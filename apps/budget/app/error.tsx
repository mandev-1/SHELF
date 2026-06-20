"use client";

// App Router error boundary — catches any uncaught render/boot error in the
// route and shows the friendly illustrated screen instead of a blank crash.
import { BootError } from "@/components/BootError";

export default function Error({ error }: { error: Error & { digest?: string } }) {
  return (
    <main className="relative z-10 mx-auto min-h-screen max-w-[1640px] px-6 py-6">
      <BootError detail={error?.message} />
    </main>
  );
}
