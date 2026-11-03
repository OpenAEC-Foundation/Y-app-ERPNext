/**
 * De kleuren van het weekoverzicht. Iedereen heeft een eigen kleur, zodat je
 * in één oogopslag ziet wie waar zit; de overige standen zijn grijs of
 * gestippeld, en rood als iemand geen plek kreeg.
 */
export const VAKJE = {
  thuis: "bg-slate-50 border-slate-200 text-slate-600",
  vrij: "border-dashed border-slate-200 text-slate-400",
  open: "border-dotted border-slate-300 text-slate-500",
  fout: "bg-red-50 border-red-200 text-red-800",
} as const;

/**
 * Voluit geschreven, zodat Tailwind de klassen in de bron terugvindt. Geen
 * rood of roze: dat is voor "geen plek".
 */
const PERSOONSKLEUREN = [
  "bg-sky-100 border-sky-300 text-sky-900",
  "bg-emerald-100 border-emerald-300 text-emerald-900",
  "bg-amber-100 border-amber-300 text-amber-900",
  "bg-violet-100 border-violet-300 text-violet-900",
  "bg-fuchsia-100 border-fuchsia-300 text-fuchsia-900",
  "bg-lime-100 border-lime-300 text-lime-900",
  "bg-indigo-100 border-indigo-300 text-indigo-900",
  "bg-teal-100 border-teal-300 text-teal-900",
  "bg-cyan-100 border-cyan-300 text-cyan-900",
  "bg-yellow-100 border-yellow-300 text-yellow-900",
  "bg-orange-100 border-orange-300 text-orange-900",
  "bg-blue-100 border-blue-300 text-blue-900",
  "bg-purple-100 border-purple-300 text-purple-900",
  "bg-green-100 border-green-300 text-green-900",
];

/**
 * De kleur van een persoon, op zijn of haar plek in de lijst. Zolang er
 * niet meer mensen zijn dan kleuren, heeft iedereen een andere.
 */
export function persoonsKleur(index: number): string {
  return PERSOONSKLEUREN[((index % PERSOONSKLEUREN.length) + PERSOONSKLEUREN.length) % PERSOONSKLEUREN.length];
}
