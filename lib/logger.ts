import pino from "pino";
import { env, isProd } from "./env";

// Structured JSON logs (security.md A09). User strings are always values, never format strings.
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "expendables-system" },
  redact: {
    paths: ["*.password", "*.token", "*.secret", "req.headers.authorization", "req.headers.cookie", "*.body"],
    censor: "[redacted]",
  },
  ...(isProd ? {} : { transport: undefined }),
});

export type Logger = typeof logger;
