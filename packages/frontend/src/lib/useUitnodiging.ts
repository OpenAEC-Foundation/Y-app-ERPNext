import { useCallback, useEffect, useState } from "react";
import { leesAfspraakIcs, zetDeelname, type Deelnamestatus, type GelezenAfspraak } from "./ical.ts";
import { haalUitnodigingIcs, planUitnodigingIn, zetEigenDeelname } from "./agenda-mailserver.ts";
import { beantwoordUitnodiging, handeltMailAf } from "./uitnodiging-antwoord.ts";
import { maakAntwoordMail, verstuurAntwoordMail } from "./uitnodiging-antwoordmail.ts";
import i18n from "../i18n/index";
import { resolveSessionUser } from "./session.ts";

/**
 * De uitnodiging die bij een e-mail hoort, en je antwoord erop.
 *
 * Als hook en niet in een component, omdat twee plekken hem tegelijk tonen: de
 * balk boven het bericht (waar je antwoordt) en de kolom ernaast (waar je je
 * dag ziet). Zouden die allebei hun eigen exemplaar ophalen, dan gaat er per
 * mail twee keer een verzoek naar de mailserver en kunnen de twee bovendien
 * een verschillende stand tonen.
 */

export interface Bijlage {
  file_url: string;
  file_name: string;
}

export interface Uitnodiging {
  /** De gelezen afspraak; `null` als deze mail er geen is. */
  afspraak: GelezenAfspraak | null;
  /** Het onbewerkte bestand; nodig om een antwoord te kunnen inplannen. */
  ruweIcs: string;
  /** Het eigen e-mailadres, kleingeletterd. */
  ik: string;
  /** Sta je er als genodigde in? Zo niet, dan valt er niets te beantwoorden. */
  genodigd: boolean;
  /** Je antwoord zoals het nu staat. */
  stand: Deelnamestatus;
  /** Er loopt een antwoord. */
  bezig: boolean;
  /** Het antwoord is zojuist vastgelegd. */
  bevestigd: boolean;
  fout: string;
  antwoord: (stand: Deelnamestatus) => Promise<void>;
}

export function useUitnodiging(
  attachments: Bijlage[],
  communication?: string,
  /**
   * Aanroepen zodra het antwoord vaststaat en de mail daarmee afgehandeld is.
   * De hook weet niet hoe een bericht afgevinkt wordt — dat hoort bij het
   * mailscherm, dat de lijst ook moet bijwerken.
   */
  opAfgehandeld?: (communication: string) => void,
): Uitnodiging {
  const [afspraak, setAfspraak] = useState<GelezenAfspraak | null>(null);
  const [ruweIcs, setRuweIcs] = useState("");
  const [ik, setIk] = useState("");
  const [stand, setStand] = useState<Deelnamestatus | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");

  const bijlage = attachments.find((a) => /\.ics$/i.test(a.file_name || ""));
  const bijlageUrl = bijlage?.file_url ?? "";

  useEffect(() => {
    let afgebroken = false;
    setAfspraak(null);
    setRuweIcs("");
    setStand(null);
    setFout("");
    if (!bijlageUrl && !communication) return;
    (async () => {
      try {
        /*
         * Eerst de bijlage, als ERPNext er een heeft. Zo niet, dan vragen we
         * het agendadeel op bij de mailserver: Frappe laat `text/calendar` bij
         * het binnenhalen vallen, waardoor een uitnodiging uit Outlook of
         * Teams hier als gewone tekst aankomt.
         */
        let tekst = "";
        if (bijlageUrl) {
          const res = await fetch(bijlageUrl, { credentials: "same-origin" });
          if (res.ok) tekst = await res.text();
        }
        if (!tekst && communication) tekst = (await haalUitnodigingIcs(communication)) || "";
        if (afgebroken || !tekst) return;
        const gelezen = leesAfspraakIcs(tekst);
        if (gelezen.start) {
          setRuweIcs(tekst);
          setAfspraak(gelezen);
        }
      } catch (err) {
        if (!afgebroken) setFout(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => { afgebroken = true; };
  }, [bijlageUrl, communication]);

  useEffect(() => {
    let afgebroken = false;
    void resolveSessionUser().then((u) => {
      if (!afgebroken) setIk((u || "").toLowerCase());
    });
    return () => { afgebroken = true; };
  }, []);

  const mijnRegel = afspraak?.genodigden.find((g) => g.email === ik && ik !== "");
  const huidigeStand: Deelnamestatus = stand ?? mijnRegel?.status ?? "needs-action";

  /**
   * Je antwoord vastleggen.
   *
   * Staat de afspraak al in je agenda — de mailserver plande hem in toen de
   * uitnodiging binnenkwam — dan verandert alleen jouw deelnemersregel. Een
   * uitnodiging van buiten staat er niet; die wordt neergelegd met je antwoord
   * er al in. Die tweede weg wordt pas geprobeerd als de eerste zegt dat de
   * afspraak er niet is, zodat er nooit een tweede exemplaar naast een
   * bestaande komt te staan.
   */
  const antwoord = useCallback(async (nieuweStand: Deelnamestatus) => {
    const uid = afspraak?.uid;
    if (!uid) return;
    setBezig(true);
    setFout("");
    try {
      const uitslag = await beantwoordUitnodiging({
        bijwerken: () => zetEigenDeelname(uid, nieuweStand),
        // Zonder .ics of zonder eigen adres valt er niets neer te leggen; dan
        // blijft alleen de eerste weg over.
        neerleggen: ruweIcs && ik
          ? () => planUitnodigingIn(uid, zetDeelname(ruweIcs, ik, nieuweStand))
          : undefined,
      });
      if (!uitslag.gelukt) { setFout(uitslag.fout); return; }
      setStand(nieuweStand);

      /*
       * De organisator hoort het antwoord te krijgen. Deze mailserver stuurt
       * dat niet zelf — zie `uitnodiging-antwoordmail.ts` — dus doet de app
       * het. Mislukt dat, dan staat je antwoord er wél in de agenda; dat is
       * iets anders dan een mislukt antwoord en hoort ook zo te klinken.
       */
      const post = maakAntwoordMail({
        organisator: afspraak?.organisator,
        ik,
        titel: afspraak?.titel,
        stand: nieuweStand,
        ics: ruweIcs,
        voorvoegsel: {
          accepted: i18n.t("agenda.reply_subject_accepted"),
          declined: i18n.t("agenda.reply_subject_declined"),
          tentative: i18n.t("agenda.reply_subject_tentative"),
          "needs-action": i18n.t("agenda.reply_subject_tentative"),
        },
      });
      if (post) {
        try {
          await verstuurAntwoordMail(post, ik, i18n.t("agenda.reply_body", {
            antwoord: post.onderwerp.split(":")[0].toLowerCase(),
          }));
        } catch (err) {
          setFout(i18n.t("agenda.reply_mail_failed", {
            error: err instanceof Error ? err.message : String(err),
          }));
        }
      }
      // Je hebt geantwoord; dan is die mail klaar. Zie `handeltMailAf` voor
      // waarom "voorlopig" niet meetelt.
      if (communication && handeltMailAf(nieuweStand)) opAfgehandeld?.(communication);
    } finally {
      setBezig(false);
    }
  }, [afspraak, ruweIcs, ik, communication, opAfgehandeld]);

  return {
    afspraak,
    ruweIcs,
    ik,
    genodigd: !!mijnRegel,
    stand: huidigeStand,
    bezig,
    bevestigd: stand !== null,
    fout,
    antwoord,
  };
}
