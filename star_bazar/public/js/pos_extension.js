$(document).on('page-change', function() {
    if (frappe.get_route()[0] === 'point-of-sale') {
        
        let checkPOSLoaded = setInterval(() => {
            const $header_actions = $('.page-actions');
            
            if ($header_actions.length > 0) {
                clearInterval(checkPOSLoaded);

                // Add Stock Inward Button
                if ($('#btn-stock-inward').length === 0) {
                    $header_actions.prepend(`
                        <button id="btn-stock-inward" class="btn btn-default btn-sm ml-2">
                            ${__('Stock Inward')}
                        </button>
                    `);

                    $('#btn-stock-inward').on('click', function() {
                        frappe.set_route('List', 'Quick Stock Inward');
                    });
                }

                // Add Price Update Button
                if ($('#btn-price-update').length === 0) {
                    $header_actions.prepend(`
                        <button id="btn-price-update" class="btn btn-default btn-sm ml-2">
                            ${__('Price Update')}
                        </button>
                    `);

                    $('#btn-price-update').on('click', function() {
                        frappe.set_route('List', 'Price Update');
                    });
                }

                if ($('#btn-view-invoice').length === 0) {
                    $header_actions.prepend(`
                        <button id="btn-view-invoice" class="btn btn-default btn-sm ml-2">
                            ${__('View Invoice')}
                        </button>
                    `);

                    $('#btn-view-invoice').on('click', function() {
                        frappe.set_route('List', 'POS Invoice');
                    });
                }

                console.log("POS Invoice buttons initialized.");
            }
            
        }, 500);
    }
});


// =====================
// EBT VALIDATION LOGIC
// =====================

$(document).on('page-change', function () {
    if (frappe.get_route()[0] === 'point-of-sale') {

        let waitForPOS = setInterval(() => {

            if (window.cur_pos && window.cur_pos.frm) {

                clearInterval(waitForPOS);

                const pos = window.cur_pos;
                let ebt_active = false;

                pos.frm.fields_dict.payments.grid.wrapper.on("change", function () {

                    let doc = pos.frm.doc;

                    let is_ebt = doc.payments.some(p =>
                        p.mode_of_payment === "EBT" && p.amount > 0
                    );

                    // ======================
                    // IF EBT SELECTED
                    // ======================
                    if (is_ebt && !ebt_active) {

                    let invalid_items = [];
                    let promises = [];

                    doc.items.forEach(row => {

                        let p = frappe.db.get_value("Item", row.item_code, "custom_food_stamp_enable")
                            .then(r => {

                                if (!r.message || !r.message.custom_food_stamp_enable) {
                                    invalid_items.push(row.item_name);
                                }

                            });

                        promises.push(p);
                    });

                    Promise.all(promises).then(() => {

                        if (invalid_items.length > 0) {

                            frappe.msgprint({
                                title: "EBT Error",
                                indicator: "red",
                                message:
                                    "These items are not EBT eligible:<br><br>" +
                                    invalid_items.join("<br>")
                            });

                            // Reset EBT payment
                            doc.payments.forEach(p => {
                                if (p.mode_of_payment === "EBT") {
                                    p.amount = 0;
                                }
                            });

                            pos.frm.refresh_field("payments");
                            return;
                        }

                        // Remove taxes
                        // Remove taxes completely
                        pos.original_tax_template = doc.taxes_and_charges;
                        pos.original_taxes = JSON.parse(JSON.stringify(doc.taxes || []));

                        // Clear tax template
                        pos.frm.set_value("taxes_and_charges", "");

                        // Clear tax table rows
                        doc.taxes = [];
                        pos.frm.refresh_field("taxes");

                        // Recalculate totals
                        pos.frm.script_manager.trigger("calculate_taxes_and_totals");

                        ebt_active = true;

                        console.log("✅ EBT taxes fully removed");


                    });

                }
                    // ======================
                    // IF EBT REMOVED
                    // ======================
                    if (!is_ebt && ebt_active) {

                        if (pos.original_tax_template) {
                            pos.frm.set_value("taxes_and_charges", pos.original_tax_template);
                        }

                        if (pos.original_taxes) {
                            doc.taxes = pos.original_taxes;
                            pos.frm.refresh_field("taxes");
                        }

                        pos.frm.script_manager.trigger("calculate_taxes_and_totals");

                        ebt_active = false;
                        console.log("✅ Taxes restored properly");
                    }
                });

                console.log("✅ FINAL EBT logic loaded");
            }

        }, 500);
    }
});

// ===============================
// RECEIPT BARCODE SCAN HANDLER
// ===============================

// let receipt_scan_buffer = "";

// $(document).on("keypress", function (e) {

//     if (e.key === "Enter") {

//         let scanned_value = receipt_scan_buffer.trim();
//         receipt_scan_buffer = "";

//         if (scanned_value.startsWith("INV:")) {

//             let short_id = scanned_value.replace("INV:", "");

//             frappe.db.get_list("POS Invoice", {
//                 filters: {
//                     name: ["like", "%" + short_id]
//                 },
//                 fields: ["name"],
//                 limit: 1
//             }).then(r => {

//                 if (r.length) {
//                     frappe.set_route("Form", "POS Invoice", r[0].name);
//                 } else {
//                     frappe.msgprint("Invoice not found: " + short_id);
//                 }

//             });
//         }

//     } else {
//         receipt_scan_buffer += e.key;
//     }
// });

// ===============================
// POS RECEIPT SCAN (LOAD INSIDE POS)
// ===============================

// ===============================
// POS RECEIPT SCAN → LOAD IN POS
// ===============================

// ===============================
// RECEIPT QR / BARCODE HANDLER
// ===============================

let receipt_scan_buffer = "";

$(document).on("keypress", function (e) {

    if (e.key === "Enter") {

        let scanned_value = receipt_scan_buffer.trim();
        receipt_scan_buffer = "";

        if (scanned_value.startsWith("INV:")) {

            let invoice_id = scanned_value.replace("INV:", "");

            frappe.db.exists("POS Invoice", invoice_id).then(exists => {

                if (exists) {
                    frappe.set_route("Form", "POS Invoice", invoice_id);
                } else {
                    frappe.msgprint("Invoice not found: " + invoice_id);
                }

            });
        }

    } else {
        receipt_scan_buffer += e.key;
    }
});
