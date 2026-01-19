const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: /.+\@.+\..+/
  },
  name: String,
  googleId: String,
  // Gmail 토큰 (암호화되어 저장)
  gmailTokens: {
    accessToken: String,
    refreshToken: String,
    expiresAt: Date,
    encrypted: Boolean
  },
  // 개인정보 정책
  privacyConsent: {
    version: String,
    acceptedAt: Date,
    emailBodyStorage: Boolean, // 메일 본문 저장 동의 여부
    domainExtractionOnly: Boolean // 도메인만 추출 동의 여부
  },
  // 마지막 로그인
  lastLoginAt: Date,
  // 계정 상태
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
