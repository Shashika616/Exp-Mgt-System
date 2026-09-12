import "server-only";
import { env } from "@/lib/env";
import type { AuthProvider } from "./types";

// architecture.md §7: Supabase Auth today, swappable. The provider is picked by AUTH_PROVIDER.
let provider: AuthProvider | undefined;

export async function getAuthProvider(): Promise<AuthProvider> {
  if (provider) return provider;
  if (env.AUTH_PROVIDER === "supabase") {
    const { SupabaseAuthProvider } = await import("./supabase");
    provider = new SupabaseAuthProvider();
  } else {
    const { LocalAuthProvider } = await import("./local");
    provider = new LocalAuthProvider();
  }
  return provider;
}
