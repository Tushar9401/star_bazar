import frappe

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
                entry_type="Material Issue"
            )

        elif difference < 0:
            create_stock_entry(
                item_code=item.item_code,
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
            qty=reserved,
            warehouse=warehouse,
            entry_type="Material Receipt"
        )
                
def create_stock_entry(item_code, qty, warehouse, entry_type):

    company = frappe.defaults.get_user_default("Company")

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

import frappe

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
                entry_type="Material Issue"
            )

        elif difference < 0:
            create_stock_entry(
                item_code=item.item_code,
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
            qty=reserved,
            warehouse=warehouse,
            entry_type="Material Receipt"
        )
                
def create_stock_entry(item_code, qty, warehouse, entry_type):

    company = frappe.defaults.get_user_default("Company")

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