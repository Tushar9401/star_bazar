app_name = "star_bazar"
app_title = "Star Bazar"
app_publisher = "Tushar Thakkar"
app_description = "Star Bazar"
app_email = "tusharthakkar1996@gmail.com"
app_license = "mit"
# app_include_css = "/assets/star_bazar/css/pos_custom_final.css"


scheduler_events = {
    "daily": [
        "star_bazar.star_bazar.cron.item_scheme.expire_item_schemes"
    ]
}
fixtures = [
    {
        "doctype": "Print Format",
        "filters": {
            "name": ["in", ["POS Invoice"]]
        }
    }
]

app_include_js = [
    # "https://cdn.jsdelivr.net/npm/qz-tray/qz-tray.js",
    "/assets/star_bazar/js/qz-tray.js",
]
# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "star_bazar",
# 		"logo": "/assets/star_bazar/logo.png",
# 		"title": "Star Bazar",
# 		"route": "/star_bazar",
# 		"has_permission": "star_bazar.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/star_bazar/css/star_bazar.css"
# app_include_js = "/assets/star_bazar/js/point_of_sale.js"

# include js, css files in header of web template
# web_include_css = "/assets/star_bazar/css/star_bazar.css"
# web_include_js = "/assets/star_bazar/js/star_bazar.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "star_bazar/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

page_js = {
    "point-of-sale": "public/js/pos_extension.js"
}

doctype_js = {
    "Item": "public/js/item.js"
}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "star_bazar/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "star_bazar.utils.jinja_methods",
# 	"filters": "star_bazar.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "star_bazar.install.before_install"
# after_install = "star_bazar.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "star_bazar.uninstall.before_uninstall"
# after_uninstall = "star_bazar.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "star_bazar.utils.before_app_install"
# after_app_install = "star_bazar.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "star_bazar.utils.before_app_uninstall"
# after_app_uninstall = "star_bazar.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "star_bazar.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }
doc_events = {
    "Item": {
        "before_validate": "star_bazar.item.update_item_margin",
        "on_update": "star_bazar.item.update_item_price_from_standard_rate"
    },
    "Hold Invoice": {
        # "after_insert": "star_bazar.hold.update_hold_stock",
        "on_update": "star_bazar.hold.update_hold_stock",
        "on_trash": "star_bazar.hold.restore_hold_stock"
    },
    "Online Order": {
        "after_insert": "star_bazar.online_order.notify_new_online_order"
    }
}

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"star_bazar.tasks.all"
# 	],
# 	"daily": [
# 		"star_bazar.tasks.daily"
# 	],
# 	"hourly": [
# 		"star_bazar.tasks.hourly"
# 	],
# 	"weekly": [
# 		"star_bazar.tasks.weekly"
# 	],
# 	"monthly": [
# 		"star_bazar.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "star_bazar.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "star_bazar.event.get_events"
# }
# override_whitelisted_methods = {
#     "erpnext.accounts.doctype.pricing_rule.pricing_rule.apply_pricing_rule":
#         "star_bazar.overrides.pricing_rule_override.apply_pricing_rule"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "star_bazar.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["star_bazar.utils.before_request"]
# after_request = ["star_bazar.utils.after_request"]

# Job Events
# ----------
# before_job = ["star_bazar.utils.before_job"]
# after_job = ["star_bazar.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"star_bazar.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []
