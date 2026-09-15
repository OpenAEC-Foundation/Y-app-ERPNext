/**
 * Korte notificatie-chime (sinus, ~250ms) via WebAudio. Gedeeld door Messenger
 * (nieuw Talk-bericht) en de mail-notificaties (web + desktop), zodat nieuwe
 * mail én chat hetzelfde signaal geven. Werkt ook in de Tauri-webview.
 */
type WebkitAudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

export function playNotificationSound(): void {
  try {
    const AudioCtx = window.AudioContext || (window as WebkitAudioWindow).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    /*
     * Een geluidscontext die zonder klik wordt aangemaakt begint geschorst:
     * browsers laten een pagina niet uit zichzelf geluid maken. Zodra er ooit
     * op de pagina geklikt is, mag het wel — en dan zet `resume` hem alsnog
     * aan. Deze melding komt uit een poller, dus zonder dit blijft hij stil
     * voor iedereen die de app al even open had staan.
     */
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
    setTimeout(() => ctx.close(), 400);
  } catch {
    /* audio niet ondersteund */
  }
}
