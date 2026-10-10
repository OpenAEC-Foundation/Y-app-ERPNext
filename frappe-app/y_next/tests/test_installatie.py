import frappe
from frappe.tests import IntegrationTestCase

EIGEN_DOCTYPES = [
	"Y Meeting Note",
	"Y Next Setting",
	"Y Onkostensoort",
	"Y Km Registratie",
	"Y Onkosten",
	"Agenda Koppeling",
]


def rechten(doctype: str, rol: str, permlevel: int = 0) -> list:
	"""De rechtenrijen van een rol in de definitie van een doctype."""
	return [
		rij
		for rij in frappe.get_meta(doctype).permissions
		if rij.role == rol and rij.permlevel == permlevel
	]


class TestEigenDoctypes(IntegrationTestCase):
	def test_eigen_doctypes_horen_bij_de_app(self):
		for naam in EIGEN_DOCTYPES:
			with self.subTest(doctype=naam):
				self.assertEqual(
					frappe.db.get_value("DocType", naam, ["module", "custom"]),
					("Y Next", 0),
				)

	def test_instellingen_zijn_alleen_leesbaar_voor_medewerkers(self):
		# De rijen in Y Next Setting bepalen onder meer welke extensies er
		# draaien; schrijven is daarom voorbehouden aan de beheerder.
		(rij,) = rechten("Y Next Setting", "Projects User")
		self.assertEqual((rij.read, rij.write, rij.create, rij.delete), (1, 0, 0, 0))
		(beheer,) = rechten("Y Next Setting", "System Manager")
		self.assertEqual((beheer.read, beheer.write, beheer.create, beheer.delete), (1, 1, 1, 1))

	def test_medewerker_ziet_alleen_eigen_declaraties(self):
		for doctype in ("Y Km Registratie", "Y Onkosten"):
			with self.subTest(doctype=doctype):
				(rij,) = rechten(doctype, "Employee")
				self.assertEqual((rij.if_owner, rij.read, rij.write, rij.create, rij.delete), (1, 1, 1, 1, 1))
				# De goedkeurvelden staan op permlevel 1: lezen mag, schrijven niet.
				(stempel,) = rechten(doctype, "Employee", permlevel=1)
				self.assertEqual((stempel.read, stempel.write), (1, 0))
				meta = frappe.get_meta(doctype)
				self.assertEqual(meta.get_field("goedgekeurd_door").permlevel, 1)
				self.assertEqual(meta.get_field("goedgekeurd_op").permlevel, 1)

	def test_naamgeving(self):
		self.assertEqual(frappe.get_meta("Y Meeting Note").autoname, "format:YMN-{YYYY}-{#####}")
		self.assertEqual(frappe.get_meta("Y Km Registratie").autoname, "format:YKM-{YYYY}-{#####}")
		self.assertEqual(frappe.get_meta("Y Onkosten").autoname, "format:YON-{YYYY}-{#####}")
		self.assertEqual(frappe.get_meta("Y Next Setting").autoname, "field:setting_key")
		self.assertEqual(frappe.get_meta("Y Onkostensoort").autoname, "field:soort_naam")

	def test_mailserverinstelling_is_enkelvoudig_en_voor_de_beheerder(self):
		meta = frappe.get_meta("Agenda Koppeling")
		self.assertEqual(meta.issingle, 1)
		self.assertEqual(
			[veld.fieldname for veld in meta.fields],
			["enabled", "server_url", "service_account", "service_password"],
		)
		self.assertEqual(meta.get_field("service_password").fieldtype, "Password")
		self.assertEqual({rij.role for rij in meta.permissions}, {"System Manager"})
