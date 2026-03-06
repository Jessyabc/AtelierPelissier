"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    router.push("/");
  }

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      {/* Hero */}
      <section className="text-center space-y-6 pt-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
          Atelier Pelissier
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Custom cabinetry and millwork — vanities, side units, and kitchens —
          built with precision and care.
        </p>
      </section>

      {/* Login */}
      <section className="neo-card p-8 sm:p-10 max-w-md mx-auto">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Sign in</h2>
        <p className="text-sm text-gray-600 mb-6">
          Enter your email and password to access the Pricing Engine.
        </p>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="neo-input w-full px-4 py-3 text-sm"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="neo-input w-full px-4 py-3 text-sm"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="neo-btn-primary w-full px-5 py-3 text-sm font-medium"
          >
            Log in
          </button>
        </form>
        <p className="mt-4 text-xs text-gray-500">
          No account? Contact your administrator for access.
        </p>
      </section>

      {/* Product intro */}
      <section className="neo-card p-8 sm:p-10 space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Pricing Engine
        </h2>
        <p className="text-gray-700 leading-relaxed">
          Our internal pricing and cost engine helps manage quotes, projects, and service
          from estimate to delivery. One place for projects, clients, inventory, and
          on-site visits.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/projects/new"
            className="neo-btn-primary px-5 py-2.5 text-sm font-medium inline-block"
          >
            New Project
          </Link>
          <Link
            href="/"
            className="neo-btn px-5 py-2.5 text-sm font-medium inline-block"
          >
            View Projects
          </Link>
        </div>
      </section>

      {/* Features grid */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">What it does</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {[
            {
              title: "Projects & estimates",
              desc: "Create projects for vanities, side units, and kitchens. Build estimates with configurable dimensions, door styles, countertops, and more.",
              href: "/projects/new",
            },
            {
              title: "Service calls",
              desc: "Track on-site visits, work performed, materials used, and client sign-off. Day planning and calendar for scheduling technicians.",
              href: "/service-calls",
            },
            {
              title: "Inventory & purchasing",
              desc: "Manage sheet goods, hardware, and materials. Track stock movements, reorder points, and supplier orders.",
              href: "/inventory",
            },
            {
              title: "Costing & risk",
              desc: "Estimate vs. actual costs, margin tracking, and deviation alerts. Stay on top of project profitability.",
              href: "/costing",
            },
          ].map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className="neo-card p-6 block transition-all hover:shadow-[6px_6px_12px_var(--shadow-dark),-6px_-6px_12px_var(--shadow-light)]"
            >
              <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer tagline */}
      <section className="text-center py-6 text-sm text-gray-500">
        <p>Internal use · Data stored locally on your machine</p>
      </section>
    </div>
  );
}
