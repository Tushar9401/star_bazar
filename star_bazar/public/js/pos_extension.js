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

                console.log("POS Custom buttons initialized.");
            }
        }, 500);
    }
});