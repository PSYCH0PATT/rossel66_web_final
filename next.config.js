import path from 'path';
import { fileURLToPath } from 'url';

// Для __dirname в ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Включаем instrumentation для запуска планировщика при старте сервера
  experimental: {
    instrumentationHook: true,
  },
  // Transpile recharts и victory-vendor для корректной работы графиков в production
  transpilePackages: ['recharts', 'victory-vendor'],
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname);
    // Фиксим n.scalePoint is not a function и кривые линий: подменяем victory-vendor на d3-пакеты
    config.resolve.alias['victory-vendor/d3-scale'] = path.resolve(__dirname, 'node_modules/d3-scale');
    config.resolve.alias['victory-vendor/d3-shape'] = path.resolve(__dirname, 'node_modules/d3-shape');
    return config;
  },
  // Если у вас есть другие специфичные для проекта настройки Next.js,
  // их нужно будет добавить сюда.
  // reactStrictMode: true, // Например
  reactStrictMode: true,
  // Игнорирование ошибок при билде
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'v0.blob.com',
      },
      {
        protocol: 'https',
        hostname: 'hebbkx1anhila5yf.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: '**.userapi.com',
      },
      {
        protocol: 'https',
        hostname: 'media.zvonkodigital.ru',
      },
      {
        protocol: 'https',
        hostname: 'avatars.yandex.net',
      },
      {
        protocol: 'https',
        hostname: 'avatars.mds.yandex.net',
      },
      {
        protocol: 'https',
        hostname: '**.akamaized.net',
      },
      {
        protocol: 'https',
        hostname: 'example.com',
      },
    ],
  },
};

export default nextConfig; // Используем ES Module экспорт
