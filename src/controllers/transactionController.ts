import { transactionService } from '../services/transactionService';
import { asyncHandler } from '../utils/asyncHandler';
import { accountIdSchema, parse } from '../validators/common';
import { createTransactionSchema, listTransactionsQuerySchema } from '../validators/transaction';

export const transactionController = {
  create: asyncHandler(async (req, res) => {
    const accountId = parse(accountIdSchema, req.params.accountId, 'accountId');
    const input = parse(createTransactionSchema, req.body);
    res.status(201).json({ data: await transactionService.create(accountId, input) });
  }),

  list: asyncHandler(async (req, res) => {
    const accountId = parse(accountIdSchema, req.params.accountId, 'accountId');
    const query = parse(listTransactionsQuerySchema, req.query);
    res.json(await transactionService.list(accountId, query));
  }),
};
