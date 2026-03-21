
frappe.ui.form.on('Item', {
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
    }
});