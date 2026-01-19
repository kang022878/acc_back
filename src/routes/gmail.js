const express = require('express');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');
const { oauth2Client } = require('../config/google');
const GmailService = require('../services/gmailService');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const { decryptToken } = require('../utils/encryption');

const router = express.Router();

function signState(userId) {
  const secret = process.env.JWT_SECRET || 'secret';
  return crypto.createHmac('sha256', secret).update(userId).digest('hex');
}

/**
 * Gmail 연결 상태 확인
 */
router.get('/status', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).lean();

  const connected = !!(user?.gmailTokens?.refreshToken);
  if (!connected) return res.json({ connected: false });

  res.json({
    connected: true,
    email: user.email,
    // connectedAt은 expiresAt이 아니라 "연결 완료 시각"이 더 자연스러움.
    // 지금은 대체로 updatedAt을 사용(원하면 gmailTokens.connectedAt 필드 추가 추천)
    connectedAt: user.updatedAt,
    privacyConsent: user.privacyConsent,
    encrypted: !!user.gmailTokens?.encrypted
  });
}));

/**
 * GET /api/gmail/connect-url
 */
router.get('/connect-url', authenticate, asyncHandler(async (req, res) => {
  const userId = req.userId;
  const state = `${userId}.${signState(userId)}`;

  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.readonly'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    state
  });

  res.json({ authUrl });
}));

/**
 * 개인정보 동의 업데이트
 */
router.post('/privacy-consent', authenticate, asyncHandler(async (req, res) => {
  const { emailBodyStorage, domainExtractionOnly } = req.body;

  const user = await User.findByIdAndUpdate(
    req.userId,
    {
      privacyConsent: {
        version: '1.0',
        acceptedAt: new Date(),
        emailBodyStorage: !!emailBodyStorage,
        domainExtractionOnly: !!domainExtractionOnly
      }
    },
    { new: true }
  ).lean();

  res.json({ success: true, privacyConsent: user.privacyConsent });
}));

/**
 * access token을 refresh token으로 재발급 (scan에서 사용)
 */
async function getFreshAccessToken(user) {
  if (!user?.gmailTokens?.refreshToken) return null;

  // refresh token 복호화 (encrypted=true일 때)
  let refreshToken = user.gmailTokens.refreshToken;
  if (user.gmailTokens.encrypted) {
    refreshToken = decryptToken(refreshToken);
  }

  if (!refreshToken) return null;

  // oauth2Client에 refresh_token 세팅 후 access token 발급
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  // googleapis 버전에 따라 리턴 형태가 다를 수 있어서 안전 처리
  const tokenResp = await oauth2Client.getAccessToken();
  const accessToken =
    (typeof tokenResp === 'string' ? tokenResp : tokenResp?.token) || null;

  return accessToken;
}

/**
 * Gmail 이메일 스캔 (가입 서비스 후보 추출)
 * POST /api/gmail/scan
 * body(optional): { limit }
 */
router.post('/scan', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);

  if (!user?.gmailTokens?.refreshToken) {
    return res.status(400).json({ error: 'Gmail not connected' });
  }

  const limit = Math.min(Number(req.body?.limit || 100), 200);

  // (중요) refresh token으로 access token을 매번 새로 받기
  const accessToken = await getFreshAccessToken(user);
  if (!accessToken) {
    return res.status(401).json({ error: 'Failed to refresh access token' });
  }

  // 검색 쿼리 구성
  const queries = GmailService.getDefaultSearchQueries();

  // 메시지 검색
  const messages = await GmailService.searchEmails(accessToken, queries, limit);

  if (!messages || messages.length === 0) {
    return res.json({ success: true, discoveredCount: 0, accounts: [] });
  }

  // 메시지 상세 정보 조회 (metadata만)
  const emailMetadata = [];
  for (const msg of messages.slice(0, limit)) {
    try {
      const details = await GmailService.getMessageDetails(accessToken, msg.id);
      emailMetadata.push(details);
    } catch (error) {
      console.error(`메시지 상세 조회 실패 (${msg.id}):`, error.message);
    }
  }

  // 발견된 이메일을 Account로 변환 및 저장
  const accounts = await GmailService.processDiscoveredEmails(req.userId, emailMetadata);

  res.json({
    success: true,
    discoveredCount: accounts.length,
    accounts: accounts.map(a => ({
      id: a._id,
      serviceName: a.serviceName,
      serviceDomain: a.serviceDomain,
      category: a.category,
      firstSeenDate: a.firstSeenDate,
      confirmed: a.userConfirmed
    }))
  });
}));

/**
 * Gmail 연결 해제
 */
router.post('/disconnect', authenticate, asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.userId, { gmailTokens: null });
  res.json({ success: true });
}));

module.exports = router;
