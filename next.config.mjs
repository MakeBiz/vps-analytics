/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    return [
      // Вкладка «Оплаты» объединена с «Партнёрки Директ»
      { source: '/payments', destination: '/royalties', permanent: false },
      // Вкладка «Экономика» убрана
      { source: '/economics', destination: '/', permanent: false },
    ];
  },
};
export default nextConfig;
