"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PurchasingRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/distributors");
  }, [router]);
  return (
    <div className="py-8 text-center text-sm text-[var(--foreground-muted)]">
      Redirecting to Suppliers & Purchasing...
    </div>
  );
}
