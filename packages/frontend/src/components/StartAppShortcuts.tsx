import { CalendarDays, DraftingCompass, ExternalLink, FileSpreadsheet, FileText, GanttChartSquare, Mail, MessageSquare, Boxes } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { leesMogelijkheden } from "../lib/mogelijkheden";

const APPS = [
  { id: "email", Icon: Mail, to: "/webmail" },
  { id: "messages", Icon: MessageSquare, to: "/messenger" },
  { id: "calendar", Icon: CalendarDays, to: "/calendar" },
  { id: "cad", Icon: DraftingCompass, url: "https://hakanseven12.github.io/OpenCADStudio/" },
  { id: "planner", Icon: GanttChartSquare, url: "https://open-planner-studio.open-aec.com/" },
  { id: "ifc", Icon: Boxes, to: "/ifc-viewer" },
  { id: "excel", Icon: FileSpreadsheet, to: "/office?new=excel" },
  { id: "word", Icon: FileText, to: "/office?new=word" },
];

export default function StartAppShortcuts() {
  const { t } = useTranslation();
  const localCad = leesMogelijkheden()?.cad_viewer === true;
  const tile = "y-app-tile group";
  return (
    <nav aria-label={t("start_apps.title")} className="y-app-dock grid grid-cols-4 gap-x-2 gap-y-4 xl:grid-cols-8">
      {APPS.map(({ id, Icon, to, url }) => {
        const content = <>
          <span className="y-app-symbol"><Icon size={25} strokeWidth={1.6} aria-hidden="true" /></span>
          <span className="flex min-h-8 items-center justify-center gap-1 leading-4">{t(`start_apps.${id}`)}{url && !(id === "cad" && localCad) && <ExternalLink size={11} className="shrink-0 text-slate-400" aria-hidden="true" />}</span>
        </>;
        if (to) return <Link key={id} to={to} data-app={id} className={tile}>{content}</Link>;
        const href = id === "cad" && localCad ? "/ocs-viewer" : url;
        return <a key={id} href={href} data-app={id} target="_blank" rel="noopener noreferrer" className={tile}
          aria-label={`${t(`start_apps.${id}`)} — ${t("start_apps.new_tab")}`}>{content}</a>;
      })}
    </nav>
  );
}
