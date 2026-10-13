import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, DraftingCompass, GanttChartSquare, HardDrive, Loader2 } from "lucide-react";
import CadFrame from "../components/studio/CadFrame";
import { plannerAssetUrl } from "../lib/studio";
import { getSessionUser } from "../lib/session";

export default function Studio({ kind }: { kind: "cad" | "planner" }) {
  const { t } = useTranslation();
  const [scope, setScope] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setScope(""); setError(false);
    if (kind === "planner") {
      const user = getSessionUser();
      if (!user) { setError(true); return; }
      void crypto.subtle.digest("SHA-256", new TextEncoder().encode(user)).then((digest) => {
        if (active) setScope(Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""));
      }).catch(() => { if (active) setError(true); });
    }
    return () => { active = false; };
  }, [kind]);
  const Icon = kind === "cad" ? DraftingCompass : GanttChartSquare;
  return <section className="flex h-full min-h-[420px] flex-col bg-white">
    <header className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-2.5">
      <Link to="/" className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600"><ArrowLeft size={14} />{t("studio.back")}</Link>
      <h1 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Icon size={17} className="text-slate-500" />{t(`start_apps.${kind}`)}</h1>
      <span className="ml-auto flex max-w-full items-center gap-1.5 text-[11px] text-slate-500" title={t("studio.local_hint")}><HardDrive size={13} className="shrink-0" />{t("studio.local_files")}</span>
    </header>
    {kind === "cad" ? <CadFrame /> : scope ? <iframe key={scope} src={plannerAssetUrl(import.meta.env.BASE_URL, scope)} title={t("start_apps.planner")} className="min-h-0 w-full flex-1 border-0" />
      : <div className="flex flex-1 items-center justify-center gap-2 px-4 text-sm text-slate-500" role={error ? "alert" : "status"}>{!error && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />}{t(error ? "studio.error_load" : "studio.loading")}</div>}
  </section>;
}
