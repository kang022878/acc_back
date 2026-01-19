const express = require('express');
const { authenticate } = require('../middleware/auth');
const Account = require('../models/Account');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

/**
 * 내 계정 목록 조회
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { status = 'active', sort = '-createdAt' } = req.query;
  
  const filter = { userId: req.userId };
  if (status) filter.status = status;

  const accounts = await Account.find(filter)
    .sort(sort)
    .limit(200);

  res.json({
    total: accounts.length,
    accounts: accounts.map(a => ({
      id: a._id,
      serviceName: a.serviceName,
      serviceDomain: a.serviceDomain,
      category: a.category,
      firstSeenDate: a.firstSeenDate,
      lastActivityDate: a.lastActivityDate,
      inactivityDays: a.inactivityDays,
      confirmed: a.userConfirmed,
      checklist: a.checklist,
      status: a.status
    }))
  });
}));

/**
 * 특정 계정 조회
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const account = await Account.findOne({
    _id: req.params.id,
    userId: req.userId
  });

  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  res.json(account);
}));

/**
 * 계정 확인 (사용자가 선택)
 */
router.post('/:id/confirm', authenticate, asyncHandler(async (req, res) => {
  const account = await Account.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    { userConfirmed: true },
    { new: true }
  );

  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  res.json({
    success: true,
    account: account
  });
}));

/**
 * 체크리스트 업데이트
 */
router.patch('/:id/checklist', authenticate, asyncHandler(async (req, res) => {
  const { passwordChanged, twoFactorEnabled, accountDeleted, reviewedTerms } = req.body;

  const account = await Account.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    {
      checklist: {
        passwordChanged: passwordChanged ?? undefined,
        twoFactorEnabled: twoFactorEnabled ?? undefined,
        accountDeleted: accountDeleted ?? undefined,
        reviewedTerms: reviewedTerms ?? undefined
      }
    },
    { new: true }
  );

  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  res.json({
    success: true,
    checklist: account.checklist
  });
}));

/**
 * 계정 상태 변경 (archived, deleted 등)
 */
router.patch('/:id/status', authenticate, asyncHandler(async (req, res) => {
  const { status } = req.body;
  
  if (!['active', 'archived', 'deleted'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const account = await Account.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    { status },
    { new: true }
  );

  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  res.json({
    success: true,
    status: account.status
  });
}));

/**
 * 계정 삭제
 */
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const result = await Account.deleteOne({
    _id: req.params.id,
    userId: req.userId
  });

  if (result.deletedCount === 0) {
    return res.status(404).json({ error: 'Account not found' });
  }

  res.json({ success: true });
}));

module.exports = router;
