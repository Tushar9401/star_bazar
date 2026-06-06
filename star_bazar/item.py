import frappe
from frappe.utils import flt, nowdate


def calculate_margin(selling_rate, purchase_rate):
    selling_rate = flt(selling_rate)
    purchase_rate = flt(purchase_rate)

    if selling_rate <= 0 or purchase_rate <= 0:
        return 0

    return flt(((selling_rate - purchase_rate) / selling_rate) * 100, 2)


def update_item_margin(doc, method=None):
    if not doc.meta.has_field("custom_margin"):
        return

    doc.custom_margin = calculate_margin(
        doc.standard_rate,
        doc.custom_item_purchase_rate,
    )


def update_item_price_from_standard_rate(doc, method=None):
    if not doc.item_code or not doc.standard_rate:
        return

    if not doc.is_new() and not doc.has_value_changed("standard_rate"):
        return

    price_list_name = "Standard Selling"
    standard_rate = flt(doc.standard_rate)
    currency = frappe.db.get_default("currency") or "USD"

    item_price = frappe.db.sql(
        """
        SELECT name
        FROM `tabItem Price`
        WHERE
            item_code = %(item_code)s
            AND price_list = %(price_list)s
            AND selling = 1
            AND IFNULL(valid_from, '1900-01-01') <= %(today)s
            AND IFNULL(valid_upto, '2999-12-31') >= %(today)s
        ORDER BY
            IFNULL(valid_from, '1900-01-01') DESC,
            modified DESC,
            creation DESC
        LIMIT 1
        """,
        {
            "item_code": doc.item_code,
            "price_list": price_list_name,
            "today": nowdate(),
        },
        as_dict=True,
    )

    if item_price:
        price_doc = frappe.get_doc("Item Price", item_price[0].name)
        price_doc.price_list_rate = standard_rate
        price_doc.save(ignore_permissions=True)
        return

    frappe.get_doc(
        {
            "doctype": "Item Price",
            "price_list": price_list_name,
            "item_code": doc.item_code,
            "price_list_rate": standard_rate,
            "selling": 1,
            "currency": currency,
            "valid_from": nowdate(),
            "reference": doc.name,
        }
    ).insert(ignore_permissions=True)


def update_item_standard_rate(item_code, standard_rate):
    if not item_code or not standard_rate:
        return

    standard_rate = flt(standard_rate)
    item_values = frappe.db.get_value(
        "Item",
        item_code,
        ["standard_rate", "custom_item_purchase_rate"],
        as_dict=True,
    )

    if not item_values:
        return

    values = {}

    if flt(item_values.standard_rate) != standard_rate:
        values["standard_rate"] = standard_rate

    if frappe.get_meta("Item").has_field("custom_margin"):
        margin = calculate_margin(
            standard_rate,
            item_values.custom_item_purchase_rate,
        )
        current_margin = flt(
            frappe.db.get_value("Item", item_code, "custom_margin")
        )
        if current_margin != margin:
            values["custom_margin"] = margin

    if values:
        frappe.db.set_value(
            "Item",
            item_code,
            values,
            update_modified=False,
        )
