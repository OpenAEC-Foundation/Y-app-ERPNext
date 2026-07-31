import { Hourglass } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Fase-1 placeholder voor schermen die nog niet geactiveerd zijn
 * (zie `../lib/capabilities.ts`). Toont een neutrale "volgt later"-melding
 * in plaats van de eigenlijke pagina. Puur presentationeel: geen datacalls,
 * geen effects.
 */
interface ComingSoonProps {
  title?: string;
}

export default function ComingSoon({ title }: ComingSoonProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 p-8 text-center">
      <Hourglass className="h-10 w-10 text-slate-400 mb-2" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-slate-800">
        {title ?? t("y_next.coming_soon_title", { defaultValue: "Coming soon" })}
      </h2>
      <p className="text-sm text-slate-500">
        {t("y_next.coming_soon_body", {
          defaultValue: "This feature will arrive in a later Y-next phase.",
        })}
      </p>
    </div>
  );
}
