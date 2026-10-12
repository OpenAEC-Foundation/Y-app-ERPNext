"""Interne, transactionele ontvangstbevestiging van één Office-save."""

import frappe
from frappe.model.document import Document


class YOfficeSave(Document):
	def validate(self):
		if not self.flags.office_save_internal or self.actor != frappe.session.user:
			raise frappe.PermissionError("office_receipt_is_internal")
		if not self.is_new():
			previous = self.get_doc_before_save()
			for field in ("operation_id", "actor", "source_file", "expected_sha256", "input_sha256", "upload_filename"):
				if previous.get(field) != self.get(field):
					raise frappe.PermissionError("office_receipt_is_immutable")
			if previous.result_file or not self.result_file or not self.result_sha256:
				raise frappe.PermissionError("office_receipt_is_immutable")
