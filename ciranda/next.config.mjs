/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Mantém o build resiliente em ambientes de demonstração.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
