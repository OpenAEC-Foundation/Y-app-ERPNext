import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { EMOJI_GROEPEN, RECENT_MAX, bijwerkenRecent, type EmojiGroepId } from "../../lib/emoji-set";
import { getActiveInstanceId } from "../../lib/instances";

/**
 * Venstertje met emoji boven het invoerveld van Berichten.
 *
 * Blijft open terwijl je kiest, zodat je er meer dan één achter elkaar kunt
 * zetten; klik ernaast of Escape sluit het. De laatst gebruikte staan vooraan,
 * per instance onthouden zoals de andere voorkeuren.
 */

function recentSleutel(): string {
  return `pref_${getActiveInstanceId()}_berichten_recente_emoji`;
}

function leesRecent(): string[] {
  try {
    const ruw: unknown = JSON.parse(localStorage.getItem(recentSleutel()) || "[]");
    return Array.isArray(ruw)
      ? ruw.filter((e): e is string => typeof e === "string").slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

function bewaarRecent(lijst: string[]): void {
  try {
    localStorage.setItem(recentSleutel(), JSON.stringify(lijst));
  } catch {
    /* opslag geblokkeerd — dan geldt het alleen voor dit bezoek */
  }
}

type Tab = "recent" | EmojiGroepId;

export default function EmojiKiezer({ onKies, onSluit, negeerRef }: {
  onKies: (emoji: string) => void;
  onSluit: () => void;
  /** De knop die het venster opent: een klik daarop is geen klik "ernaast". */
  negeerRef: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation();
  const [recent, setRecent] = useState<string[]>(() => leesRecent());
  const [tab, setTab] = useState<Tab>(() => (recent.length > 0 ? "recent" : "smileys"));
  const paneel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ernaast = (e: MouseEvent | TouchEvent) => {
      const doel = e.target as Node | null;
      if (!doel || paneel.current?.contains(doel) || negeerRef.current?.contains(doel)) return;
      onSluit();
    };
    const toets = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSluit();
    };
    document.addEventListener("mousedown", ernaast);
    document.addEventListener("touchstart", ernaast);
    document.addEventListener("keydown", toets);
    return () => {
      document.removeEventListener("mousedown", ernaast);
      document.removeEventListener("touchstart", ernaast);
      document.removeEventListener("keydown", toets);
    };
  }, [onSluit, negeerRef]);

  function kies(emoji: string) {
    const volgende = bijwerkenRecent(recent, emoji);
    setRecent(volgende);
    bewaarRecent(volgende);
    onKies(emoji);
  }

  const tabs: { id: Tab; icoon: string }[] = [
    ...(recent.length > 0 ? [{ id: "recent" as const, icoon: "🕘" }] : []),
    ...EMOJI_GROEPEN.map((g) => ({ id: g.id, icoon: g.icoon })),
  ];
  const zichtbaar = tab === "recent" ? recent : (EMOJI_GROEPEN.find((g) => g.id === tab)?.emoji ?? []);

  return (
    <div
      ref={paneel}
      role="dialog"
      aria-label={t("messages.emoji_open")}
      className="absolute bottom-full left-0 z-30 mb-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-lg"
    >
      <div className="flex gap-0.5 border-b border-slate-100 px-1.5 pt-1.5">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            title={t(`messages.emoji_group_${item.id}`)}
            aria-label={t(`messages.emoji_group_${item.id}`)}
            aria-pressed={tab === item.id}
            className={`cursor-pointer rounded-t-md px-1.5 py-1 text-base leading-none ${
              tab === item.id ? "bg-slate-100" : "opacity-60 hover:opacity-100"
            }`}
          >
            {item.icoon}
          </button>
        ))}
      </div>
      <div className="grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto p-1.5">
        {zichtbaar.map((emoji) => (
          <button
            key={emoji}
            type="button"
            // Met de muis: de focus blijft in het invoerveld, zodat de cursor
            // op zijn plek blijft staan voor de volgende emoji.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => kies(emoji)}
            className="cursor-pointer rounded-md p-1 text-xl leading-none hover:bg-slate-100"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
