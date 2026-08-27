/**
 * Shared helpers voor mail-attachments. Eerder gedupliceerd in Webmail.tsx
 * en MailView.tsx — beide bestanden importeren nu uit deze module zodat de
 * "wat is een inline-attachment"-logica consistent is.
 */

/**
 * Zet een ArrayBuffer veilig om naar base64. Verwerkt de bytes in chunks van
 * 8192 zodat `String.fromCharCode` nooit honderdduizenden argumenten in één
 * aanroep krijgt — een spread van een grote Uint8Array (`...new Uint8Array(buf)`)
 * gooit anders "Maximum call stack size exceeded" zodra de bijlage groter is dan
 * ~60 KB. Bron-van-waarheid voor base64-encoding van uitgaande bijlages, gedeeld
 * door Webmail.tsx en MailView.tsx.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x2000; // 8192
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export interface AttachmentMeta {
  filename: string;
  contentType: string;
  size: number;
  cid?: string;
  contentDisposition?: string;
}

/**
 * Detecteert of een attachment puur inline is (handtekening-logo, CID-image,
 * footer-banner). Inline-images horen niet als "echte bijlage" geteld te
 * worden — anders ziet de gebruiker paperclip+counter voor mails die alleen
 * sig-images bevatten.
 */
export function isInlineAttachment(att: AttachmentMeta, htmlBody?: string): boolean {
  const isImage = att.contentType?.startsWith("image/");
  if (!isImage) return false;
  if (att.contentDisposition === "inline") return true;
  if (att.cid && htmlBody && htmlBody.includes(`cid:${att.cid}`)) return true;
  const genericNames = /^(image\d+|logo|signature|banner|icon|footer|header|spacer|pixel|tracking)\.(png|jpg|jpeg|gif|bmp|webp)$/i;
  if (att.size < 50 * 1024 && genericNames.test(att.filename)) return true;
  return false;
}
