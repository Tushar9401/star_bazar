import frappe
from frappe.model.document import Document

class ItemScheme(Document):

    def validate(self):
        self.validate_single_scheme()

    def after_insert(self):
        if self.active == 1:
            self.apply_scheme()

    def on_update(self):
        if self.active == 1:
            self.apply_scheme()
        else:
            self.revert_scheme()

    def validate_single_scheme(self):

        if not self.item:
            return

        existing_scheme = frappe.db.get_value(
            "Item",
            self.item,
            "custom_bundle_item_code"
        )

        # ✅ If scheme already linked AND not this scheme → block
        if existing_scheme and existing_scheme != self.scheme_name:
            frappe.throw(
                f"Item <b>{self.item}</b> already has scheme "
                f"<b>{existing_scheme}</b>. <br><br>"
                f"Only one scheme can be applied at a time."
            )

    def apply_scheme(self):

        if not frappe.db.exists("Item", self.scheme_name):

            item_doc = frappe.get_doc({
                "doctype": "Item",
                "item_code": self.scheme_name,
                "item_name": self.scheme_name,
                "is_stock_item": 0,
                "standard_rate": self.selling_price,
                "item_group": "Scheme"
            })

            item_doc.insert(ignore_permissions=True)

        if self.item and not frappe.db.exists("Product Bundle", {"new_item_code": self.scheme_name}):

            bundle_doc = frappe.get_doc({
                "doctype": "Product Bundle",
                "new_item_code": self.scheme_name,
                "items": [{
                    "item_code": self.item,
                    "qty": self.qty
                }]
            })

            bundle_doc.insert(ignore_permissions=True)

        if self.item:
            frappe.db.set_value(
                "Item",
                self.item,
                {
                    "custom_bundle_item_code": self.scheme_name,
                    "custom_bundle_qty": self.qty
                }
            )

    def revert_scheme(self):

        bundle_name = frappe.db.get_value(
            "Product Bundle",
            {"new_item_code": self.scheme_name},
            "name"
        )

        if bundle_name:
            frappe.delete_doc("Product Bundle", bundle_name, ignore_permissions=True)

        if self.item:
            frappe.db.set_value(
                "Item",
                self.item,
                {
                    "custom_bundle_item_code": None,
                    "custom_bundle_qty": 0
                }
            )

        if frappe.db.exists("Item", self.scheme_name):
            frappe.db.set_value(
                "Item",
                self.scheme_name,
                "disabled",
                1
            )
            frappe.delete_doc("Item", self.scheme_name, ignore_permissions=True)