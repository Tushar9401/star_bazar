frappe.ui.form.on("Price Update", {

    scan_barcode: function(frm) {

        if (!frm.doc.scan_barcode) return;

        let barcode = frm.doc.scan_barcode;

        // ✅ Find Item via Barcode
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

                // ✅ Fetch Item Details
                frappe.call({
                    method: "frappe.client.get_value",
                    args: {
                        doctype: "Item",
                        filters: { name: item_code },
                        fieldname: ["item_name", "stock_uom"]
                    },

                    callback: function(item) {

                        if (!item.message) return;

                        frm.set_value("item_code", item_code);
                        frm.set_value("item_name", item.message.item_name);
                        frm.set_value("uom", item.message.stock_uom);

                        resolve_warehouse_and_fetch(frm);

                        reset_scanner(frm);
                    }
                });
            }
        });
    }
});


// ✅ Resolve Warehouse Logic
function resolve_warehouse_and_fetch(frm) {

    // ✅ Fetch Default Warehouse from Stock Settings
    frappe.call({
        method: "frappe.client.get_single_value",
        args: {
            doctype: "Stock Settings",
            field: "default_warehouse"
        },

        callback: function(r) {

            if (!r.message) {
                frappe.show_alert({
                    message: __("No Default Warehouse set in Stock Settings"),
                    indicator: "red"
                });
                return;
            }

            warehouse = r.message;

            // frm.set_value("warehouse", warehouse);

            fetch_stock_and_price(frm, warehouse);
        }
    });
}


// ✅ Fetch Stock + Price
function fetch_stock_and_price(frm, warehouse) {

    let item_code = frm.doc.item_code;

    if (!item_code || !warehouse) return;

    // ✅ Current Stock
    frappe.call({
        method: "erpnext.stock.utils.get_stock_balance",
        args: {
            item_code: item_code,
            warehouse: warehouse
        },

        callback: function(stock) {
            frm.set_value("current_qty", stock.message || 0);
        }
    });

    // ✅ Current Sales Rate
    frappe.call({
        method: "frappe.client.get_value",
        args: {
            doctype: "Item Price",
            filters: {
                item_code: item_code,
                price_list:"Standard Selling",
                selling: 1
            },
            fieldname: ["price_list_rate"],
            order_by: "creation desc",   // ✅ MOST IMPORTANT
            limit_page_length: 1   
        },

        callback: function(price) {
            frm.set_value(
                "current_sales_price",
                price.message ? price.message.price_list_rate : 0
            );
        }
    });
}
