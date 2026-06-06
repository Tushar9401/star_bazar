
frappe.ui.form.on('Item', {
    refresh: function(frm) {
        calculate_margin(frm);
    },
    standard_rate: function(frm) {
        calculate_margin(frm);
    },
    custom_item_purchase_rate: function(frm) {
        calculate_margin(frm);
    },
    custom_tobaco: function(frm) {
        if (frm.doc.custom_tobaco) {
            frm.clear_table("taxes");
            frm.add_child("taxes", {
                item_tax_template: "Tobacco Tax - SB"
            });
            frm.refresh_field("taxes");
        }
    },
     custom_food_stamp_enable: function(frm) {
        if (frm.doc.custom_food_stamp_enable) {
            frm.clear_table("taxes");
            frm.add_child("taxes", {
                item_tax_template: "Food Tax - SB"
            });
            frm.refresh_field("taxes");
        }
    },
    custom_non_food: function(frm) {
        if (frm.doc.custom_non_food) {
            frm.clear_table("taxes");
            frm.add_child("taxes", {
                item_tax_template: "Non Food Tax - SB"
            });
            frm.refresh_field("taxes");
        }
    },
    validate: function(frm) {
        if (frm.doc.barcodes) {
            let barcodes = frm.doc.barcodes
                .map(b => b.barcode)
                .filter(b => b)
                .join(',');

            // Add leading + trailing comma for safe search
            frm.set_value('custom_barcode_search', `,${barcodes},`);
        }
    }
});

function calculate_margin(frm) {
    const selling = flt(frm.doc.standard_rate);
    const purchase = flt(frm.doc.custom_item_purchase_rate);
    const margin = selling > 0 && purchase > 0
        ? ((selling - purchase) / selling) * 100
        : 0;

    frm.set_value('custom_margin', flt(margin, 2));
}
