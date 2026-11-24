// Entry point: migrate the database, then start the HTTP server.
import { config } from './src/config/index.js';
import { createApp } from './src/app.js';
import { migrate } from './src/db/migrate.js';
import { warmUp } from './src/services/ollamaService.js';

migrate()
  .then(() => createApp().listen(config.port, () => {
    console.log(`API on :${config.port}`);
    warmUp();
  }))
  .catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });
