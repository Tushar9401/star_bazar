import frappe


def execute():
    if not frappe.get_meta("Item").has_field("custom_margin"):
        return

    frappe.db.sql(
        """
        UPDATE `tabItem`
        SET custom_margin = CASE
            WHEN IFNULL(standard_rate, 0) > 0
                AND IFNULL(custom_item_purchase_rate, 0) > 0
            THEN ROUND(
                (
                    (standard_rate - custom_item_purchase_rate)
                    / standard_rate
                ) * 100,
                2
            )
            ELSE 0
        END
        """
    )
