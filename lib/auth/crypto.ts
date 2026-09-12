import { createCipheriv, createDecipheriv, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

// security.md A04: no custom crypto — only Node's WebCrypto/OpenSSL primitives with standard parameters.
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const scrypt = (password: string, salt: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => scryptCb(password, salt, 64, SCRYPT, (err, key) => (err ? reject(err) : resolve(key))));

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(input: string): string {
  return createHmac("sha256", "expendables-token-v1").update(input).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFC"), salt);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string | null | undefined): Promise<boolean> {
  if (!encoded) {
    // Equal-time budget for unknown users (enumeration resistance)
    await scrypt("x".repeat(12), randomBytes(16));
    return false;
  }
  const [, saltB64, keyB64] = encoded.split("$");
  if (!saltB64 || !keyB64) return false;
  const key = await scrypt(password.normalize("NFC"), Buffer.from(saltB64, "base64url"));
  const expected = Buffer.from(keyB64, "base64url");
  return key.length === expected.length && timingSafeEqual(key, expected);
}

const KEY = Buffer.from(env.APP_ENCRYPTION_KEY, "hex");

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${enc.toString("base64url")}.${tag.toString("base64url")}`;
}

export function decrypt(payload: string): string {
  const [ivB, encB, tagB] = payload.split(".");
  if (!ivB || !encB || !tagB) throw new Error("bad ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encB, "base64url")), decipher.final()]).toString("utf8");
}

/** HMAC-signed value for cookies (session-version pin). */
export function sign(value: string): string {
  const mac = createHmac("sha256", env.SESSION_SECRET).update(value).digest("base64url");
  return `${value}.${mac}`;
}

export function unsign(signed: string | undefined | null): string | null {
  if (!signed) return null;
  const idx = signed.lastIndexOf(".");
  if (idx < 0) return null;
  const value = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  const expected = createHmac("sha256", env.SESSION_SECRET).update(value).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? value : null;
}
