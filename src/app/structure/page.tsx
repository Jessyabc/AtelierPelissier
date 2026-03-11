"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StructurePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin");
  }, [router]);

  return (
    <div className="py-8 text-center text-sm text-[var(--foreground-muted)]">
      Redirecting to Admin Hub...
    </div>
  );
}
