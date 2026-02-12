import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold text-gray-900">Page not found</h1>
      <p className="text-gray-600">The page you’re looking for doesn’t exist.</p>
      <Link
        href="/"
        className="btn-primary rounded px-4 py-2 text-sm font-medium transition-colors"
      >
        Back to home
      </Link>
    </div>
  );
}
