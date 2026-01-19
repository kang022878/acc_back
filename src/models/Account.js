const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  serviceName: {
    type: String,
    required: true
  },
  serviceDomain: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['signup', 'receipt', 'authentication', 'other'],
    default: 'other'
  },
  // 발견된 첫 메일 날짜
  firstSeenDate: Date,
  // 마지막 활동 날짜
  lastActivityDate: Date,
  // 사용자 확인 여부
  userConfirmed: {
    type: Boolean,
    default: false
  },
  // 체크리스트
  checklist: {
    passwordChanged: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
    accountDeleted: { type: Boolean, default: false },
    reviewedTerms: { type: Boolean, default: false }
  },
  // 근거 데이터 (최소화)
  evidenceTitle: String, // 메일 제목 일부
  evidenceSource: String, // 발신자 이메일 도메인
  
  // 상태
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  },
  
  inactivityDays: Number, // 몇 일 동안 활동이 없었는지
  
  notes: String,
  
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
accountSchema.index({ userId: 1 });
accountSchema.index({ userId: 1, status: 1 });
accountSchema.index({ serviceDomain: 1 });

module.exports = mongoose.model('Account', accountSchema);
