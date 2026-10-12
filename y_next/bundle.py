"""De gebouwde frontend van Y-next.

De bundel staat in `public/app/` en Frappe serveert die map op
`/assets/y_next/app/`. Vite schrijft er een manifest bij waarin staat welk
bestand het startpunt is; de bestandsnamen bevatten een hash en veranderen dus
per build.
"""

import json
import os

import frappe

BASE_URL = "/assets/y_next/app/"


def parse_manifest(manifest: dict) -> dict | None:
	"""Geeft het startbestand en zijn stylesheets uit een Vite-manifest."""
	for chunk in manifest.values():
		if isinstance(chunk, dict) and chunk.get("isEntry"):
			return {"js": chunk["file"], "css": list(chunk.get("css") or [])}
	return None


def get_entry() -> dict | None:
	"""Het startbestand van de geïnstalleerde bundel, of None als er geen bundel is."""
	pad = frappe.get_app_path("y_next", "public", "app", ".vite", "manifest.json")
	if not os.path.exists(pad):
		return None
	with open(pad, encoding="utf-8") as bestand:
		return parse_manifest(json.load(bestand))
