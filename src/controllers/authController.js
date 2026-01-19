const User = require("../models/User");
const { generateToken } = require("../config/jwt");

/**
 * POST /api/auth/dev-login
 * body: { email, name }
 *
 * - email로 유저 upsert
 * - lastLoginAt 갱신
 * - JWT 발급
 */
const devLogin = async (req, res) => {
  try {
    const { email, name } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const now = new Date();

    // upsert: 없으면 생성, 있으면 업데이트
    const user = await User.findOneAndUpdate(
      { email: normalizedEmail },
      {
        $set: {
          name: name ? String(name).trim() : "",
          lastLoginAt: now,
          updatedAt: now,
          isActive: true,
        },
        $setOnInsert: {
          email: normalizedEmail,
          createdAt: now,
          // 임시 로그인에서 consent 기본값을 넣고 싶다면 (선택)
          privacyConsent: {
            version: "v1",
            acceptedAt: now,
            emailBodyStorage: false,
            domainExtractionOnly: true,
          },
        },
      },
      { new: true, upsert: true }
    );

    const token = generateToken(user._id.toString());

    return res.status(200).json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name || "",
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        isActive: user.isActive,
        privacyConsent: user.privacyConsent || null,
        gmailConnected: !!(user.gmailTokens && user.gmailTokens.refreshToken),
      },
    });
  } catch (err) {
    console.error("[devLogin] error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * GET /api/auth/me
 * header: Authorization: Bearer <token>
 */
const me = async (req, res) => {
  try {
    const userId = req.userId; // middleware/auth.js가 넣어줌
    const user = await User.findById(userId).lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      id: user._id.toString(),
      email: user.email,
      name: user.name || "",
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      isActive: user.isActive,
      privacyConsent: user.privacyConsent || null,
      gmailConnected: !!(user.gmailTokens && user.gmailTokens.refreshToken),
    });
  } catch (err) {
    console.error("[me] error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { devLogin, me };
