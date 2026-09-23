import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy } from "lucide-react";

/**
 * Het ERPNext-kenmerk van de geopende mail, met een kopieerknop.
 *
 * Waarom het in beeld staat: met dit kenmerk is één mail eenduidig aan te
 * wijzen — in een opdracht ("handel deze mail af"), in een gesprek met de
 * assistent, of rechtstreeks in ERPNext (/app/communication/<kenmerk>). Het
 * onderwerp is daar te dubbelzinnig voor: drie mails heten "Re: offerte".
 */
export default function MailId({ naam }: { naam: string }) {
  const { t } = useTranslation();
  const [gekopieerd, setGekopieerd] = useState(false);
  if (!naam) return null;

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(naam);
      setGekopieerd(true);
      window.setTimeout(() => setGekopieerd(false), 1500);
    } catch {
      /* Zonder klembordrecht blijft de tekst gewoon te selecteren. */
    }
  }

  return (
    <span className="mt-0.5 inline-flex max-w-full items-center gap-1 text-[10px] text-slate-400">
      <span className="flex-shrink-0">{t("y_next.mail_id_label")}</span>
      <code className="truncate rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-500 select-all">{naam}</code>
      <button type="button" onClick={() => void kopieer()}
        title={gekopieerd ? t("y_next.mail_id_copied") : t("y_next.mail_id_copy")}
        aria-label={gekopieerd ? t("y_next.mail_id_copied") : t("y_next.mail_id_copy")}
        className="flex-shrink-0 cursor-pointer rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
        {gekopieerd ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
      </button>
    </span>
  );
}
