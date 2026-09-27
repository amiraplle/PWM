import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Path to firmware and workflow source files
const FIRMWARE_DIR = path.join(__dirname, 'firmware');
const INO_PATH = path.join(FIRMWARE_DIR, 'esp32c3_cob_pwm', 'esp32c3_cob_pwm.ino');
const PLATFORMIO_PATH = path.join(FIRMWARE_DIR, 'platformio.ini');
const MERGE_BIN_PATH = path.join(FIRMWARE_DIR, 'merge_bin.py');
const BUILD_SH_PATH = path.join(FIRMWARE_DIR, 'build.sh');
const WORKFLOW_PATH = path.join(__dirname, '.github', 'workflows', 'build-esp32.yml');

// Serve firmware and workflow files directly for download
app.get('/api/firmware/download-ino', (_req: Request, res: Response) => {
  if (fs.existsSync(INO_PATH)) {
    res.download(INO_PATH, 'esp32c3_cob_pwm.ino');
  } else {
    res.status(404).json({ error: 'Firmware file not found' });
  }
});

app.get('/api/firmware/download-platformio', (_req: Request, res: Response) => {
  if (fs.existsSync(PLATFORMIO_PATH)) {
    res.download(PLATFORMIO_PATH, 'platformio.ini');
  } else {
    res.status(404).json({ error: 'platformio.ini not found' });
  }
});

app.get('/api/firmware/download-workflow', (_req: Request, res: Response) => {
  if (fs.existsSync(WORKFLOW_PATH)) {
    res.download(WORKFLOW_PATH, 'build-esp32.yml');
  } else {
    res.status(404).json({ error: 'build-esp32.yml not found' });
  }
});

app.get('/api/firmware/download-merge-bin', (_req: Request, res: Response) => {
  if (fs.existsSync(MERGE_BIN_PATH)) {
    res.download(MERGE_BIN_PATH, 'merge_bin.py');
  } else {
    res.status(404).json({ error: 'merge_bin.py not found' });
  }
});

app.get('/api/firmware/download-build-sh', (_req: Request, res: Response) => {
  if (fs.existsSync(BUILD_SH_PATH)) {
    res.download(BUILD_SH_PATH, 'build.sh');
  } else {
    res.status(404).json({ error: 'build.sh not found' });
  }
});

// Provide raw firmware and workflow source code for in-browser review & copy
app.get('/api/firmware/source', (_req: Request, res: Response) => {
  try {
    const inoCode = fs.existsSync(INO_PATH) ? fs.readFileSync(INO_PATH, 'utf-8') : '';
    const platformioCode = fs.existsSync(PLATFORMIO_PATH) ? fs.readFileSync(PLATFORMIO_PATH, 'utf-8') : '';
    const workflowCode = fs.existsSync(WORKFLOW_PATH) ? fs.readFileSync(WORKFLOW_PATH, 'utf-8') : '';
    const mergeBinCode = fs.existsSync(MERGE_BIN_PATH) ? fs.readFileSync(MERGE_BIN_PATH, 'utf-8') : '';
    const buildShCode = fs.existsSync(BUILD_SH_PATH) ? fs.readFileSync(BUILD_SH_PATH, 'utf-8') : '';

    res.json({
      inoCode,
      platformioCode,
      workflowCode,
      mergeBinCode,
      buildShCode,
      filename: 'esp32c3_cob_pwm.ino',
      sizeBytes: Buffer.byteLength(inoCode, 'utf8'),
      lastModified: fs.existsSync(INO_PATH) ? fs.statSync(INO_PATH).mtime : new Date(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy endpoint to communicate with ESP32-C3 on user's LAN (avoiding browser mixed-content/CORS)
app.all('/api/esp32/proxy', async (req: Request, res: Response) => {
  const targetUrl = req.query.target as string;
  if (!targetUrl) {
    res.status(400).json({ error: 'Missing target query parameter (e.g. http://192.168.1.150/api/state)' });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        ...(req.body && Object.keys(req.body).length > 0 ? { 'Content-Type': 'application/json' } : {})
      },
      signal: controller.signal,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    clearTimeout(timeout);

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else {
      const text = await response.text();
      res.status(response.status).send(text);
    }
  } catch (error: any) {
    res.status(502).json({
      error: 'Failed to communicate with ESP32-C3 controller',
      details: error.message || 'Connection refused or timed out',
      target: targetUrl
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ESP32-C3 COB PWM Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
