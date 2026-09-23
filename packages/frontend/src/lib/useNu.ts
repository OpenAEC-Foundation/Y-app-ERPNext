import { useEffect, useState } from "react";
import { totVolgendeMinuut } from "./agenda-tijdlijn";

/**
 * De huidige tijd, bijgewerkt op elke hele minuut.
 *
 * Op de minuutgrens en niet elke 60 seconden vanaf het openen: anders loopt de
 * lijn in de agenda tot een minuut achter op de klok rechtsonder. Komt het
 * tabblad terug uit de achtergrond (of de laptop uit de slaapstand), dan meteen
 * bijwerken; timers lopen daar niet betrouwbaar door.
 */
export function useNu(): Date {
  const [nu, setNu] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const plan = () => {
      timer = setTimeout(() => {
        setNu(new Date());
        plan();
      }, totVolgendeMinuut(new Date()) + 50);
    };
    plan();
    const terug = () => {
      if (!document.hidden) setNu(new Date());
    };
    document.addEventListener("visibilitychange", terug);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", terug);
    };
  }, []);

  return nu;
}
