import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import express from 'express';
import type { PushSubscription } from 'web-push';

const require = createRequire(import.meta.url);
const webpush = require('web-push') as typeof import('web-push');

interface StoredPushSubscription {
  userId: string;
  endpoint: string;
  subscription: PushSubscription;
  updatedAt: string;
}

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.cwd(), '.data');
const VAPID_FILE = path.join(DATA_DIR, 'vapid-keys.json');
const SUBS_FILE = path.join(DATA_DIR, 'push-subscriptions.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadOrCreateVapidKeys(): VapidKeys {
  const envPub = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPriv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (envPub && envPriv) {
    return { publicKey: envPub, privateKey: envPriv };
  }

  ensureDataDir();
  if (fs.existsSync(VAPID_FILE)) {
    try {
      const raw = fs.readFileSync(VAPID_FILE, 'utf8');
      const parsed = JSON.parse(raw) as VapidKeys;
      if (parsed.publicKey && parsed.privateKey) {
        return parsed;
      }
    } catch {
      // regenerate if unreadable
    }
  }

  const generated = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify(generated, null, 2), 'utf8');
  return generated;
}

function loadSubscriptions(): StoredPushSubscription[] {
  ensureDataDir();
  if (!fs.existsSync(SUBS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(SUBS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSubscriptions(list: StoredPushSubscription[]): void {
  ensureDataDir();
  fs.writeFileSync(SUBS_FILE, JSON.stringify(list, null, 2), 'utf8');
}

const vapidKeys = loadOrCreateVapidKeys();
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:support@txtourbd.app',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const DEFAULT_PUBLIC_ORIGIN =
  'https://ais-pre-xqluoj7ufqf3547m4ybkp7-104523512966.asia-northeast1.run.app';

function resolvePublicOrigin(req: express.Request): string {
  const envOrigin = process.env.APP_URL?.trim().replace(/\/+$/, '');
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const rawHost = forwardedHost || req.get('host')?.trim();

  if (rawHost) {
    const isLocalHost =
      rawHost.startsWith('localhost') ||
      rawHost.startsWith('127.0.0.1') ||
      rawHost.startsWith('0.0.0.0');
    if (isLocalHost && process.env.NODE_ENV === 'production') {
      return envOrigin || DEFAULT_PUBLIC_ORIGIN;
    }
    const proto = forwardedProto || (isLocalHost ? 'http' : 'https');
    return `${proto}://${rawHost}`;
  }

  return envOrigin || DEFAULT_PUBLIC_ORIGIN;
}

function buildSitemapXml(origin: string): string {
  const base = origin.replace(/\/+$/, '');
  const lastmod = '2026-11-17';
  const urls = [
    { loc: `${base}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${base}/app`, changefreq: 'daily', priority: '0.9' },
    { loc: `${base}/install`, changefreq: 'weekly', priority: '0.8' },
    { loc: `${base}/refer-earn`, changefreq: 'weekly', priority: '0.7' },
  ];

  const items = urls
    .map(
      (entry) => `  <url>
    <loc>${entry.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>
`;
}

function buildRobotsTxt(origin: string): string {
  const base = origin.replace(/\/+$/, '');
  return `User-agent: *
Allow: /
Allow: /app
Allow: /install
Allow: /refer-earn
Disallow: /api/
Disallow: /admin
Disallow: /admin-login
Disallow: /admin-panel
Disallow: /admin-dashboard
Disallow: /manage-admins
Disallow: /room-manager
Disallow: /ban-management
Disallow: /winner-payout-list

Sitemap: ${base}/sitemap.xml
`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/sitemap.xml', (req, res) => {
    const origin = resolvePublicOrigin(req);
    res.status(200);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buildSitemapXml(origin));
  });

  app.get('/robots.txt', (req, res) => {
    const origin = resolvePublicOrigin(req);
    res.status(200);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buildRobotsTxt(origin));
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/download-apk', (_req, res) => {
    const candidates = [
      path.resolve(process.cwd(), 'public', 'TX-TOUR-BD.apk'),
      path.resolve(process.cwd(), 'dist', 'TX-TOUR-BD.apk'),
    ];
    const apkPath = candidates.find((p) => fs.existsSync(p));
    if (!apkPath) {
      res.status(404).json({ error: 'Android APK package is not available yet.' });
      return;
    }
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="TX-TOUR-BD-v3.apk"');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(apkPath);
  });

  app.get('/api/push/vapid-public-key', (_req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  app.post('/api/push/subscribe', (req, res) => {
    try {
      const { userId, subscription } = req.body || {};
      if (
        !userId ||
        typeof userId !== 'string' ||
        !subscription ||
        typeof subscription.endpoint !== 'string' ||
        !subscription.keys
      ) {
        res.status(400).json({ error: 'Invalid push subscription payload' });
        return;
      }

      const existing = loadSubscriptions().filter(
        (item) => item.endpoint !== subscription.endpoint
      );
      existing.push({
        userId,
        endpoint: subscription.endpoint,
        subscription,
        updatedAt: new Date().toISOString(),
      });
      saveSubscriptions(existing);

      res.json({ ok: true });
    } catch (err) {
      console.error('Push subscribe error:', err);
      res.status(500).json({ error: 'Failed to save push subscription' });
    }
  });

  app.post('/api/push/unsubscribe', (req, res) => {
    try {
      const { endpoint } = req.body || {};
      if (!endpoint || typeof endpoint !== 'string') {
        res.status(400).json({ error: 'Endpoint required' });
        return;
      }
      const next = loadSubscriptions().filter((item) => item.endpoint !== endpoint);
      saveSubscriptions(next);
      res.json({ ok: true });
    } catch (err) {
      console.error('Push unsubscribe error:', err);
      res.status(500).json({ error: 'Failed to remove push subscription' });
    }
  });

  app.post('/api/push/send-room', async (req, res) => {
    try {
      const { userIds, title, body, url, tag } = req.body || {};
      if (!Array.isArray(userIds) || userIds.length === 0) {
        res.json({ ok: true, sentCount: 0, failedCount: 0 });
        return;
      }

      const targetSet = new Set<string>(
        userIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      );
      const allSubs = loadSubscriptions();
      const targetSubs = allSubs.filter((s) => targetSet.has(s.userId));

      if (targetSubs.length === 0) {
        res.json({ ok: true, sentCount: 0, failedCount: 0 });
        return;
      }

      const payload = JSON.stringify({
        title: title || 'Room Code Chole Asche',
        body:
          body ||
          'Tomar Match er Room ID & Password deya hoyeche. ROOM button e click kore dekhe nao.',
        url: url || '/app',
        tag: tag || `room-${Date.now()}`,
      });

      const expiredEndpoints = new Set<string>();
      let sentCount = 0;
      let failedCount = 0;

      await Promise.all(
        targetSubs.map(async (entry) => {
          try {
            await webpush.sendNotification(entry.subscription, payload);
            sentCount += 1;
          } catch (err: unknown) {
            failedCount += 1;
            const statusCode =
              typeof err === 'object' && err !== null && 'statusCode' in err
                ? Number((err as { statusCode?: number }).statusCode)
                : 0;
            if (statusCode === 404 || statusCode === 410) {
              expiredEndpoints.add(entry.endpoint);
            }
          }
        })
      );

      if (expiredEndpoints.size > 0) {
        const cleaned = allSubs.filter((s) => !expiredEndpoints.has(s.endpoint));
        saveSubscriptions(cleaned);
      }

      res.json({ ok: true, sentCount, failedCount });
    } catch (err) {
      console.error('Push send error:', err);
      res.status(500).json({ error: 'Failed to send push notifications' });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TX TOUR BD server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
