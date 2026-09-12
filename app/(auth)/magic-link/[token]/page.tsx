import { MagicLinkConsume } from "@/components/auth/forms";

export const metadata = { title: "Sign in" };

/** Requires a click: link scanners/prefetchers cannot consume the single-use token (security.md A07). */
export default async function MagicLinkPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ next?: string }> }) {
  const { token } = await params;
  const { next } = await searchParams;
  return <MagicLinkConsume token={token} next={next} />;
}
