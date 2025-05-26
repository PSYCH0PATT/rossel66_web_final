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
    domains: [
      'v0.blob.com',
      'hebbkx1anhila5yf.public.blob.vercel-storage.com'
    ],
  },
};

export default nextConfig; // Используем ES Module экспорт
