import frappe
from frappe.model.document import Document
from frappe.utils import flt, nowdate

ITEM_TAX_SETTINGS = {
    "Food": {
        "template": "Food Tax - SB",
        "custom_food_stamp_enable": 1,
        "custom_non_food": 0,
        "custom_tobaco": 0,
    },
    "Non Food": {
        "template": "Non Food Tax - SB",
        "custom_food_stamp_enable": 0,
        "custom_non_food": 1,
        "custom_tobaco": 0,
    },
    "Tobacco": {
        "template": "Tobacco Tax - SB",
        "custom_food_stamp_enable": 0,
        "custom_non_food": 0,
        "custom_tobaco": 1,
    },
}


class ItemScheme(Document):

    def validate(self):
        self.validate_items()
        self.validate_single_scheme()
        self.validate_active_scheme_conflicts()
        self.validate_purchase_rate()

    def after_insert(self):
        if self.active == 1:
            self.apply_scheme()

    def on_update(self):
        if self.active == 1:
            self.apply_scheme()
        else:
            self.revert_scheme()

    def validate_single_scheme(self):

        if self.is_combo_scheme():
            return

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

    def validate_items(self):

        if self.is_combo_scheme():
            combo_items = self.get_combo_items()

            if len(combo_items) < 2:
                frappe.throw("Please add at least two Combo Items for a combo scheme.")

            if flt(self.qty) <= 0:
                frappe.throw("Qty must be greater than zero.")

            seen_items = set()

            for row in combo_items:
                if row.item in seen_items:
                    frappe.throw(f"Duplicate combo item found: <b>{row.item}</b>.")

                seen_items.add(row.item)

            return

        if not self.item:
            frappe.throw("Please select an Item for a single item scheme.")

        if flt(self.qty) <= 0:
            frappe.throw("Qty must be greater than zero.")

    def validate_active_scheme_conflicts(self):
        if not self.active:
            return

        for item in self.get_scheme_items():
            conflict = self.get_active_scheme_conflict(item["item_code"])

            if conflict:
                frappe.throw(
                    f"Item <b>{item['item_code']}</b> already has active scheme "
                    f"<b>{conflict}</b>. <br><br>"
                    "Only one active scheme can be applied to an item at a time."
                )

    def get_active_scheme_conflict(self, item_code):
        single_scheme = frappe.db.get_value(
            "Item Scheme",
            {
                "active": 1,
                "item": item_code,
                "name": ["!=", self.name],
            },
            "scheme_name",
        )

        if single_scheme:
            return single_scheme

        combo_scheme = frappe.db.sql(
            """
            SELECT scheme.scheme_name
            FROM `tabItem Scheme Item` scheme_item
            INNER JOIN `tabItem Scheme` scheme
                ON scheme.name = scheme_item.parent
            WHERE
                scheme.active = 1
                AND scheme.name != %(current_scheme)s
                AND scheme_item.item = %(item_code)s
            LIMIT 1
            """,
            {
                "current_scheme": self.name,
                "item_code": item_code,
            },
            as_dict=True,
        )

        if combo_scheme:
            return combo_scheme[0].scheme_name

        return None

    def is_combo_scheme(self):
        scheme_type = self.get("scheme_type")

        if scheme_type:
            return scheme_type == "Combo Item"

        return len(self.get_combo_items()) > 0

    def validate_purchase_rate(self):

        if not self.active:
            return

        for item in self.get_scheme_items():
            purchase_rate = flt(frappe.db.get_value(
                "Item",
                item["item_code"],
                "custom_item_purchase_rate"
            ))

            if purchase_rate <= 0:
                frappe.throw(
                    f"Item Purchase Rate is missing or zero for Item: <b>{item['item_code']}</b>. "
                    "Please set the Item Purchase Rate in Item Master before creating an active scheme."
                )

    def get_combo_items(self):
        return [
            row for row in (self.get("combo_items") or [])
            if row.item
        ]

    def get_scheme_items(self):
        if self.is_combo_scheme():
            return [
                {
                    "item_code": row.item,
                    "qty": 1,
                }
                for row in self.get_combo_items()
            ]

        return [{
            "item_code": self.item,
            "qty": flt(self.qty),
        }]

    def get_purchase_rate(self):
        if self.is_combo_scheme():
            purchase_rates = [
                flt(frappe.db.get_value(
                    "Item",
                    row.item,
                    "custom_item_purchase_rate"
                ))
                for row in self.get_combo_items()
            ]

            return (max(purchase_rates) if purchase_rates else 0) * flt(self.qty)

        purchase_rate = 0

        for item in self.get_scheme_items():
            purchase_rate += flt(frappe.db.get_value(
                "Item",
                item["item_code"],
                "custom_item_purchase_rate"
            )) * flt(item["qty"])

        return purchase_rate

    def apply_scheme(self):

        purchase_rate = self.get_purchase_rate()

        if not frappe.db.exists("Item", self.scheme_name):
            item_doc = frappe.get_doc({
                "doctype": "Item",
                "item_code": self.scheme_name,
                "item_name": self.scheme_name,
                "is_stock_item": 0,
                "standard_rate": self.selling_price,
                "custom_item_purchase_rate": purchase_rate,
                "item_group": "Scheme"
            })

            item_doc.insert(ignore_permissions=True)
        else:
            item_doc = frappe.get_doc("Item", self.scheme_name)
            item_doc.disabled = 0
            item_doc.standard_rate = self.selling_price
            item_doc.custom_item_purchase_rate = purchase_rate
            item_doc.item_group = "Scheme"

        self.apply_item_tax(item_doc)
        item_doc.save(ignore_permissions=True)

        if self.is_combo_scheme():
            self.disable_product_bundle()
            self.clear_linked_items()
        else:
            self.apply_product_bundle()
            frappe.db.set_value(
                "Item",
                self.item,
                {
                    "custom_bundle_item_code": self.scheme_name,
                    "custom_bundle_qty": self.qty
                }
            )

    def apply_product_bundle(self):

        bundle_name = frappe.db.get_value(
            "Product Bundle",
            {"new_item_code": self.scheme_name},
            "name"
        )

        bundle_items = self.get_scheme_items()

        if bundle_name:
            bundle_doc = frappe.get_doc("Product Bundle", bundle_name)
            bundle_doc.disabled = 0
            bundle_doc.set("items", bundle_items)
            bundle_doc.save(ignore_permissions=True)
        else:
            bundle_doc = frappe.get_doc({
                "doctype": "Product Bundle",
                "new_item_code": self.scheme_name,
                "items": bundle_items
            })

            bundle_doc.insert(ignore_permissions=True)

    def apply_item_tax(self, item_doc):
        tax_type = self.tax_type or "Non Food"
        tax_settings = ITEM_TAX_SETTINGS.get(tax_type)

        if not tax_settings:
            frappe.throw(f"Invalid Tax Type selected: <b>{tax_type}</b>.")

        for fieldname in ("custom_food_stamp_enable", "custom_non_food", "custom_tobaco"):
            item_doc.set(fieldname, tax_settings[fieldname])

        item_doc.set("taxes", [])
        item_doc.append("taxes", {
            "item_tax_template": tax_settings["template"],
        })

    def disable_product_bundle(self):
        bundle_name = frappe.db.get_value(
            "Product Bundle",
            {"new_item_code": self.scheme_name},
            "name"
        )

        if bundle_name:
            frappe.db.set_value(
                "Product Bundle",
                bundle_name,
                "disabled",
                1
            )

    def revert_scheme(self):

        bundle_name = frappe.db.get_value(
            "Product Bundle",
            {"new_item_code": self.scheme_name},
            "name"
        )

        if bundle_name:
            frappe.db.set_value(
                "Product Bundle",
                bundle_name,
                "disabled",
                1
            )

        self.clear_linked_items()

        if frappe.db.exists("Item", self.scheme_name):
            frappe.db.set_value(
                "Item",
                self.scheme_name,
                "disabled",
                1
            )

    def clear_linked_items(self):
        linked_items = frappe.get_all(
            "Item",
            filters={"custom_bundle_item_code": self.scheme_name},
            pluck="name"
        )

        for item_code in linked_items:
            frappe.db.set_value(
                "Item",
                item_code,
                {
                    "custom_bundle_item_code": None,
                    "custom_bundle_qty": 0
                }
            )


@frappe.whitelist()
def get_active_combo_schemes():
    schemes = frappe.get_all(
        "Item Scheme",
        filters={
            "active": 1,
            "from_date": ["<=", nowdate()],
            "to_date": [">=", nowdate()],
        },
        fields=["name", "scheme_name", "scheme_type", "qty", "selling_price"],
    )

    combo_schemes = []

    for scheme in schemes:
        if scheme.scheme_type == "Single Item":
            continue

        items = frappe.get_all(
            "Item Scheme Item",
            filters={"parent": scheme.name, "parenttype": "Item Scheme"},
            fields=["item"],
            order_by="idx asc",
        )
        items = [
            {
                "item_code": row.item,
            }
            for row in items
            if row.item
        ]

        if len(items) < 2 or flt(scheme.qty) <= 0:
            continue

        combo_schemes.append({
            "scheme_name": scheme.scheme_name,
            "selling_price": flt(scheme.selling_price),
            "required_qty": flt(scheme.qty),
            "items": items,
        })

    return combo_schemes
