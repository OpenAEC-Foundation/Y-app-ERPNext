# Copyright (c) 2026, OpenAEC Foundation and contributors
# For license information, please see license.txt

import secrets

import frappe
from frappe.model.document import Document


class YAgendaDeellink(Document):
	"""Een link waarmee een agenda zonder inlog als iCal-abonnement te lezen is.

	Wie de code heeft, ziet de agenda. De code is daarom lang en
	onvoorspelbaar, wordt hier gemaakt en is niet te kiezen of te wijzigen. Een
	link intrekken is dit document uitzetten of verwijderen.
	"""

	def before_insert(self):
		self.code = secrets.token_urlsafe(32)

	def validate(self):
		if not self.is_new():
			self.code = frappe.db.get_value(self.doctype, self.name, "code")
