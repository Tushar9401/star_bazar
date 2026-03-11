import frappe

def notify_new_online_order(doc, method):

    print("ONLINE ORDER EVENT TRIGGERED")

    frappe.publish_realtime(
        "new_online_order",
        {
            "order_id": doc.order_id,
            "customer": doc.customer_name,
            "total": doc.order_total
        },
        after_commit=True
    )