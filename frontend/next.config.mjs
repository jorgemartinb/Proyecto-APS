/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  output: 'export', // <--- Esto obliga a Next a generar HTML/JS puro que Vercel entiende a la primera
  images: {
    unoptimized: true, // <--- Obligatorio si usas 'output: export' y tienes componentes <Image> de Next
  },
};

export default nextConfig;