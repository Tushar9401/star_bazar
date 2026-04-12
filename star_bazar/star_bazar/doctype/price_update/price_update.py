import frappe
from frappe.model.document import Document
from frappe.utils import flt, nowdate


class PriceUpdate(Document):

    def validate(self):

        if not self.item_code:
            return

        if not self.new_sales_price:
            return

        price_list_name = "Standard Selling"
        currency = frappe.db.get_default("currency") or "USD"
        valid_from = nowdate()

        sales_rate = flt(self.new_sales_price)

        existing_price = frappe.db.exists(
            "Item Price",
            {
                "item_code": self.item_code,
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
                "item_code": self.item_code,
                "price_list_rate": sales_rate,
                "selling": 1,
                "currency": currency,
                "valid_from": valid_from,
                "reference": self.name,
            })

            new_ip.insert(ignore_permissions=True)
        if self.new_purchase_price and self.item_code:
    
            item_doc = frappe.get_doc("Item", self.item_code)
            
            current_rate = flt(item_doc.custom_item_purchase_rate)
            new_rate = flt(self.new_purchase_price)

            if current_rate != new_rate:
                item_doc.custom_item_purchase_rate = new_rate
                item_doc.save(ignore_permissions=True)
