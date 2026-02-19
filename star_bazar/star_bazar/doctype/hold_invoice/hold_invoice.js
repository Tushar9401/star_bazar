frappe.ui.form.on("Hold Invoice", {

    refresh: function(frm) {

        // ✅ Fetch Default Tax Template
        if (!frm.doc.sales_tax_charges_and_template) {

            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Sales Taxes and Charges Template",
                    filters: { is_default: 1 },
                    fields: ["name"],
                    limit: 1
                },

                callback: function(r) {

                    if (r.message && r.message.length) {

                        frm.set_value(
                            "sales_tax_charges_and_template",
                            r.message[0].name
                        );

                        calculate_totals(frm);
                    }
                }
            });
        }
    },

    sales_tax_charges_and_template: function(frm) {
        calculate_totals(frm);
    },

    scan_barcode: function(frm) {

        if (!frm.doc.scan_barcode) return;

        let barcode = frm.doc.scan_barcode;

        // ✅ Resolve Item via Barcode
        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Item Barcode",
                filters: { barcode: barcode },
                fieldname: ["parent"],
                parent: "Item"
            },

            callback: function(r) {

                if (!r.message) {

                    frappe.show_alert({
                        message: __("Invalid Barcode"),
                        indicator: "red"
                    });

                    reset_scanner(frm);
                    return;
                }

                let item_code = r.message.parent;

                // ✅ Fetch Item Details
                frappe.call({
                    method: "frappe.client.get_value",
                    args: {
                        doctype: "Item",
                        filters: { name: item_code },
                        fieldname: ["item_name", "stock_uom"]
                    },

                    callback: function(item) {

                        if (!item.message) {
                            reset_scanner(frm);
                            return;
                        }

                        handle_item_row(
                            frm,
                            barcode,
                            item_code,
                            item.message.item_name,
                            item.message.stock_uom
                        );
                    }
                });
            }
        });
    }
});


// ✅ FETCH ITEM PRICE
function handle_item_row(frm, barcode, item_code, item_name, uom) {

    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Item Price",
            filters: {
                item_code: item_code,
                price_list: frm.doc.selling_price_list
            },
            fields: ["price_list_rate"],
            order_by: "valid_from desc, creation desc",
            limit: 1
        },

        callback: function(price_res) {

            let price = 0;

            if (price_res.message.length) {
                price = price_res.message[0].price_list_rate;
            }

            add_or_update_row(frm, barcode, item_code, item_name, uom, price);
        }
    });
}


// ✅ ADD / UPDATE ITEM ROW
function add_or_update_row(frm, barcode, item_code, item_name, uom, price) {

    let existing_row = frm.doc.items.find(row => row.item_code === item_code);

    if (existing_row) {

        existing_row.qty = flt(existing_row.qty) + 1;
        existing_row.price = price;

        recalculate_row(existing_row);

    } else {

        let row = frm.add_child("items");

        row.barcode = barcode;
        row.item_code = item_code;
        row.item_name = item_name;
        row.uom = uom;

        row.qty = 1;
        row.price = price;

        recalculate_row(row);
    }

    frm.refresh_field("items");

    calculate_totals(frm);
    reset_scanner(frm);
}


// ✅ CHILD TABLE EVENTS
frappe.ui.form.on("Hold Invoice Item", {

    qty: function(frm, cdt, cdn) {

        let row = locals[cdt][cdn];

        recalculate_row(row);

        frm.refresh_field("items");
        calculate_totals(frm);
    },

    price: function(frm, cdt, cdn) {

        let row = locals[cdt][cdn];

        recalculate_row(row);

        frm.refresh_field("items");
        calculate_totals(frm);
    }
});


// ✅ ROW CALCULATION
function recalculate_row(row) {
    row.amount = flt(row.qty) * flt(row.price);
}


// ✅ MASTER TOTAL ENGINE
function calculate_totals(frm) {

    let net_total = 0;

    (frm.doc.items || []).forEach(item => {
        net_total += flt(item.amount);
    });

    frm.set_value("net_total", net_total);

    apply_tax_template(frm, net_total);
}


// ✅ TAX ENGINE
function apply_tax_template(frm, net_total) {

    if (!frm.doc.sales_tax_charges_and_template) {

        frm.set_value("total_taxes", 0);
        frm.set_value("grand_total", net_total);
        return;
    }

    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Sales Taxes and Charges Template",
            name: frm.doc.sales_tax_charges_and_template
        },

        callback: function(r) {

            if (!r.message) return;

            frm.clear_table("sales_taxes_and_charges");

            let total_tax = 0;

            (r.message.taxes || []).forEach(tax => {

                let tax_amount = 0;

                if (tax.rate) {
                    tax_amount = net_total * (flt(tax.rate) / 100);
                }

                total_tax += tax_amount;

                frm.add_child("sales_taxes_and_charges", {
                    charge_type: tax.charge_type,
                    account_head: tax.account_head,
                    description: tax.description,
                    rate: tax.rate,
                    tax_amount: tax_amount
                });
            });

            frm.refresh_field("sales_taxes_and_charges");

            frm.set_value("total_taxes", total_tax);
            frm.set_value("grand_total", net_total + total_tax);
        }
    });
}


// ✅ RESET SCANNER
function reset_scanner(frm) {
    frm.set_value("scan_barcode", "");
    frm.fields_dict.scan_barcode.$input.focus();
}
