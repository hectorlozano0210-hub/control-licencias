/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    instrumentationHook: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/license/activate",
        destination: "/api/licenses/activate",
      },
    ];
  },
};

export default nextConfig;
