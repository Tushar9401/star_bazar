// Copyright (c) 2026, Tushar Thakkar and contributors
// For license information, please see license.txt

frappe.ui.form.on("Item Scheme", {
	 item: function(frm) {
        if (frm.doc.item) {
            frappe.call({
                method: "frappe.client.get",
                args: {
                    doctype: "Item",
                    name: frm.doc.item
                },
                callback: function(r) {
                    if (r.message && r.message.barcodes && r.message.barcodes.length > 0) {
                        frm.set_value('barcode', r.message.barcodes[0].barcode);
                    }
                }
            });
        }
    },

    barcode: function(frm) {
        if (frm.doc.barcode) {
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Item",
                    filters: [
                        ["Item Barcode", "barcode", "=", frm.doc.barcode]
                    ],
                    fields: ["name"],
                    limit_page_length: 1
                },
                callback: function(r) {
                    if (r.message && r.message.length > 0) {
                        frm.set_value('item', r.message[0].name);
                    }
                }
            });
        }
    }
});
