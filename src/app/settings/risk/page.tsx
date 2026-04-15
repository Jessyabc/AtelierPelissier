"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RiskSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin?tab=behavior");
  }, [router]);

  return (
    <div className="space-y-4 rounded border border-amber-200 bg-amber-50 p-4 text-amber-900">
      <h1 className="text-lg font-semibold">Risk settings moved</h1>
      <p className="text-sm">
        Risk and behavior controls are now consolidated in the Admin Hub under
        <strong> App Behavior</strong>.
      </p>
      <Link href="/admin?tab=behavior" className="inline-block rounded bg-amber-700 px-3 py-2 text-sm text-white">
        Open App Behavior controls
      </Link>
    </div>
  );
}
