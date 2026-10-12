import frappe
from frappe.tests import IntegrationTestCase

EIGEN_DOCTYPES = [
	"Y Meeting Note",
	"Y Next Setting",
	"Y Onkostensoort",
	"Y Km Registratie",
	"Y Onkosten",
	"Agenda Koppeling",
	"Y Agenda Deellink",
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


class TestInrichting(IntegrationTestCase):
	"""Wat de app naast de eigen doctypes op een site inricht."""

	def test_eigen_velden_bestaan(self):
		from y_next.setup import install

		aantal = 0
		for doctype, velden in install.load("custom_fields.json").items():
			if not frappe.db.exists("DocType", doctype):
				continue
			meta = frappe.get_meta(doctype)
			for veld in velden:
				with self.subTest(veld=f"{doctype}.{veld['fieldname']}"):
					gevonden = meta.get_field(veld["fieldname"])
					self.assertIsNotNone(gevonden)
					self.assertEqual(gevonden.fieldtype, veld["fieldtype"])
					# Het is een veld van de app en geen veld dat ERPNext zelf al had.
					self.assertTrue(
						frappe.db.exists("Custom Field", {"dt": doctype, "fieldname": veld["fieldname"]})
					)
					aantal += 1
		# 23 velden op doctypes van Frappe en ERPNext zelf; 7 erbij op een site met HRMS.
		self.assertEqual(aantal, 30 if frappe.db.exists("DocType", "Travel Request") else 23)

	def test_velden_staan_achter_een_bestaand_veld(self):
		from y_next.setup import install

		for doctype, velden in install.load("custom_fields.json").items():
			if not frappe.db.exists("DocType", doctype):
				continue
			meta = frappe.get_meta(doctype)
			for veld in velden:
				with self.subTest(veld=f"{doctype}.{veld['fieldname']}"):
					self.assertTrue(meta.has_field(veld["insert_after"]))

	def test_rechten_op_bestaande_doctypes(self):
		from y_next.setup import install

		toegepast = 0
		for regel in install.load("permissions.json"):
			if not frappe.db.exists("DocType", regel["doctype"]):
				continue
			with self.subTest(regel=regel):
				waarde = frappe.db.get_value(
					"Custom DocPerm",
					{
						"parent": regel["doctype"],
						"role": regel["role"],
						"permlevel": regel["permlevel"],
						"if_owner": 0,
					},
					regel["ptype"],
				)
				self.assertEqual(waarde, regel["value"])
				toegepast += 1
		# Communication en ToDo bestaan altijd; de regels voor HRMS alleen met die app.
		self.assertGreaterEqual(toegepast, 6)

	def test_stamgegevens(self):
		from y_next.setup import install

		for record in install.load("master_records.json"):
			if not frappe.db.exists("DocType", record["doctype"]):
				continue
			with self.subTest(record=record["name"]):
				self.assertTrue(frappe.db.exists(record["doctype"], record["name"]))
		self.assertEqual(frappe.db.get_value("Y Next Setting", "km-tarief", "setting_value"), "0.23")

	def test_aangepast_tarief_overleeft_een_migratie(self):
		from y_next.setup import install

		self.addCleanup(frappe.db.rollback)
		frappe.db.set_value("Y Next Setting", "km-tarief", "setting_value", "0.25")
		install.sync_master_records()
		self.assertEqual(frappe.db.get_value("Y Next Setting", "km-tarief", "setting_value"), "0.25")

	def test_opnieuw_toepassen_verandert_niets(self):
		from y_next.setup import install

		def tel():
			return (
				frappe.db.count("Custom Field"),
				frappe.db.count("Custom DocPerm"),
				frappe.db.count("Y Onkostensoort"),
				frappe.db.count("Y Next Setting"),
			)

		voor = tel()
		install.sync_all()
		install.sync_all()
		self.assertEqual(tel(), voor)

	def test_onbekend_doctype_of_onbekende_rol_wordt_overgeslagen(self):
		from y_next.setup import install

		install.sync_custom_fields(
			{"Bestaat Niet": [{"fieldname": "custom_x", "label": "X", "fieldtype": "Data", "insert_after": "y"}]}
		)
		install.sync_permissions(
			[
				{"doctype": "Bestaat Niet", "role": "Employee", "permlevel": 0, "ptype": "read", "value": 1},
				{"doctype": "ToDo", "role": "Bestaat Niet", "permlevel": 0, "ptype": "read", "value": 1},
			]
		)
		install.sync_master_records([{"doctype": "Bestaat Niet", "name": "x", "payload": {"name": "x"}}])
		self.assertFalse(frappe.db.exists("Custom Field", {"dt": "Bestaat Niet"}))
		self.assertFalse(frappe.db.exists("Custom DocPerm", {"parent": "ToDo", "role": "Bestaat Niet"}))
