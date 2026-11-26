import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Trust reverse proxy headers so real client IP is detected accurately across networks/devices
app.set('trust proxy', true);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

function getNormalizedClientIp(req: express.Request): string {
  const cfIp = req.headers['cf-connecting-ip'];
  const xff = req.headers['x-forwarded-for'];
  let raw = '';

  if (typeof cfIp === 'string' && cfIp.trim().length > 0) {
    raw = cfIp.trim();
  } else if (typeof xff === 'string' && xff.trim().length > 0) {
    raw = xff.split(',')[0].trim();
  } else if (Array.isArray(xff) && xff.length > 0) {
    raw = xff[0].split(',')[0].trim();
  } else {
    raw = req.ip || req.socket.remoteAddress || 'unknown';
  }

  if (raw.startsWith('::ffff:')) {
    raw = raw.slice(7);
  }
  if (raw === '::1') {
    raw = '127.0.0.1';
  }

  return raw.slice(0, 64) || 'unknown';
}

function hashClientIp(ip: string): string {
  return crypto
    .createHash('sha256')
    .update(`mostamsakati_ip_v1:${ip}`)
    .digest('hex');
}

// === API ROUTES ===

// 1. Health check (non-sensitive connectivity check only)
app.get('/api/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    status: 'online',
    serverName: 'MOSTAMSAKATI Cloud Auth & Network Gateway',
    timestamp: new Date().toISOString(),
  });
});

// 2. Real-time client IP detection for new-IP / multi-device verification
app.get('/api/network/ip', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const ip = getNormalizedClientIp(req);
  const ipHash = hashClientIp(ip);

  res.json({
    ip,
    ipHash,
    detectedAt: new Date().toISOString(),
  });
});

// Legacy unauthenticated local-file sync/backup routes are retired in favor of authenticated Firebase Firestore
app.all(['/api/sync/*', '/api/backup/*', '/api/server/factory-reset'], (_req, res) => {
  res.status(410).json({
    success: false,
    error: 'This endpoint has been retired. Use authenticated Firebase Cloud Sync.',
  });
});

// VITE MIDDLEWARE SETUP
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  } else {
    const vitePromise = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({
        server: {
          middlewareMode: true,
          allowedHosts: true,
        },
        appType: 'spa',
      })
    );

    vitePromise.catch((err) => {
      console.error('[MOSTAMSAKATI Server] Vite initialization error:', err);
    });

    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MOSTAMSAKATI Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[MOSTAMSAKATI Server] Fatal startup error:', err);
  process.exit(1);
});
