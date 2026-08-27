import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import { open } from "@tauri-apps/plugin-shell";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/**
 * In-app updater voor de desktop-app.
 *
 * Twee paden:
 *  1. Echte in-app update (tauri-plugin-updater): `check()` haalt het gehoste
 *     `latest.json` op, vergelijkt versies en verifieert de minisign-handtekening
 *     tegen de ingebakken pubkey. Is er een update, dan toont de banner een
 *     "Nu bijwerken"-knop die de installer downloadt (met voortgang) en na afloop
 *     via `relaunch()` herstart. NOOIT geforceerd/automatisch — altijd een klik.
 *  2. Fallback (link-only): kan `check()` niets vinden of faalt hij (bv. de
 *     allereerste updater-release heeft nog geen zichzelf-updatend `latest.json`,
 *     of de asset-signing hikte), dan valt de banner terug op de bestaande
 *     versie-vergelijking via het publieke `/api/app-version` endpoint en toont
 *     alleen een link naar de Releases-pagina.
 *
 * De Releases-link blijft in BEIDE paden staan: dat is tevens het rollback-kanaal
 * (gebruiker downloadt zelf een oudere installer en installeert daar overheen —
 * de NSIS-installer staat downgrades toe via `allowDowngrades: true`).
 *
 * De banner is dismissbaar en onthoudt de weggeklikte versie in localStorage,
 * zodat een bewuste rollback niet bij elke start opnieuw een melding geeft.
 */
const VERSION_URL = "https://y-app.impertio.app/api/app-version";
const RELEASES_URL = "https://github.com/OpenAEC-Foundation/Y-app/releases";
const DISMISS_KEY = "desktop_update_dismissed_version";

/** True als `remote` (x.y.z) een hogere versie is dan `local`. */
function isNewer(remote: string, local: string): boolean {
  const r = remote.split(".").map((n) => parseInt(n, 10) || 0);
  const l = local.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((r[i] || 0) > (l[i] || 0)) return true;
    if ((r[i] || 0) < (l[i] || 0)) return false;
  }
  return false;
}

type Phase = "idle" | "downloading" | "installing" | "error";

export function UpdateBanner() {
  const { t } = useTranslation();
  // Beschikbare versie (nummer) + of we een echte in-app install kunnen doen.
  const [latest, setLatest] = useState<string | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pct, setPct] = useState(0);
  const updateRef = useRef<Update | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await getVersion().catch(() => "0.0.0");
      // 1. Probeer de echte updater eerst.
      try {
        const update = await check();
        if (!cancelled && update && update.available) {
          updateRef.current = update;
          setLatest(update.version);
          setCanInstall(true);
          return;
        }
      } catch {
        /* geen manifest / netwerk / signing-hik → val terug op link-only */
      }
      if (cancelled) return;
      // 2. Fallback: versie-vergelijking, alleen een Releases-link.
      try {
        const res = await fetch(VERSION_URL, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string };
        const remote = String(data.version || "");
        if (!cancelled && remote && remote !== "dev" && isNewer(remote, local)) {
          setLatest(remote);
          setCanInstall(false);
        }
      } catch {
        /* offline → stil */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Onthoud een weggeklikte versie zodat een bewuste rollback niet blijft nagen.
  useEffect(() => {
    if (!latest) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === latest) setDismissed(true);
    } catch {
      /* localStorage kan geblokkeerd zijn — dan gewoon per sessie dismissen */
    }
  }, [latest]);

  function dismiss() {
    setDismissed(true);
    try {
      if (latest) localStorage.setItem(DISMISS_KEY, latest);
    } catch {
      /* best-effort */
    }
  }

  async function runUpdate() {
    const update = updateRef.current;
    if (!update) return;
    setPhase("downloading");
    setPct(0);
    let downloaded = 0;
    let total = 0;
    try {
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            total = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (total > 0) setPct(Math.min(100, Math.round((downloaded / total) * 100)));
            break;
          case "Finished":
            setPct(100);
            setPhase("installing");
            break;
        }
      });
      // Installer klaar → herstart in de nieuwe versie.
      await relaunch();
    } catch {
      setPhase("error");
    }
  }

  if (!latest || dismissed) return null;

  const busy = phase === "downloading" || phase === "installing";

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-900 flex-shrink-0">
      <span>
        {t("desktop.update.available", "Nieuwe versie")} <strong>v{latest}</strong>{" "}
        {t("desktop.update.available_suffix", "beschikbaar.")}
      </span>

      {phase === "downloading" && (
        <span className="text-amber-800">
          {t("desktop.update.downloading", "Downloaden…")} {pct}%
        </span>
      )}
      {phase === "installing" && (
        <span className="text-amber-800">
          {t("desktop.update.installing", "Installeren en herstarten…")}
        </span>
      )}
      {phase === "error" && (
        <span className="text-red-700">
          {t("desktop.update.error", "Bijwerken mislukt. Download de installer handmatig.")}
        </span>
      )}

      {/* In-app update, alleen als de updater een geverifieerde update vond. */}
      {canInstall && phase !== "installing" && (
        <button
          onClick={() => { void runUpdate(); }}
          disabled={busy}
          className="px-2.5 py-1 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700 cursor-pointer disabled:opacity-60 disabled:cursor-default"
        >
          {phase === "error"
            ? t("desktop.update.retry", "Opnieuw proberen")
            : t("desktop.update.install_now", "Nu bijwerken")}
        </button>
      )}

      {/* Releases-link: altijd zichtbaar. Tevens het rollback-kanaal (oudere
          installer downloaden en overheen installeren). */}
      <button
        onClick={() => { void open(RELEASES_URL); }}
        className="px-2.5 py-1 bg-white border border-amber-400 text-amber-800 rounded text-xs font-medium hover:bg-amber-100 cursor-pointer"
      >
        {canInstall
          ? t("desktop.update.releases_link", "Releases")
          : t("desktop.update.download", "Download")}
      </button>

      {!busy && (
        <button
          onClick={dismiss}
          className="ml-auto text-amber-700 hover:text-amber-900 cursor-pointer"
          aria-label={t("common.close", "Sluiten")}
        >
          ✕
        </button>
      )}
    </div>
  );
}
