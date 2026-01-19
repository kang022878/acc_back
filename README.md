# ACC (Account Control Center) - Backend

개인정보 보호와 계정 보안을 위한 통합 플랫폼의 백엔드 서버입니다.

## 🎯 주요 기능

### 1. 개인정보가 퍼진 사이트 추적기
- **Gmail 연동**: Google OAuth를 통한 안전한 인증
- **자동 서비스 발견**: 메일 이력에서 가입된 서비스 자동 탐지
- **도메인 추출**: 이메일 발신자에서 서비스 도메인 자동 추출
- **카테고리 분류**: 가입/영수증/인증 메일 자동 분류
- **개인정보 최소화**: 메일 본문은 저장하지 않음 (도메인, 날짜, 제목만)

### 2. 개인정보 약관 AI 요약 서비스
- **URL 분석**: 약관 페이지 자동 크롤링 및 분석
- **텍스트 분석**: 약관 텍스트 직접 입력 분석
- **위험 신호 탐지**: 7가지 위험 요소 자동 감지
  - 제3자 제공
  - 국외 이전
  - 민감정보 처리
  - 장기 보관/불명확한 기간
  - 광고/마케팅 동의
  - 목적 변경 가능성
  - 위탁/재위탁
- **근거 제시**: 각 위험 신호별 관련 문장 제시
- **Q&A 제공**: 쉬운 말로 약관 설명

## 🛠️ 기술 스택

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB
- **Authentication**: Google OAuth 2.0 + JWT
- **AI/NLP**: OpenAI GPT-4
- **Email API**: Google Gmail API
- **Encryption**: AES-256-CBC (토큰 암호화)
- **Security**: Helmet, CORS, Express Validator

## 📁 프로젝트 구조

```
src/
├── index.js                 # 메인 서버 파일
├── config/
│   ├── database.js         # MongoDB 연결
│   ├── jwt.js              # JWT 설정
│   └── google.js           # Google OAuth 설정
├── models/
│   ├── User.js             # 사용자 모델
│   ├── Account.js          # 계정 모델
│   └── PolicyAnalysis.js   # 약관 분석 결과 모델
├── routes/
│   ├── auth.js             # 인증 라우트
│   ├── gmail.js            # Gmail 연동 라우트
│   ├── accounts.js         # 계정 관리 라우트
│   └── policy-analysis.js  # 약관 분석 라우트
├── services/
│   ├── gmailService.js     # Gmail 서비스
│   └── policyAnalysisService.js  # 약관 분석 서비스
├── middleware/
│   ├── auth.js             # JWT 인증 미들웨어
│   ├── errorHandler.js     # 에러 핸들러
│   └── asyncHandler.js     # 비동기 핸들러
├── utils/
│   ├── encryption.js       # 암호화/복호화
│   ├── emailParser.js      # 이메일 파싱
│   └── policyParser.js     # 약관 파싱
└── lib/
```

## 🚀 시작하기

### 설치

```bash
npm install
```

### 환경 설정

`.env.example`을 복사하여 `.env` 파일 생성:

```bash
cp .env.example .env
```

필수 환경 변수 설정:

```env
# 기본
NODE_ENV=development
PORT=5000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/acc_db

# JWT
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRE=7d

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback

# OpenAI
OPENAI_API_KEY=sk-...

# 암호화
ENCRYPTION_KEY=your_32_character_key_here
ENCRYPTION_ALGORITHM=aes-256-cbc

# CORS
CORS_ORIGIN=http://localhost:3000
```

### 개발 서버 실행

```bash
npm run dev
```

서버는 `http://localhost:5000`에서 시작됩니다.

## 📡 API 엔드포인트

### 인증 (Authentication)

#### Google OAuth 인증
```
GET /api/auth/google/auth-url
```
Google 로그인 URL 반환

```
POST /api/auth/google/callback
Body: { code: "authorization_code" }
```
인증 코드를 JWT 토큰으로 교환

#### 로그아웃
```
POST /api/auth/logout
Headers: { Authorization: "Bearer {token}" }
```

---

### Gmail 연동 (Gmail Integration)

#### 연결 상태 확인
```
GET /api/gmail/status
Headers: { Authorization: "Bearer {token}" }
```
응답:
```json
{
  "connected": true,
  "email": "user@gmail.com",
  "privacyConsent": { ... }
}
```

#### 개인정보 동의 업데이트
```
POST /api/gmail/privacy-consent
Headers: { Authorization: "Bearer {token}" }
Body: {
  "emailBodyStorage": false,
  "domainExtractionOnly": true
}
```

#### Gmail 스캔 (서비스 발견)
```
POST /api/gmail/scan
Headers: { Authorization: "Bearer {token}" }
```
응답:
```json
{
  "success": true,
  "discoveredCount": 15,
  "accounts": [
    {
      "id": "...",
      "serviceName": "Coupang",
      "serviceDomain": "coupang.com",
      "category": "signup",
      "firstSeenDate": "2023-01-15",
      "confirmed": false
    }
  ]
}
```

#### Gmail 연결 해제
```
POST /api/gmail/disconnect
Headers: { Authorization: "Bearer {token}" }
```

---

### 계정 관리 (Account Management)

#### 계정 목록 조회
```
GET /api/accounts?status=active
Headers: { Authorization: "Bearer {token}" }
```

#### 계정 확인
```
POST /api/accounts/{id}/confirm
Headers: { Authorization: "Bearer {token}" }
```

#### 체크리스트 업데이트
```
PATCH /api/accounts/{id}/checklist
Headers: { Authorization: "Bearer {token}" }
Body: {
  "passwordChanged": true,
  "twoFactorEnabled": false
}
```

#### 계정 상태 변경
```
PATCH /api/accounts/{id}/status
Headers: { Authorization: "Bearer {token}" }
Body: { "status": "archived" }
```

---

### 약관 분석 (Policy Analysis)

#### URL로 약관 분석
```
POST /api/policy-analysis/analyze-url
Headers: { Authorization: "Bearer {token}" }
Body: {
  "url": "https://example.com/privacy-policy",
  "serviceName": "Example Service"
}
```

응답:
```json
{
  "success": true,
  "analysis": {
    "id": "...",
    "serviceName": "Example Service",
    "summary": "제3자 제공 가능성이 있고...",
    "riskLevel": "high",
    "riskFlags": ["third_party_sharing", "international_transfer"],
    "evidence": [...],
    "qaAnswers": [...]
  }
}
```

#### 텍스트로 약관 분석
```
POST /api/policy-analysis/analyze-text
Headers: { Authorization: "Bearer {token}" }
Body: {
  "text": "약관 전문 텍스트...",
  "serviceName": "Service Name"
}
```

#### 분석 기록 조회
```
GET /api/policy-analysis/history
Headers: { Authorization: "Bearer {token}" }
```

#### 위험 신호 가이드
```
GET /api/policy-analysis/guidance/{flag}
```
예: `/guidance/third_party_sharing`

#### 분석 결과 피드백
```
POST /api/policy-analysis/{id}/feedback
Headers: { Authorization: "Bearer {token}" }
Body: {
  "helpful": true,
  "notes": "정확한 분석입니다"
}
```

## 🔒 보안 고려사항

### 개인정보 최소화
- ✅ 메일 본문은 저장하지 않음
- ✅ 도메인, 날짜, 제목만 저장
- ✅ refresh token은 암호화되어 저장
- ✅ 데이터 보관 기간 제한 (기본 90일)

### 토큰 관리
- ✅ access token: 매 요청마다 검증
- ✅ refresh token: 암호화 저장
- ✅ JWT: 7일 만료

### API 보안
- ✅ HTTPS only (프로덕션)
- ✅ CORS 설정
- ✅ Helmet.js로 헤더 보안
- ✅ Input validation (Express Validator)

## 📊 데이터베이스 스키마

### User
```javascript
{
  email: String (unique),
  name: String,
  googleId: String,
  gmailTokens: {
    accessToken: String,
    refreshToken: String (encrypted),
    expiresAt: Date
  },
  privacyConsent: {
    version: String,
    acceptedAt: Date,
    emailBodyStorage: Boolean,
    domainExtractionOnly: Boolean
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Account
```javascript
{
  userId: ObjectId (ref: User),
  serviceName: String,
  serviceDomain: String,
  category: String (signup|receipt|authentication|other),
  firstSeenDate: Date,
  userConfirmed: Boolean,
  checklist: {
    passwordChanged: Boolean,
    twoFactorEnabled: Boolean,
    accountDeleted: Boolean,
    reviewedTerms: Boolean
  },
  status: String (active|archived|deleted)
}
```

### PolicyAnalysis
```javascript
{
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
  riskLevel: String (low|medium|high)
}
```

## 🧪 테스트

```bash
# 유닛 테스트
npm test

# 테스트 감시 모드
npm run test:watch
```

## 📝 환경 변수 설명

| 변수 | 설명 | 필수 |
|------|------|------|
| `NODE_ENV` | 환경 (development/production) | ✅ |
| `PORT` | 서버 포트 | ✅ |
| `MONGODB_URI` | MongoDB 연결 문자열 | ✅ |
| `JWT_SECRET` | JWT 서명 시크릿 | ✅ |
| `JWT_EXPIRE` | JWT 만료 시간 | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | ✅ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | ✅ |
| `GOOGLE_REDIRECT_URI` | Google OAuth 리다이렉트 URI | ✅ |
| `OPENAI_API_KEY` | OpenAI API 키 | ✅ |
| `ENCRYPTION_KEY` | 토큰 암호화 키 (32자) | ✅ |
| `CORS_ORIGIN` | CORS 허용 도메인 | ❌ |
| `DATA_RETENTION_DAYS` | 데이터 보관 기간 (일) | ❌ |
| `MAIL_SEARCH_PERIOD_MONTHS` | 메일 검색 기간 (개월) | ❌ |

## 🐛 문제 해결

### MongoDB 연결 실패
```
MongoDB 연결 실패: connect ECONNREFUSED 127.0.0.1:27017
```
✅ MongoDB 서버가 실행 중인지 확인하세요:
```bash
mongod --version
```

### Google OAuth 에러
```
Error: invalid_client
```
✅ GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI이 정확한지 확인하세요.

### OpenAI API 에러
```
Error: invalid_api_key
```
✅ OPENAI_API_KEY가 유효한지 확인하세요.

## 📚 참고 자료

- [Google Gmail API Docs](https://developers.google.com/gmail/api)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [MongoDB Docs](https://docs.mongodb.com)
- [Express.js Guide](https://expressjs.com)

## 📄 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.

## 👨‍💻 개발자

ACC 팀

## 📞 지원

문제가 발생하면 이슈를 등록해주세요.
