/**
 * Adressen in de kop van een mail, elk als knop: klik en je schrijft die
 * persoon een nieuwe mail. Zo gaat dat in elk mailprogramma, en het scheelt
 * het overtypen of kopiëren van een adres.
 *
 * De splitsing respecteert aanhalingstekens (`"Hoeven, Maarten van der" <…>`
 * blijft één adres) — zie `splitAddresses`.
 */

import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { splitAddresses } from "../../lib/mail-erpnext-compose";

export default function AdresKnoppen({ adressen, onKies }: {
  /** Het adresveld zoals het op de mail staat, komma-gescheiden. */
  adressen: string;
  onKies: (adres: string) => void;
}) {
  const { t } = useTranslation();
  const lijst = splitAddresses(adressen);
  if (lijst.length === 0) return <>{adressen}</>;
  return (
    <>
      {lijst.map((a, i) => (
        <Fragment key={`${a.email}-${i}`}>
          {i > 0 && ", "}
          <button type="button" onClick={() => onKies(a.raw)}
            title={t("webmail.compose_to", { adres: a.email })}
            className="cursor-pointer rounded text-left hover:text-blue-700 hover:underline">
            {a.raw}
          </button>
        </Fragment>
      ))}
    </>
  );
}
