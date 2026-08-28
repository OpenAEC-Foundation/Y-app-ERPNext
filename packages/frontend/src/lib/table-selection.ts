/**
 * Rij-selectie voor een tabel met bulkacties — puur, zonder React of DOM.
 *
 * Waarom apart van de pagina: de interessante gevallen (shift-bereik na een
 * herordening, "selecteer alle N die aan het filter voldoen", het opruimen van
 * verdwenen rijen na een refresh) zijn precies de gevallen die je in een
 * component niet fatsoenlijk kunt testen. Hier zijn het functies over een Set
 * en een anchor, en dus wél.
 *
 * Het idioom volgt de multi-select van de berichtenlijst: één klik toggelt,
 * Ctrl/Cmd-klik toggelt óók (voor wie het gewend is), Shift-klik trekt een
 * bereik vanaf het anchor. Eén bewust verschil: hier zit de klik op een
 * *checkbox* en niet op de rij zelf (de rij opent de taak), dus een gewone klik
 * wist de rest van de selectie NIET — een vinkje dat andere vinkjes uitzet is
 * precies het gedrag waarop mensen per ongeluk 80 geselecteerde taken kwijt
 * zijn. Shift-klik is om dezelfde reden optellend en verschuift het anchor niet.
 */

export interface SelectionState {
  /** Geselecteerde rij-id's (documentnamen). */
  readonly selected: ReadonlySet<string>;
  /** Laatst aangeklikte rij — het ankerpunt voor een Shift-bereik. */
  readonly anchor: string | null;
}

export interface ClickModifiers {
  shift?: boolean;
  ctrl?: boolean;
  meta?: boolean;
}

/** Lege selectie. Bewust een functie: een gedeelde constante zou per pagina
 * dezelfde Set-instantie delen en identity-vergelijkingen laten liegen. */
export function emptySelection(): SelectionState {
  return { selected: new Set(), anchor: null };
}

/**
 * Verwerkt een klik op het vinkje van rij `id`.
 *
 * `orderedIds` is de lijst zoals hij op dat moment op het scherm staat
 * (gefilterd én gesorteerd) — het bereik van een Shift-klik loopt over díe
 * volgorde, niet over de ruwe fetch-volgorde.
 */
export function applyRowClick(
  state: SelectionState,
  id: string,
  orderedIds: readonly string[],
  mods: ClickModifiers = {},
): SelectionState {
  const next = new Set(state.selected);

  if (mods.shift && state.anchor !== null && state.anchor !== id) {
    const from = orderedIds.indexOf(state.anchor);
    const to = orderedIds.indexOf(id);
    // Anchor uit beeld (ander filter, verdwenen rij) → geen bereik te trekken;
    // val terug op een gewone toggle in plaats van niets te doen.
    if (from === -1 || to === -1) {
      toggle(next, id);
      return { selected: next, anchor: id };
    }
    const [lo, hi] = from < to ? [from, to] : [to, from];
    for (let i = lo; i <= hi; i++) next.add(orderedIds[i]);
    // Anchor blijft staan, zodat je het bereik kunt bijstellen met een tweede
    // Shift-klik in plaats van een nieuw bereik te beginnen.
    return { selected: next, anchor: state.anchor };
  }

  toggle(next, id);
  return { selected: next, anchor: id };
}

function toggle(set: Set<string>, id: string): void {
  if (set.has(id)) set.delete(id);
  else set.add(id);
}

/**
 * Kopcheckbox: staat alles uit `visibleIds` al aan, dan gaat dat blok uit;
 * anders gaat het hele blok aan. Rijen buiten `visibleIds` blijven ongemoeid —
 * anders zou "alle N die aan het filter voldoen" bij de eerstvolgende klik op
 * de kop stilletjes terugvallen naar alleen het zichtbare venster.
 */
export function toggleAllVisible(
  state: SelectionState,
  visibleIds: readonly string[],
): SelectionState {
  const next = new Set(state.selected);
  if (visibleIds.length > 0 && visibleIds.every((id) => next.has(id))) {
    for (const id of visibleIds) next.delete(id);
    return { selected: next, anchor: null };
  }
  for (const id of visibleIds) next.add(id);
  return { selected: next, anchor: state.anchor };
}

/** "Selecteer alle N taken die aan het filter voldoen." */
export function selectAll(ids: readonly string[]): SelectionState {
  return { selected: new Set(ids), anchor: null };
}

/**
 * Gooit id's uit de selectie die niet meer bestaan.
 *
 * Nodig na élke herlaad: een taak die iemand anders verwijderde, of die na een
 * statuswijziging uit het actieve filter valt, mag niet als onzichtbare
 * passagier meeliften in de volgende bulkactie.
 */
export function pruneSelection(
  state: SelectionState,
  validIds: readonly string[],
): SelectionState {
  const valid = new Set(validIds);
  const next = new Set<string>();
  for (const id of state.selected) if (valid.has(id)) next.add(id);
  if (next.size === state.selected.size) return state;
  return { selected: next, anchor: state.anchor && valid.has(state.anchor) ? state.anchor : null };
}

/** Zijn alle zichtbare rijen geselecteerd? (kopcheckbox aangevinkt) */
export function allVisibleSelected(
  state: SelectionState,
  visibleIds: readonly string[],
): boolean {
  return visibleIds.length > 0 && visibleIds.every((id) => state.selected.has(id));
}

/** Is een deel — maar niet alles — van de zichtbare rijen geselecteerd? (indeterminate) */
export function someVisibleSelected(
  state: SelectionState,
  visibleIds: readonly string[],
): boolean {
  const hit = visibleIds.some((id) => state.selected.has(id));
  return hit && !allVisibleSelected(state, visibleIds);
}
