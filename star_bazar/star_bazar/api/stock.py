import frappe
from frappe.utils import today

@frappe.whitelist()
def get_pending_pos_qty(item_codes):

    item_codes = frappe.parse_json(item_codes)

    if not item_codes:
        return []

    invoices = frappe.get_all(
        "POS Invoice",
        filters={
            "docstatus": 1,
            "is_return": 0,
            "posting_date": today(),
        },
        fields=["name"]
    )

    if not invoices:
        return []

    invoice_names = [inv.name for inv in invoices]

    qty_map = {}

    # 1️⃣ Get packed items first (bundle children)
    packed_items = frappe.get_all(
        "Packed Item",
        filters={
            "parent": ["in", invoice_names],
            "item_code": ["in", item_codes]
        },
        fields=["item_code", "qty"]
    )

    packed_item_codes = set()

    for row in packed_items:
        packed_item_codes.add(row.item_code)
        qty_map[row.item_code] = qty_map.get(row.item_code, 0) + row.qty

    # 2️⃣ Get normal items (exclude ones already counted via bundle)
    normal_items = frappe.get_all(
        "POS Invoice Item",
        filters={
            "parent": ["in", invoice_names],
            "item_code": ["in", item_codes]
        },
        fields=["item_code", "qty"]
    )

    for row in normal_items:
        if row.item_code not in packed_item_codes:
            qty_map[row.item_code] = qty_map.get(row.item_code, 0) + row.qty

    return [
        {"item_code": item, "sold_qty": qty}
        for item, qty in qty_map.items()
    ]