# ACC Backend 프로젝트 구조

```
acc_back/
├── src/
│   ├── index.js                    # 메인 서버 진입점
│   ├── config/
│   │   ├── database.js             # MongoDB 연결 설정
│   │   ├── jwt.js                  # JWT 토큰 관리
│   │   └── google.js               # Google OAuth 설정
│   ├── models/
│   │   ├── User.js                 # 사용자 모델 (계정, Gmail 토큰)
│   │   ├── Account.js              # 발견된 계정 모델
│   │   └── PolicyAnalysis.js       # 약관 분석 결과 모델
│   ├── routes/
│   │   ├── auth.js                 # 인증 라우트 (Google OAuth, 로그인)
│   │   ├── gmail.js                # Gmail 연동 라우트 (스캔, 상태)
│   │   ├── accounts.js             # 계정 관리 라우트
│   │   └── policy-analysis.js      # 약관 분석 라우트
│   ├── services/
│   │   ├── gmailService.js         # Gmail API 서비스
│   │   │   ├── searchEmails()       # 메일 검색
│   │   │   ├── getMessageDetails()  # 메시지 상세 조회
│   │   │   ├── processDiscoveredEmails()  # 발견된 이메일 처리
│   │   │   └── getDefaultSearchQueries()  # 기본 검색 쿼리
│   │   └── policyAnalysisService.js # 약관 분석 서비스
│   │       ├── analyzePolicy()      # 텍스트 분석
│   │       ├── analyzePolicyFromUrl()  # URL 분석
│   │       └── getRiskGuidance()    # 위험 신호 가이드
│   ├── middleware/
│   │   ├── auth.js                 # JWT 인증 미들웨어
│   │   ├── errorHandler.js         # 에러 처리 미들웨어
│   │   └── asyncHandler.js         # 비동기 핸들러 래퍼
│   ├── utils/
│   │   ├── encryption.js           # 토큰 암호화/복호화
│   │   ├── emailParser.js          # 이메일 파싱 (도메인 추출)
│   │   └── policyParser.js         # 약관 파싱 (URL 크롤링)
│   └── lib/
│       └── (외부 라이브러리 확장)
├── __tests__/                       # 테스트 파일
│   ├── services/
│   └── routes/
├── .github/
│   └── workflows/                   # CI/CD 파이프라인
├── package.json                     # 의존성 및 스크립트
├── .env.example                     # 환경변수 템플릿
├── .gitignore                       # Git 제외 파일
├── README.md                        # 프로젝트 소개
├── DEVELOPMENT.md                   # 개발 가이드
├── DEPLOYMENT.md                    # 배포 가이드
└── API_EXAMPLES.md                  # API 사용 예제
```

## 🔄 데이터 흐름

### 1. Gmail 연동 flow

```
사용자 로그인 (Google OAuth)
    ↓
User 모델에 Gmail 토큰 저장 (암호화)
    ↓
사용자가 "Gmail 스캔" 요청
    ↓
GmailService.searchEmails() - 메일 검색
    ↓
GmailService.getMessageDetails() - 메시지 상세 조회
    ↓
emailParser.js로 도메인/서비스명 추출
    ↓
GmailService.processDiscoveredEmails() - Account 모델로 저장
    ↓
응답: 발견된 계정 목록
```

### 2. 약관 분석 flow

```
사용자가 URL 또는 텍스트 제출
    ↓
policyParser.js - URL에서 텍스트 추출
    ↓
PolicyAnalysisService.analyzePolicy() - OpenAI API 호출
    ↓
LLM이 다음 분석:
  - 한 줄 요약
  - 위험 신호 7가지 탐지
  - 각 신호별 근거 문장
  - Q&A 답변 생성
    ↓
PolicyAnalysis 모델에 저장
    ↓
응답: 분석 결과
```

## 🗄️ 데이터베이스 스키마

### User Collection
```javascript
{
  _id: ObjectId,
  email: String (unique),
  name: String,
  googleId: String,
  gmailTokens: {
    accessToken: String,
    refreshToken: String (암호화됨),
    expiresAt: Date
  },
  privacyConsent: {
    version: String,
    acceptedAt: Date,
    emailBodyStorage: Boolean,
    domainExtractionOnly: Boolean
  },
  lastLoginAt: Date,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Account Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  serviceName: String,
  serviceDomain: String,
  category: String (signup|receipt|authentication|other),
  firstSeenDate: Date,
  lastActivityDate: Date,
  userConfirmed: Boolean,
  checklist: {
    passwordChanged: Boolean,
    twoFactorEnabled: Boolean,
    accountDeleted: Boolean,
    reviewedTerms: Boolean
  },
  evidenceTitle: String,
  evidenceSource: String,
  status: String (active|archived|deleted),
  inactivityDays: Number,
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

### PolicyAnalysis Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  serviceName: String,
  serviceUrl: String,
  policySource: String (url|text),
  summary: String,
  riskFlags: [String],
  evidence: [{
    flag: String,
    sentences: [String],
    confidence: Number
  }],
  qaAnswers: [{
    question: String,
    answer: String
  }],
  riskLevel: String (low|medium|high),
  analysisMeta: {
    model: String,
    promptVersion: String,
    processingTime: Number
  },
  userFeedback: {
    helpful: Boolean,
    notes: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

## 🔑 핵심 기능 구현

### Gmail 메일 검색
```javascript
// Gmail API 검색 쿼리
"subject:(가입 OR 회원가입 OR verify OR welcome) newer_than:24m"
"subject:(영수증 OR 결제 OR 주문) newer_than:24m"
```

### 도메인 추출
```javascript
From: noreply@coupang.com → coupang.com
List-Unsubscribe: <https://example.com/unsub> → example.com
Subject: [Coupang] 주문 확인 → Coupang
```

### LLM 프롬프트
```
약관 텍스트 입력
  ↓
  System: 개인정보 보호 전문가 역할 지정
  User: 분석 요청 (한 줄 요약, 위험 신호, 근거, Q&A)
  ↓
  LLM 응답 (JSON 형식)
```

## 🔒 보안 전략

### 토큰 관리
- Access Token: 요청마다 검증 (7일 만료)
- Refresh Token: DB에 암호화 저장
- JWT Secret: 환경변수로 관리

### 데이터 최소화
- 메일 본문: 저장 금지
- 메일 헤더: 도메인, 날짜, 제목만 추출
- 개인정보: 사용자 동의 하에만 처리

### 암호화
- Refresh Token: AES-256-CBC
- 환경변수: 프로덕션 시크릿으로 관리

## 📊 API 엔드포인트 요약

| 메서드 | 경로 | 기능 |
|--------|------|------|
| GET | `/api/auth/google/auth-url` | Google 로그인 URL |
| POST | `/api/auth/google/callback` | OAuth 콜백 |
| GET | `/api/gmail/status` | Gmail 연결 상태 |
| POST | `/api/gmail/scan` | Gmail 메일 스캔 |
| GET | `/api/accounts` | 계정 목록 |
| POST | `/api/accounts/:id/confirm` | 계정 확인 |
| PATCH | `/api/accounts/:id/checklist` | 체크리스트 업데이트 |
| POST | `/api/policy-analysis/analyze-url` | URL 약관 분석 |
| POST | `/api/policy-analysis/analyze-text` | 텍스트 약관 분석 |
| GET | `/api/policy-analysis/history` | 분석 기록 |

## 🚀 다음 단계

1. **환경변수 설정**
   - `.env` 파일 생성
   - Google OAuth 자격증명 입력
   - OpenAI API 키 입력

2. **MongoDB 준비**
   - 로컬 MongoDB 실행 또는 MongoDB Atlas 설정
   - 데이터베이스 생성

3. **의존성 설치**
   ```bash
   npm install
   ```

4. **개발 서버 실행**
   ```bash
   npm run dev
   ```

5. **API 테스트**
   - Postman 또는 cURL로 엔드포인트 테스트
   - API_EXAMPLES.md 참고

6. **프론트엔드 연결**
   - React 프론트엔드와 통합
   - CORS 설정 확인

## 📞 지원

- 질문이나 버그 보고: GitHub 이슈 생성
- 개발 가이드: DEVELOPMENT.md 참고
- API 사용법: API_EXAMPLES.md 참고
- 배포 가이드: DEPLOYMENT.md 참고
