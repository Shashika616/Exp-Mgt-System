import "server-only";
import { createHash } from "node:crypto";
import { logger } from "@/lib/logger";

/**
 * FR-AUTH-01 / security.md A07: breached-password check via the HaveIBeenPwned k-anonymity range API.
 * Only the first 5 hex chars of the SHA-1 leave the server. Allowlisted outbound host; 3 s timeout.
 * Availability failures fail *open* (logged) so an outage never locks users out - the password length rule
 * still applies. Supabase Auth performs its own leaked-password check when that provider is active.
 */
const HOST = "https://api.pwnedpasswords.com";

export async function isPwnedPassword(password: string): Promise<boolean> {
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetch(`${HOST}/range/${prefix}`, { headers: { "Add-Padding": "true", "User-Agent": "expendables-support" }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const body = await res.text();
    for (const line of body.split("\n")) {
      const [hashSuffix, count] = line.trim().split(":");
      if (hashSuffix === suffix && Number(count) > 0) return true;
    }
    return false;
  } catch (err) {
    logger.warn({ err }, "pwned-password check unavailable; allowing");
    return false;
  }
}
