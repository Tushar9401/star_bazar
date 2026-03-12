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

        // ✅ Add Payment button in Actions
        // Only show for saved documents
        if (!frm.doc.__islocal && frm.doc.status !== "Paid") {
            frm.add_custom_button(__('Payment'), function() {
                // Open new Hold Invoice Payment with prefilled values
                frappe.new_doc('Hold Invoice Payment', {
                    customer: frm.doc.customer,
                    hold_invoice_no: frm.doc.name,
                    sales_invoice: frm.doc.sales_invoice,
                    amount_to_be_paid: frm.doc.grand_total-frm.doc.amount_paid,
                });
            }, __('Actions'));
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
    },
  
});

async function calculate_ebt_split(frm) {

    let ebt_total = 0;
    let taxable_total = 0;

    for (let item of (frm.doc.items || [])) {

        if (!item.item_code) continue;

        let r = await frappe.db.get_value(
            "Item",
            item.item_code,
            ["custom_food_stamp_enable"]
        );

        let is_food = r.message.custom_food_stamp_enable || 0;

        if (is_food == 1) {
            ebt_total += flt(item.amount);
        } else {
            taxable_total += flt(item.amount);
        }
    }
  
    frm.set_value("ebt_amount", ebt_total);
    

    console.log("EBT Eligible:", ebt_total);
    console.log("Taxable Amount:", taxable_total);

    apply_tax_template(frm, taxable_total);
}

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
async function calculate_totals(frm) {

    let net_total = 0;
    let taxable_total = 0;
    let ebt_total = 0;

    // Calculate Net Total first
    (frm.doc.items || []).forEach(item => {
        net_total += flt(item.amount);
    });

    frm.set_value("net_total", net_total);

    // If NO EBT → normal taxation
    if (!has_ebt(frm)) {

        frm.set_value("ebt_amount", 0);
        apply_tax_template(frm, net_total);
        return;
    }

    // If EBT exists → split items
    for (let item of (frm.doc.items || [])) {

        if (!item.item_code) continue;

        let amount = flt(item.amount);

        let r = await frappe.db.get_value(
            "Item",
            item.item_code,
            ["custom_food_stamp_enable"]
        );

        let is_food = r.message.custom_food_stamp_enable || 0;

        if (is_food == 1) {
            ebt_total += amount;
        } else {
            taxable_total += amount;
        }
    }

    frm.set_value("ebt_amount", ebt_total);


    // Apply tax ONLY on taxable items
    apply_tax_template(frm, taxable_total);
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

frappe.ui.form.on("Hold Invoice Payment Type", {
	amount: function(frm, cdt, cdn) {
		recalc_amount_paid(frm);
	},

	// If mode_of_payment changes we may want to recalc as well (in case UI logic modifies amount)
	mode_of_payment: function(frm, cdt, cdn) {

       let row = locals[cdt][cdn];

        // ✅ INIT cache once
        if (!frm._original_tax_template) {
            frm._original_tax_template = frm.doc.sales_tax_charges_and_template;
        }

        // ---------------------------------------------------
        // ✅ IF EBT → REMOVE TAXES
        // ---------------------------------------------------

        if (row.mode_of_payment === "EBT") {

            frappe.show_alert({
                message: __("EBT Enabled → Tax removed only for food stamp items"),
                indicator: "orange"
            });

            calculate_totals(frm);
        }

        // ---------------------------------------------------
        // ✅ IF NOT EBT → RESTORE TAXES
        // ---------------------------------------------------

        else {
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

            
        }
		recalc_amount_paid(frm);
	},

    payments_remove: function(frm) {
        calculate_totals(frm);
        recalc_amount_paid(frm);
    }
});

function has_ebt(frm) {

    return (frm.doc.payments || []).some(row =>
        row.mode_of_payment === "EBT"
    );
}
function recalc_amount_paid(frm) {
	let total = 0.0;

	(frm.doc.payments || []).forEach(row => {
		// ensure numeric
		let amt = row.amount || 0;
		total += flt(amt);
	});

	// set read-only field
	frm.set_value('amount_paid', total);

	// Calculate remaining amount_to_be_paid = original - paid
	let original = frm.doc._original_amount_to_be_paid;
	// Fallback: if original not set (edge-case), treat current amount_to_be_paid as original + paid
	if (original === undefined) {
		original = flt(frm.doc.amount_to_be_paid) + flt(total);
		frm.doc._original_amount_to_be_paid = original;
	}

	let remaining = flt(original) - flt(total);
	if (remaining < 0) remaining = 0;

	// frm.set_value('amount_to_be_paid', remaining);
}