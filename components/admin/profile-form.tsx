"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveProfile } from "@/lib/actions/admin";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export function ProfileForm({ value }: { value: { fullName: string; email: string; role: string; mfaEnrolled: boolean } }) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(value.fullName);
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid max-w-3xl gap-6 md:grid-cols-2">
      <Card>
        <CardHeader eyebrow="Account" title="Details" />
        <form className="flex flex-col gap-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const r = await saveProfile({ fullName: name }); setBusy(false); if (!r.ok) return toast({ title: r.message, tone: "error" }); toast({ title: "Profile saved", tone: "success" }); router.refresh(); }}>
          <Field label="Full name" required>{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Email">{(p) => <Input {...p} value={value.email} disabled />}</Field>
          <p className="text-body-sm text-on-surface-variant">Role: {value.role.replace("_", " ")}</p>
          <Button type="submit" loading={busy} className="self-start">Save</Button>
        </form>
      </Card>
      <Card>
        <CardHeader eyebrow="Security" title="Sign-in" />
        <ul className="flex flex-col gap-3 text-body-md">
          <li className="flex items-center justify-between gap-3"><span>Two-factor authentication</span>{value.mfaEnrolled ? <span className="text-success-fg">On</span> : <Link href="/mfa/enroll" className="text-label text-secondary hover:underline">Set up</Link>}</li>
          <li className="flex items-center justify-between gap-3"><span>Password</span><Link href="/reset" className="text-label text-secondary hover:underline">Reset by email</Link></li>
          <li className="flex items-center justify-between gap-3"><span>Sessions</span><Button size="sm" variant="outline" onClick={async () => { const r = await signOut({ everywhere: true }); if (r.ok) { router.replace(r.data.next); router.refresh(); } }}>Sign out everywhere</Button></li>
        </ul>
      </Card>
    </div>
  );
}
