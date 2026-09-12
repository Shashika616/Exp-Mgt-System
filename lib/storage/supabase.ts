import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { SIGNED_URL_TTL_SECONDS, type StorageProvider } from "./provider";

/** Supabase Storage, private bucket. Uses the service key server-side only; the browser only ever sees signed URLs. */
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = "supabase" as const;
  private client = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  private bucket = env.STORAGE_BUCKET;

  async put(key: string, body: Uint8Array, contentType: string) {
    const { error } = await this.client.storage.from(this.bucket).upload(key, body, { contentType, upsert: false });
    if (error) throw new Error(`storage upload: ${error.message}`);
  }

  async signedDownloadUrl(key: string, fileName: string, expiresInSeconds = SIGNED_URL_TTL_SECONDS) {
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUrl(key, Math.min(expiresInSeconds, SIGNED_URL_TTL_SECONDS), { download: fileName });
    if (error || !data) throw new Error(`storage sign: ${error?.message}`);
    return data.signedUrl;
  }

  async delete(key: string) {
    await this.client.storage.from(this.bucket).remove([key]);
  }
}
