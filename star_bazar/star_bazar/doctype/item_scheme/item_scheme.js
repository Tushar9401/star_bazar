// Copyright (c) 2026, Tushar Thakkar and contributors
// For license information, please see license.txt

frappe.ui.form.on("Item Scheme", {
    setup: function(frm) {
        set_scheme_type_if_missing(frm);
    },

    refresh: function(frm) {
        set_scheme_type_if_missing(frm);
        apply_scheme_type_layout(frm);
    },

    scheme_type: function(frm) {
        apply_scheme_type_layout(frm);
    },

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

function set_scheme_type_if_missing(frm) {
    if (frm.doc.scheme_type) return;

    const has_combo_items = (frm.doc.combo_items || []).some(row => row.item || row.qty || row.barcode);
    frm.set_value("scheme_type", has_combo_items ? "Combo Item" : "Single Item");
}

function apply_scheme_type_layout(frm) {
    const is_single_item = frm.doc.scheme_type === "Single Item";
    const is_combo_item = frm.doc.scheme_type === "Combo Item";

    frm.toggle_display(["section_break_iqwg", "barcode", "item", "column_break_pptl", "qty"], is_single_item);
    frm.toggle_display(["combo_section", "combo_items"], is_combo_item);

    frm.toggle_reqd("item", is_single_item);
    frm.toggle_reqd("qty", is_single_item);
    frm.toggle_reqd("combo_items", is_combo_item);
}

frappe.ui.form.on("Item Scheme Item", {
    item: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];

        if (!row.item) return;

        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Item",
                name: row.item
            },
            callback: function(r) {
                if (r.message && r.message.barcodes && r.message.barcodes.length > 0) {
                    frappe.model.set_value(cdt, cdn, "barcode", r.message.barcodes[0].barcode);
                }
            }
        });
    },

    barcode: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];

        if (!row.barcode) return;

        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Item",
                filters: [
                    ["Item Barcode", "barcode", "=", row.barcode]
                ],
                fields: ["name"],
                limit_page_length: 1
            },
            callback: function(r) {
                if (r.message && r.message.length > 0) {
                    frappe.model.set_value(cdt, cdn, "item", r.message[0].name);
                }
            }
        });
    }
});
