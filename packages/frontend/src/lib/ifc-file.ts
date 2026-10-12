export function validateIfcFile(file: { name: string; size: number }, header: string): "type" | "content" | "empty" | "large" | null {
  if (!/\.ifc$/i.test(file.name)) return "type";
  if (file.size <= 0) return "empty";
  if (file.size > 100 * 1024 * 1024) return "large";
  if (!header.trimStart().startsWith("ISO-10303-21;")) return "content";
  return null;
}
