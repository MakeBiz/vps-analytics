/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    // Вкладка «Оплаты» объединена с «Партнёрки Директ»
    return [{ source: '/payments', destination: '/royalties', permanent: false }];
  },
};
export default nextConfig;
