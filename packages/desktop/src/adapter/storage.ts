const STORAGE_API = "/api/desktop/preferences";

class DesktopStorage implements Storage {
  private cache = new Map<string, string>();
  private loaded = false;

  get length(): number { return this.cache.size; }

  async load(): Promise<void> {
    const res = await fetch(STORAGE_API);
    const data = await res.json();
    this.cache.clear();
    for (const [k, v] of Object.entries(data)) {
      this.cache.set(k, v as string);
    }
    this.loaded = true;
  }

  getItem(key: string): string | null {
    return this.cache.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.cache.set(key, value);
    fetch(STORAGE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  }

  removeItem(key: string): void {
    this.cache.delete(key);
    fetch(`${STORAGE_API}/${encodeURIComponent(key)}`, { method: "DELETE" });
  }

  clear(): void { this.cache.clear(); }
  key(index: number): string | null {
    return Array.from(this.cache.keys())[index] ?? null;
  }
}

export const desktopStorage = new DesktopStorage();
