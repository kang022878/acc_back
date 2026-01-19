const crypto = require('crypto');
const CryptoJS = require('crypto-js');

// 토큰 암호화 (refreshToken 보호용)
const encryptToken = (token) => {
  const encrypted = CryptoJS.AES.encrypt(
    token,
    process.env.ENCRYPTION_KEY
  ).toString();
  return encrypted;
};

// 토큰 복호화
const decryptToken = (encrypted) => {
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, process.env.ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted;
  } catch (error) {
    console.error('토큰 복호화 실패:', error.message);
    return null;
  }
};

// 문자열 해싱 (정책 내용 비교용)
const hashString = (str) => {
  return crypto.createHash('sha256').update(str).digest('hex');
};

module.exports = {
  encryptToken,
  decryptToken,
  hashString
};
