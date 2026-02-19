from frappe.model.document import Document
import frappe
from frappe.utils import today


class HoldInvoice(Document):

    def on_submit(self):
        self.create_sales_invoice()

    def create_sales_invoice(self):

        # ✅ Prevent Duplicate SI
        if self.sales_invoice:
            frappe.throw("Sales Invoice already created")

        # ✅ Fetch Default Warehouse
        default_warehouse = frappe.db.get_single_value(
            "Stock Settings",
            "default_warehouse"
        )

        if not default_warehouse:
            frappe.throw("Please set Default Warehouse in Stock Settings")

        si = frappe.new_doc("Sales Invoice")

        # ✅ Basic Fields
        si.customer = self.customer
        si.posting_date = today()
        si.due_date = today()

        # ✅ VERY IMPORTANT → Tax Template
        si.taxes_and_charges = self.sales_tax_charges_and_template

        # ✅ Update Stock
        si.update_stock = 1

        # ✅ Items
        for item in self.items:
            si.append("items", {
                "item_code": item.item_code,
                "qty": item.qty,
                "uom": item.uom,
                "rate": item.price,
                "warehouse": default_warehouse
            })

        # ✅ Taxes Table (CRITICAL)
        if self.sales_taxes_and_charges:

            for tax in self.sales_taxes_and_charges:
                si.append("taxes", {
                    "charge_type": tax.charge_type,
                    "account_head": tax.account_head,
					"description": tax.description,	
                    "rate": tax.rate,
                    "tax_amount": tax.tax_amount
                })

        # ✅ Insert FIRST
        si.insert(ignore_permissions=True)

        # ✅ Let ERPNext Recalculate Properly
        si.calculate_taxes_and_totals()

        # ✅ Submit SI
        si.submit()

        # ✅ Link Back
        self.sales_invoice = si.name
        frappe.db.set_value(self.doctype, self.name, "sales_invoice", si.name)

        
