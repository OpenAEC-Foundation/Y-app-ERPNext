"""Koppeling met de mailserver: agenda, afwezigheid, uitnodigingen en verwijderen.

Deze functies werken met een mailserver die JMAP en CalDAV spreekt en een
serviceaccount namens gebruikers laat handelen. Het adres en het
serviceaccount staan in de instelling `Agenda Koppeling`; zolang die niet is
ingevuld, melden de functies dat de koppeling uitstaat.
"""
