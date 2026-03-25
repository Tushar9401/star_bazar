import frappe
import base64
import os
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

@frappe.whitelist(allow_guest=True)
def sign_qz():
    try:
        data = frappe.form_dict.get("request", "")

        key_path = frappe.get_app_path(
            "star_bazar",
            "private",
            "private-key.pem"
        )

        if not os.path.exists(key_path):
            raise Exception(f"Key not found: {key_path}")

        with open(key_path, "rb") as f:
            private_key = serialization.load_pem_private_key(
                f.read(),
                password=None
            )

        signature = private_key.sign(
            data.encode("utf-8"),
            padding.PKCS1v15(),
            hashes.SHA512()
        )

        frappe.local.response["type"] = "text/plain"
        return base64.b64encode(signature).decode("utf-8")

    except Exception:
        frappe.log_error(frappe.get_traceback(), "QZ SIGN ERROR")
        raise