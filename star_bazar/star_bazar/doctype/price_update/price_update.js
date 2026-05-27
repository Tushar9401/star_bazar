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
    },
    item_code:function(frm) {
        resolve_warehouse_and_fetch(frm);
    },
     new_sales_price: function(frm) {
        calculate_new_margin(frm);
    },
    new_purchase_price: function(frm) {
        calculate_new_margin(frm);
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
        method: "star_bazar.star_bazar.doctype.price_update.price_update.get_latest_selling_price",
        args: {
            item_code: item_code
        },

        callback: function(price) {
            frm.set_value(
                "current_sales_price",
                price.message || 0
            );
            // ✅ Calculate current margin after fetching
            calculate_current_margin(frm);
        }
    });
}

// ✅ Calculate Current Margin
function calculate_current_margin(frm) {

    let purchase = flt(frm.doc.current_purchase_rate);
    let selling = flt(frm.doc.current_sales_price);

    if (!purchase) return;

    let margin = ((selling - purchase) / selling) * 100;

    frm.set_value("current_margin", margin.toFixed(2));
}


// ✅ Calculate New Margin
function calculate_new_margin(frm) {

    let purchase = flt(frm.doc.new_purchase_price || frm.doc.current_purchase_rate);
    let new_price = flt(frm.doc.new_sales_price);

    if (!purchase || !new_price) return;

    let margin = ((new_price - purchase) / new_price) * 100;

    frm.set_value("new_margin", margin.toFixed(2));
}
