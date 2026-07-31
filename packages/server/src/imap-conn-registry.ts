/**
 * Per-host bewaker op het AANTAL gelijktijdig open IMAP-verbindingen.
 *
 * Waarom: Y-app houdt per account een fetch- én een IDLE-verbinding open en
 * kan bij lekken/churn nieuwe blijven maken. Dan loopt het aantal verbindingen
 * op de mailserver op tot die (of de firewall) het IP blokkeert. Deze limiter
 * is het structurele plafond: per host nooit meer dan `maxPerHost` open
 * verbindingen — de OUDSTE wordt gesloten zodra het maximum overschreden wordt.
 * Een gesloten verbinding ruimt zichzelf op via het 'close'-event.
 */
export interface LimitableConn {
  close(): unknown;
  once(event: "close", cb: () => void): unknown;
}

export interface ConnectionLimiter {
  track(host: string, conn: LimitableConn): void;
  count(host: string): number;
}

export function createConnectionLimiter(maxPerHost: number): ConnectionLimiter {
  const open = new Map<string, LimitableConn[]>();

  function remove(host: string, conn: LimitableConn): void {
    const list = open.get(host);
    if (!list) return;
    const i = list.indexOf(conn);
    if (i >= 0) list.splice(i, 1);
  }

  return {
    track(host, conn) {
      const list = open.get(host) ?? [];
      list.push(conn);
      open.set(host, list);
      // Zelf-opruimen wanneer de verbinding sluit (door ons, de server of fout).
      conn.once("close", () => remove(host, conn));

      // Plafond afdwingen: sluit de oudste (nooit de zojuist toegevoegde) tot
      // binnen `maxPerHost`. Synchroon uit de lijst halen zodat de lus stopt,
      // ook als 'close' asynchroon vuurt.
      let guard = 0;
      while (list.length > maxPerHost && guard++ < 1000) {
        const oldest = list[0] === conn ? list[1] : list[0];
        if (!oldest) break;
        remove(host, oldest);
        try { oldest.close(); } catch { /* ignore */ }
      }
    },
    count(host) {
      return open.get(host)?.length ?? 0;
    },
  };
}
