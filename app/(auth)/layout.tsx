import Image from "next/image";

/** Login-style split layout (docs/design.md §8.3): navy panel with the banner, form on the right. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-primary-container text-on-primary lg:flex lg:flex-col lg:justify-between lg:p-10">
        <Image src="/brand/expendables-mission-vision.png" alt="" fill priority className="object-cover opacity-90" sizes="45vw" />
        <div className="relative">
          <Image src="/brand/expendables-logo.png" alt="EXPENDABLES { Software Solutions }" width={72} height={72} className="rounded-md" priority />
        </div>
        <div className="relative max-w-md">
          <p className="text-overline text-secondary-fixed-dim">Client support</p>
          <h1 className="text-display mt-3 text-on-primary">Engineering Tomorrow.</h1>
          <p className="text-body-lg mt-4 text-secondary-fixed">Raise requests, follow progress and talk to the engineers working on your systems — in one place.</p>
        </div>
        <p className="relative text-body-sm text-on-primary-container">EXPENDABLES (PVT) LTD · 63 Parakum Mawatha, Gampaha</p>
      </aside>
      <main className="flex items-center justify-center px-page py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image src="/brand/expendables-logo.png" alt="EXPENDABLES" width={40} height={40} className="rounded-md" />
            <span className="text-headline-sm uppercase">Expendables (Pvt) Ltd</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
