import express from 'express';
import routes from './routes/index.js';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '6mb' })); // photos arrive as small base64 JPEGs
  app.use('/api', routes);
  return app;
}
