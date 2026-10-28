import { accountService } from '../services/accountService';
import { asyncHandler } from '../utils/asyncHandler';
import { createAccountSchema } from '../validators/account';
import { accountIdSchema, parse } from '../validators/common';

export const accountController = {
  create: asyncHandler(async (req, res) => {
    const { name } = parse(createAccountSchema, req.body);
    res.status(201).json({ data: await accountService.create(name) });
  }),

  getBalance: asyncHandler(async (req, res) => {
    const accountId = parse(accountIdSchema, req.params.accountId, 'accountId');
    res.json({ data: await accountService.getBalance(accountId) });
  }),
};
