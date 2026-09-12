import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Architecture boundaries (docs/architecture.md §3) and banned APIs (docs/security.md A05):
 *  - app/(portal)/** may import lib/actions/portal/* and lib/dal/portal/* only (no staff DAL)
 *  - components/** may not import lib/dal/** or any provider implementation
 *  - only lib/dal/** (and db/, scripts) may import db/**
 *  - dangerouslySetInnerHTML / eval banned everywhere except the single sanitiser component
 */
const banned = {
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-new-func": "error",
  "react/no-danger": "error",
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**", "coverage/**", ".local/**", "db/migrations/**"]),
  {
    files: ["**/*.{ts,tsx,mts}"],
    rules: {
      ...banned,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // react-hook-form + React Compiler: the compiler skips these files (warning only); behaviour is unaffected
    files: ["components/portal/new-request.tsx", "components/tickets/new-ticket-form.tsx"],
    rules: { "react-hooks/incompatible-library": "off" },
  },
  {
    files: ["components/tickets/safe-html.tsx"],
    rules: { "react/no-danger": "off" },
  },
  {
    files: ["app/(portal)/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/lib/dal/*", "!@/lib/dal/portal", "!@/lib/dal/portal/*", "!@/lib/dal/users", "!@/lib/dal/categories", "!@/lib/dal/notifications"], message: "The portal may only read through lib/dal/portal/* (client-safe projections)." },
            { group: ["@/lib/actions/*", "!@/lib/actions/portal", "!@/lib/actions/portal/*", "!@/lib/actions/auth", "!@/lib/actions/notifications", "!@/lib/actions/admin"], message: "The portal may only call lib/actions/portal/*." },
            { group: ["@/db/*"], message: "Only lib/dal/** may import db/**." },
          ],
        },
      ],
    },
  },
  {
    files: ["components/**/*.{ts,tsx}"],
    ignores: ["components/tickets/safe-html.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/lib/dal/*"], allowTypeImports: true, message: "Components must not touch the DAL; use Server Actions or props." },
            { group: ["@/lib/auth/supabase", "@/lib/auth/local", "@/lib/storage/*", "@/lib/email/*", "@/lib/ratelimit/*"], allowTypeImports: true, message: "Components must not import provider implementations." },
            { group: ["@/db/*"], allowTypeImports: true, message: "Only lib/dal/** may import db/**." },
          ],
        },
      ],
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "lib/actions/**/*.ts", "lib/jobs/**/*.ts", "lib/auth/**/*.ts", "lib/domain/**/*.ts", "lib/authz/**/*.ts", "lib/schemas/**/*.ts", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [{ group: ["@/db/*", "@/db"], allowTypeImports: true, message: "Only lib/dal/** may import db/** (architecture.md §3)." }],
        },
      ],
    },
  },
]);
