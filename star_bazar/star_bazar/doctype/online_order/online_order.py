import frappe
from frappe.model.document import Document


class OnlineOrder(Document):

    def after_insert(self):
        frappe.msgprint("New Online Order Created")