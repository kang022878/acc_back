const axios = require('axios');
const { hashString } = require('./encryption');

// URL에서 약관 텍스트 가져오기
const fetchPolicyFromUrl = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      }
    });
    
    // 간단한 HTML 태그 제거 (프로덕션에서는 cheerio/jsdom 사용 권장)
    const text = response.data
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return text;
  } catch (error) {
    throw new Error(`URL에서 약관을 가져올 수 없음: ${error.message}`);
  }
};

// 텍스트에서 문장 추출
const extractSentences = (text) => {
  // 한글/영문 문장 분리
  const sentences = text.match(/[^.!?]*[.!?]+|[^.!?]+$/g) || [];
  return sentences
    .map(s => s.trim())
    .filter(s => s.length > 10); // 너무 짧은 문장 제외
};

// 텍스트 정규화
const normalizeText = (text) => {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

module.exports = {
  fetchPolicyFromUrl,
  extractSentences,
  normalizeText
};
