// Copyright (c) 2026, Tushar Thakkar and contributors
// For license information, please see license.txt

frappe.query_reports["Daily Sales Report"] = {
  "filters": [
    {
      "fieldname": "from_date",
      "label": "From Date",
      "fieldtype": "Date",
      "default": "Today",
      "reqd": 1
    },
    {
      "fieldname": "to_date",
      "label": "To Date",
      "fieldtype": "Date",
      "default": "Today",
      "reqd": 1
    },
    {
      "fieldname": "pos_profile",
      "label": "POS Profile",
      "fieldtype": "Link",
      "options": "POS Profile",
      "reqd": 0
    }
  ]
};
