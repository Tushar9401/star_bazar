import frappe
from frappe.utils import getdate, nowdate

def expire_item_schemes():

    current_date = getdate(nowdate())

    schemes = frappe.get_all(
        "Item Scheme",
        filters={"active": 1},
        fields=["name", "to_date"]
    )

    for scheme in schemes:

        if scheme.to_date and scheme.to_date < current_date:

            scheme_doc = frappe.get_doc("Item Scheme", scheme.name)

            scheme_doc.active = 0

            scheme_doc.save(ignore_permissions=True)  
            # ✅ THIS triggers on_update → revert_scheme()

            print(f"Expired → {scheme.name}")