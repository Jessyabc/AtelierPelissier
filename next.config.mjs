/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Prisma must run in Node; avoids bundling issues on Vercel.
    serverComponentsExternalPackages: ["@prisma/client"],
  },
};

export default nextConfig;
