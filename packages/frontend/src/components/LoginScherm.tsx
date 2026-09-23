import { useTranslation } from "react-i18next";
import { LogIn } from "lucide-react";
import { YLogo } from "./YLogo";
import { APP_NAME, APP_VERSION } from "../lib/version";
import achtergrond from "../assets/login-staalconstructie.jpg";

/**
 * Het scherm dat je ziet als je (nog) niet bij Frappe bent ingelogd.
 *
 * Het oude scherm was een lege verloop met een klein kaartje erop — correct,
 * maar het zei niets over waar je binnenloopt. Dit scherm is een tekentafel
 * bij avond: een blauwdruk-raster, een stalen portaal dat zichzelf tekent, en
 * maatlijnen erlangs. Dat is waar dit programma over gaat, en het is meteen
 * herkenbaar van de CAD-viewer die in de app zelf zit.
 *
 * **De foto zit in de bundel** (`assets/login-staalconstructie.jpg`, vrij te
 * gebruiken onder de Unsplash-licentie) en wordt dus met de app meegeleverd —
 * geen verwijzing naar een website van buiten. Dat is geen zuinigheid maar een
 * eis: dit scherm verschijnt juist op het moment dat de sessie weg is, en dan
 * hoort er niets te hangen op een bestand dat er misschien niet is. Het
 * lijnwerk eroverheen is SVG en blijft staan als de foto ooit vervangen wordt.
 */

/** De merkkleuren van Y-next; hier als constante zodat het SVG ze kan gebruiken. */
const TEAL = "#2dd4bf";
const TEAL_DIEP = "#0d9488";

/** Het lijnwerk op de achtergrond: een stalen portaal met vakwerkligger. */
function Portaal({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 900 640" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="lijn" x1="0" y1="0" x2="900" y2="640" gradientUnits="userSpaceOnUse">
          <stop stopColor={TEAL} stopOpacity="0.55" />
          <stop offset="1" stopColor={TEAL_DIEP} stopOpacity="0.12" />
        </linearGradient>
      </defs>
      <g stroke="url(#lijn)" strokeWidth="1.5" strokeLinecap="round" className="y-teken">
        {/* Kolommen */}
        <path d="M150 560V150M210 560V150M690 560V150M750 560V150" />
        <path d="M150 150h60M150 560h60M690 150h60M690 560h60" />
        {/* Vakwerk in de kolommen */}
        <path d="M150 560l60-70M210 560l-60-70M150 420l60-70M210 420l-60-70M150 280l60-70M210 280l-60-70" />
        <path d="M690 560l60-70M750 560l-60-70M690 420l60-70M750 420l-60-70M690 280l60-70M750 280l-60-70" />
        {/* Ligger */}
        <path d="M150 150h600M150 92h600" />
        <path d="M150 150l60-58M270 150l-60-58M270 150l60-58M390 150l-60-58M390 150l60-58M510 150l-60-58M510 150l60-58M630 150l-60-58M630 150l60-58M750 150l-60-58" />
        {/* Maatvoering */}
        <path d="M120 150v410M112 158l8-8 8 8M112 552l8 8 8-8" strokeWidth="1" opacity="0.7" />
        <path d="M150 600h600M158 592l-8 8 8 8M742 592l8 8-8 8" strokeWidth="1" opacity="0.7" />
        {/* Fundering */}
        <path d="M110 570h130M110 578h130M660 570h130M660 578h130" strokeWidth="1" opacity="0.6" />
      </g>
    </svg>
  );
}

export default function LoginScherm({ onLogin }: { onLogin: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#071316] text-slate-100">
      <style>{`
        @keyframes y-teken-in { to { stroke-dashoffset: 0; } }
        @keyframes y-op { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .y-teken path {
          stroke-dasharray: 1400;
          stroke-dashoffset: 1400;
          animation: y-teken-in 2.6s cubic-bezier(.22,.61,.36,1) forwards;
        }
        .y-teken path:nth-child(2n) { animation-delay: .18s; }
        .y-teken path:nth-child(3n) { animation-delay: .34s; }
        .y-op { opacity: 0; animation: y-op .7s cubic-bezier(.22,.61,.36,1) forwards; }
        @media (prefers-reduced-motion: reduce) {
          .y-teken path, .y-op { animation: none; opacity: 1; stroke-dashoffset: 0; }
        }
      `}</style>

      {/* De foto, donker gehouden zodat de tekst leesbaar blijft. */}
      <div className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${achtergrond})` }} />
      <div className="absolute inset-0"
        style={{ background: "linear-gradient(115deg, rgba(3,14,16,.96) 0%, rgba(4,24,26,.88) 40%, rgba(7,40,43,.72) 72%, rgba(13,148,136,.32) 100%)" }} />

      {/* Blauwdrukraster; fijn en grof over elkaar, zoals millimeterpapier. */}
      <div className="absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage:
            `linear-gradient(rgba(45,212,191,.10) 1px, transparent 1px),
             linear-gradient(90deg, rgba(45,212,191,.10) 1px, transparent 1px),
             linear-gradient(rgba(45,212,191,.05) 1px, transparent 1px),
             linear-gradient(90deg, rgba(45,212,191,.05) 1px, transparent 1px)`,
          backgroundSize: "120px 120px, 120px 120px, 24px 24px, 24px 24px",
        }} />

      {/* Het lijnwerk zelf, rechts van het midden en over de vouw heen. */}
      <Portaal className="pointer-events-none absolute -right-[8%] top-1/2 hidden w-[58%] -translate-y-1/2 opacity-60 md:block" />
      <Portaal className="pointer-events-none absolute inset-x-0 bottom-0 w-full opacity-20 md:hidden" />

      {/* Vignet en korrel: geeft diepte zonder een foto. */}
      <div className="absolute inset-0"
        style={{ background: "linear-gradient(100deg, rgba(4,10,12,.88) 0%, rgba(4,10,12,.55) 38%, rgba(4,10,12,0) 68%)" }} />
      <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%22.8%22 numOctaves=%224%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E')",
        }} />

      {/* ── De inhoud ── */}
      <div className="relative flex min-h-screen flex-col justify-between px-6 py-10 sm:px-14 lg:px-20">
        <header className="y-op flex items-center gap-3" style={{ animationDelay: ".05s" }}>
          <YLogo size={38} className="rounded-xl" />
          <span className="text-sm font-semibold tracking-[0.2em] text-teal-200/80 uppercase">{APP_NAME}</span>
        </header>

        <main className="max-w-xl py-12">
          <p className="y-op flex items-center gap-3 text-xs font-medium uppercase tracking-[0.3em] text-teal-300/70"
            style={{ animationDelay: ".15s" }}>
            <span className="h-px w-10 bg-teal-300/50" aria-hidden="true" />
            {t("y_next.direct_mode")}
          </p>
          <h1 className="y-op mt-5 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl"
            style={{ animationDelay: ".25s" }}>
            {t("y_next.login_headline")}
          </h1>
          <p className="y-op mt-4 max-w-md text-sm leading-relaxed text-slate-300/80"
            style={{ animationDelay: ".35s" }}>
            {t("y_next.login_required")}
          </p>

          <div className="y-op mt-9 flex flex-wrap items-center gap-4" style={{ animationDelay: ".45s" }}>
            <button
              onClick={onLogin}
              className="group relative inline-flex cursor-pointer items-center gap-2.5 rounded-full px-7 py-3.5 text-sm font-semibold text-[#04191a] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL_DIEP} 100%)` }}
            >
              <LogIn size={16} />
              {t("y_next.login_button")}
              <span className="absolute inset-0 -z-10 rounded-full opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-70"
                style={{ background: TEAL }} />
            </button>
            <span className="flex items-center gap-2 text-[11px] text-slate-400/80">
              <span className="flex h-4 w-4 items-center justify-center rounded-[5px] bg-[#2490EF] text-[9px] font-extrabold leading-none text-white">F</span>
              {t("y_next.login_via_frappe")}
            </span>
          </div>
        </main>

        <footer className="y-op flex items-end justify-between gap-6 text-[11px] text-slate-500"
          style={{ animationDelay: ".55s" }}>
          <span className="tracking-wide">OpenAEC Foundation</span>
          <span className="font-mono tracking-wider">v{APP_VERSION}</span>
        </footer>
      </div>
    </div>
  );
}
