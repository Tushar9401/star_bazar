import frappe

DEFAULT_WAREHOUSE = frappe.db.get_single_value("Stock Settings", "default_warehouse")

DEFAULT_WAREHOUSE = "Stores - SB"

def update_hold_stock(doc, method):

    for item in doc.items:

        previous_reserved = item.custom_stock_reserved_quantity or 0
        current_qty = item.qty or 0

        difference = current_qty - previous_reserved

        if difference == 0:
            continue

        if difference > 0:
            create_stock_entry(
                item_code=item.item_code,
                qty=difference,
                warehouse=DEFAULT_WAREHOUSE,
                item_group=item.item_group,
                entry_type="Material Issue"
            )

        elif difference < 0:
            create_stock_entry(
                item_code=item.item_code,
                item_group=item.item_group,
                qty=abs(difference),
                warehouse=DEFAULT_WAREHOUSE,
                entry_type="Material Receipt"
            )

        # ✅ Update child row directly (no save)
        frappe.db.set_value(
            item.doctype,
            item.name,
            "custom_stock_reserved_quantity",
            current_qty
        )

def restore_hold_stock(doc, method):

    warehouse = DEFAULT_WAREHOUSE

    for item in doc.items:

        reserved = item.custom_stock_reserved_quantity or 0

        if reserved <= 0:
            continue

        create_stock_entry(
            item_code=item.item_code,
            item_group=item.item_group,
            qty=reserved,
            warehouse=warehouse,
            entry_type="Material Receipt"
        )
                
def create_stock_entry(item_code, item_group, qty, warehouse, entry_type):
    

    company = frappe.defaults.get_user_default("Company")

    # ✅ SCHEME LOGIC
    if item_group == "Scheme":

        bundle_name = frappe.db.get_value(
            "Product Bundle",
            {"new_item_code": item_code},
            "name"
        )

        if bundle_name:
            bundle_items = frappe.get_all(
                "Product Bundle Item",
                filters={"parent": bundle_name},
                fields=["item_code", "qty", "uom"]
            )

            for bi in bundle_items:
                se = frappe.get_doc({
                    "doctype": "Stock Entry",
                    "stock_entry_type": entry_type,
                    "company": company,
                    "items": [{
                        "item_code": bi.item_code,
                        "qty": bi.qty * qty,   # ✅ multiply by scheme qty
                        "s_warehouse": warehouse if entry_type == "Material Issue" else None,
                        "t_warehouse": warehouse if entry_type == "Material Receipt" else None
                    }]
                })

                se.insert(ignore_permissions=True)
                se.submit()

            return   # ✅ STOP further execution for scheme item

    # ✅ NORMAL ITEM LOGIC
    se = frappe.get_doc({
        "doctype": "Stock Entry",
        "stock_entry_type": entry_type,
        "company": company,
        "items": [{
            "item_code": item_code,
            "qty": qty,
            "s_warehouse": warehouse if entry_type == "Material Issue" else None,
            "t_warehouse": warehouse if entry_type == "Material Receipt" else None
        }]
    })

    se.insert(ignore_permissions=True)
    se.submit()