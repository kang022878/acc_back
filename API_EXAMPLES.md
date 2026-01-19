# ACC Backend API 사용 예제

## 🔐 1. 사용자 인증

### Google 로그인 플로우

**Step 1: 인증 URL 가져오기**
```bash
curl http://localhost:5000/api/auth/google/auth-url
```

응답:
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

**Step 2: 사용자가 Google 로그인 (프론트)**
사용자가 위 URL로 이동하여 로그인 후 권한 허용

**Step 3: Authorization Code 교환**
```bash
curl -X POST http://localhost:5000/api/auth/google/callback \
  -H "Content-Type: application/json" \
  -d '{
    "code": "4/0AY0e-g..."
  }'
```

응답:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@gmail.com",
    "name": "User Name"
  }
}
```

이제 이 `token`을 모든 요청의 Authorization 헤더에 포함시킵니다.

---

## 📧 2. Gmail 연동

### Gmail 연결 상태 확인

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  http://localhost:5000/api/gmail/status
```

응답:
```json
{
  "connected": true,
  "email": "user@gmail.com",
  "connectedAt": "2024-01-15T10:30:00Z",
  "privacyConsent": {
    "version": "1.0",
    "acceptedAt": "2024-01-15T10:30:00Z",
    "emailBodyStorage": false,
    "domainExtractionOnly": true
  }
}
```

### 개인정보 동의 업데이트

```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "emailBodyStorage": false,
    "domainExtractionOnly": true
  }' \
  http://localhost:5000/api/gmail/privacy-consent
```

### Gmail 스캔 (서비스 발견)

```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/gmail/scan
```

응답:
```json
{
  "success": true,
  "discoveredCount": 23,
  "accounts": [
    {
      "id": "507f1f77bcf86cd799439011",
      "serviceName": "Coupang",
      "serviceDomain": "coupang.com",
      "category": "signup",
      "firstSeenDate": "2022-03-15T00:00:00Z",
      "confirmed": false
    },
    {
      "id": "507f1f77bcf86cd799439012",
      "serviceName": "G Market",
      "serviceDomain": "gmarket.co.kr",
      "category": "receipt",
      "firstSeenDate": "2021-05-20T00:00:00Z",
      "confirmed": false
    },
    ...
  ]
}
```

### Gmail 연결 해제

```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/gmail/disconnect
```

---

## 💾 3. 계정 관리

### 계정 목록 조회

```bash
curl -H "Authorization: Bearer {token}" \
  "http://localhost:5000/api/accounts?status=active&sort=-createdAt"
```

응답:
```json
{
  "total": 23,
  "accounts": [
    {
      "id": "507f1f77bcf86cd799439011",
      "serviceName": "Coupang",
      "serviceDomain": "coupang.com",
      "category": "signup",
      "firstSeenDate": "2022-03-15",
      "lastActivityDate": "2023-11-01",
      "inactivityDays": 76,
      "confirmed": true,
      "checklist": {
        "passwordChanged": true,
        "twoFactorEnabled": false,
        "accountDeleted": false,
        "reviewedTerms": false
      },
      "status": "active"
    }
  ]
}
```

### 계정 상세 조회

```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/accounts/507f1f77bcf86cd799439011
```

### 계정 확인 (사용자가 선택)

```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/accounts/507f1f77bcf86cd799439011/confirm
```

### 체크리스트 업데이트

```bash
curl -X PATCH \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "passwordChanged": true,
    "twoFactorEnabled": true,
    "accountDeleted": false,
    "reviewedTerms": true
  }' \
  http://localhost:5000/api/accounts/507f1f77bcf86cd799439011/checklist
```

응답:
```json
{
  "success": true,
  "checklist": {
    "passwordChanged": true,
    "twoFactorEnabled": true,
    "accountDeleted": false,
    "reviewedTerms": true
  }
}
```

### 계정 상태 변경

```bash
curl -X PATCH \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{ "status": "archived" }' \
  http://localhost:5000/api/accounts/507f1f77bcf86cd799439011/status
```

### 계정 삭제

```bash
curl -X DELETE \
  -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/accounts/507f1f77bcf86cd799439011
```

---

## 📋 4. 약관 분석

### URL로 약관 분석

```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.toss.im/legal/privacy-policy",
    "serviceName": "Toss"
  }' \
  http://localhost:5000/api/policy-analysis/analyze-url
```

응답:
```json
{
  "success": true,
  "analysis": {
    "id": "507f1f77bcf86cd799439015",
    "serviceName": "Toss",
    "summary": "제3자 제공 가능성이 있고, 국외 이전 조항이 포함되어 있어요.",
    "riskLevel": "high",
    "riskFlags": [
      "third_party_sharing",
      "international_transfer",
      "marketing_consent"
    ],
    "evidence": [
      {
        "flag": "third_party_sharing",
        "sentences": [
          "당사는 다음의 경우에 개인정보를 제3자에게 제공할 수 있습니다.",
          "제공받은 개인정보는 사용 목적으로만 이용되며 관련 법령에 따라 폐기됩니다."
        ],
        "confidence": 92
      },
      {
        "flag": "international_transfer",
        "sentences": [
          "당사는 국제 거래 등을 위해 필요한 경우 개인정보를 국외로 이전할 수 있습니다.",
          "국외 이전된 개인정보는 국제 개인정보 보호 기준에 따라 보호됩니다."
        ],
        "confidence": 88
      }
    ],
    "qaAnswers": [
      {
        "question": "이 약관을 동의하면 내 정보가 어디로 갈 수 있어?",
        "answer": "Toss는 서비스 제공, 마케팅, 제휴사 등에 당신의 정보를 공유할 수 있어요. 특히 국외 회사와도 정보를 공유할 수 있으니 주의하세요."
      },
      {
        "question": "탈퇴하면 언제 삭제돼?",
        "answer": "계정 탈퇴 후 법령상 보관 의무가 있는 정보는 3년 이상 보관될 수 있어요. 나머지 정보는 30일 내에 삭제됩니다."
      },
      {
        "question": "마케팅 수신 거부할 수 있어?",
        "answer": "네, 설정에서 마케팅 수신을 거부할 수 있지만, 중요한 서비스 공지는 계속 받게 됩니다."
      }
    ]
  }
}
```

### 텍스트로 약관 분석

```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "개인정보 처리방침\n\n1. 개인정보의 수집\n당 회사는 다음과 같은 개인정보를 수집합니다...",
    "serviceName": "My Service"
  }' \
  http://localhost:5000/api/policy-analysis/analyze-text
```

### 분석 기록 조회

```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/policy-analysis/history
```

응답:
```json
{
  "total": 5,
  "analyses": [
    {
      "id": "507f1f77bcf86cd799439015",
      "serviceName": "Toss",
      "serviceUrl": "https://www.toss.im/legal/privacy-policy",
      "summary": "제3자 제공 가능성이 있고...",
      "riskLevel": "high",
      "riskFlags": ["third_party_sharing", "international_transfer"],
      "createdAt": "2024-01-15T14:30:00Z"
    }
  ]
}
```

### 특정 분석 결과 조회

```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/policy-analysis/507f1f77bcf86cd799439015
```

### 위험 신호 가이드

```bash
curl http://localhost:5000/api/policy-analysis/guidance/third_party_sharing
```

응답:
```json
{
  "guidance": {
    "title": "제3자 제공",
    "description": "귀사가 제공한 개인정보가 제3자에게 공유될 수 있습니다.",
    "action": "약관에서 제3자 공유에 대한 명확한 동의를 확인하세요."
  }
}
```

### 분석 결과 피드백

```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "helpful": true,
    "notes": "정확하고 명확한 분석입니다."
  }' \
  http://localhost:5000/api/policy-analysis/507f1f77bcf86cd799439015/feedback
```

---

## 🛠️ JavaScript 클라이언트 예제

```javascript
// API 기본 클래스
class AccAPI {
  constructor(baseURL = 'http://localhost:5000/api', token = null) {
    this.baseURL = baseURL;
    this.token = token;
  }

  setToken(token) {
    this.token = token;
  }

  async request(method, endpoint, body = null) {
    const url = `${this.baseURL}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` })
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API 요청 실패');
    }

    return data;
  }

  // Gmail
  async getGmailStatus() {
    return this.request('GET', '/gmail/status');
  }

  async scanGmail() {
    return this.request('POST', '/gmail/scan');
  }

  // 계정
  async getAccounts() {
    return this.request('GET', '/accounts');
  }

  async confirmAccount(id) {
    return this.request('POST', `/accounts/${id}/confirm`);
  }

  // 약관 분석
  async analyzePolicy(url, serviceName) {
    return this.request('POST', '/policy-analysis/analyze-url', {
      url,
      serviceName
    });
  }

  async getPolicyHistory() {
    return this.request('GET', '/policy-analysis/history');
  }
}

// 사용 예제
const api = new AccAPI();

// 토큰 설정
api.setToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');

// Gmail 스캔
api.scanGmail()
  .then(result => console.log('발견된 계정:', result.discoveredCount))
  .catch(error => console.error('스캔 실패:', error));

// 약관 분석
api.analyzePolicy('https://www.example.com/privacy', 'Example')
  .then(result => console.log('분석 결과:', result.analysis))
  .catch(error => console.error('분석 실패:', error));
```

---

## ✅ 완료!

이제 ACC 백엔드 API를 사용할 준비가 되었습니다!
