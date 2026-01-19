// Gmail 메시지에서 도메인 추출
const extractDomainFromEmail = (emailAddress) => {
  try {
    const domain = emailAddress.split('@')[1];
    return domain ? domain.toLowerCase() : null;
  } catch (error) {
    return null;
  }
};

// List-Unsubscribe 헤더에서 도메인 추출
const extractDomainFromUnsubscribe = (unsubscribeHeader) => {
  if (!unsubscribeHeader) return null;
  
  try {
    // 예: <mailto:unsubscribe@example.com>, <https://example.com/unsubscribe>
    const httpMatch = unsubscribeHeader.match(/<https?:\/\/([^/]+)\//);
    const mailtoMatch = unsubscribeHeader.match(/mailto:([^@]+@[^>]+)>/);
    
    if (httpMatch) {
      return httpMatch[1].toLowerCase();
    }
    if (mailtoMatch) {
      return extractDomainFromEmail(mailtoMatch[1]);
    }
  } catch (error) {
    return null;
  }
  return null;
};

// 메일 제목에서 서비스명 추출 (간단한 규칙)
const extractServiceNameFromSubject = (subject) => {
  if (!subject) return null;
  
  // [서비스명] 형식
  const bracketMatch = subject.match(/\[([^\]]+)\]/);
  if (bracketMatch) return bracketMatch[1].trim();
  
  // "OOO 가입" 또는 "Welcome to OOO" 형식
  const signupMatch = subject.match(/(?:Welcome to|가입|회원가입)\s+([^,.\n]+)/i);
  if (signupMatch) return signupMatch[1].trim();
  
  return null;
};

// 이메일 카테고리 분류
const categorizeEmail = (subject, fromDomain) => {
  const subjectLower = (subject || '').toLowerCase();
  
  if (/가입|회원|signup|welcome|verify|confirmation/i.test(subjectLower)) {
    return 'signup';
  }
  if (/영수증|결제|주문|receipt|invoice|order/i.test(subjectLower)) {
    return 'receipt';
  }
  if (/인증|인증|auth|password|verify|code/i.test(subjectLower)) {
    return 'authentication';
  }
  
  return 'other';
};

// 비활성 기간 계산
function calculateInactivityDays(lastActivityDate) {
  if (!lastActivityDate) return null;
  const ms = Date.now() - new Date(lastActivityDate).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

module.exports = {
  extractDomainFromEmail,
  extractDomainFromUnsubscribe,
  extractServiceNameFromSubject,
  categorizeEmail,
  calculateInactivityDays
};
