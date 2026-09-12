import "server-only";
import { createHmac } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { env } from "@/lib/env";
import { SIGNED_URL_TTL_SECONDS, type StorageProvider } from "./provider";

/**
 * Filesystem adapter for development/tests (env.ts refuses it in production). Mirrors the Supabase
 * behaviour: private files, HMAC-signed short-lived URLs served by /api/files/[...key] with
 * Content-Disposition: attachment.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = "local" as const;
  private root = resolve(process.cwd(), env.LOCAL_STORAGE_DIR);

  private path(key: string) {
    if (key.includes("..") || key.startsWith("/")) throw new Error("bad storage key");
    return resolve(this.root, key);
  }

  async put(key: string, body: Uint8Array) {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body, { flag: "wx" });
  }

  async get(key: string) {
    try {
      return new Uint8Array(await readFile(this.path(key)));
    } catch {
      return null;
    }
  }

  async signedDownloadUrl(key: string, fileName: string, expiresInSeconds = SIGNED_URL_TTL_SECONDS) {
    const exp = Math.floor(Date.now() / 1000) + Math.min(expiresInSeconds, SIGNED_URL_TTL_SECONDS);
    const sig = signLocal(key, fileName, exp);
    return `${env.APP_URL}/api/files/${key}?exp=${exp}&name=${encodeURIComponent(fileName)}&sig=${sig}`;
  }

  async delete(key: string) {
    await rm(this.path(key), { force: true });
  }
}

export function signLocal(key: string, fileName: string, exp: number): string {
  return createHmac("sha256", env.SESSION_SECRET).update(`${key}\n${fileName}\n${exp}`).digest("base64url");
}
