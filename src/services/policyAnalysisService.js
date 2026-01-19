const { OpenAI } = require('openai');
const { hashString } = require('../utils/encryption');
const { fetchPolicyFromUrl, extractSentences, normalizeText } = require('../utils/policyParser');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class PolicyAnalysisService {
  /**
   * OpenAI 사용 가능 여부
   */
  static isEnabled() {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  /**
   * 약관 텍스트 분석
   */
  static async analyzePolicy(policyText, serviceName = '') {
    const startTime = Date.now();

    try {
      if (!this.isEnabled()) {
        throw new Error('OpenAI API key not configured');
      }

      // 해시로 중복 검사
      const policyHash = hashString(policyText);

      // LLM 프롬프트 구성
      const prompt = this.buildAnalysisPrompt(policyText, serviceName);

      // OpenAI API 호출
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      const analysisResult = JSON.parse(completion.choices[0].message.content);
      
      return {
        policyHash,
        summary: analysisResult.summary,
        riskFlags: analysisResult.riskFlags,
        evidence: analysisResult.evidence,
        qaAnswers: analysisResult.qaAnswers,
        riskLevel: analysisResult.riskLevel,
        analysisMeta: {
          model: 'gpt-4-turbo-preview',
          promptVersion: '1.0',
          processingTime: Date.now() - startTime
        }
      };
    } catch (error) {
      throw new Error(`정책 분석 실패: ${error.message}`);
    }
  }

  /**
   * URL에서 약관을 가져온 후 분석
   */
  static async analyzePolicyFromUrl(url, serviceName = '') {
    try {
      const policyText = await fetchPolicyFromUrl(url);
      return this.analyzePolicy(policyText, serviceName);
    } catch (error) {
      throw new Error(`URL 분석 실패: ${error.message}`);
    }
  }

  /**
   * 시스템 프롬프트 구성
   */
  static getSystemPrompt() {
    return `당신은 개인정보 보호 법률 전문가입니다.
사용자의 약관을 분석하고, 개인정보 처리와 관련된 위험 요소를 한국어로 명확하게 설명합니다.

응답은 반드시 다음 JSON 형식으로 작성합니다:
{
  "summary": "한 줄 요약 (60자 이내)",
  "riskFlags": ["third_party_sharing", "international_transfer", "sensitive_data", "long_retention", "marketing_consent", "purpose_change", "subcontracting"],
  "evidence": [
    {
      "flag": "flag_name",
      "sentences": ["근거 문장 1", "근거 문장 2"],
      "confidence": 85
    }
  ],
  "qaAnswers": [
    {
      "question": "이 약관을 동의하면 내 정보가 어디로 갈 수 있어?",
      "answer": "쉬운 말로 설명"
    }
  ],
  "riskLevel": "high"
}`;
  }

  /**
   * 분석용 프롬프트 구성
   */
  static buildAnalysisPrompt(policyText, serviceName) {
    return `다음은 ${serviceName || '서비스'}의 개인정보 처리 약관입니다:

---
${policyText.substring(0, 5000)}
---

이 약관을 분석하고 다음을 포함한 JSON으로 응답하세요:

1. 한 줄 요약: 가장 중요한 개인정보 처리 특성을 요약
2. 위험 신호: 다음 중 해당하는 항목
   - third_party_sharing: 제3자 제공
   - international_transfer: 국외 이전
   - sensitive_data: 민감정보 처리
   - long_retention: 장기 보관/불명확한 기간
   - marketing_consent: 광고/마케팅 동의
   - purpose_change: 목적 변경 가능성
   - subcontracting: 위탁/재위탁

3. 근거: 각 위험 신호마다 2~5개의 관련 문장

4. Q&A 응답:
   - "이 약관을 동의하면 내 정보가 어디로 갈 수 있어?"
   - "탈퇴하면 언제 삭제돼?"
   - "마케팅 수신 거부할 수 있어?"

5. 전체 위험도: low, medium, high 중 하나`;
  }

  /**
   * 위험 신호별 가이드 제공
   */
  static getRiskGuidance(riskFlag) {
    const guidance = {
      'third_party_sharing': {
        title: '제3자 제공',
        description: '귀사가 제공한 개인정보가 제3자에게 공유될 수 있습니다.',
        action: '약관에서 제3자 공유에 대한 명확한 동의를 확인하세요.'
      },
      'international_transfer': {
        title: '국외 이전',
        description: '개인정보가 해외 서버나 회사에 저장될 수 있습니다.',
        action: '국외 이전 시 데이터 보호 수준을 확인하세요.'
      },
      'sensitive_data': {
        title: '민감정보 처리',
        description: '건강, 금융, 생체 정보 등 민감한 정보를 처리합니다.',
        action: '민감정보 처리에 대해 별도의 명시적 동의를 확인하세요.'
      },
      'long_retention': {
        title: '장기 보관',
        description: '개인정보 보관 기간이 명확하지 않거나 매우 깁니다.',
        action: '필요한 기간만 정보 보관을 요청하세요.'
      },
      'marketing_consent': {
        title: '광고/마케팅 동의',
        description: '서비스 제공 외에 광고나 마케팅 목적으로 정보를 사용할 수 있습니다.',
        action: '필요하지 않으면 마케팅 동의를 거부하세요.'
      },
      'purpose_change': {
        title: '목적 변경 가능',
        description: '향후 약관을 변경하여 정보 사용 목적을 바꿀 수 있습니다.',
        action: '정기적으로 약관 변경사항을 확인하세요.'
      },
      'subcontracting': {
        title: '위탁/재위탁',
        description: '정보 처리를 다른 회사에 위탁하거나, 위탁처가 다시 위탁할 수 있습니다.',
        action: '위탁처의 정보 보호 수준을 확인하세요.'
      }
    };
    return guidance[riskFlag] || null;
  }
}

module.exports = PolicyAnalysisService;
