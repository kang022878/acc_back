const mongoose = require('mongoose');

const policyAnalysisSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  serviceName: String,
  serviceUrl: String,
  
  // 원본 데이터 (저장하지 않거나 제한적으로만)
  policySource: {
    type: String,
    enum: ['url', 'text'],
    required: true
  },
  policyHash: String, // 정책 내용의 해시 (중복 검사용)
  
  // 분석 결과
  summary: String, // 한 줄 요약
  
  // 위험 신호
  riskFlags: [{
    type: String,
    enum: [
      'third_party_sharing',
      'international_transfer',
      'sensitive_data',
      'long_retention',
      'marketing_consent',
      'purpose_change',
      'subcontracting'
    ]
  }],
  
  // 근거 문장들 (위험 신호별)
  evidence: [{
    flag: String,
    sentences: [String], // 2~5개 문장
    confidence: Number // 0~100
  }],
  
  // Q&A 응답
  qaAnswers: [{
    question: String,
    answer: String
  }],
  
  // 전체 위험도 레벨
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  
  // 분석 메타데이터
  analysisMeta: {
    model: String, // 사용한 LLM 모델
    promptVersion: String,
    processingTime: Number // ms
  },
  
  // 사용자 피드백
  userFeedback: {
    helpful: Boolean,
    notes: String
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

// 인덱스
policyAnalysisSchema.index({ userId: 1 });
policyAnalysisSchema.index({ createdAt: -1 });
policyAnalysisSchema.index({ policyHash: 1 }); // 중복 검사

module.exports = mongoose.model('PolicyAnalysis', policyAnalysisSchema);
