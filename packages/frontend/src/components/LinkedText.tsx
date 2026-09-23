import { Fragment, useMemo } from "react";
import { splitLinks } from "../lib/linkify";

/**
 * Platte tekst met klikbare links (http, www en e-mailadressen).
 *
 * Een link opent in een nieuw tabblad en laat de klik niet doorlopen naar de
 * rij of de bel eromheen, zodat klikken op een link niet ook het bericht
 * opent of selecteert.
 */
export default function LinkedText({ text, className }: { text: string; className?: string }) {
  const delen = useMemo(() => splitLinks(text), [text]);
  return (
    <>
      {delen.map((d, i) => (d.type === "text" ? (
        <Fragment key={i}>{d.text}</Fragment>
      ) : (
        <a
          key={i}
          href={d.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={className ?? "underline underline-offset-2 break-all hover:opacity-80"}
        >
          {d.text}
        </a>
      )))}
    </>
  );
}
