# Copyright (c) 2026, Tushar Thakkar and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import flt


def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    return columns, data


def get_columns():
    return [
        {
            "label": "Label",
            "fieldname": "label",
            "fieldtype": "Data",
            "width": 300
        },
        {
            "label": "Amount",
            "fieldname": "amount",
            "fieldtype": "Currency",
            "width": 200
        },
    ]


def get_data(filters):
    conditions = "pi.docstatus = 1 AND pi.status IN ('Paid', 'Consolidated')"

    if filters.get("from_date"):
        conditions += " AND pi.posting_date >= %(from_date)s"

    if filters.get("to_date"):
        conditions += " AND pi.posting_date <= %(to_date)s"

    if filters.get("pos_profile"):
        conditions += " AND pi.pos_profile = %(pos_profile)s"

    # ✅ Step 1: Invoice level totals
    invoice_totals = frappe.db.sql(
        f"""
        SELECT
            SUM(net_total)               AS total_net_sales,
            SUM(total_taxes_and_charges) AS total_tax,
            SUM(grand_total)             AS total_grand
        FROM
            `tabPOS Invoice` pi
        WHERE
            {conditions}
        """,
        filters,
        as_dict=True
    )

    total_net_sales = flt(invoice_totals[0].total_net_sales) if invoice_totals else 0
    total_tax       = flt(invoice_totals[0].total_tax)       if invoice_totals else 0
    total_grand     = flt(invoice_totals[0].total_grand)     if invoice_totals else 0

    # ✅ Step 2: Net sales grouped by item_tax_template
    item_rows = frappe.db.sql(
        f"""
        SELECT
            pii.item_tax_template   AS template,
            SUM(pii.net_amount)     AS net_sales
        FROM
            `tabPOS Invoice Item` pii
        INNER JOIN
            `tabPOS Invoice` pi ON pi.name = pii.parent
        WHERE
            {conditions}
        GROUP BY
            pii.item_tax_template
        ORDER BY
            pii.item_tax_template
        """,
        filters,
        as_dict=True
    )

    # ✅ Step 3: Fetch tax rate per template
    template_rates = {}
    templates = set(r.template for r in item_rows if r.template)

    for template in templates:
        rate = frappe.db.sql(
            """
            SELECT tax_rate
            FROM `tabItem Tax Template Detail`
            WHERE parent = %s
            LIMIT 1
            """,
            template,
            as_dict=True
        )
        template_rates[template] = flt(rate[0].tax_rate) if rate else 0

    # ✅ Step 4: Payment mode totals from POS Invoice Payment child table
    payment_rows = frappe.db.sql(
        f"""
        SELECT
            pip.mode_of_payment,
            SUM(pip.amount)     AS total_amount
        FROM
            `tabSales Invoice Payment` pip
        INNER JOIN
            `tabPOS Invoice` pi ON pi.name = pip.parent
        WHERE
            {conditions}
        GROUP BY
            pip.mode_of_payment
        ORDER BY
            pip.mode_of_payment
        """,
        filters,
        as_dict=True
    )

    # ✅ Step 5: Build receipt style data
    data = []

    # 1️⃣ Net Sales
    data.append({
        "label" : "Net Sales",
        "amount": total_net_sales,
    })

    # 2️⃣ Each tax template breakdown
    for row in item_rows:
        template   = row.template or "No Tax Template"
        net_sales  = flt(row.net_sales)
        tax_rate   = template_rates.get(row.template, 0)
        tax_amount = net_sales * (tax_rate / 100)

        if tax_rate > 0:
            data.append({
                "label" : f"  {template} ({tax_rate}%)",
                "amount": tax_amount,
            })

    # 3️⃣ Total Tax
    data.append({
        "label" : "Total Tax",
        "amount": total_tax,
    })

    # Blank separator
    data.append({})

    # 4️⃣ Grand Total
    data.append({
        "label" : "Grand Total",
        "amount": total_grand,
    })

    # Blank separator
    data.append({})

    # 5️⃣ Payment breakdown header
    data.append({
        "label" : "── Payment Received ──",
        "amount": "",
    })

    # 6️⃣ Each payment mode
    total_payments = 0
    for pay in payment_rows:
        amt = flt(pay.total_amount)
        total_payments += amt
        data.append({
            "label" : f"  {pay.mode_of_payment}",
            "amount": amt,
        })

    # 7️⃣ Total Payments received
    data.append({
        "label" : "Total Payments",
        "amount": total_payments,
    })

    return data