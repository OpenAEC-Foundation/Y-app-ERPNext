import { CalendarDays, DraftingCompass, FileSpreadsheet, FileText, GanttChartSquare, Mail, MessageSquare, Boxes } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const APPS = [
  { id: "email", Icon: Mail, to: "/webmail" },
  { id: "messages", Icon: MessageSquare, to: "/messenger" },
  { id: "calendar", Icon: CalendarDays, to: "/calendar" },
  { id: "cad", Icon: DraftingCompass, to: "/cad-studio" },
  { id: "planner", Icon: GanttChartSquare, to: "/planner-studio" },
  { id: "ifc", Icon: Boxes, to: "/ifc-viewer" },
  { id: "excel", Icon: FileSpreadsheet, to: "/office?new=excel" },
  { id: "word", Icon: FileText, to: "/office?new=word" },
];

export default function StartAppShortcuts() {
  const { t } = useTranslation();
  const tile = "y-app-tile group";
  return (
    <nav aria-label={t("start_apps.title")} className="y-app-dock">
      {APPS.map(({ id, Icon, to }) => {
        const content = <>
          <span className="y-app-symbol"><Icon size={25} strokeWidth={1.6} aria-hidden="true" /></span>
          <span className="flex min-h-8 items-center justify-center gap-1 leading-4">{t(`start_apps.${id}`)}</span>
        </>;
        return <Link key={id} to={to} data-app={id} className={tile}>{content}</Link>;
      })}
    </nav>
  );
}
