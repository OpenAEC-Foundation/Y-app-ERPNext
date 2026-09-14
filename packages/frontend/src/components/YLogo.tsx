import { useId } from "react";

/**
 * Het beeldmerk van Y-Next.
 *
 * Eén bron voor alle plekken waar het logo staat: het loginscherm, de
 * zijbalk, het aanmeldscherm. Stond eerder drie keer los in de pagina's, met
 * drie verschillende tinten teal en een `<text>Y</text>` — en een letter uit
 * een systeemfont valt op elk apparaat net iets anders uit. Nu is de Y
 * getekend, dus overal gelijk.
 *
 * De rechterarm heeft een eigen kleur: dat is de knik die van de Y een
 * vooruitwijzend teken maakt. Bij 16 pixels (het favicon) blijft de vorm
 * leesbaar — daarop is de dikte van de lijnen gekozen.
 *
 * Hetzelfde beeld staat als bestand in `public/y-logo.svg` voor het favicon,
 * de webmanifest en de desktop-build. Verander je het hier, verander het dan
 * daar ook.
 */
export function YLogo({ size = 64, className = "" }: { size?: number; className?: string }) {
  // Verloop-id's moeten uniek zijn: staan er twee logo's op één pagina, dan
  // wint anders de eerste definitie voor allebei.
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Y-Next"
    >
      <defs>
        <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14a0a6" />
          <stop offset=".5" stopColor="#006876" />
          <stop offset="1" stopColor="#03303a" />
        </linearGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".18" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id}-tile)`} />
      <rect width="64" height="64" rx="15" fill={`url(#${id}-sheen)`} />
      <g fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <g stroke="#012227" strokeOpacity=".18" transform="translate(0 1.2)">
          <path d="M16.5 16.5 32 31.5V50" />
          <path d="M47.5 16.5 32.6 31" />
        </g>
        <path d="M16.5 16.5 32 31.5V50" stroke="#fff" />
        <path d="M47.5 16.5 32.6 31" stroke="#5eead4" />
      </g>
      <rect
        x="1" y="1" width="62" height="62" rx="14"
        fill="none" stroke="#fff" strokeOpacity=".14" strokeWidth="1.6"
      />
    </svg>
  );
}

export default YLogo;
