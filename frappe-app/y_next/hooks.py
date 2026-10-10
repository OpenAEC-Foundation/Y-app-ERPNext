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

# De frontend roept de serverfuncties aan onder een korte naam
# (/api/method/mijn_postbussen). Frappe past deze tabel toe vóórdat het naar
# Server Scripts kijkt, dus de app-code gaat voor op een script met dezelfde
# naam.
override_whitelisted_methods = {
	"mijn_postbussen": "y_next.api.postbussen.mijn_postbussen",
	"mail_bijwerken": "y_next.api.mail.mail_bijwerken",
	"mail_ophalen": "y_next.api.mail.mail_ophalen",
	"agenda_collegas": "y_next.api.agenda.agenda_collegas",
	"berichten_collegas": "y_next.api.berichten.berichten_collegas",
	"berichten_foto": "y_next.api.berichten.berichten_foto",
	"berichten_verwijderen": "y_next.api.berichten.berichten_verwijderen",
	"y_next_mogelijkheden": "y_next.api.mogelijkheden.y_next_mogelijkheden",
	# Mailserver: doen hun werk zodra Agenda Koppeling is ingevuld.
	"agenda_ophalen": "y_next.api.mailserver.agenda.agenda_ophalen",
	"agenda_schrijven": "y_next.api.mailserver.agenda.agenda_schrijven",
	"mail_afwezigheid": "y_next.api.mailserver.afwezigheid.mail_afwezigheid",
	"mail_uitnodiging": "y_next.api.mailserver.post.mail_uitnodiging",
	"mail_verwijderen": "y_next.api.mailserver.post.mail_verwijderen",
}

add_to_apps_screen = [
	{
		"name": "y_next",
		"logo": "/assets/y_next/app/y-logo.svg",
		"title": "Y-next",
		"route": "/y-next",
	}
]
