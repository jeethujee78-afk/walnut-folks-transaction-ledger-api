import { Router } from 'express';
import { accountController } from '../controllers/accountController';
import { transactionController } from '../controllers/transactionController';
import { Errors } from '../errors/AppError';

const router = Router();

router.post('/', accountController.create);
router.get('/:accountId/balance', accountController.getBalance);
router.post('/:accountId/transactions', transactionController.create);
router.get('/:accountId/transactions', transactionController.list);

// Immutability: no edit/delete operations exist. Answer explicitly (405) rather than a vague 404.
const MUTATING_METHODS = new Set(['PUT', 'PATCH', 'DELETE']);
router.all(['/:accountId/transactions', '/:accountId/transactions/:transactionId'], (req, _res, next) => {
  next(MUTATING_METHODS.has(req.method) ? Errors.transactionsImmutable() : undefined);
});

export { router as accountRoutes };
