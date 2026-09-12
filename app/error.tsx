"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Users get an error id; stack traces only go to the server log / Sentry (security.md A10).
    console.error("error boundary", error.digest);
  }, [error]);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-page text-center">
      <h1 className="text-headline-sm">Something went wrong on our side</h1>
      <p className="text-body-md max-w-sm text-on-surface-variant">
        Please try again. If it keeps happening, tell us this reference: <span className="text-mono">{error.digest ?? "n/a"}</span>
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
