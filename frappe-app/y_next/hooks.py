app_name = "y_next"
app_title = "Y-next"
app_publisher = "OpenAEC Foundation"
app_description = "Web interface for ERPNext"
app_email = "info@openaec.org"
app_license = "mit"

# De enige vereiste app. Y-next leunt alleen op wat in kale ERPNext zit of op
# wat deze app zelf meebrengt; al het andere is een optionele koppeling.
required_apps = ["erpnext"]

# Velden, rechten en stamgegevens. Ook na elke migratie, zodat een definitie
# voor een later geïnstalleerde app alsnog wordt toegepast.
after_install = "y_next.setup.install.after_install"
after_migrate = "y_next.setup.install.after_migrate"

add_to_apps_screen = [
	{
		"name": "y_next",
		"logo": "/assets/y_next/app/y-logo.svg",
		"title": "Y-next",
		"route": "/y-next",
	}
]
