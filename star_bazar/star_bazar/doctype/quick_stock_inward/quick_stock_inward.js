frappe.ui.form.on('Quick Stock Inward', {
   onload: function(frm) {

    frappe.db.get_value(
        "Stock Settings",
        "Stock Settings",
        "default_warehouse",
        function(value) {

            if (value.default_warehouse) {

                frm.set_value("warehouse", value.default_warehouse);
            }
        }
    );
},

    scan_barcode: function(frm) {

        if (!frm.doc.scan_barcode) return;

        let barcode = frm.doc.scan_barcode;

        // ✅ Find Item via Item Barcode table
        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Item Barcode",
                filters: { barcode: barcode },
                fieldname: ["parent"],
                parent:"Item"
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

                // ✅ Fetch Item Name
                frappe.call({
                    method: "frappe.client.get_value",
                    args: {
                        doctype: "Item",
                        filters: { name: item_code },
                        fieldname: ["item_name","stock_uom"]
                    },

                    callback: function(item) {

                        let item_name = item.message.item_name;
                        let uom = item.message.stock_uom;

                        handle_item_row(frm, barcode, item_code, item_name, uom);
                    }
                });
            }
        });
    }
});
function handle_item_row(frm, barcode, item_code, item_name, uom) {

    let existing_row = null;

    (frm.doc.items || []).forEach(row => {
        if (row.item_code === item_code) {
            existing_row = row;
        }
    });

    if (existing_row) {

        // increment incoming_qty on existing row (field is named incoming_qty in child doctype)
        existing_row.incoming_qty = (existing_row.incoming_qty || 0) + 1;

        // update amount when quantity changes
        existing_row.amount = (existing_row.purchase_rate || 0) * (existing_row.incoming_qty || 0);

        fetch_stock(frm, existing_row);

    } else {

        let row = frm.add_child("items");

        row.barcode = barcode;
        row.item_code = item_code;
        row.item_name = item_name;
        row.uom = uom;
    // set incoming_qty (child field) to 1 when adding a new row
    row.incoming_qty = 1;

    // initialize amount for new row
    row.amount = (row.purchase_rate || 0) * (row.incoming_qty || 0);

        fetch_stock(frm, row);
    }

    frm.refresh_field("items");
    reset_scanner(frm);
}
function fetch_stock(frm, row) {

    if (!frm.doc.warehouse) {
        frappe.msgprint("Please select Warehouse first");
        return;
    }

    frappe.call({
        method: "erpnext.stock.utils.get_stock_balance",
        args: {
            item_code: row.item_code,
            warehouse: frm.doc.warehouse
        },

        callback: function(r) {
            row.current_stock = r.message || 0;
            frm.refresh_field("items");
        }
    });
}
function reset_scanner(frm) {
    frm.set_value("scan_barcode", "");
    frm.fields_dict.scan_barcode.$input.focus();
}


function calculate_margin(row) {
    let purchase = row.purchase_rate || 0;
    let sales = row.sales_rate || 0;
 
    if (purchase > 0) {
        row.margin = flt(((sales - purchase) / purchase) * 100, 2);
    } else {
        row.margin = 0;
    }
}
// Recalculate amount on child table when incoming_qty or purchase_rate changes
frappe.ui.form.on('Quick Stock Inward Item', {
    item_code: function(frm, cdt, cdn) {
        // when item_code is entered in the child row, fetch current stock for selected warehouse
        let row = locals[cdt][cdn];
        if (!row) return;
        // fetch_stock will check for warehouse and populate row.current_stock
        fetch_stock(frm, row);
    },
    incoming_qty: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        row.amount = (row.purchase_rate || 0) * (row.incoming_qty || 0);
        calculate_margin(row);
        frm.refresh_field('items');
    },
    purchase_rate: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        row.amount = (row.purchase_rate || 0) * (row.incoming_qty || 0);
        frm.refresh_field('items');
        calculate_margin(row);
    },
    sales_rate: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        calculate_margin(row);
        frm.refresh_field("items");
    }
});


