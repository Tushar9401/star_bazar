import frappe
import requests

MERCHANT_ID = "971RRN5EG3JJ1"
ACCESS_TOKEN = "c6004c49-d6c2-38ea-be10-8fd1621268c4"

CLOVER_URL = "https://sandbox.dev.clover.com/v3/merchants"

headers = {
    "Authorization": f"Bearer {ACCESS_TOKEN}",
    "Content-Type": "application/json"
}

def create_clover_order():

    url = f"{CLOVER_URL}/{MERCHANT_ID}/orders"

    data = {
        "state": "open"
    }

    res = requests.post(url, headers=headers, json=data)

    return res.json()

def add_item(order_id, name, price):

    url = f"{CLOVER_URL}/{MERCHANT_ID}/line_items"

    body = {
        "orderRef": {
            "id": order_id
        },
        "name": name,
        "price": price
    }

    res = requests.post(url, headers=headers, json=body)

    return res.json()

def create_payment(order_id, amount):

    url = "https://sandbox.dev.clover.com/connect/v1/payments"

    body = {
        "merchant_id": MERCHANT_ID,
        "amount": amount,
        "external_payment_id": order_id,
        "tip_amount": 0,
        "currency": "USD"
    }

    res = requests.post(url, headers=headers, json=body)

    return res.json()

@frappe.whitelist()
def start_clover_payment(items, total):

    order = create_clover_order()
    order_id = order["id"]

    for item in items:

        add_item(
            order_id,
            item["item_name"],
            int(item["price"] * 100)
        )

    payment = create_payment(order_id, int(total * 100))

    return {
        "order_id": order_id,
        "payment": payment
    }