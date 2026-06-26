
frappe.require("/assets/star_bazar/js/qz-tray.js");



// async function openDrawerThenPrint() {
//     try {
//         await qz.websocket.connect();

//         const printer = await qz.printers.find("EPSON TM-T20II Receipt");
//         const config = qz.configs.create(printer);

//         const data = [
//             '\x1B\x70\x00\x19\xFA'
//         ];

//         await qz.print(config, data);

//         console.log("Drawer Opened");

//         window.print();

//     } catch (err) {
//         console.error("QZ Error:", err);
//     }
// }
// console.log("POS extension loaded on point-of-sale page");

// window.testQZConnection = async function () {
//     try {
//         await window.ensureQZReady();

//         console.log("Before connect");
//         if (!qz.websocket.isActive()) {
//             await qz.websocket.connect();
//         }
//         console.log("After connect");

//         const printers = await qz.printers.find();
//         console.log("Available printers:", printers);

//         return printers;
//     } catch (err) {
//         console.error("QZ connection test failed:", err);
//     }
// };

// window.testDrawerOnly = async function () {
//     try {
//         await window.ensureQZReady();

//         console.log("Before connect");
//         if (!qz.websocket.isActive()) {
//             await qz.websocket.connect();
//         }
//         console.log("After connect");

//         const printer = await qz.printers.find("EPSON TM-T20II Receipt");
//         console.log("Printer found:", printer);

//         const config = qz.configs.create(printer, { encoding: "CP437" });

//         console.log("Sending drawer pulse...");
//         await qz.print(config, [
//             {
//                 type: "raw",
//                 format: "command",
//                 data: "\x1B\x70\x00\x19\xFA"
//             }
//         ]);
//         console.log("Drawer command sent");
//     } catch (err) {
//         console.error("Drawer test failed:", err);
//     }
// };
console.log("POS extension loaded on point-of-sale page");

function applyPaymentModeColors() {
    const colorByMode = {
        cash: {
            className: "star-pos-payment-cash",
            background: "#16a34a",
            border: "#15803d"
        },
        credit_card: {
            className: "star-pos-payment-credit-card",
            background: "#dc2626",
            border: "#b91c1c"
        }
    };

    document.querySelectorAll(".mode-of-payment").forEach((button) => {
        const mode = (button.dataset.mode || "").trim().toLowerCase();
        const label = (button.childNodes[0]?.textContent || button.textContent || "").trim().toLowerCase();
        const config = colorByMode[mode] || (label === "cash" ? colorByMode.cash : null) ||
            (label === "credit card" ? colorByMode.credit_card : null);

        if (!config) return;

        button.classList.add(config.className);
        button.style.setProperty("background", config.background, "important");
        button.style.setProperty("background-color", config.background, "important");
        button.style.setProperty("border-color", config.border, "important");
        button.style.setProperty("color", "#ffffff", "important");

        button.querySelectorAll(".pay-amount, .control-label").forEach((element) => {
            element.style.setProperty("color", "#ffffff", "important");
        });

        button.querySelectorAll(".mode-of-payment-control input").forEach((input) => {
            input.style.setProperty("color", "#111827", "important");
        });

        button.querySelectorAll(".cash-shortcuts .shortcut").forEach((shortcut) => {
            shortcut.style.setProperty("background-color", "#ffffff", "important");
            shortcut.style.setProperty("color", "#374151", "important");
            shortcut.style.setProperty("border", "1px solid rgba(255, 255, 255, 0.75)", "important");
        });
    });
}

(function watchPaymentModeColors() {
    const apply = () => {
        if (frappe.get_route?.()[0] === "point-of-sale") {
            applyPaymentModeColors();
        }
    };

    $(document).on("page-change", () => setTimeout(apply, 300));
    setInterval(apply, 1000);

    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
})();

window.addEventListener("message", function (event) {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === "customer_display_ready") {
        console.log("✅ Customer display ready — sending current cart");
        broadcastCartToDisplay();
    }
});
// ===============================
// CUSTOMER DISPLAY BROADCAST
// ===============================
let _suppress_search_input = false;
const customerDisplayChannel = new BroadcastChannel("pos_customer_display");

function broadcastCartToDisplay() {
    try {
        const pos = window.cur_pos;
        if (!pos || !pos.frm) return;

        const doc = pos.frm.doc;
        const items = (doc.items || []).map(row => ({
            item_code: row.item_code,
            item_name: row.item_name,
            qty:       row.qty,
            amount:    row.amount
        }));

        const taxes     = doc.taxes || [];
        const tax_row   = taxes[0];
        const tax_label = tax_row?.description || tax_row?.account_head || "Tax";
        const tax_total = taxes.reduce((sum, t) => sum + flt(t.tax_amount), 0);

        const payload = {
            type:        "cart_update",
            items:       items,
            net_total:   doc.net_total   || 0,
            tax_total:   tax_total,
            tax_label:   tax_label,
            grand_total: doc.grand_total || 0
        };

        // ✅ Broadcast via channel (works when window is already open)
        customerDisplayChannel.postMessage(payload);

        // ✅ Also push directly into window if it's open and loaded
        // This handles the first load where BroadcastChannel may not be ready yet
        if (window._customerDisplayWindow && !window._customerDisplayWindow.closed) {
            try {
                window._customerDisplayWindow.postMessage(payload, window.location.origin);
            } catch(e) {
                // Window may not be ready yet, BroadcastChannel will cover it
            }
        }

    } catch (e) {
        console.error("Customer display broadcast error:", e);
    }
}

function broadcastCartClear() {
    customerDisplayChannel.postMessage({ type: "cart_clear" });
}


window.openDrawerOnly = async function () {
    try {
        await window.ensureQZReady();

        if (!qz.websocket.isActive()) {
            await qz.websocket.connect({
                host: "localhost",    // ✅ always localhost — QZ is on this PC
                usingSecure: false    // ✅ no SSL needed for localhost
            });
        }

        const printer = await qz.printers.find("EPSON TM-T20II Receipt");
        const config = qz.configs.create(printer, { encoding: "CP437" });

        await qz.print(config, [{
            type: "raw",
            format: "command",
            data: "\x1B\x70\x00\x19\xFA"
        }]);

        console.log("Drawer opened");
    } catch (err) {
        console.error("Drawer open failed:", err);
    }
};

function isCashPayment() {
    try {
        const pos = frappe.pages["point-of-sale"]?.pos;
        const payments = pos?.frm?.doc?.payments || [];

        return payments.some(p =>
            (p.mode_of_payment || "").toLowerCase().includes("cash") &&
            Number(p.amount || 0) > 0
        );
    } catch (e) {
        console.error("Payment check failed:", e);
        return false;
    }
}

(function attachButtonListener() {
    const timer = setInterval(() => {

        // ✅ Hook CHECKOUT button (cart screen)
        const checkoutBtn = document.querySelector(".checkout-btn");
        if (checkoutBtn && !checkoutBtn.__tax_reset_hooked) {
            checkoutBtn.__tax_reset_hooked = true;

            checkoutBtn.addEventListener("click", async () => {
                try {
                    const pos = window.cur_pos;
                    if (pos && pos.frm && pos.frm.doc.custom_tax_mode !== "Tax") {
                        await pos.frm.set_value("custom_tax_mode", "Tax");
                        restoreTaxes(pos);
                        console.log("✅ Tax mode reset to Tax on Checkout click");
                    }
                } catch (e) {
                    console.error("Tax reset on checkout error:", e);
                }
            });

            console.log("✅ Checkout button tax-reset hooked");
        }
        const btn = document.querySelector(".submit-order-btn");

        if (!btn || btn.__drawer_hooked) return;

        btn.__drawer_hooked = true;

        btn.addEventListener("click", async () => {
            try {
                broadcastCartClear();
                if (isCashPayment()) {
                    console.log("Cash detected → opening drawer");
                    await window.openDrawerOnly();
                } else {
                    console.log("Non-cash → drawer not opened");
                }
            } catch (e) {
                console.error("Drawer hook error:", e);
            }
        });

        console.log("Complete Order button hooked");
        clearInterval(timer);
    }, 1000);
})();

let order_notification_interval = null;
let latest_online_order = null;
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
                    item_group: row.item_group,
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
            item_group: row.item_group,
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

function updatePOSTotals() {
    if (!window.cur_pos || !window.cur_pos.frm) return;

    let frm = window.cur_pos.frm;

    // Recalculate totals
    frm.script_manager.trigger("calculate_taxes_and_totals");

    // Refresh UI
    frm.refresh_fields();

    console.log("✅ POS totals updated");
}

function openNewPOSOrder() {
    if (frappe.get_route()[0] !== "point-of-sale") {
        frappe.set_route("point-of-sale");
        return;
    }

    const summary_new_order_btn = $(".past-order-summary:visible .new-btn:visible, .summary-btns:visible .new-btn:visible").first();
    if (summary_new_order_btn.length) {
        summary_new_order_btn.trigger("click");
        return;
    }

    const pos = window.cur_pos;
    if (pos && typeof pos.make_new_invoice === "function") {
        frappe.run_serially([
            () => frappe.dom.freeze(),
            () => pos.make_new_invoice(),
            () => pos.toggle_components && pos.toggle_components(true),
            () => pos.item_selector && pos.item_selector.toggle_component(true),
            () => pos.cart && pos.cart.enable_customer_selection && pos.cart.enable_customer_selection(),
            () => pos.recent_order_list && pos.recent_order_list.toggle_component(false),
            () => pos.order_summary && pos.order_summary.toggle_component(false),
            () => frappe.dom.unfreeze(),
        ]);
        return;
    }

    frappe.set_route("point-of-sale");
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
                        <button id="btn-stock-inward" class="btn btn-default btn-sm ml-2" style="background:#E8F5FE;color:#0C3A6A;border:1px solid #60A8DE;">
                            ${__('Stock Inward')}
                        </button>
                    `);

                    $('#btn-stock-inward').on('click', function() {
                        frappe.set_route('List', 'Quick Stock Inward');
                    });
                }

                if ($('#btn-new-order-top').length === 0) {
                    $('#btn-stock-inward').after(`
                        <button id="btn-new-order-top" class="btn btn-default btn-sm ml-2" style="background:#E6F4EA;color:#0B5A2A;border:1px solid #79C48D;">
                            ${__('New Order')}
                        </button>
                    `);

                    $('#btn-new-order-top').on('click', function() {
                        openNewPOSOrder();
                    });
                }

                // Add Price Update Button
                if ($('#btn-price-update').length === 0) {
                    $header_actions.prepend(`
                        <button id="btn-price-update" class="btn btn-default btn-sm ml-2" style="background:#F1EFE8;color:#444441;border:1px solid #B4B2A9;">
                            ${__('Price Update')}
                        </button>
                    `);

                    $('#btn-price-update').on('click', function() {
                        frappe.set_route('List', 'Price Update');
                    });
                }

                if ($('#btn-view-invoice').length === 0) {
                    $header_actions.prepend(`
                        <button id="btn-view-invoice" class="btn btn-default btn-sm ml-2" style="background:#FCEBEB;color:#791F1F;border:1px solid #F09595;">
                            ${__('View Invoice')}
                        </button>
                    `);

                    $('#btn-view-invoice').on('click', function() {
                        frappe.set_route('List', 'POS Invoice');
                    });
                }

                if ($('#btn-hold-invoice').length === 0) {
                    $header_actions.prepend(`
                        <button id="btn-hold-invoice" class="btn btn-default btn-sm ml-2" style="background:#E1F5EE;color:#085041;border:1px solid #5DCAA5;">
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
                        <button id="btn-view-hold-invoice" class="btn btn-default btn-sm ml-2" style="background:#FAECE7;color:#712B13;border:1px solid #F0997B;">
                            ${__('View Hold Invoice')}
                        </button>
                    `);

                    $('#btn-view-hold-invoice').on('click', function() {
                        frappe.set_route('List', 'Hold Invoice');
                    });
                }

                if ($('#btn-item-scheme').length === 0) {
                    $header_actions.prepend(`
                        <button id="btn-item-scheme" class="btn btn-default btn-sm ml-2" style="background:#EEEDFE;color:#3C3489;border:1px solid #AFA9EC;">
                            ${__('Item Scheme')}
                        </button>
                    `);

                    $('#btn-item-scheme').on('click', function() {
                        frappe.set_route('List', 'Item Scheme');
                    });
                }

                if ($('#btn-view-online-order').length === 0) {
                    $header_actions.prepend(`
                        <button id="btn-view-online-order" class="btn btn-default btn-sm ml-2" style="background:#FBEAF0;color:#72243E;border:1px solid #ED93B1;">
                            ${__('View Online Order')}
                        </button>
                    `);

                    $('#btn-view-online-order').on('click', function() {
                        if (order_notification_interval) {
                            clearInterval(order_notification_interval);
                            order_notification_interval = null;
                        }
                        frappe.set_route('List', 'Online Order');
                    });
                }
                if ($('#btn-update-total').length === 0) {
                    $header_actions.prepend(`
                        <button id="btn-update-total" class="btn btn-default btn-sm ml-2" style="background:#EAF3DE;color:#27500A;border:1px solid #97C459;">
                            ${__('Update Total')}
                        </button>
                    `);

                    $('#btn-update-total').on('click', function () {
                        updatePOSTotals();
                    });
                if ($('#btn-open-drawer').length === 0) {
                        $header_actions.prepend(`
                            <button id="btn-open-drawer" class="btn btn-default btn-sm ml-2" style="background:#FAEEDA;color:#633806;border:1px solid #EF9F27;">
                                ${__('Open Drawer')}
                            </button>
                        `);

                        $('#btn-open-drawer').on('click', async function () {
                            try {
                                await window.openDrawerOnly();
                            } catch (e) {
                                console.error("Drawer open error:", e);
                            }
                        });
                    }
                }
               if ($('#btn-customer-display').length === 0) {
                        $header_actions.prepend(`
                            <button id="btn-customer-display" class="btn btn-default btn-sm ml-2" style="background:#E6F1FB;color:#0C447C;border:1px solid #85B7EB;">
                                ${__('Customer Display')}
                            </button>
                        `);

                        $('#btn-customer-display').on('click', function () {
                            // ✅ If already open, just focus it instead of opening a new one
                            if (window._customerDisplayWindow && !window._customerDisplayWindow.closed) {
                                window._customerDisplayWindow.focus();
                                return;
                            }

                            // ✅ Open as a plain navigation, not a preload
                            const displayUrl = window.location.origin + '/customer_display';

                            window._customerDisplayWindow = window.open(
                                '',                 // ✅ open blank first
                                'CustomerDisplay',
                                'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no'
                            );

                            // ✅ Then navigate — avoids preload warning
                            window._customerDisplayWindow.location.href = displayUrl;
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

// $(document).on('page-change', function () {
//     if (frappe.get_route()[0] === 'point-of-sale') {

//         let wait = setInterval(() => {

//             if (window.cur_pos && window.cur_pos.frm) {
//                 clearInterval(wait);

//                 const pos = window.cur_pos;

//                 $(document).on("change", 'select[data-fieldname="custom_tax_mode"]', function () {

//                     let mode = $(this).val();

//                     if (mode === "Non Tax") {
//                         removeTaxes(pos);
//                         calculateEBTSplit(pos);
//                     } else {
//                         restoreTaxes(pos);
//                     }

//                 });

//                 console.log("✅ Tax Mode logic loaded");
//             }

//         }, 300);
//     }
// });


$(document).on('page-change', function () {

    if (frappe.get_route()[0] === 'point-of-sale') {

        let wait = setInterval(() => {

            if (window.cur_pos && window.cur_pos.frm) {
                clearInterval(wait);
                // ✅ Add this new function
function attach_realtime_cart_broadcast(pos) {

    // 1️⃣ Watch for item row additions/removals via MutationObserver on the cart DOM
    const cartObserver = new MutationObserver(() => {
        setTimeout(broadcastCartToDisplay, 150);
    });

    const observeCart = setInterval(() => {
        const cartEl = document.querySelector('.cart-items-wrapper') 
                    || document.querySelector('.item-cart-wrapper')
                    || document.querySelector('.cart-container');
        if (cartEl) {
            clearInterval(observeCart);
            cartObserver.observe(cartEl, {
                childList: true,
                subtree: true,
                characterData: true
            });
            console.log("✅ Cart DOM observer attached for customer display");
        }
    }, 500);

    // 2️⃣ Also hook directly into POS item events
    const frm = pos.frm;

    // When item is added to cart
    const orig_items_add = frm.cscript.items_add;
    frm.cscript.items_add = function () {
        if (orig_items_add) orig_items_add.apply(this, arguments);
        setTimeout(broadcastCartToDisplay, 300);
    };

    // ✅ AGGRESSIVE: Monitor for General Items and Non-Food Items with qty > 1 and auto-split them
    const generalItemSplitInterval = setInterval(() => {
        if (!frm || !frm.doc || !frm.doc.items) return;

        const items = frm.doc.items;
        let splitted = false;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            // Check if it's a General Item (SPECIAL_* code or item_name = "General Item")
            const isGeneralItem = (item.item_code && item.item_code.startsWith("SPECIAL_"))
                               || item.item_name === "GROCERY";
            
            // Check if it's a Non-Food Item (item_code or item_name contains "NON FOOD")
            const itemCodeUpper = (item.item_code || "").toUpperCase();
            const itemNameUpper = (item.item_name || "").toUpperCase();
            const isNonFoodItem = itemCodeUpper.includes("NON FOOD") || itemNameUpper.includes("NON FOOD");

            if ((isGeneralItem || isNonFoodItem) && flt(item.qty) > 1) {
                console.log("🔄 AUTO-SPLIT:", isGeneralItem ? "GROCERY" : "Non-Food Item", "with qty", item.qty, "→ Splitting into qty=1 rows");

                const original_qty = flt(item.qty);
                item.qty = 1;

                // Add new rows for each remaining qty
                for (let j = 1; j < original_qty; j++) {
                    _special_item_counter++;
                    const new_row = frappe.model.add_child(frm.doc, "items");
                    
                    if (isGeneralItem) {
                        // For General Items: use Generic Item name
                        new_row.item_code = `GROCERY`;
                        new_row.item_name = "GROCERY";
                    } else {
                        // For Non-Food Items: keep original item_code and item_name
                        new_row.item_code = item.item_code;
                        new_row.item_name = item.item_name;
                    }
                    
                    new_row.qty = 1;
                    new_row.uom = item.uom;
                    new_row.description = item.description;
                    new_row.income_account = "Sales - SB";
                    new_row.rate = item.rate || 0;
                    new_row.amount = item.rate || 0;
                }

                splitted = true;
                break; // Process one split per interval cycle
            }
        }

        if (splitted) {
            frm.refresh_field("items");
            frm.script_manager.trigger("calculate_taxes_and_totals");
            console.log("✅ Split complete — refreshed cart");
        }
    }, 500); // Check every 500ms

    // When item qty or rate changes
    const orig_qty = frm.cscript.qty;
    frm.cscript.qty = function () {
        if (orig_qty) orig_qty.apply(this, arguments);
        setTimeout(broadcastCartToDisplay, 300);
    };

    const orig_rate = frm.cscript.rate;
    frm.cscript.rate = function (cdt, cdn,doc) {
        if (orig_rate) orig_rate.apply(this, arguments);
        let row = null;

            if (cdt && cdn && locals[cdt]) {
                row = locals[cdt][cdn];
            } else {
                row = frm.doc.items?.slice(-1)[0];
            }

            if (!row) return;

            console.log("🔴 Rate Updated:", {
                item: row.item_name,
                rate: row.rate,
                discount: row.discount_percentage,
                amount: row.amount
            });
            // 🔥 CHECK ZERO VALUE (IMPORTANT: use amount)
            if (flt(row.amount) === 0) {

                frappe.throw({
                    title: "Invalid Rate",
                    indicator: "red",
                    message: `
                        Item <b>${row.item_name}</b> has zero value.<br><br>
                        Please enter a valid rate.
                    `
                });

                // ❗ OPTIONAL: Auto reset rate
                // row.rate = row.price_list_rate || 0;
                // frm.refresh_field("items");

                return;
            }
        setTimeout(broadcastCartToDisplay, 300);
    };

    // 3️⃣ Watch item click (item added by clicking item card)
    $(document).off('click.broadcast', '.item-wrapper')
               .on('click.broadcast', '.item-wrapper', function () {
        setTimeout(broadcastCartToDisplay, 400);
    });

    // 4️⃣ Watch numpad confirm (qty change via numpad)
    $(document).off('click.broadcast', '.numpad-btn')
               .on('click.broadcast', '.numpad-btn', function () {
        setTimeout(broadcastCartToDisplay, 400);
    });

    // 5️⃣ Watch remove item button
    $(document).off('click.broadcast', '.remove-item-btn')
               .on('click.broadcast', '.remove-item-btn', function () {
        setTimeout(broadcastCartToDisplay, 400);
    });

    console.log("✅ Realtime cart broadcast hooks attached");
}

                const pos = window.cur_pos;
                attach_realtime_cart_broadcast(pos);

                /* ============================================
                   1️⃣ LOAD FOOD STAMP FLAG AFTER ITEM ADDED
                ============================================ */

                const original_calculate = pos.frm.script_manager.trigger;

                pos.frm.script_manager.trigger = function () {

                    let result = original_calculate.apply(this, arguments);

                    if (arguments[0] === "calculate_taxes_and_totals") {

                        (pos.frm.doc.items || []).forEach(item => {

                            if (item.custom_food_stamp_enable === undefined && item.item_code) {

                                frappe.db.get_value(
                                    "Item",
                                    item.item_code,
                                    "custom_food_stamp_enable"
                                ).then(r => {

                                    item.custom_food_stamp_enable =
                                        r.message.custom_food_stamp_enable || 0;

                                    pos.frm.refresh_field("items");
                                });
                            }
                        });
                        setTimeout(broadcastCartToDisplay, 200);
                    }

                    return result;
                };


                /* ============================================
                   2️⃣ TAX MODE CHANGE
                ============================================ */

                $(document).on(
                    "change",
                    'select[data-fieldname="custom_tax_mode"]',
                    async function () {

                        let mode = $(this).val();

                        if (mode === "Non Tax") {
                            removeTaxes(pos);
                            calculateEBTSplit(pos);
                        } else {
                            restoreTaxes(pos);
                        }
                    }
                );

                console.log("✅ Stable POS EBT logic loaded");
            }

        }, 300);
    }
});


/* ============================================
   REMOVE TAX FROM FOOD ITEMS ONLY
============================================ */

// async function removeTaxes(pos) {

//     let doc = pos.frm.doc;

//     // Save original taxes
//     pos.original_tax_template = doc.taxes_and_charges;
//     pos.original_taxes = JSON.parse(JSON.stringify(doc.taxes || []));

//     // 1️⃣ Remove ALL taxes first
//     pos.frm.set_value("taxes_and_charges", "");
//     doc.taxes = [];
//     pos.frm.refresh_field("taxes");

//     pos.frm.script_manager.trigger("calculate_taxes_and_totals");

//     // 2️⃣ Now calculate tax only for NON-FOOD items
//     let non_food_tax_total = 0;

//     for (let item of (doc.items || [])) {

//         let r = await frappe.db.get_value(
//             "Item",
//             item.item_code,
//             "custom_food_stamp_enable"
//         );

//         if (r.message.custom_food_stamp_enable != 1) {

//             // apply tax only on non-food
//             let tax_rate = 0.08; // ⚠ replace with your actual tax rate (example 2%)

//             non_food_tax_total += flt(item.net_amount) * tax_rate;
//         }
//     }

//     // 3️⃣ Add tax row manually for non-food
//     if (non_food_tax_total > 0) {

//         let tax_row = pos.frm.add_child("taxes");

//         tax_row.charge_type = "Actual";
//         tax_row.account_head = pos.original_taxes?.[0]?.account_head;
//         tax_row.tax_amount = non_food_tax_total;

//         pos.frm.refresh_field("taxes");
//     }

//     pos.frm.script_manager.trigger("calculate_taxes_and_totals");

//     console.log("✅ Tax applied only on non-food items");
// }

async function removeTaxes(pos) {

    let doc = pos.frm.doc;

    // Save original tax state
    pos.original_tax_template = doc.taxes_and_charges;
    pos.original_taxes = JSON.parse(JSON.stringify(doc.taxes || []));

    // 1️⃣ Remove all taxes
    pos.frm.set_value("taxes_and_charges", "");
    doc.taxes = [];
    pos.frm.refresh_field("taxes");
    pos.frm.script_manager.trigger("calculate_taxes_and_totals");

    let ebt_total = 0;
    let non_food_total = 0;
    let non_food_items = [];

    // 2️⃣ Process each item
    for (let item of (doc.items || [])) {

        let r = await frappe.db.get_value(
            "Item",
            item.item_code,
            [
                "custom_food_stamp_enable",
                "custom_non_food",
                "custom_tobaco"
            ]
        );

        let is_food = r.message.custom_food_stamp_enable || 0;
        let is_non_food = r.message.custom_non_food || 0;
        let is_tobacco = r.message.custom_tobaco || 0;

        if (is_food == 1) {

            ebt_total += flt(item.net_amount);

        } else if (is_non_food == 1) {

            let tax = flt(item.net_amount) * 0.08;
            non_food_total += flt(item.net_amount) + tax;

            non_food_items.push(
                `${item.item_name} (8% tax)`
            );

        } else if (is_tobacco == 1) {

            let tax = flt(item.net_amount) * 0.05;
            non_food_total += flt(item.net_amount) + tax;

            non_food_items.push(
                `${item.item_name} (5% tax)`
            );
        }
    }

    // 3️⃣ Add tax row manually
    if (non_food_total > 0) {

        let tax_row = pos.frm.add_child("taxes");

        tax_row.charge_type = "Actual";
        tax_row.account_head = pos.original_taxes?.[0]?.account_head;
        tax_row.tax_amount = non_food_total - (doc.net_total - ebt_total);

        pos.frm.refresh_field("taxes");
    }

    pos.frm.script_manager.trigger("calculate_taxes_and_totals");

    // 4️⃣ Show breakdown popup
    frappe.msgprint({
        title: "EBT Breakdown",
        message: `
            <b>EBT Eligible:</b> $${ebt_total.toFixed(2)}<br><br>
            <b>Non-Food / Tobacco Items:</b><br>
            ${non_food_items.join("<br>")}<br><br>
            <b>Pay via Card/Cash:</b> $${non_food_total.toFixed(2)}
        `,
        indicator: "green"
    });

    console.log("✅ Tax applied correctly per category");
}


/* ============================================
   RESTORE TAX
============================================ */

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

    console.log("✅ Original taxes restored");
}


/* ============================================
   CALCULATE EBT SPLIT
============================================ */

async function calculateEBTSplit(pos) {

    let doc = pos.frm.doc;
    let ebt_total = 0;

    for (let item of (doc.items || [])) {

        if (!item.item_code) continue;

        let r = await frappe.db.get_value(
            "Item",
            item.item_code,
            "custom_food_stamp_enable"
        );

        let is_food = r.message.custom_food_stamp_enable || 0;

        if (is_food == 1) {
            ebt_total += flt(item.net_amount);
        }
    }

    let grand_total = flt(doc.grand_total);
    let remaining = grand_total - ebt_total;

    console.log("EBT Eligible:", ebt_total);
    console.log("Remaining:", remaining);

    frappe.msgprint({
        title: "EBT Breakdown",
        message: `
            <b>EBT Eligible:</b> $${ebt_total.toFixed(2)}<br>
            <b>Pay via Card/Cash:</b> $${remaining.toFixed(2)}
        `,
        indicator: "green"
    });
}

// function removeTaxes(pos) {

//     let doc = pos.frm.doc;

//     pos.original_tax_template = doc.taxes_and_charges;
//     pos.original_taxes = JSON.parse(JSON.stringify(doc.taxes || []));

//     pos.frm.set_value("taxes_and_charges", "");
//     doc.taxes = [];
//     pos.frm.refresh_field("taxes");

//     pos.frm.script_manager.trigger("calculate_taxes_and_totals");

//     console.log("✅ Taxes removed");
// }

// function restoreTaxes(pos) {

//     let doc = pos.frm.doc;

//     if (pos.original_tax_template) {
//         pos.frm.set_value("taxes_and_charges", pos.original_tax_template);
//     }

//     if (pos.original_taxes) {
//         doc.taxes = pos.original_taxes;
//         pos.frm.refresh_field("taxes");
//     }

//     pos.frm.script_manager.trigger("calculate_taxes_and_totals");

//     console.log("✅ Taxes restored");
// }




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


let combo_scheme_cache = null;
let combo_scheme_cache_at = 0;
let pack_conversion_running = false;

async function get_active_combo_schemes() {
    const now = Date.now();

    if (combo_scheme_cache && (now - combo_scheme_cache_at) < 60000) {
        return combo_scheme_cache;
    }

    const response = await frappe.call({
        method: "star_bazar.star_bazar.doctype.item_scheme.item_scheme.get_active_combo_schemes"
    });

    combo_scheme_cache = response.message || [];
    combo_scheme_cache_at = now;

    return combo_scheme_cache;
}

function get_combo_pack_count(items, scheme) {
    const eligible_items = new Set((scheme.items || []).map(row => row.item_code));
    const required_qty = flt(scheme.required_qty);

    if (!eligible_items.size || required_qty <= 0) return 0;

    const total_qty = (items || [])
        .filter(row => eligible_items.has(row.item_code) && !row.__combo_component)
        .reduce((total, row) => total + flt(row.qty), 0);

    return Math.floor(total_qty / required_qty);
}

function consume_combo_items(frm, scheme, pack_count) {
    const eligible_items = new Set((scheme.items || []).map(row => row.item_code));
    let qty_to_consume = flt(scheme.required_qty) * pack_count;

    for (const row of [...(frm.doc.items || [])]) {
        if (!eligible_items.has(row.item_code) || row.__combo_component || qty_to_consume <= 0) continue;

        const row_qty = flt(row.qty);
        const consumed_qty = Math.min(row_qty, qty_to_consume);
        const remaining_qty = row_qty - consumed_qty;

        qty_to_consume -= consumed_qty;

        if (remaining_qty > 0) {
            row.qty = remaining_qty;
        } else {
            frappe.model.clear_doc(row.doctype, row.name);
        }
    }
}

async function add_combo_scheme_row(frm, scheme, pack_count) {
    const new_row = frm.add_child("items");

    new_row.item_code = scheme.scheme_name;
    await Promise.resolve(frm.script_manager.trigger("item_code", new_row.doctype, new_row.name));

    new_row.qty = pack_count;
    new_row.rate = flt(scheme.selling_price);
    new_row.net_rate = flt(scheme.selling_price);
    new_row.price_list_rate = flt(scheme.selling_price);
    new_row.amount = flt(scheme.selling_price) * pack_count;
    new_row.net_amount = flt(scheme.selling_price) * pack_count;
    await Promise.resolve(frm.script_manager.trigger("qty", new_row.doctype, new_row.name));

    new_row.rate = flt(scheme.selling_price);
    new_row.net_rate = flt(scheme.selling_price);
    new_row.price_list_rate = flt(scheme.selling_price);
    new_row.amount = flt(scheme.selling_price) * pack_count;
    new_row.net_amount = flt(scheme.selling_price) * pack_count;
}

async function handle_combo_scheme_conversion() {
    if (!window.cur_pos || !window.cur_pos.frm) return false;

    const frm = window.cur_pos.frm;
    const schemes = await get_active_combo_schemes();
    let converted = false;

    for (const scheme of schemes) {
        let pack_count = get_combo_pack_count(frm.doc.items || [], scheme);

        while (pack_count > 0) {
            consume_combo_items(frm, scheme, pack_count);
            await add_combo_scheme_row(frm, scheme, pack_count);
            converted = true;

            pack_count = get_combo_pack_count(frm.doc.items || [], scheme);
        }
    }

    if (converted) {
        frm.refresh_field("items");
        frm.script_manager.trigger("calculate_taxes_and_totals");
    }

    return converted;
}

async function handle_single_item_pack_conversion(frm) {

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

async function handle_pack_conversion() {

    if (!window.cur_pos || !window.cur_pos.frm || pack_conversion_running) return;

    pack_conversion_running = true;

    try {
        let frm = window.cur_pos.frm;

        await handle_combo_scheme_conversion();
        await handle_single_item_pack_conversion(frm);
    } finally {
        pack_conversion_running = false;
    }
}

function move_latest_item_to_top() {
    const frm = window.cur_pos?.frm;
    if (!frm || !frm.doc.items || frm.doc.items.length <= 1) return;

    const items = frm.doc.items;
    const latest = items.pop();

    items.unshift(latest);

    items.forEach((row, i) => {
        row.idx = i + 1;
    });

    frm.refresh_field("items");
    frm.script_manager.trigger("calculate_taxes_and_totals");

    console.log("✅ Latest item moved to top");
}

function attach_pack_hook() {
    const wait_for_pos = setInterval(() => {

        if (!window.cur_pos || !window.cur_pos.frm) return;

        clearInterval(wait_for_pos);

        let frm = window.cur_pos.frm;

        frm.cscript.items_add = function() {
            setTimeout(async () => {
                await handle_pack_conversion();
                move_latest_item_to_top();
            }, 50);
        };

        frm.cscript.qty = function() {
            setTimeout(async () => {
                await handle_pack_conversion();
                move_latest_item_to_top();
            }, 500);
        };

        console.log("Pack conversion + latest item top hook attached ✅");

    }, 1000);
}

attach_pack_hook();

function attach_qty_update_hook() {
    const wait = setInterval(() => {
        if (!window.cur_pos || !window.cur_pos.frm) return;
        clearInterval(wait);
        // ✅ Add this new function

        const frm = window.cur_pos.frm;

        // Watch for qty field changes in Item Details popup
        $(document).on("change keyup", 
            ".item-details-container input[data-fieldname='qty']", 
            function () {
                setTimeout(() => {
                    const items = frm.doc.items || [];
                    items.forEach(item => {
                        // Recalculate amount for each item
                        item.amount = flt(item.qty) * flt(item.rate);
                        item.net_amount = flt(item.qty) * flt(item.net_rate || item.rate);
                    });
                    frm.refresh_field("items");
                    frm.script_manager.trigger("calculate_taxes_and_totals");
                }, 300);
            }
        );

        console.log("✅ Qty update hook attached");
    }, 1000);
}

attach_qty_update_hook();

// ===============================
// ONLINE ORDER REALTIME ALERT
// ===============================

let sound_allowed = false;

document.addEventListener("click", function () {
    sound_allowed = true;
});

function show_online_order_notification() {

    frappe.show_alert({
        message: `
            🔔 New Online Order<br>
            Customer: ${latest_online_order.customer}<br>
            Total: $${latest_online_order.total}
        `,
        indicator: "orange"
    });

    let audio = new Audio("/assets/star_bazar/sounds/soundreality-notification-mars-498937.mp3");
    audio.play().catch(() => {});
}

frappe.realtime.on("new_online_order", function(data) {

    console.log("New Online Order:", data);

    latest_online_order = data;

    show_online_order_notification();

    // Start repeating every 30 seconds
    if (!order_notification_interval) {

        order_notification_interval = setInterval(() => {
            show_online_order_notification();
        }, 60000);

    }

});

// Rest Pay Api
//     $(document).on('page-change', function () {
//     if (frappe.get_route()[0] !== 'point-of-sale') return;

//     let wait = setInterval(() => {
//         if (!window.cur_pos || !window.cur_pos.frm) return;

//         const pos = window.cur_pos;
//         const completeBtn = document.querySelector('.submit-order-btn');

//         if (!completeBtn) return;

//         if (pos.__clover_click_hook_attached) {
//             clearInterval(wait);
//             return;
//         }

//         clearInterval(wait);
//         pos.__clover_click_hook_attached = true;

//         completeBtn.addEventListener('click', async function (e) {
//             if (pos.__clover_skip_once) {
//                 pos.__clover_skip_once = false;
//                 return;
//             }

//             let doc = pos.frm.doc;
//             console.log("🔥 Complete Order clicked");
//             console.log("Payments:", JSON.parse(JSON.stringify(doc.payments || [])));

//             let payment_mode = null;

//             if (doc.payments && doc.payments.length > 0) {
//                 let active_payment = doc.payments.find(p => flt(p.amount) > 0);

//                 if (!active_payment && doc.payments.length === 1) {
//                     active_payment = doc.payments[0];
//                 }

//                 if (!active_payment) {
//                     active_payment = doc.payments[doc.payments.length - 1];
//                 }

//                 if (active_payment) {
//                     payment_mode = active_payment.mode_of_payment;
//                 }
//             }

//             console.log("Selected payment mode:", payment_mode);

//             if (payment_mode === "Cash") {
//                 console.log("Cash selected -> normal flow");
//                 return;
//             }

//             if (payment_mode === "Credit Card" || payment_mode === "EBT") {
//                 e.preventDefault();
//                 e.stopImmediatePropagation();

//                 frappe.dom.freeze(`Waiting for ${payment_mode} on Clover Flex...`);

//                 try {
//                     const payload = {
//                         order_number: doc.name || ("POS-" + Date.now()),
//                         register_code: "POS1",
//                         amount: Math.round(flt(doc.grand_total) * 100),
//                         payment_mode: payment_mode,
//                         customer: doc.customer,
//                         items: (doc.items || []).map(row => ({
//                             item_code: row.item_code,
//                             item_name: row.item_name,
//                             qty: row.qty,
//                             rate: row.rate,
//                             amount: row.amount
//                         }))
//                     };

//                     console.log("Sending to Django:", payload);

//                     const response = await fetch("http://127.0.0.1:8000/api/clover/start-payment/", {
//                         method: "POST",
//                         headers: {
//                             "Content-Type": "application/json"
//                         },
//                         body: JSON.stringify(payload)
//                     });

//                     const result = await response.json();

//                     console.log("Django response:", result);

//                     frappe.dom.unfreeze();

//                     if (response.ok && result.success) {
//                         frappe.show_alert({
//                             message: `${payment_mode} payment successful on Flex`,
//                             indicator: "green"
//                         });

//                         pos.__clover_skip_once = true;
//                         setTimeout(() => completeBtn.click(), 100);
//                     } else {
//                         frappe.msgprint({
//                             title: "Payment Failed",
//                             message: result.error || "Payment was not approved on Clover Flex",
//                             indicator: "red"
//                         });
//                     }

//                 } catch (err) {
//                     frappe.dom.unfreeze();
//                     console.error("Django payment error:", err);

//                     frappe.msgprint({
//                         title: "Connection Error",
//                         message: "Could not connect to Django Clover payment API.",
//                         indicator: "red"
//                     });
//                 }

//                 return false;
//             }

//             frappe.msgprint("Please select a valid payment mode before completing the order.");
//             return false;

//         }, true);

//         console.log("✅ Complete Order click hook attached");

//     }, 500);
// });

// Local Connection snpd
//     $(document).on('page-change', function () {
//     if (frappe.get_route()[0] !== 'point-of-sale') return;

//     let wait = setInterval(() => {
//         if (!window.cur_pos || !window.cur_pos.frm) return;

//         const pos = window.cur_pos;
//         const completeBtn = document.querySelector('.submit-order-btn');

//         if (!completeBtn) return;

//         if (pos.__clover_click_hook_attached) {
//             clearInterval(wait);
//             return;
//         }

//         clearInterval(wait);
//         pos.__clover_click_hook_attached = true;

//         completeBtn.addEventListener('click', async function (e) {
//             if (pos.__clover_skip_once) {
//                 pos.__clover_skip_once = false;
//                 return;
//             }

//             let doc = pos.frm.doc;
//             console.log("🔥 Complete Order clicked");
//             console.log("Payments:", JSON.parse(JSON.stringify(doc.payments || [])));

//             let payment_mode = null;

//             if (doc.payments && doc.payments.length > 0) {
//                 let active_payment = doc.payments.find(p => flt(p.amount) > 0);

//                 if (!active_payment && doc.payments.length === 1) {
//                     active_payment = doc.payments[0];
//                 }

//                 if (!active_payment) {
//                     active_payment = doc.payments[doc.payments.length - 1];
//                 }

//                 if (active_payment) {
//                     payment_mode = active_payment.mode_of_payment;
//                 }
//             }

//             console.log("Selected payment mode:", payment_mode);

//             if (payment_mode === "Cash") {
//                 console.log("Cash selected -> normal flow");
//                 return;
//             }

//             if (payment_mode === "Credit Card" || payment_mode === "EBT") {
//                 e.preventDefault();
//                 e.stopImmediatePropagation();

//                 frappe.dom.freeze(`Waiting for ${payment_mode} on Clover Flex...`);

//                 try {
//                     const payload = {
//                         orderNumber: doc.name || ("POS-" + Date.now()),
//                         externalId: (doc.name || "POS") + "-" + Date.now(),
//                         amount: Math.round(flt(doc.grand_total) * 100),
//                         paymentMode: payment_mode,
//                         registerCode: "POS1",
//                         customer: doc.customer,
//                         items: (doc.items || []).map(row => ({
//                             item_code: row.item_code,
//                             item_name: row.item_name,
//                             qty: row.qty,
//                             rate: row.rate,
//                             amount: row.amount
//                         }))
//                     };

//                     console.log("Sending to SNPD connector:", payload);

//                     const response = await fetch("http://127.0.0.1:9001/sale", {
//                         method: "POST",
//                         headers: {
//                             "Content-Type": "application/json"
//                         },
//                         body: JSON.stringify(payload)
//                     });

//                     const result = await response.json();

//                     console.log("SNPD connector response:", result);

//                     frappe.dom.unfreeze();

//                     if (response.ok && result.success) {
//                         frappe.show_alert({
//                             message: `${payment_mode} payment successful on Flex`,
//                             indicator: "green"
//                         });

//                         pos.__clover_skip_once = true;
//                         setTimeout(() => completeBtn.click(), 100);
//                     } else {
//                         frappe.msgprint({
//                             title: "Payment Failed",
//                             message: result.error || result.result || "Payment was not approved on Clover Flex",
//                             indicator: "red"
//                         });
//                     }

//                 } catch (err) {
//                     frappe.dom.unfreeze();
//                     console.error("SNPD connector error:", err);

//                     frappe.msgprint({
//                         title: "Connection Error",
//                         message: "Could not connect to local Clover SNPD connector.",
//                         indicator: "red"
//                     });
//                 }

//                 return false;
//             }

//             frappe.msgprint("Please select a valid payment mode before completing the order.");
//             return false;

//         }, true);

//         console.log("✅ Complete Order click hook attached");

//     }, 500);
// });


// // ===============================
// // LOCAL DEVICE API INTEGRATION
// // ===============================

// const DEVICE_API = "http://127.0.0.1:5055";

// let barcode_poll_started = false;
// let lb_weight_watch_started = false;
// let weighted_rows = new Set();

// let barcode_queue = [];
// let barcode_processing = false;
// let last_barcode_seen = null;

// // -------------------------------
// // Search field helpers
// // -------------------------------
// function getPOSSearchInput() {
//     return document.querySelector('input.input-with-feedback.form-control[placeholder*="Search by item code"]')
//         || document.querySelector('.search-field input')
//         || document.querySelector('.search-field .control-input input');
// }

// function setInputValue(input, value) {
//     const nativeSetter = Object.getOwnPropertyDescriptor(
//         window.HTMLInputElement.prototype,
//         "value"
//     ).set;
//     nativeSetter.call(input, value);
//     input.dispatchEvent(new Event("input", { bubbles: true }));
//     input.dispatchEvent(new Event("change", { bubbles: true }));
// }

// function sleep(ms) {
//     return new Promise(resolve => setTimeout(resolve, ms));
// }

// async function waitForSingleVisibleItem(timeout = 1200) {
//     const start = Date.now();

//     while (Date.now() - start < timeout) {
//         const visibleItems = Array.from(document.querySelectorAll(".item-wrapper"))
//             .filter(el => el.offsetParent !== null);

//         if (visibleItems.length === 1) {
//             return visibleItems[0];
//         }

//         await sleep(50);
//     }

//     return null;
// }

// async function processBarcode(barcode) {
//     const input = getPOSSearchInput();
//     if (!input) return;

//     const frm = window.cur_pos?.frm;
//     if (!frm) return;

//     const items = frm.doc.items || [];

//     // 🔍 Check if item already exists by barcode
//     let existingRow = items.find(row => row.barcode === barcode);

//     if (existingRow) {
//         // ✅ Increment qty instead of adding new row
//         let newQty = (existingRow.qty || 0) + 1;

//         await frappe.model.set_value(
//             existingRow.doctype,
//             existingRow.name,
//             "qty",
//             newQty
//         );

//         frm.refresh_field("items");
//         frm.script_manager.trigger("qty", existingRow.doctype, existingRow.name);

//         console.log("Updated qty for existing item:", barcode);
//         return;
//     }

//     // ❌ If not found → normal add
//     input.focus();
//     setInputValue(input, barcode);

//     console.log("New item added:", barcode);
// }

// async function processBarcodeQueue() {
//     if (barcode_processing) return;
//     barcode_processing = true;

//     try {
//         while (barcode_queue.length > 0) {
//             const barcode = barcode_queue.shift();
//             await processBarcode(barcode);
//         }
//     } catch (err) {
//         console.error("Barcode queue processing error:", err);
//     } finally {
//         barcode_processing = false;
//     }
// }

// // -------------------------------
// // Barcode polling
// // -------------------------------
// async function pollBarcodeFromLocalService() {
//     try {
//         const res = await fetch(`${DEVICE_API}/consume_barcode`, { cache: "no-store" });
//         const data = await res.json();

//         if (!data || !data.barcode) return;

//         // always queue it, even if same barcode comes again
//         barcode_queue.push(data.barcode);
//         processBarcodeQueue();

//     } catch (err) {
//         console.log("Barcode API not reachable:", err);
//     }
// }

// function startBarcodePolling() {
//     if (barcode_poll_started) return;
//     barcode_poll_started = true;

//     setInterval(() => {
//         if (frappe.get_route()[0] !== "point-of-sale") return;
//         pollBarcodeFromLocalService();
//     }, 120);

//     console.log("Barcode polling started");
// }

// // -------------------------------
// // Weight fetch
// // -------------------------------
// async function fetchWeightFromLocalScale() {
//     try {
//         const res = await fetch(`${DEVICE_API}/get_weight`, { cache: "no-store" });
//         const data = await res.json();

//         if (!res.ok || !data.success) {
//             console.log("Weight API returned invalid response:", data);
//             return null;
//         }

//         return data; // { success, raw, weight_raw, kg, lbs }
//     } catch (err) {
//         console.log("Weight API not reachable:", err);
//         return null;
//     }
// }

// // -------------------------------
// // Apply weight to LB items
// // -------------------------------
// async function applyWeightToRow(row) {
//     if (!row || !row.name || !row.doctype) return;
//     if (weighted_rows.has(row.name)) return;

//     weighted_rows.add(row.name);

//     try {
//         const weightData = await fetchWeightFromLocalScale();

//         if (!weightData || !weightData.lbs) {
//             weighted_rows.delete(row.name);
//             frappe.show_alert({
//                 message: __("Unable to fetch weight from scale"),
//                 indicator: "red"
//             });
//             return;
//         }

//         const lbs = parseFloat(weightData.lbs || 0);
//         if (!lbs || lbs <= 0) {
//             weighted_rows.delete(row.name);
//             frappe.show_alert({
//                 message: __("Invalid weight received from scale"),
//                 indicator: "red"
//             });
//             return;
//         }

//         await frappe.model.set_value(row.doctype, row.name, "qty", lbs);

//         if (window.cur_pos && window.cur_pos.frm) {
//             window.cur_pos.frm.refresh_field("items");
//             window.cur_pos.frm.script_manager.trigger("qty", row.doctype, row.name);
//             window.cur_pos.frm.script_manager.trigger("calculate_taxes_and_totals");
//         }

//         frappe.show_alert({
//             message: __("Weight applied: {0} lb", [lbs.toFixed(3)]),
//             indicator: "green"
//         });

//         console.log("Weight applied to row:", row.item_code, lbs);

//     } catch (err) {
//         weighted_rows.delete(row.name);
//         console.error("Error applying weight:", err);
//     }
// }

// // -------------------------------
// // Detect new LB item rows
// // -------------------------------
// function startLBWeightWatcher() {
//     if (lb_weight_watch_started) return;
//     lb_weight_watch_started = true;

//     let previous_item_count = 0;

//     setInterval(async () => {
//         if (frappe.get_route()[0] !== "point-of-sale") return;
//         if (!window.cur_pos || !window.cur_pos.frm) return;

//         const frm = window.cur_pos.frm;
//         const items = frm.doc.items || [];

//         // reset tracking when invoice is new/empty
//         if (!items.length) {
//             previous_item_count = 0;
//             weighted_rows.clear();
//             return;
//         }

//         // only react when item count increases
//         if (items.length <= previous_item_count) {
//             previous_item_count = items.length;
//             return;
//         }

//         previous_item_count = items.length;

//         // latest added row
//         const row = items[items.length - 1];
//         if (!row) return;

//         const uom = (row.uom || row.stock_uom || "").toLowerCase().trim();

//         if (uom === "lb") {
//             console.log("LB item detected, fetching weight for:", row.item_code);
//             await applyWeightToRow(row);
//         }

//     }, 500);

//     console.log("LB weight watcher started");
// }

// // -------------------------------
// // Init on POS page
// // -------------------------------
// $(document).on("page-change", function () {
//     if (frappe.get_route()[0] !== "point-of-sale") return;

//     setTimeout(() => {
//         startBarcodePolling();
//         startLBWeightWatcher();
//     }, 1000);
// });

// ===============================
// LOCAL DEVICE API INTEGRATION
// ===============================

const DEVICE_API = "http://127.0.0.1:5055";

let barcode_poll_started = false;
let lb_weight_watch_started = false;
let weighted_rows = new Set();

let barcode_queue = [];
let barcode_processing = false;

// -------------------------------
// Search field helpers
// -------------------------------
function getPOSSearchInput() {
    return document.querySelector('input.input-with-feedback.form-control[placeholder*="Search by item code"]')
        || document.querySelector('.search-field input')
        || document.querySelector('.search-field .control-input input');
}

function setInputValue(input, value) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
    ).set;
    nativeSetter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isLikelyBarcodeSearch(value) {
    return /^\d{4,}$/.test(String(value || "").trim());
}

function getCartChangeSnapshot() {
    const items = window.cur_pos?.frm?.doc?.items || [];
    return JSON.stringify(items.map(row => ({
        name: row.name,
        item_code: row.item_code,
        barcode: row.barcode,
        qty: row.qty,
        rate: row.rate,
        amount: row.amount
    })));
}

function hasCartChanged(snapshot) {
    return getCartChangeSnapshot() !== snapshot;
}

let _last_not_found_barcode = "";
let _manual_barcode_not_found_timer = null;

function clearBarcodeNotFoundTimer() {
    if (_manual_barcode_not_found_timer) {
        clearTimeout(_manual_barcode_not_found_timer);
        _manual_barcode_not_found_timer = null;
    }
}

function showProductNotFound(barcode) {
    barcode = String(barcode || "").trim();
    if (!barcode) return;

    _last_not_found_barcode = barcode;
    frappe.msgprint({
        title: __("Product Not Found"),
        message: __("No product found for barcode: {0}", [barcode]),
        indicator: "red"
    });
}

async function waitForSingleVisibleItem(timeout = 1200) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
        const visibleItems = Array.from(document.querySelectorAll(".item-wrapper"))
            .filter(el => el.offsetParent !== null);

        if (visibleItems.length === 1) {
            return visibleItems[0];
        }

        await sleep(50);
    }

    return null;
}

// Patch the search input handler to respect the flag
// Add this inside your $(document).on('page-change') or attach_realtime_cart_broadcast
$(document).on("input.barcode_suppress", ".search-field input", function(e) {
    if (_suppress_search_input) {
        e.stopImmediatePropagation();
        setInputValue(this, "");
        return false;
    }
});
let _barcode_processing_lock = false;

async function processBarcode(barcode) {
    const isAlwaysNewLine = ["2000", "2014"].includes(String(barcode).trim());
    clearBarcodeNotFoundTimer();

    // ✅ Hard lock — if already processing, ignore completely
    if (_barcode_processing_lock) {
        console.log("🔒 Barcode locked, ignoring:", barcode);
        return;
    }
    _barcode_processing_lock = true;

    try {
        if (isAlwaysNewLine) {
            const pos = window.cur_pos;
            if (!pos || !pos.frm) return;

            const frm = pos.frm;

            // ✅ Kill search input immediately
            _suppress_search_input = true;
            const input = getPOSSearchInput();
            if (input) {
                input.blur();
                setInputValue(input, "");
            }

            await sleep(250);

            const new_row = frappe.model.add_child(frm.doc, "items");
            new_row.item_code = "General Item";
            new_row.qty = 1;

            await frm.script_manager.trigger("item_code", new_row.doctype, new_row.name);

            frm.refresh_field("items");
            frm.script_manager.trigger("calculate_taxes_and_totals");

            await sleep(300);
            _suppress_search_input = false;

            console.log("✅ New line added for barcode:", barcode);
            return;
        }

        // --- normal barcode flow ---
        const input = getPOSSearchInput();
        if (!input) return;

        const beforeSnapshot = getCartChangeSnapshot();

        input.focus();
        setInputValue(input, barcode);

        const start = Date.now();
        let itemAdded = false;

        while (Date.now() - start < 3000) {
            if (hasCartChanged(beforeSnapshot)) {
                itemAdded = true;
                break;
            }
            await sleep(50);
        }

        if (!itemAdded) {
            const itemEl = await waitForSingleVisibleItem(500);
            if (itemEl) {
                itemEl.click();
                await sleep(800);
                itemAdded = hasCartChanged(beforeSnapshot);
            }
        }

        if (!itemAdded) {
            showProductNotFound(barcode);
        }

        setInputValue(input, "");
        clearBarcodeNotFoundTimer();
        await sleep(100);

    } finally {
        clearBarcodeNotFoundTimer();
        // ✅ Always release lock
        _barcode_processing_lock = false;
    }
}
async function processBarcodeQueue() {
    if (barcode_processing) return;
    barcode_processing = true;

    try {
        while (barcode_queue.length > 0) {
            const barcode = barcode_queue.shift();
            await processBarcode(barcode);
        }
    } catch (err) {
        console.error("Barcode queue processing error:", err);
    } finally {
        barcode_processing = false;
    }
}

// -------------------------------
// Barcode polling
// -------------------------------
async function pollBarcodeFromLocalService() {
    // ✅ Don't even poll if currently processing
    if (_barcode_processing_lock) return;

    try {
        const res = await fetch(`${DEVICE_API}/consume_barcode`, { cache: "no-store" });
        const data = await res.json();

        if (!data || !data.barcode) return;
        const barcode = String(data.barcode).trim();
        const isAlwaysNewLine = ["2000", "2014"].includes(barcode);

        console.log("📦 Polled barcode:", barcode, "isAlwaysNewLine:", isAlwaysNewLine);

        // ✅ Don't use queue for always-new-line — process directly and block
        if (isAlwaysNewLine) {
            await processBarcode(barcode);
        } else {
            barcode_queue.push(barcode);
            processBarcodeQueue();
        }

    } catch (err) {
        console.log("Barcode API not reachable:", err);
    }
}

function startBarcodePolling() {
    if (barcode_poll_started) return;
    barcode_poll_started = true;

    setInterval(() => {
        if (frappe.get_route()[0] !== "point-of-sale") return;
        pollBarcodeFromLocalService();
    }, 120);

    console.log("Barcode polling started");
}

// -------------------------------
// Weight fetch
// -------------------------------
async function fetchWeightFromLocalScale() {
    try {
        const res = await fetch(`${DEVICE_API}/get_weight`, { cache: "no-store" });
        const data = await res.json();

        if (!res.ok || !data.success) {
            console.log("Weight API returned invalid response:", data);
            return null;
        }

        return data; // { success, raw, weight_raw, kg, lbs }
    } catch (err) {
        console.log("Weight API not reachable:", err);
        return null;
    }
}

// -------------------------------
// Apply weight to LB items
// -------------------------------
async function applyWeightToRow(row) {
    if (!row || !row.name || !row.doctype) return;
    if (weighted_rows.has(row.name)) return;

    weighted_rows.add(row.name);

    try {
        const weightData = await fetchWeightFromLocalScale();

        if (!weightData || !weightData.lbs) {
            weighted_rows.delete(row.name);
            frappe.show_alert({
                message: __("Unable to fetch weight from scale"),
                indicator: "red"
            });
            return;
        }

        const lbs = parseFloat(weightData.lbs || 0);
        if (!lbs || lbs <= 0) {
            weighted_rows.delete(row.name);
            frappe.show_alert({
                message: __("Invalid weight received from scale"),
                indicator: "red"
            });
            return;
        }

        await frappe.model.set_value(row.doctype, row.name, "qty", lbs);

        if (window.cur_pos && window.cur_pos.frm) {
            window.cur_pos.frm.refresh_field("items");
            window.cur_pos.frm.script_manager.trigger("qty", row.doctype, row.name);
            window.cur_pos.frm.script_manager.trigger("calculate_taxes_and_totals");
        }

        frappe.show_alert({
            message: __("Weight applied: {0} lb", [lbs.toFixed(3)]),
            indicator: "green"
        });

        console.log("Weight applied to row:", row.item_code, lbs);

    } catch (err) {
        weighted_rows.delete(row.name);
        console.error("Error applying weight:", err);
    }
}

// -------------------------------
// Detect new LB item rows
// -------------------------------
function startLBWeightWatcher() {
    if (lb_weight_watch_started) return;
    lb_weight_watch_started = true;

    let previous_item_count = 0;

    setInterval(async () => {
        if (frappe.get_route()[0] !== "point-of-sale") return;
        if (!window.cur_pos || !window.cur_pos.frm) return;

        const frm = window.cur_pos.frm;
        const items = frm.doc.items || [];

        // reset tracking when invoice is new/empty
        if (!items.length) {
            previous_item_count = 0;
            weighted_rows.clear();
            return;
        }

        // only react when item count increases
        if (items.length <= previous_item_count) {
            previous_item_count = items.length;
            return;
        }

        previous_item_count = items.length;

        // latest added row
        const row = items[items.length - 1];
        if (!row) return;

        const uom = (row.uom || row.stock_uom || "").toLowerCase().trim();

        if (uom === "lb") {
            console.log("LB item detected, fetching weight for:", row.item_code);
            await applyWeightToRow(row);
        }

    }, 500);

    console.log("LB weight watcher started");
}

// ===============================
// PATCH POS TO ALWAYS ADD NEW LINE FOR 2000 & 2014
// ===============================
// Track the current search value to know what barcode was just searched
let _current_search_value = "";
let _special_item_counter = 0;

$(document).off("input.barcode_not_found", ".search-field input");
$(document).on("input.barcode_not_found", ".search-field input", function() {
    _current_search_value = $(this).val().trim();
    clearBarcodeNotFoundTimer();

    if (_barcode_processing_lock) return;

    if (!isLikelyBarcodeSearch(_current_search_value)) {
        if (!_current_search_value) {
            _last_not_found_barcode = "";
        }
        return;
    }

    const searched_barcode = _current_search_value;
    const before_snapshot = getCartChangeSnapshot();

    _manual_barcode_not_found_timer = setTimeout(() => {
        _manual_barcode_not_found_timer = null;
        if (frappe.get_route()[0] !== "point-of-sale") return;

        const input = getPOSSearchInput();
        const current_value = String(input?.value || "").trim();
        if (current_value !== searched_barcode) return;

        const visible_items = Array.from(document.querySelectorAll(".item-wrapper, .pos .list-item-container"))
            .filter(el => el.offsetParent !== null);

        if (!hasCartChanged(before_snapshot) && visible_items.length === 0) {
            showProductNotFound(searched_barcode);
        }
    }, 1800);
});

// ✅ Intercept item selection for 2000/2014: add unique item to prevent merging
$(document).on("click", ".pos .list-item-container", function(e) {
    const isAlwaysNewLine = ["2000", "2014"].includes(_current_search_value);
    
    if (!isAlwaysNewLine) return; // Let normal POS behavior handle other items
    
    // Prevent default POS behavior for 2000/2014
    e.preventDefault();
    e.stopImmediatePropagation();
    
    if (window.cur_pos && window.cur_pos.frm) {
        const frm = window.cur_pos.frm;
        
        // Generate a unique item code so each row is separate
        _special_item_counter++;
        const unique_item_code = `SPECIAL_${_current_search_value}_${_special_item_counter}`;
        
        // Manually add a new row with unique item code
        const new_row = frappe.model.add_child(frm.doc, "items");
        new_row.item_code = unique_item_code;
        new_row.item_name = "General Item";
        new_row.qty = 1;
        new_row.rate = 0;
        
        // Trigger item_code handler to set defaults if needed
        frm.script_manager.trigger("item_code", new_row.doctype, new_row.name);
        
        frm.refresh_field("items");
        frm.script_manager.trigger("calculate_taxes_and_totals");
        
        // Clear search
        $(".search-field input").val("").focus();
        _current_search_value = "";
        
        console.log("✅ New line added for barcode with unique code:", unique_item_code);
    }
    
    return false;
});

// -------------------------------
// Init on POS page
// -------------------------------
$(document).on("page-change", function () {
    if (frappe.get_route()[0] !== "point-of-sale") return;

    setTimeout(() => {
        startBarcodePolling();
        startLBWeightWatcher();
    }, 1000);
});

// ===============================
// SHOW NEWEST CART ITEM ON TOP
// ===============================

// function attachCartOrderFix() {

//     const observer = new MutationObserver(() => {

//         const cart = document.querySelector(
//             '.cart-items, .cart-item-container, .items-container'
//         );

//         if (!cart) return;

//         const rows = Array.from(cart.children);

//         if (rows.length > 1) {
//             cart.prepend(rows[rows.length - 1]);
//         }
//     });

//     observer.observe(document.body, {
//         childList: true,
//         subtree: true
//     });

//     console.log("✅ POS cart order hook attached");
// }

// $(document).on("page-change", function () {
//     if (frappe.get_route()[0] !== "point-of-sale") {
//         return;
//     }

//     setTimeout(() => {
//         attachCartOrderFix();
//     }, 1500);
// });
