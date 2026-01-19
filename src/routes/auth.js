const express = require('express');
const crypto = require("crypto");
const { oauth2Client } = require('../config/google');
const { generateToken } = require('../config/jwt');
const { encryptToken } = require('../utils/encryption');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');

const { authenticate } = require('../middleware/auth');

const router = express.Router();


function signState(userId) {
  const secret = process.env.JWT_SECRET || "secret";
  return crypto.createHmac("sha256", secret).update(userId).digest("hex");
}

router.get('/google/callback', asyncHandler(async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).json({ error: "Authorization code required" });
  }
  if (!state || typeof state !== "string" || !state.includes(".")) {
    return res.status(400).json({ error: "Invalid state" });
  }

  const [userId, sig] = state.split(".");
  if (!userId || !sig || sig !== signState(userId)) {
    return res.status(400).json({ error: "State verification failed" });
  }

  // code -> tokens 교환
  const { tokens } = await oauth2Client.getToken(String(code));
  oauth2Client.setCredentials(tokens);

  // 사용자 찾기 (state의 userId 기준)
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found for state" });
  }

  // refresh_token은 첫 동의 시에만 오거나, prompt=consent로 강제해야 잘 옴
  const accessToken = tokens.access_token || "";
  const refreshTokenRaw = tokens.refresh_token || "";
  const expiryMs = tokens.expiry_date || tokens.expiry_time || null;

  let refreshToken = refreshTokenRaw;
  let encrypted = false;

  // refreshToken 암호화(필수)
  if (refreshToken && process.env.ENCRYPTION_KEY) {
    refreshToken = encryptToken(refreshToken);
    encrypted = true;
  }

  user.gmailTokens = {
    accessToken, // MVP에서는 저장해도 되지만, 원하면 저장 안 해도 됨(짧게 사라짐)
    refreshToken, // 암호화된 refresh token
    expiresAt: expiryMs ? new Date(expiryMs) : null,
    encrypted,
  };

  user.lastLoginAt = new Date();
  await user.save();

  // 완료 후 프런트로 리다이렉트(원하는 페이지로)
  const redirectTo = process.env.POST_AUTH_REDIRECT || "http://localhost:3000/dashboard?gmail=connected";
  return res.redirect(redirectTo);
}));

/**
 * Google OAuth 인증 URL 생성
 */
router.get('/google/auth-url', asyncHandler(async (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.readonly'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes
  });

  res.json({ authUrl });
}));

/**
 * Google OAuth 콜백
 */
router.post('/google/callback', asyncHandler(async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code required' });
  }

  try {
    // 토큰 교환
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // 사용자 정보 조회
    const response = await oauth2Client.request({
      url: 'https://www.googleapis.com/oauth2/v2/userinfo'
    });

    const { email, name, id: googleId } = response.data;

    // 또는 기존 사용자 찾기
    let user = await User.findOne({ email });

    if (!user) {
      // 새 사용자 생성
      user = new User({
        email,
        name,
        googleId,
        gmailTokens: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(tokens.expiry_time),
          encrypted: true
        },
        privacyConsent: {
          version: '1.0',
          emailBodyStorage: false,
          domainExtractionOnly: true
        }
      });
    } else {
      // 기존 사용자 업데이트
      user.gmailTokens = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expiry_time),
        encrypted: true
      };
      user.googleId = googleId;
    }

    // 토큰 암호화 (프로덕션에서는 필수)
    if (user.gmailTokens.refreshToken && process.env.ENCRYPTION_KEY) {
      user.gmailTokens.refreshToken = encryptToken(user.gmailTokens.refreshToken);
    }

    user.lastLoginAt = new Date();
    await user.save();

    // JWT 토큰 발급
    const jwtToken = generateToken(user._id);

    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}));

/**
 * (개발용) 임시 로그인
 * POST /api/auth/dev-login
 * body: { email, name }
 */
router.post('/dev-login', asyncHandler(async (req, res) => {
  const { email, name } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const now = new Date();

  // email로 upsert
  const user = await User.findOneAndUpdate(
    { email: normalizedEmail },
    {
      $set: {
        name: name ? String(name).trim() : '',
        lastLoginAt: now,
        isActive: true
      },
      $setOnInsert: {
        email: normalizedEmail,
        privacyConsent: {
          version: '1.0',
          acceptedAt: now,
          emailBodyStorage: false,
          domainExtractionOnly: true
        }
      }
    },
    { new: true, upsert: true }
  );

  const jwtToken = generateToken(user._id.toString());

  res.json({
    success: true,
    token: jwtToken,
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name || '',
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      gmailConnected: !!(user.gmailTokens && user.gmailTokens.refreshToken)
    }
  });
}));

/**
 * 내 정보 조회
 * GET /api/auth/me
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).lean();

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    id: user._id.toString(),
    email: user.email,
    name: user.name || '',
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    gmailConnected: !!(user.gmailTokens && user.gmailTokens.refreshToken),
    privacyConsent: user.privacyConsent || null
  });
}));

/**
 * 로그아웃
 */
router.post('/logout', asyncHandler(async (req, res) => {
  // 프론트에서 토큰 삭제, 서버는 상태 없음
  res.json({ success: true });
}));

module.exports = router;
