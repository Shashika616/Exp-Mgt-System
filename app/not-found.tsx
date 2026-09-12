import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-page text-center">
      <SearchX className="size-6 text-on-surface-variant" strokeWidth={1.5} aria-hidden />
      <h1 className="text-headline-sm">We couldn&apos;t find that</h1>
      <p className="text-body-md max-w-sm text-on-surface-variant">The page or ticket doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/" className="text-label text-secondary underline-offset-4 hover:underline">
        Go to your dashboard
      </Link>
    </main>
  );
}
