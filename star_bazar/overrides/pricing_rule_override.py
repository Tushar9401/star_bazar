# import math
# import frappe
# from erpnext.accounts.doctype.pricing_rule.pricing_rule import (
#     apply_pricing_rule as original_apply_pricing_rule
# )


# @frappe.whitelist()
# def apply_pricing_rule(args):

#     result = original_apply_pricing_rule(args)

#     # POS sends list of items
#     if isinstance(result, list):
#         for row in result:
#             _apply_block_logic(row)
#         return result

#     # Single dict case
#     _apply_block_logic(result)
#     return result


# def _apply_block_logic(result):

#     if not result or not isinstance(result, dict):
#         return

#     if not result.get("pricing_rule"):
#         return

#     rule = frappe.get_doc("Pricing Rule", result["pricing_rule"])

#     if not rule.min_qty:
#         return

#     qty = float(result.get("qty") or 0)
#     min_qty = float(rule.min_qty)

#     if qty <= min_qty:
#         return

#     original_rate = float(result.get("price_list_rate") or 0)
#     offer_rate = float(rule.rate)

#     full_sets = math.floor(qty / min_qty)
#     remaining = qty % min_qty

#     offer_total = offer_rate * min_qty

#     total = (full_sets * offer_total) + (remaining * original_rate)

#     result["rate"] = total / qty