import path from 'path';
import { fileURLToPath } from 'url';
import { builtinModules } from 'module';

// Для __dirname в ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const isDev = process.env.NODE_ENV === 'development'
    // Next.js в dev требует 'unsafe-eval'; в prod оставляем базовый набор (при необходимости ужесточить под конкретные скрипты).
    const csp = [
      "default-src 'self'",
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'",
      // Б-13: иконочный шрифт лежит в public/fonts, а Nunito Sans приезжает
      // на билде через next/font — рантайм-запросов к Google больше нет ни
      // одного. Дырка в CSP закрыта: теперь «доступа к Google нет» проверяет
      // сам браузер, а не только договорённость.
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
  // Включаем instrumentation для запуска планировщика при старте сервера
  experimental: {
    instrumentationHook: true,
    // RSC / server bundles: не тащить эти пакеты в webpack (иначе ломаются Node builtins в dev instrumentation)
    serverComponentsExternalPackages: [
      '@sentry/node',
      '@prisma/client',
      '@prisma/adapter-pg',
      'pg',
      'pg-native',
      // Нативные / optional deps ssh2 — иначе webpack падает на билде (Docker / prod)
      'ssh2',
      'ssh2-sftp-client',
      'cpu-features',
    ],
  },
  // Transpile recharts и victory-vendor для корректной работы графиков в production
  transpilePackages: ['recharts', 'victory-vendor'],
  webpack: (config, { isServer }) => {
    config.resolve.alias['@'] = path.resolve(__dirname);
    // Фиксим n.scalePoint is not a function и кривые линий: подменяем victory-vendor на d3-пакеты
    config.resolve.alias['victory-vendor/d3-scale'] = path.resolve(__dirname, 'node_modules/d3-scale');
    config.resolve.alias['victory-vendor/d3-shape'] = path.resolve(__dirname, 'node_modules/d3-shape');
    // instrumentation бандлится webpack'ом отдельным compiler'ом и не получает автоматический
    // externalize для Node builtins и серверных пакетов. Маркируем их как CommonJS require —
    // рантайм Node подтянет их из node_modules, не раздувая client.js / чанков instrumentation.
    if (isServer) {
      const NODE_BUILTINS = new Set(builtinModules);
      const SERVER_PKGS = new Set([
        '@sentry/node',
        '@prisma/client',
        '@prisma/adapter-pg',
        'pg',
        'pgpass',
        'pg-native',
        'ssh2',
        'ssh2-sftp-client',
        'cpu-features',
      ]);
      const ext = ({ request }, callback) => {
        if (request && request.startsWith('node:')) {
          return callback(undefined, `commonjs ${request.slice('node:'.length)}`);
        }
        if (request && NODE_BUILTINS.has(request)) {
          return callback(undefined, `commonjs ${request}`);
        }
        if (
          request &&
          (SERVER_PKGS.has(request) ||
            [...SERVER_PKGS].some((p) => request.startsWith(p + '/')))
        ) {
          return callback(undefined, `commonjs ${request}`);
        }
        callback();
      };
      if (Array.isArray(config.externals)) {
        config.externals.push(ext);
      } else if (typeof config.externals === 'function') {
        const prev = config.externals;
        config.externals = [prev, ext];
      } else {
        config.externals = [config.externals, ext].filter(Boolean);
      }
    }
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
      {
        // Обложки, загружаемые админом, отдаются как Supabase Storage public URL
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
};

export default nextConfig; // Используем ES Module экспорт
