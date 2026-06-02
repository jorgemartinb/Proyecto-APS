/** @type {import('next').NextConfig} */
const backendApiUrl = process.env.BACKEND_API_URL || "http://localhost:8000";

const nextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendApiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
