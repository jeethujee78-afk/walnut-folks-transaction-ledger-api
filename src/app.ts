import express, { type Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { pool } from './db/pool';
import { openApiSpec } from './docs/openapi';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { accountRoutes } from './routes/accountRoutes';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  app.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.get('/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.use('/accounts', accountRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
