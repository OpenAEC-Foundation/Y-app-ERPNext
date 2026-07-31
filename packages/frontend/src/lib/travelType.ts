/**
 * Resolves the valid options for the "custom_travel_type" custom field on
 * the "Travel Itinerary" child doctype (the km-registration rows on a
 * Travel Request). This is a per-tenant ERPNext customisation — Y-app
 * doesn't control its fieldtype or options, so hardcoding a value (e.g.
 * "Business") can be rejected by ERPNext validation with no way for the
 * user to pick something that IS valid on their instance.
 *
 * Strategy: look up the field definition via the "Custom Field" doctype
 * (dt="Travel Itinerary", fieldname="custom_travel_type"). If it's a
 * Select, split its newline-separated options. If it's a Link, fetch the
 * first page of the linked doctype's records as options. If the lookup
 * fails — field doesn't exist, or the user's role can't read "Custom
 * Field" (Frappe requires System Manager for that by default) — callers
 * fall back to an optional free-text input instead of guessing a value.
 */

import { fetchList } from "./erpnext";
import { getActiveInstanceId } from "./instances";

export interface TravelTypeConfig {
  kind: "select" | "link" | "none";
  options: string[];
}

const NONE_CONFIG: TravelTypeConfig = { kind: "none", options: [] };

const cache = new Map<string, Promise<TravelTypeConfig>>();

export async function fetchTravelTypeConfig(): Promise<TravelTypeConfig> {
  const instanceId = getActiveInstanceId() || "default";
  const cached = cache.get(instanceId);
  if (cached) return cached;

  const promise = (async (): Promise<TravelTypeConfig> => {
    try {
      const rows = await fetchList<{ fieldtype?: string; options?: string }>("Custom Field", {
        fields: ["fieldtype", "options"],
        filters: [
          ["dt", "=", "Travel Itinerary"],
          ["fieldname", "=", "custom_travel_type"],
        ],
        limit_page_length: 1,
      });
      const field = rows[0];
      if (!field) return NONE_CONFIG;

      if (field.fieldtype === "Select" && field.options) {
        const options = field.options
          .split("\n")
          .map((o) => o.trim())
          .filter(Boolean);
        return options.length > 0 ? { kind: "select", options } : NONE_CONFIG;
      }

      if (field.fieldtype === "Link" && field.options) {
        const linked = await fetchList<{ name: string }>(field.options, {
          fields: ["name"],
          limit_page_length: 100,
        });
        return linked.length > 0
          ? { kind: "link", options: linked.map((r) => r.name) }
          : NONE_CONFIG;
      }

      return NONE_CONFIG;
    } catch {
      return NONE_CONFIG;
    }
  })();

  cache.set(instanceId, promise);
  return promise;
}
