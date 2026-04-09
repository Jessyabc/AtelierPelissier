import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(["admin"]);
  if (!session.ok) {
    // If user is logged in but lacks role (or is impersonating), send them to their landing page.
    redirect("/");
  }
  return <>{children}</>;
}

