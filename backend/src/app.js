import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import apiRoutes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFound.js';
import { config } from './config/env.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(currentDir, '../../frontend');

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  if (config.logFormat !== 'off') app.use(morgan(config.logFormat));
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false }));

  // REST API
  app.use('/api', apiRoutes);

  // Serve the frontend from the same origin so one command runs the whole app.
  app.use(express.static(frontendDir));

  // The frontend is a hash-routed SPA: send index.html for extension-less GETs.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || path.extname(req.path)) {
      return next();
    }
    return res.sendFile(path.join(frontendDir, 'index.html'));
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
