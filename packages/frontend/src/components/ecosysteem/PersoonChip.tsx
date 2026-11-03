/** Een naam in de eigen kleur van die persoon, zoals bij Werkplekken. */
export function PersoonChip({ naam, kleur }: { naam: string; kleur: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded-md border text-xs font-medium ${kleur}`}>{naam}</span>;
}
