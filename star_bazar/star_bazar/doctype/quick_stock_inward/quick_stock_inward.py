import frappe
from frappe.model.document import Document
from frappe.utils import flt, nowdate
from star_bazar.item import update_item_standard_rate


class QuickStockInward(Document):
    
    def validate(self):
    
        if not self.items:
            frappe.throw("At least one item is required")

        for row in self.items:
            if not row.purchase_rate or row.purchase_rate == 0:
                frappe.throw(
                    f"Purchase Rate is missing or zero for Item: <b>{row.item_code}</b> (Row #{row.idx}). "
                    "Please set the Purchase Rate in Item Master."
                )

           
    def on_submit(self):

        price_list_name = "Standard Selling"
        currency = frappe.db.get_default("currency") or "USD"
        valid_from = self.posting_date or nowdate()

        # ---------------------------------------------------
        # ITEM PRICE LOGIC
        # ---------------------------------------------------

        for row in (self.items or []):

            if not row.sales_rate:
                continue

            sales_rate = flt(row.sales_rate)

            existing_price = frappe.db.exists(
                "Item Price",
                {
                    "item_code": row.item_code,
                    "price_list": price_list_name,
                    "selling": 1,
                    "valid_from": valid_from
                },
            )

            if existing_price:
                ip = frappe.get_doc("Item Price", existing_price)
                ip.price_list_rate = sales_rate
                ip.save(ignore_permissions=True)

            else:
                new_ip = frappe.get_doc({
                    "doctype": "Item Price",
                    "price_list": price_list_name,
                    "item_code": row.item_code,
                    "price_list_rate": sales_rate,
                    "selling": 1,
                    "currency": currency,
                    "valid_from": valid_from,
                    "reference": self.name,
                })

                new_ip.insert(ignore_permissions=True)

            update_item_standard_rate(row.item_code, sales_rate)

        # ---------------------------------------------------
        # STOCK ENTRY PREPARATION
        # ---------------------------------------------------

        if not self.warehouse:
            frappe.throw("Warehouse is mandatory")

        stock_items = []

        for row in (self.items or []):

            qty = flt(row.incoming_qty)

            if qty <= 0:
                continue

            if not row.purchase_rate:
                frappe.throw(f"Purchase Rate missing for Item {row.item_code}")

            rate = flt(row.purchase_rate)

            stock_items.append({
                "item_code": row.item_code,
                "qty": qty,
                "t_warehouse": self.warehouse,
                "basic_rate": rate,
                "valuation_rate": rate,
            })

        if not stock_items:
            frappe.throw("No valid items found for Stock Entry")

        # ---------------------------------------------------
        # CREATE STOCK ENTRY
        # ---------------------------------------------------

        se = frappe.get_doc({
            "doctype": "Stock Entry",
            "stock_entry_type": "Material Receipt",
            "company": frappe.db.get_default("company"),
            "posting_date": self.posting_date or nowdate(),
            "items": stock_items,
            "remarks": f"Material receipt created from Quick Stock Inward {self.name}",
        })

        se.insert(ignore_permissions=True)
        se.submit()

        frappe.db.set_value(self.doctype, self.name, "stock_entry", se.name)

    def on_cancel(self):

        if self.stock_entry:

            se = frappe.get_doc("Stock Entry", self.stock_entry)

            if se.docstatus == 1:
                se.cancel()

        item_prices = frappe.get_all(
            "Item Price",
            filters={"reference": self.name},
            fields=["name"]
        )

        for ip in item_prices:
            frappe.delete_doc("Item Price", ip.name, ignore_permissions=True)
