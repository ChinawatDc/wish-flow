import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

/**
 * Storage adapter — MVP เก็บ local disk, production เปลี่ยนเป็น
 * Supabase Storage / Cloudflare R2 ได้โดย implement interface เดียวกัน
 */
export interface StorageAdapter {
  /** เก็บไฟล์ คืน public URL path */
  save(params: {
    eventId: string;
    filename: string;
    buffer: Buffer;
  }): Promise<string>;
  delete(url: string): Promise<void>;
  read(url: string): Promise<Buffer | null>;
}

const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");
const URL_PREFIX = "/api/uploads";

/** แปลง URL → path ใต้ uploads/ พร้อมกัน path traversal */
function urlToSafePath(url: string): string | null {
  if (!url.startsWith(`${URL_PREFIX}/`)) return null;
  const rel = url.slice(URL_PREFIX.length + 1);
  const resolved = path.resolve(UPLOAD_ROOT, rel);
  if (!resolved.startsWith(UPLOAD_ROOT + path.sep)) return null;
  return resolved;
}

class LocalStorageAdapter implements StorageAdapter {
  async save({
    eventId,
    filename,
    buffer,
  }: {
    eventId: string;
    filename: string;
    buffer: Buffer;
  }): Promise<string> {
    const dir = path.join(UPLOAD_ROOT, "events", eventId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), buffer);
    return `${URL_PREFIX}/events/${eventId}/${filename}`;
  }

  async delete(url: string): Promise<void> {
    const filePath = urlToSafePath(url);
    if (!filePath) return;
    try {
      await unlink(filePath);
    } catch {
      // already gone
    }
  }

  async read(url: string): Promise<Buffer | null> {
    const filePath = urlToSafePath(url);
    if (!filePath) return null;
    try {
      return await readFile(filePath);
    } catch {
      return null;
    }
  }
}

export const storage: StorageAdapter = new LocalStorageAdapter();
export { UPLOAD_ROOT, URL_PREFIX, urlToSafePath };
