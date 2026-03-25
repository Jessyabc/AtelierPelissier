"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Redirects authenticated users who have not finished onboarding (Neon User.onboardingComplete).
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname) return;
    if (pathname === "/login" || pathname.startsWith("/auth")) return;
    if (pathname.startsWith("/onboarding")) return;

    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user?: { onboardingComplete?: boolean } } | null) => {
        if (data?.user && data.user.onboardingComplete === false) {
          router.replace("/onboarding");
        }
      })
      .catch(() => {});
  }, [pathname, router]);

  return <>{children}</>;
}
