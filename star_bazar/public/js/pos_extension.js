frappe.require("/assets/star_bazar/js/qz-tray.js");


// =====================
// HOLD ITEMS LOGIC
// =====================

function append_to_existing_hold(hold_name, pos_doc) {

    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Hold Invoice",
            name: hold_name
        },
        callback: function(r) {

            let hold_doc = r.message;

            // 1️⃣ Append items
            pos_doc.items.forEach(row => {
                hold_doc.items.push({
                    item_code: row.item_code,
                    item_name: row.item_name,
                    qty: row.qty,
                    unit_of_measure: row.uom,
                    price: row.rate,
                    amount: row.amount
                });
            });

            // 2️⃣ Update totals by adding POS totals
            hold_doc.net_total = flt(hold_doc.net_total) + flt(pos_doc.net_total);

            // POS tax field is usually:
            let pos_tax = flt(pos_doc.total_taxes_and_charges) || 0;

            hold_doc.total_taxes = flt(hold_doc.total_taxes) + pos_tax;

            hold_doc.grand_total = flt(hold_doc.grand_total) + flt(pos_doc.grand_total);

            // 3️⃣ Save
            frappe.call({
                method: "frappe.client.save",
                args: { doc: hold_doc },
                freeze: true,
                callback: function() {

                    frappe.show_alert({
                        message: "Items Appended & Totals Updated",
                        indicator: "green"
                    });

                    window.cur_pos.make_new_invoice();
                }
            });
        }
    });
}

function create_new_hold(pos_doc) {

    let hold_items = [];

    pos_doc.items.forEach(row => {
        hold_items.push({
            item_code: row.item_code,
            item_name: row.item_name,
            qty: row.qty,
            unit_of_measure: row.uom,
            price: row.rate,
            amount: row.amount
        });
    });

    frappe.call({
        method: "frappe.client.insert",
        args: {
            doc: {
                doctype: "Hold Invoice",
                customer: pos_doc.customer,
                net_total: pos_doc.net_total,
                total_taxes: pos_doc.total_taxes_and_charges,
                grand_total: pos_doc.grand_total,
                items: hold_items
            }
        },
        freeze: true,
        callback: function() {

            frappe.show_alert({
                message: "New Hold Invoice Created",
                indicator: "green"
            });

            window.cur_pos.make_new_invoice();
        }
    });
}

function create_hold_invoice() {

    if (!window.cur_pos || !window.cur_pos.frm) {
        frappe.msgprint("POS not ready");
        return;
    }

    let pos = window.cur_pos;
    let doc = pos.frm.doc;

    if (!doc.items || doc.items.length === 0) {
        frappe.msgprint("No items to hold");
        return;
    }

    if (!doc.customer) {
        frappe.msgprint("Please select customer");
        return;
    }

    let customer = doc.customer;

    // Step 1: Check if Draft Hold Invoice exists for this customer
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Hold Invoice",
            filters: {
                customer: customer,
                docstatus: 0  // Draft only
            },
            fields: ["name"],
            limit_page_length: 1
        },
        callback: function(res) {

            if (res.message && res.message.length > 0) {
                // Existing Draft found
                append_to_existing_hold(res.message[0].name, doc);
            } else {
                // No draft found → Create new
                create_new_hold(doc);
            }
        }
    });
}

// =====================
// POS BUTTON ADDITION
// =====================

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

                if ($('#btn-hold-invoice').length === 0) {
                    $header_actions.prepend(`
                        <button id="btn-hold-invoice" class="btn btn-default btn-sm ml-2">
                            ${__('Hold Invoice')}
                        </button>
                    `);

                    // $('#btn-hold-invoice').on('click', function() {
                    //     frappe.set_route('List', 'Hold Invoice');
                    // });
                    $('#btn-hold-invoice').on('click', function() {
                        create_hold_invoice();
                    });
                }

                if ($('#btn-view-hold-invoice').length === 0) {
                    $header_actions.prepend(`
                        <button id="btn-view-hold-invoice" class="btn btn-default btn-sm ml-2">
                            ${__('View Hold Invoice')}
                        </button>
                    `);

                    $('#btn-view-hold-invoice').on('click', function() {
                        frappe.set_route('List', 'Hold Invoice');
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

        let wait = setInterval(() => {

            if (window.cur_pos && window.cur_pos.frm) {
                clearInterval(wait);

                const pos = window.cur_pos;

                $(document).on("change", 'select[data-fieldname="custom_tax_mode"]', function () {

                    let mode = $(this).val();

                    if (mode === "Non Tax") {
                        removeTaxes(pos);
                    } else {
                        restoreTaxes(pos);
                    }

                });

                console.log("✅ Tax Mode logic loaded");
            }

        }, 300);
    }
});

function removeTaxes(pos) {

    let doc = pos.frm.doc;

    pos.original_tax_template = doc.taxes_and_charges;
    pos.original_taxes = JSON.parse(JSON.stringify(doc.taxes || []));

    pos.frm.set_value("taxes_and_charges", "");
    doc.taxes = [];
    pos.frm.refresh_field("taxes");

    pos.frm.script_manager.trigger("calculate_taxes_and_totals");

    console.log("✅ Taxes removed");
}

function restoreTaxes(pos) {

    let doc = pos.frm.doc;

    if (pos.original_tax_template) {
        pos.frm.set_value("taxes_and_charges", pos.original_tax_template);
    }

    if (pos.original_taxes) {
        doc.taxes = pos.original_taxes;
        pos.frm.refresh_field("taxes");
    }

    pos.frm.script_manager.trigger("calculate_taxes_and_totals");

    console.log("✅ Taxes restored");
}



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
// RECEIPT QR / BARCODE HANDLER
// ===============================

$(document).on("input", ".search-field input", function () {

    let value = $(this).val().trim();

    if (value.startsWith("INV:")) {

        let invoice_id = value.replace("INV:", "");

        // clear search box immediately
        $(this).val("");

        // frappe.db.exists("POS Invoice", invoice_id).then(exists => {

        //     if (exists) {
        //         frappe.set_route("Form", "POS Invoice", invoice_id);
        //     } else {
        //         frappe.msgprint("Invoice not found: " + invoice_id);
        //     }

        // });
        frappe.db.get_list("POS Invoice", {
            filters: {
                name: ["like", "%" + invoice_id]
            },
            fields: ["name"],
            limit: 1
        }).then(r => {
            if (r.length) {
                frappe.set_route("Form", "POS Invoice", r[0].name);
            }
            else { frappe.msgprint("Invoice not found: ");
            }
        });
    }
});

// // ===============================
// // MERGE SAME ITEM IN ITEM LIST
// // ===============================

// function merge_duplicate_items_v15() {

//     if (!window.cur_pos || !window.cur_pos.frm) return;

//     let frm = window.cur_pos.frm;
//     let items = frm.doc.items || [];

//     let item_map = {};
//     let new_items = [];

//     items.forEach(row => {

//         if (item_map[row.item_code]) {

//             item_map[row.item_code].qty += row.qty;

//         } else {

//             item_map[row.item_code] = row;
//             new_items.push(row);
//         }
//     });

//     frm.doc.items = new_items;

//     frm.refresh_field("items");

// }

// // Trigger merge AFTER every item add
// $(document).on("click", ".item-wrapper", function () {
//     setTimeout(() => {
//         merge_duplicate_items_v15();
//     }, 100);
// });

$(document).on('page-change', function () {
    if (frappe.get_route()[0] === 'point-of-sale') {

        const observer = new MutationObserver(() => {
            const el = document.querySelector('.add-discount-wrapper');
            if (el) {
                el.remove();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

    }
});


async function handle_pack_conversion() {

    if (!window.cur_pos || !window.cur_pos.frm) return;

    let frm = window.cur_pos.frm;
    let items = frm.doc.items || [];

    for (let row of [...items]) {

        if (!row.item_code) continue;

        let item = await frappe.db.get_doc("Item", row.item_code);

        if (!item.custom_bundle_item_code || !item.custom_bundle_qty) continue;

        let bundle_qty = item.custom_bundle_qty;
        let total_qty = row.qty;

        if (total_qty < bundle_qty) continue;

        let pack_count = Math.floor(total_qty / bundle_qty);
        let remaining = total_qty % bundle_qty;

        // Remove original row
        frappe.model.clear_doc(row.doctype, row.name);

        frm.refresh_field("items");

        // Add bundle packs
        for (let i = 0; i < pack_count; i++) {

            let new_row = frm.add_child("items");

            new_row.item_code = item.custom_bundle_item_code;
            frm.script_manager.trigger("item_code", new_row.doctype, new_row.name);

            new_row.qty = 1;
        }

        // Add remaining normal qty
        if (remaining > 0) {

            let new_row = frm.add_child("items");

            new_row.item_code = row.item_code;
            frm.script_manager.trigger("item_code", new_row.doctype, new_row.name);

            new_row.qty = remaining;
        }

        frm.refresh_field("items");
        frm.script_manager.trigger("calculate_taxes_and_totals");
    }
}

function attach_pack_hook() {

    const wait_for_pos = setInterval(() => {

        if (!window.cur_pos || !window.cur_pos.frm) return;

        clearInterval(wait_for_pos);

        let frm = window.cur_pos.frm;

        frm.cscript.items_add = function() {
            setTimeout(() => handle_pack_conversion(), 200);
        };

        frm.cscript.qty = function() {
            setTimeout(() => handle_pack_conversion(), 200);
        };

        console.log("Pack conversion hook attached ✅");

    }, 1000);
}

attach_pack_hook();


