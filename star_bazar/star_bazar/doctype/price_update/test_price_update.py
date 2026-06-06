# Copyright (c) 2026, Tushar Thakkar and Contributors
# See license.txt

# import frappe
from frappe.tests.utils import FrappeTestCase
from star_bazar.item import calculate_margin


class TestPriceUpdate(FrappeTestCase):
	def test_calculate_margin_uses_selling_price(self):
		self.assertEqual(calculate_margin(100, 75), 25)

	def test_calculate_margin_returns_zero_for_missing_rates(self):
		self.assertEqual(calculate_margin(0, 75), 0)
		self.assertEqual(calculate_margin(100, 0), 0)
