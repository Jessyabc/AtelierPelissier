/**
 * All API routes depend on Prisma / runtime env (e.g. DATABASE_URL).
 * Force dynamic rendering so `next build` does not try to prerender route
 * handlers when env vars are missing (e.g. Vercel Preview without DATABASE_URL).
 */
export const dynamic = "force-dynamic";

export default function ApiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
