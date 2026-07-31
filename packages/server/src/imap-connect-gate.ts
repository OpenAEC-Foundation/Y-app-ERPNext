/**
 * Per-host IMAP connect-gate.
 *
 * Waarom dit bestaat — burst-preventie tegen de mailserver-rate-limit:
 * na een socket-drop (laptop slaap/wake, netwerkwissel, idle-timeout, of de
 * mailserver die zelf sluit) willen meerdere interne aanroepers tegelijk
 * herverbinden: de wachtende user-actie, de 30s-background-refresh, de
 * folder-warmup, de body-prefill én de aparte IMAP-IDLE-loop. Bij meerdere
 * accounts op dezelfde host (bv. een primary + een gedeelde mailbox) telt dat
 * op tot een piek van gelijktijdige TLS+LOGIN-pogingen. Een rate-limitende
 * server (bv. Stalwart) ziet die piek als misbruik en gaat het account/IP
 * weigeren (ECONNRESET / throttle).
 *
 * De gate **serialiseert** alle `connect()`-aanroepen naar dezelfde host en
 * houdt een **minimale tussenruimte** (`spacingMs`) aan tussen het starten van
 * opeenvolgende connects. Verschillende hosts lopen onafhankelijk. Eén
 * hangende/trage connect blokkeert bewust de volgende naar diezelfde host —
 * we willen niet doorpompen terwijl de host worstelt. Een mislukte connect
 * breekt de keten niet: de volgende aanroep komt gewoon aan de beurt.
 *
 * De gate doet GEEN backoff/retry — dat blijft de verantwoordelijkheid van de
 * aanroeper (MailAccountCache.ensureConnected / startIdleLoop). De gate
 * regelt alleen het *tempo* waarmee connects de host raken.
 */

export interface ConnectGate {
  /** Voer `fn` (een IMAP-connect) uit binnen de per-host wachtrij + spacing. */
  run<T>(host: string, fn: () => Promise<T>): Promise<T>;
}

export interface ConnectGateOptions {
  /** Minimale tijd (ms) tussen het starten van twee connects naar dezelfde host. */
  spacingMs?: number;
  /** Harde bovengrens: max. aantal connects dat per `windowMs` per host mag
   *  STARTEN. Verdere connects wachten tot het venster ruimte geeft. Voorkomt
   *  dat een storm/retry-flood de fail2ban van de mailserver tript. Default uit. */
  maxPerWindow?: number;
  /** Venstergrootte (ms) voor `maxPerWindow`. Default 60s. */
  windowMs?: number;
}

const DEFAULT_SPACING_MS = 1000;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createConnectGate(opts: ConnectGateOptions = {}): ConnectGate {
  const spacingMs = opts.spacingMs ?? DEFAULT_SPACING_MS;
  const maxPerWindow = opts.maxPerWindow ?? Infinity;
  const windowMs = opts.windowMs ?? 60_000;
  // Per host: een Promise-keten (serialisatie), het starttijdstip van de laatste
  // connect (spacing) en de starttijden binnen het huidige venster (rate-cap).
  // Begrensd door het aantal unieke hosts.
  const chains = new Map<string, Promise<unknown>>();
  const lastStart = new Map<string, number>();
  const windowStarts = new Map<string, number[]>();

  return {
    run<T>(host: string, fn: () => Promise<T>): Promise<T> {
      const prev = chains.get(host) ?? Promise.resolve();

      const result = prev.then(async () => {
        // 1) Min-spacing tussen opeenvolgende connects.
        const last = lastStart.get(host) ?? 0;
        const wait = spacingMs - (Date.now() - last);
        if (wait > 0) await sleep(wait);

        // 2) Harde rate-cap: max `maxPerWindow` starts per `windowMs` per host.
        if (maxPerWindow !== Infinity) {
          let starts = (windowStarts.get(host) ?? []).filter((t) => t > Date.now() - windowMs);
          while (starts.length >= maxPerWindow) {
            const waitMs = starts[0] + windowMs - Date.now();
            if (waitMs > 0) await sleep(waitMs);
            starts = starts.filter((t) => t > Date.now() - windowMs);
          }
          starts.push(Date.now());
          windowStarts.set(host, starts);
        }

        lastStart.set(host, Date.now());
        return fn();
      });

      // De volgende run() op deze host wacht op het *afronden* van deze (succes
      // én fout), zodat een mislukte/trage connect de serialisatie niet
      // doorbreekt of overslaat. Fouten worden hier geslikt; de aanroeper
      // krijgt ze via `result`.
      chains.set(host, result.then(() => undefined, () => undefined));
      return result;
    },
  };
}
