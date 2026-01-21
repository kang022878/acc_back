const { OpenAI } = require('openai');
const { hashString } = require('../utils/encryption');
const { fetchPolicyFromUrl, extractSentences, normalizeText } = require('../utils/policyParser');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

// 프론트/DB에서 쓰는 플래그는 기존 그대로 유지
const RISK_FLAGS = [
  "third_party_sharing",
  "international_transfer",
  "sensitive_data",
  "long_retention",
  "marketing_consent",
  "purpose_change",
  "subcontracting",
];

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
사용자가 제공한 개인정보 처리방침/약관에서 "위험 신호"를 찾아 요약합니다.
근거는 반드시 사용자가 준 문장(원문)을 그대로 인용하세요(새 문장 생성 금지).
출력은 지정된 JSON 스키마를 반드시 따르세요.`;
  }

  static preprocess(policyText) {
    const text = normalizeText(policyText || "");
    const sentences = extractSentences(text); // 너 utils에 이미 있음
    return { text, sentences };
  }

  // (중요) 태그별 후보 문장 뽑기: "근거 하이라이트" 안정화
  static buildEvidenceCandidates(sentences) {
    const rules = {
      third_party_sharing: ["제3자", "제공", "공유", "제휴", "파트너", "외부에 제공"],
      international_transfer: ["국외", "해외", "이전", "외국", "국외 소재", "글로벌"],
      sensitive_data: ["민감", "고유식별", "건강", "생체", "주민등록", "신용", "금융"],
      long_retention: ["보관", "보유", "파기", "탈퇴", "기간", "까지", "영구", "준영구"],
      marketing_consent: ["마케팅", "광고", "홍보", "이벤트", "수신", "동의", "선택"],
      purpose_change: ["변경", "추가", "목적", "개정", "고지", "동의 없이", "합리적"],
      subcontracting: ["위탁", "수탁", "재위탁", "대행", "처리업무", "업무를 위탁"],
    };

    const byFlag = {};
    for (const flag of Object.keys(rules)) {
      const keywords = rules[flag];
      const hits = [];
      for (let i = 0; i < sentences.length; i++) {
        const s = sentences[i];
        const score = keywords.reduce((acc, kw) => (s.includes(kw) ? acc + 1 : acc), 0);
        if (score > 0) hits.push({ id: i, text: s, score });
      }
      hits.sort((a, b) => b.score - a.score);
      byFlag[flag] = hits.slice(0, 30); // 후보를 너무 많이 주지 않기
    }
    return byFlag;
  }

  
  /**
   * 분석용 프롬프트 구성
   */
  static buildAnalysisPrompt({ serviceName, candidates }) {
    return `서비스명: ${serviceName || "미상"}

    아래는 위험 신호별 "근거 후보 문장" 목록입니다.
    반드시 이 후보 문장들 중에서만 근거 문장을 선택하세요.
    각 위험 신호가 해당되면 문장 2~5개를 선택하고, 해당되지 않으면 제외하세요.

    후보 목록(JSON):
    ${JSON.stringify(candidates, null, 2)}

    요구사항:
    - oneLineSummary: 60자 이내 한국어
    - riskFlags: 해당되는 flag만 나열
    - evidence: flag별로 {flag, sentences[], confidence} 제공 (sentences는 후보 text 그대로)
    - qaAnswers: 3개 질문에 대해 쉬운 한국어로 답변(근거를 바탕으로)
    - riskLevel: low|medium|high`;
      }

    static getOutputSchema() {
    // Structured Outputs(JSON Schema 강제)
    return {
      name: "policy_analysis_result",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          summary: { type: "string" },
          riskFlags: {
            type: "array",
            items: { type: "string", enum: RISK_FLAGS },
          },
          evidence: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                flag: { type: "string", enum: RISK_FLAGS },
                sentences: {
                  type: "array",
                  minItems: 2,
                  maxItems: 5,
                  items: { type: "string" },
                },
                confidence: { type: "integer", minimum: 0, maximum: 100 },
              },
              required: ["flag", "sentences", "confidence"],
            },
          },
          qaAnswers: {
            type: "array",
            minItems: 3,
            maxItems: 3,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                question: { type: "string" },
                answer: { type: "string" },
              },
              required: ["question", "answer"],
            },
          },
          riskLevel: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["summary", "riskFlags", "evidence", "qaAnswers", "riskLevel"],
      },
      strict: true,
    };
  }

    static async analyzePolicy(policyText, serviceName = "") {
    const startTime = Date.now();
    if (!this.isEnabled()) throw new Error("OpenAI API key not configured");

    const policyHash = hashString(policyText);
    const { sentences } = this.preprocess(policyText);
    const candidates = this.buildEvidenceCandidates(sentences);

    const prompt = this.buildAnalysisPrompt({ serviceName, candidates });

    const resp = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      input: [
        { role: "system", content: this.getSystemPrompt() },
        { role: "user", content: prompt },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "policy_analysis_result",   // ✅ 이게 빠져서 에러난 것
          strict: true,
          schema: this.getOutputSchema().schema, // ✅ schema는 여기로
        },
      },
      temperature: 0.2,
    });

    const jsonText = resp.output_text;
    const analysisResult = JSON.parse(jsonText);

    return {
      policyHash,
      summary: analysisResult.summary,
      riskFlags: analysisResult.riskFlags,
      evidence: analysisResult.evidence,
      qaAnswers: analysisResult.qaAnswers,
      riskLevel: analysisResult.riskLevel,
      analysisMeta: {
        model: MODEL,
        promptVersion: "2.0",
        processingTime: Date.now() - startTime,
      },
    };
  }

  static async analyzePolicyFromUrl(url, serviceName = "") {
    const policyText = await fetchPolicyFromUrl(url);
    return this.analyzePolicy(policyText, serviceName);
  }

  // guidance는 네 코드 그대로 둬도 OK
  static getRiskGuidance(riskFlag) { /* ... 기존 ... */ }
  }

  module.exports = PolicyAnalysisService;
