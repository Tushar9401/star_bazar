from frappe.model.document import Document
import frappe
from frappe.utils import today


class HoldInvoice(Document):

    def on_submit(self):
        self.create_sales_invoice()

    def create_sales_invoice(self):

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

        # ✅ Update Stock
        si.update_stock = 1

        # ✅ Items
        for item in self.items:
            si.append("items", {
                "item_code": item.item_code,
                "qty": item.qty,
                "uom": item.uom,
                "rate": item.price,
                "amount": item.amount,
                "warehouse": default_warehouse
            })

        # ✅ Insert FIRST
        si.insert(ignore_permissions=True)

        # ✅ Link Back (AFTER insert)
        self.sales_invoice = si.name
        frappe.db.set_value(self.doctype, self.name, "sales_invoice", si.name)

        # ✅ Submit SI
        si.submit()

        frappe.msgprint(f"Sales Invoice {si.name} Created")
