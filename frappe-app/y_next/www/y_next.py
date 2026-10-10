"""De pagina /y-next: het HTML-omhulsel waarin de frontend start."""

import frappe
import frappe.sessions

from y_next.bundle import BASE_URL, get_entry

# De pagina draagt het CSRF-token van de sessie en mag daarom nooit uit een
# cache komen: een bezoeker die uitgelogd binnenkwam, zou na het inloggen
# anders de pagina van de gast terugkrijgen.
no_cache = 1


def get_context(context):
	bundel = get_entry()
	context.no_cache = 1
	context.base_url = BASE_URL
	context.entry_js = bundel["js"] if bundel else None
	context.entry_css = bundel["css"] if bundel else []
	context.csrf_token = ""
	if frappe.session.user != "Guest":
		context.csrf_token = frappe.sessions.get_csrf_token()
		frappe.db.commit()
	return context
