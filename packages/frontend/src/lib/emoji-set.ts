/**
 * De emoji die in Berichten te kiezen zijn, en het rekenwerk eromheen.
 *
 * Bewust een eigen, korte lijst en geen volledige emojibibliotheek: zo'n
 * bibliotheek is een halve megabyte voor duizenden tekens waarvan er op een
 * werkchat een paar dozijn gebruikt worden. Op een telefoon heeft het
 * toetsenbord ze toch al allemaal.
 */

export type EmojiGroepId = "smileys" | "gebaren" | "harten" | "werk" | "eten" | "symbolen";

export interface EmojiGroep {
  id: EmojiGroepId;
  /** Het teken op het tabblad. */
  icoon: string;
  emoji: string[];
}

export const EMOJI_GROEPEN: EmojiGroep[] = [
  {
    id: "smileys",
    icoon: "😀",
    emoji: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉",
      "😍", "🥰", "😘", "😋", "😜", "🤪", "😎", "🤓", "🤩", "🥳", "😏", "😌",
      "🤔", "🤨", "😐", "😑", "😶", "🙄", "😬", "😴", "🤯", "😮", "😲", "😳",
      "🥺", "😢", "😭", "😤", "😠", "😡", "😱", "😨", "😰", "🤗", "🤭", "🤫",
      "😷", "🤒", "🤧", "🥵", "🥶", "😵", "🤠", "😈", "👻", "💩", "🙈", "🙉", "🙊",
    ],
  },
  {
    id: "gebaren",
    icoon: "👍",
    emoji: [
      "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👋", "✋", "👏", "🙌",
      "👐", "🤝", "🙏", "💪", "👊", "✊", "☝️", "👆", "👇", "👈", "👉", "🫡",
      "🤷", "🤦", "🙋", "🙆", "🙅", "💁",
    ],
  },
  {
    id: "harten",
    icoon: "❤️",
    emoji: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "💕", "💖", "💯",
      "⭐", "🌟", "✨", "🔥", "🎉", "🎊", "🥂", "🍾", "🏆", "🥇", "🎁", "🎂",
    ],
  },
  {
    id: "werk",
    icoon: "🏗️",
    emoji: [
      "🏗️", "🏢", "🏠", "🧱", "🔩", "🛠️", "🔨", "🔧", "📐", "📏", "🦺", "👷",
      "🚧", "🚚", "💡", "📊", "📈", "📉", "📋", "📁", "📎", "✏️", "📝", "📅",
      "⏰", "⏳", "💻", "📱", "📞", "✉️", "💰", "💶", "🧾", "✅", "❌", "⚠️",
      "❗", "❓",
    ],
  },
  {
    id: "eten",
    icoon: "☕",
    emoji: [
      "☕", "🍵", "🥤", "🍺", "🍻", "🍷", "🍕", "🍔", "🍟", "🌭", "🥪", "🥐",
      "🍞", "🧀", "🍎", "🍌", "🍓", "🍰", "🍪", "🍩", "🍫", "🍦",
    ],
  },
  {
    id: "symbolen",
    icoon: "☀️",
    emoji: [
      "☀️", "🌤️", "🌧️", "⛈️", "❄️", "🌈", "🚗", "🚲", "✈️", "🚆", "🏖️", "⚽",
      "🎵", "📷", "🌍", "🕐",
    ],
  },
];

/** Hoeveel recent gebruikte emoji er bewaard worden. */
export const RECENT_MAX = 16;

/** De gekozen emoji vooraan; geen dubbele, en nooit langer dan het maximum. */
export function bijwerkenRecent(recent: readonly string[], emoji: string, max: number = RECENT_MAX): string[] {
  return [emoji, ...recent.filter((e) => e !== emoji)].slice(0, max);
}

/**
 * Tekst invoegen op de plek van de cursor, of in plaats van wat geselecteerd is.
 * Geeft ook de nieuwe cursorpositie terug: direct achter het ingevoegde.
 */
export function voegInOpCursor(
  tekst: string,
  start: number,
  eind: number,
  invoeg: string,
): { tekst: string; cursor: number } {
  const lengte = tekst.length;
  const van = Math.max(0, Math.min(lengte, Math.min(start, eind)));
  const tot = Math.max(0, Math.min(lengte, Math.max(start, eind)));
  return { tekst: tekst.slice(0, van) + invoeg + tekst.slice(tot), cursor: van + invoeg.length };
}
