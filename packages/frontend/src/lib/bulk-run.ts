/**
 * Voert één bewerking uit over veel documenten, met begrensde parallelliteit,
 * voortgang, en een volledig foutrapport.
 *
 * Waarom niet gewoon `Promise.all(ids.map(...))`: op deze instance staan ~440
 * taken. 440 gelijktijdige PUT's leveren een instance die kortstondig omvalt,
 * en één afwijzing zou via `Promise.all` de rest onzichtbaar maken. En
 * `Promise.allSettled` geeft wel alles terug, maar zonder rem én zonder
 * voortgang — bij een bulk van 87 taken staart de gebruiker dan minutenlang
 * naar niets.
 *
 * De belangrijkste eigenschap: **deelfouten verdwijnen nooit stil.** Elke
 * mislukking komt met de bijbehorende id én reden terug; de aanroeper toont die
 * en laat de mislukte rijen geselecteerd staan. Geslaagde wijzigingen blijven
 * gewoon staan — er wordt niets teruggedraaid, want een halve rollback over een
 * REST-API is minder eerlijk dan een eerlijk rapport.
 */

import { isPermissionError } from "./permission-error.ts";

export interface BulkFailure {
  /** Documentnaam die faalde. */
  id: string;
  /** Leesbare reden, uit de fout van de server. */
  message: string;
  /** Is dit een rechtenfout? Zo ja, dan is het geen netwerkhapering maar een
   * structureel oplosbaar DocPerm-probleem — de UI zegt dat expliciet. */
  permission: boolean;
}

export interface BulkResult {
  total: number;
  succeeded: string[];
  failed: BulkFailure[];
}

export interface BulkOptions {
  /** Hoeveel documenten tegelijk. Default 5. */
  concurrency?: number;
  /** Aangeroepen ná elke afgeronde (geslaagde óf mislukte) bewerking. */
  onProgress?: (done: number, total: number) => void;
  /** Afbreken; al gestarte bewerkingen lopen af, de rest wordt niet gestart. */
  signal?: { aborted: boolean };
}

function reasonText(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return "Onbekende fout";
}

/**
 * Draait `worker` over `ids` met maximaal `concurrency` tegelijk.
 *
 * De volgorde van `succeeded` volgt de volgorde van afronden, niet die van
 * `ids` — voor een rapport maakt dat niet uit, en het bespaart een sorteerslag
 * over een lijst die tot in de honderden loopt.
 */
export async function runBulk(
  ids: readonly string[],
  worker: (id: string) => Promise<void>,
  options: BulkOptions = {},
): Promise<BulkResult> {
  const total = ids.length;
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 5, total || 1));
  const succeeded: string[] = [];
  const failed: BulkFailure[] = [];
  let cursor = 0;
  let done = 0;

  async function lane(): Promise<void> {
    for (;;) {
      if (options.signal?.aborted) return;
      const index = cursor++;
      if (index >= total) return;
      const id = ids[index];
      try {
        await worker(id);
        succeeded.push(id);
      } catch (err) {
        failed.push({ id, message: reasonText(err), permission: isPermissionError(err) });
      }
      done++;
      options.onProgress?.(done, total);
    }
  }

  await Promise.all(Array.from({ length: total === 0 ? 0 : concurrency }, lane));
  return { total, succeeded, failed };
}
