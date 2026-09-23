import { useState } from "react";
import { fotoUrl, type CollegaStatus } from "../../lib/berichten-aanwezigheid";

/**
 * Rond fotootje van een collega, met een groen bolletje als die online is.
 *
 * Zonder foto, of als de foto niet laadt, de initialen op een vaste kleur per
 * persoon. Geef de component een `key` per gebruiker mee: dan begint een
 * andere collega niet met de "foto kapot"-stand van de vorige.
 */

const KLEUREN = [
  "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
];

function kleurVoor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  return KLEUREN[Math.abs(hash) % KLEUREN.length];
}

export function initialen(naam: string): string {
  return naam
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((deel) => deel[0]?.toUpperCase() ?? "")
    .join("");
}

export default function BerichtAvatar({ user, naam, status, online = false, onlineLabel, klein = false }: {
  user: string;
  naam: string;
  status?: CollegaStatus | null;
  online?: boolean;
  /** Tekst bij het bolletje, voor schermlezers en als tooltip. */
  onlineLabel?: string;
  klein?: boolean;
}) {
  const [fotoKapot, setFotoKapot] = useState(false);
  const maat = klein ? "w-8 h-8 text-[11px]" : "w-9 h-9 text-xs";
  const metFoto = Boolean(status?.foto) && !fotoKapot;

  return (
    <span className={`relative inline-flex flex-shrink-0 ${maat}`}>
      {metFoto ? (
        <img
          src={fotoUrl(user)}
          alt=""
          onError={() => setFotoKapot(true)}
          className={`${maat} rounded-full bg-slate-200 object-cover`}
        />
      ) : (
        <span className={`${maat} flex items-center justify-center rounded-full ${kleurVoor(user)} font-semibold text-white`}>
          {initialen(naam)}
        </span>
      )}
      {online && (
        <span
          role="img"
          aria-label={onlineLabel}
          title={onlineLabel}
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500"
        />
      )}
    </span>
  );
}
