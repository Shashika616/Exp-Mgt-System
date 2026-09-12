"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { acceptInvite, consumeMagicLink, confirmTotpEnrollment, requestMagicLink, requestPasswordReset, resetPassword, signInWithPassword, signInWithRecoveryCode, verifyTotp } from "@/lib/actions/auth";
import { LoginSchema, MagicLinkSchema, ResetRequestSchema } from "@/lib/schemas/auth";
import type { PublicError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/menu";

function ErrorBanner({ error }: { error: PublicError | null }) {
  if (!error) return null;
  return (
    <p className="rounded-md border border-danger-border bg-danger-bg px-3 py-2 text-body-sm text-danger-fg" role="alert" data-testid="form-error">
      {error.message}
    </p>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<PublicError | null>(null);
  const [sent, setSent] = useState(false);
  const pw = useForm<z.input<typeof LoginSchema>>({ resolver: zodResolver(LoginSchema), mode: "onBlur", defaultValues: { email: "", password: "", next } });
  const ml = useForm<z.input<typeof MagicLinkSchema>>({ resolver: zodResolver(MagicLinkSchema), mode: "onBlur", defaultValues: { email: "", next } });

  return (
    <div>
      <h1 className="text-headline-lg">Sign in</h1>
      <p className="text-body-md mt-2 text-on-surface-variant">Use your password, or get a one-time link by email.</p>
      <Tabs.Root defaultValue="password" className="mt-6">
        <Tabs.List aria-label="Sign-in method">
          <Tabs.Tab value="password">Password</Tabs.Tab>
          <Tabs.Tab value="magic">Email link</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="password" className="pt-6">
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={pw.handleSubmit(async (values) => {
              setError(null);
              const res = await signInWithPassword(values);
              if (!res.ok) return setError(res);
              router.replace(res.data.next);
              router.refresh();
            })}
          >
            <ErrorBanner error={error} />
            <Field label="Email" required error={pw.formState.errors.email?.message}>
              {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" {...pw.register("email")} />}
            </Field>
            <Field label="Password" required error={pw.formState.errors.password?.message}>
              {(p) => <Input {...p} type="password" autoComplete="current-password" {...pw.register("password")} />}
            </Field>
            <Button type="submit" size="lg" loading={pw.formState.isSubmitting} className="mt-2">
              Sign in
            </Button>
            <Link href="/reset" className="text-label self-start text-secondary underline-offset-4 hover:underline">
              Forgot your password?
            </Link>
          </form>
        </Tabs.Panel>
        <Tabs.Panel value="magic" className="pt-6">
          {sent ? (
            <div className="rounded-lg border border-outline-variant/60 bg-surface-container-low p-4" role="status">
              <p className="text-label">Check your email</p>
              <p className="text-body-md mt-1 text-on-surface-variant">If an account exists for that address, a sign-in link is on its way. It works once and expires in 15 minutes.</p>
            </div>
          ) : (
            <form
              className="flex flex-col gap-4"
              noValidate
              onSubmit={ml.handleSubmit(async (values) => {
                setError(null);
                const res = await requestMagicLink(values);
                if (!res.ok) return setError(res);
                setSent(true);
              })}
            >
              <ErrorBanner error={error} />
              <Field label="Email" required error={ml.formState.errors.email?.message}>
                {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" {...ml.register("email")} />}
              </Field>
              <Button type="submit" size="lg" loading={ml.formState.isSubmitting} className="mt-2">
                Email me a link
              </Button>
            </form>
          )}
        </Tabs.Panel>
      </Tabs.Root>
      <p className="text-body-sm mt-8 text-on-surface-variant">Accounts are invitation-only. Ask your Expendables contact or your organisation&apos;s admin for access.</p>
    </div>
  );
}

export function MagicLinkConsume({ token, next }: { token: string; next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<PublicError | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <div>
      <h1 className="text-headline-lg">Continue to Expendables Support</h1>
      <p className="text-body-md mt-2 text-on-surface-variant">Click below to finish signing in. The link can only be used once.</p>
      <ErrorBanner error={error} />
      <Button
        size="lg"
        className="mt-6"
        loading={loading}
        onClick={async () => {
          setLoading(true);
          const res = await consumeMagicLink({ token, next });
          setLoading(false);
          if (!res.ok) return setError(res);
          router.replace(res.data.next);
          router.refresh();
        }}
      >
        Sign in
      </Button>
      {error ? (
        <Link href="/login" className="text-label mt-4 block text-secondary underline-offset-4 hover:underline">
          Request a new link
        </Link>
      ) : null}
    </div>
  );
}

const PasswordSchema = z.object({ password: z.string().min(12, "Use at least 12 characters").max(200), confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

export function SetPasswordForm({ mode, token, email, orgName }: { mode: "invite" | "reset"; token: string; email?: string; orgName?: string }) {
  const router = useRouter();
  const [error, setError] = useState<PublicError | null>(null);
  const [done, setDone] = useState(false);
  const form = useForm<z.infer<typeof PasswordSchema>>({ resolver: zodResolver(PasswordSchema), mode: "onBlur", defaultValues: { password: "", confirm: "" } });
  if (done && mode === "reset")
    return (
      <div role="status">
        <h1 className="text-headline-lg">Password updated</h1>
        <p className="text-body-md mt-2 text-on-surface-variant">You&apos;ve been signed out everywhere else. Sign in with your new password.</p>
        <Button className="mt-6" size="lg" onClick={() => router.replace("/login")}>
          Sign in
        </Button>
      </div>
    );
  return (
    <div>
      <h1 className="text-headline-lg">{mode === "invite" ? "Welcome" : "Choose a new password"}</h1>
      <p className="text-body-md mt-2 text-on-surface-variant">
        {mode === "invite" ? (
          <>
            Set a password for <strong className="text-primary">{email}</strong>
            {orgName ? <> to join {orgName}</> : null}. At least 12 characters — a phrase works well.
          </>
        ) : (
          "At least 12 characters — a phrase works well."
        )}
      </p>
      <form
        className="mt-6 flex flex-col gap-4"
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          setError(null);
          const res = mode === "invite" ? await acceptInvite({ token, password: values.password }) : await resetPassword({ token, password: values.password });
          if (!res.ok) return setError(res);
          if (mode === "invite" && "next" in res.data) {
            router.replace(res.data.next);
            router.refresh();
          } else setDone(true);
        })}
      >
        <ErrorBanner error={error} />
        <Field label="New password" required error={form.formState.errors.password?.message}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...form.register("password")} />}
        </Field>
        <Field label="Confirm password" required error={form.formState.errors.confirm?.message}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...form.register("confirm")} />}
        </Field>
        <Button type="submit" size="lg" loading={form.formState.isSubmitting} className="mt-2">
          {mode === "invite" ? "Accept invitation" : "Update password"}
        </Button>
      </form>
    </div>
  );
}

export function ResetRequestForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<PublicError | null>(null);
  const form = useForm<z.input<typeof ResetRequestSchema>>({ resolver: zodResolver(ResetRequestSchema), mode: "onBlur", defaultValues: { email: "" } });
  return (
    <div>
      <h1 className="text-headline-lg">Reset your password</h1>
      {sent ? (
        <p className="text-body-md mt-2 text-on-surface-variant" role="status">
          If an account exists for that address, a reset link is on its way. It works once and expires in 1 hour.
        </p>
      ) : (
        <form
          className="mt-6 flex flex-col gap-4"
          noValidate
          onSubmit={form.handleSubmit(async (values) => {
            const res = await requestPasswordReset(values);
            if (!res.ok) return setError(res);
            setSent(true);
          })}
        >
          <ErrorBanner error={error} />
          <Field label="Email" required error={form.formState.errors.email?.message}>
            {(p) => <Input {...p} type="email" autoComplete="email" {...form.register("email")} />}
          </Field>
          <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
            Email me a reset link
          </Button>
        </form>
      )}
      <Link href="/login" className="text-label mt-6 block text-secondary underline-offset-4 hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}

export function TotpForm({ next, mode, secret, uri, recoveryCodes }: { next?: string; mode: "verify" | "enroll"; secret?: string; uri?: string; recoveryCodes?: string[] }) {
  const router = useRouter();
  const [error, setError] = useState<PublicError | null>(null);
  const [recovery, setRecovery] = useState(false);
  const form = useForm<{ code: string }>({ defaultValues: { code: "" } });
  return (
    <div>
      <h1 className="text-headline-lg">{mode === "enroll" ? "Set up two-factor authentication" : "Two-factor authentication"}</h1>
      {mode === "enroll" ? (
        <div className="text-body-md mt-2 text-on-surface-variant">
          <p>Add this account to Google Authenticator, 1Password or a similar app, then enter the 6-digit code. Required for admins and leads; optional but recommended for everyone else.</p>
          <div className="mt-4 rounded-lg border border-outline-variant/60 bg-surface-container-low p-4">
            <p className="text-overline text-on-surface-variant">Secret key</p>
            <p className="text-mono mt-1 break-all select-all text-primary" data-testid="totp-secret">
              {secret}
            </p>
            {uri ? (
              <a href={uri} className="text-label mt-3 inline-block text-secondary underline-offset-4 hover:underline">
                Open in authenticator app
              </a>
            ) : null}
          </div>
          {recoveryCodes?.length ? (
            <div className="mt-4 rounded-lg border border-warning-border bg-warning-bg p-4 text-warning-fg">
              <p className="text-label">Recovery codes — save these now</p>
              <ul className="text-mono mt-2 grid grid-cols-2 gap-1">
                {recoveryCodes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-body-md mt-2 text-on-surface-variant">Enter the 6-digit code from your authenticator app.</p>
      )}
      <form
        className="mt-6 flex flex-col gap-4"
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          setError(null);
          const res = mode === "enroll" ? await confirmTotpEnrollment({ code: values.code, next }) : recovery ? await signInWithRecoveryCode({ code: values.code }) : await verifyTotp({ code: values.code, next });
          if (!res.ok) return setError(res);
          router.replace(res.data.next);
          router.refresh();
        })}
      >
        <ErrorBanner error={error} />
        <Field label={recovery ? "Recovery code" : "Authentication code"} required error={error?.fields?.code}>
          {(p) => <Input {...p} inputMode={recovery ? "text" : "numeric"} autoComplete="one-time-code" autoFocus maxLength={recovery ? 40 : 6} className="text-mono tracking-[0.3em]" {...form.register("code")} />}
        </Field>
        <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
          {mode === "enroll" ? "Turn on two-factor" : "Continue"}
        </Button>
        {mode === "verify" ? (
          <button type="button" className="text-label self-start text-secondary underline-offset-4 hover:underline" onClick={() => setRecovery((r) => !r)}>
            {recovery ? "Use authenticator code instead" : "Use a recovery code"}
          </button>
        ) : null}
      </form>
    </div>
  );
}
