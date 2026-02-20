from frappe.model.document import Document
import frappe
from frappe.utils import today
from frappe.utils import flt


class HoldInvoice(Document):

    def validate(self):
        """
        Validate payment amount
        """

        amount_paid = round(flt(self.amount_paid), 2)
        amount_to_be_paid = round(flt(self.grand_total), 2)

        if not amount_paid:
            return

        if amount_paid > amount_to_be_paid:
            frappe.throw("Amount Paid cannot be greater than Grand Total")

    # ✅ SAFE Auto Submit Trigger 😎🔥
    def on_update(self):

        if self.docstatus != 0:
            return

        amount_paid = round(flt(self.amount_paid), 2)
        amount_to_be_paid = round(flt(self.grand_total), 2)

        if abs(amount_paid - amount_to_be_paid) < 0.01:

            # Prevent infinite loop 😎
            if frappe.flags.in_auto_submit:
                return

            frappe.flags.in_auto_submit = True

            # Save status BEFORE submit
            self.db_set("status", "Paid")

            # Submit document safely
            self.submit()

    def before_submit(self):

        amount_paid = round(flt(self.amount_paid), 2)
        amount_to_be_paid = round(flt(self.grand_total), 2)

        if abs(amount_paid - amount_to_be_paid) >= 0.01:
            frappe.throw("Cannot submit Hold Invoice until fully paid")

    def on_submit(self):
        self.create_sales_invoice()

    def create_sales_invoice(self):

        if self.sales_invoice:
            frappe.throw("Sales Invoice already created")

        default_warehouse = frappe.db.get_single_value(
            "Stock Settings",
            "default_warehouse"
        )

        if not default_warehouse:
            frappe.throw("Please set Default Warehouse in Stock Settings")

        si = frappe.new_doc("Sales Invoice")

        si.customer = self.customer
        si.posting_date = today()
        si.due_date = today()
        si.taxes_and_charges = self.sales_tax_charges_and_template

        # ✅ ITEMS
        for item in self.items:
            si.append("items", {
                "item_code": item.item_code,
                "qty": item.qty,
                "uom": item.uom,
                "rate": item.price,
                "warehouse": default_warehouse
            })

        # ✅ COPY TAX TABLE 😎🔥
        if self.sales_taxes_and_charges:

            for tax in self.sales_taxes_and_charges:

                si.append("taxes", {
                    "charge_type": tax.charge_type,
                    "account_head": tax.account_head,
                    "description": tax.description,
                    "rate": tax.rate,
                    "tax_amount": tax.tax_amount,

                    # Optional but GOOD practice 👍
                    "cost_center": tax.cost_center
                })

        si.insert(ignore_permissions=True)

        si.calculate_taxes_and_totals()

        si.submit()

        frappe.db.set_value(self.doctype, self.name, "sales_invoice", si.name)

        self.create_payment_journal_entry(si.name)


    def create_payment_journal_entry(self, sales_invoice):

        if not self.payments:
            frappe.throw("No payment rows found")

        company = frappe.db.get_default("company")

        receivable_account = frappe.db.get_value(
            "Company",
            company,
            "default_receivable_account"
        )

        if not receivable_account:
            frappe.throw("Company Receivable Account not set")

        je = frappe.new_doc("Journal Entry")

        je.voucher_type = "Journal Entry"
        je.posting_date = frappe.utils.today()
        je.company = company
        je.user_remark = f"Payment for Sales Invoice {sales_invoice}"

        total_paid_amount = 0

        # ---------------------------------------------------
        # ✅ MULTIPLE PAYMENT MODES → MULTIPLE DEBITS
        # ---------------------------------------------------

        for payment in self.payments:

            if not payment.amount:
                continue

            account = frappe.db.get_value(
                "Mode of Payment Account",
                {
                    "parent": payment.mode_of_payment,
                    "company": company
                },
                "default_account"
            )

            if not account:
                frappe.throw(
                    f"Default account not set for Mode of Payment {payment.mode_of_payment}"
                )

            je.append("accounts", {
                "account": account,
                "debit_in_account_currency": payment.amount
            })

            total_paid_amount += payment.amount

        if total_paid_amount == 0:
            frappe.throw("Payment amount cannot be zero")

        # ---------------------------------------------------
        # ✅ SINGLE CREDIT ENTRY 😎🔥
        # ---------------------------------------------------

        je.append("accounts", {
            "account": receivable_account,
            "party_type": "Customer",
            "party": self.customer,
            "credit_in_account_currency": total_paid_amount,
            "reference_type": "Sales Invoice",
            "reference_name": sales_invoice
        })

        je.insert(ignore_permissions=True)
        je.submit()

        frappe.db.set_value(self.doctype, self.name, "journal_entry", je.name)
