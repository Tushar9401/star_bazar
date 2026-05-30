import frappe
from frappe.utils import flt, nowdate


def update_item_price_from_standard_rate(doc, method=None):
    if not doc.item_code or not doc.standard_rate:
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
