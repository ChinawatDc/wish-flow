import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { Readable } from "stream";

/**
 * Storage adapter — local disk for dev; Cloudflare R2 (S3-compatible) when
 * R2_* env vars are set (required for guestbook photos on Vercel).
 */
export interface StorageAdapter {
  save(params: {
    eventId?: string;
    templateId?: string;
    revisionId?: string;
    guestbookEventId?: string;
    filename: string;
    buffer: Buffer;
    contentType?: string;
  }): Promise<string>;
  delete(url: string): Promise<void>;
  read(url: string): Promise<Buffer | null>;
}

const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");
const URL_PREFIX = "/api/uploads";

function urlToSafePath(url: string): string | null {
  if (!url.startsWith(`${URL_PREFIX}/`)) return null;
  const rel = url.slice(URL_PREFIX.length + 1);
  const resolved = path.resolve(UPLOAD_ROOT, rel);
  if (!resolved.startsWith(UPLOAD_ROOT + path.sep)) return null;
  return resolved;
}

function resolveOwner(params: {
  eventId?: string;
  templateId?: string;
  revisionId?: string;
  guestbookEventId?: string;
}): { ownerType: string; ownerId: string } {
  if (params.guestbookEventId) {
    return { ownerType: "guestbook", ownerId: params.guestbookEventId };
  }
  if (params.revisionId) {
    return { ownerType: "revisions", ownerId: params.revisionId };
  }
  if (params.templateId) {
    return { ownerType: "templates", ownerId: params.templateId };
  }
  if (params.eventId) {
    return { ownerType: "events", ownerId: params.eventId };
  }
  throw new Error("storage_owner_required");
}

class LocalStorageAdapter implements StorageAdapter {
  async save(params: {
    eventId?: string;
    templateId?: string;
    revisionId?: string;
    guestbookEventId?: string;
    filename: string;
    buffer: Buffer;
  }): Promise<string> {
    const { ownerType, ownerId } = resolveOwner(params);
    const dir = path.join(UPLOAD_ROOT, ownerType, ownerId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, params.filename), params.buffer);
    return `${URL_PREFIX}/${ownerType}/${ownerId}/${params.filename}`;
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

/** URL รูปแบบ /api/uploads/guestbook/<eventId>/<file> → object key guestbook/... */
function urlToObjectKey(url: string): string | null {
  if (!url.startsWith(`${URL_PREFIX}/`)) return null;
  const key = url.slice(URL_PREFIX.length + 1);
  if (!key || key.includes("..")) return null;
  return key;
}

class R2StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET;
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      throw new Error("r2_env_incomplete");
    }
    this.bucket = bucket;
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async save(params: {
    eventId?: string;
    templateId?: string;
    revisionId?: string;
    guestbookEventId?: string;
    filename: string;
    buffer: Buffer;
    contentType?: string;
  }): Promise<string> {
    const { ownerType, ownerId } = resolveOwner(params);
    const key = `${ownerType}/${ownerId}/${params.filename}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: params.buffer,
        ContentType: params.contentType ?? "application/octet-stream",
      }),
    );
    // คืน path ภายในแอปเท่านั้น — ไม่ใช่ public R2 URL
    return `${URL_PREFIX}/${key}`;
  }

  async delete(url: string): Promise<void> {
    const key = urlToObjectKey(url);
    if (!key) return;
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch {
      // ignore
    }
  }

  async read(url: string): Promise<Buffer | null> {
    const key = urlToObjectKey(url);
    if (!key) return null;
    try {
      const out = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!out.Body) return null;
      const stream = out.Body as Readable;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } catch {
      return null;
    }
  }
}

function createStorage(): StorageAdapter {
  if (
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
  ) {
    return new R2StorageAdapter();
  }
  return new LocalStorageAdapter();
}

export const storage: StorageAdapter = createStorage();
export { UPLOAD_ROOT, URL_PREFIX, urlToSafePath, urlToObjectKey };

export function isGuestbookUploadUrl(url: string): boolean {
  return url.startsWith(`${URL_PREFIX}/guestbook/`);
}
