import path from 'path';
import { fileURLToPath } from 'url';

// Для __dirname в ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => { // Убираем неиспользуемые параметры
    config.resolve.alias['@'] = path.resolve(__dirname);
    return config;
  },
  // Если у вас есть другие специфичные для проекта настройки Next.js,
  // их нужно будет добавить сюда.
  // reactStrictMode: true, // Например
  reactStrictMode: true,
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
        hostname: 'sun6-23.userapi.com',
      },
      {
        protocol: 'https',
        hostname: 'sun6-21.userapi.com',
      },
      {
        protocol: 'https',
        hostname: 'media.zvonkodigital.ru',
      },
    ],
  },
};

export default nextConfig; // Используем ES Module экспорт
