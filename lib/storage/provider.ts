import "server-only";
import { env } from "@/lib/env";

/**
 * architecture.md: private buckets, signed URLs ≤ 60 s minted after authz, object path
 * {org_id}/{ticket_id}/{uuid} with no user-controlled names. Downloads never proxy through Next.js in
 * production (Supabase signed URL); the local adapter serves through a route handler for dev/test only.
 */
export interface StorageProvider {
  readonly name: "supabase" | "local";
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** Signed, short-lived download URL with Content-Disposition: attachment. */
  signedDownloadUrl(key: string, fileName: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
  /** Local adapter only: read bytes for the dev download route. */
  get?(key: string): Promise<Uint8Array | null>;
}

let provider: StorageProvider | undefined;

export async function getStorageProvider(): Promise<StorageProvider> {
  if (provider) return provider;
  if (env.STORAGE_PROVIDER === "supabase") {
    const { SupabaseStorageProvider } = await import("./supabase");
    provider = new SupabaseStorageProvider();
  } else {
    const { LocalStorageProvider } = await import("./local");
    provider = new LocalStorageProvider();
  }
  return provider;
}

export const SIGNED_URL_TTL_SECONDS = 60;
