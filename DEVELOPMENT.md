# ACC Backend 개발 가이드

## 🏗️ 아키텍처

```
Request → Express Router → Middleware → Controller → Service → Database
         ↓
      Error Handler
```

### 레이어별 책임

1. **Router** (`src/routes/`)
   - HTTP 요청 수신
   - 라우팅 정의
   - 요청 검증 (선택)

2. **Controller** (라우터 내장)
   - 비즈니스 로직 조정
   - 요청/응답 매핑

3. **Service** (`src/services/`)
   - 핵심 비즈니스 로직
   - 외부 API 호출
   - 데이터 처리

4. **Model** (`src/models/`)
   - MongoDB 스키마 정의
   - 데이터베이스 쿼리

5. **Middleware** (`src/middleware/`)
   - 인증
   - 에러 처리
   - 로깅

6. **Utilities** (`src/utils/`)
   - 헬퍼 함수
   - 암호화/복호화

---

## 📖 개발 워크플로우

### 새로운 기능 추가

#### 1. 데이터 모델 정의 (필요한 경우)
```javascript
// src/models/NewModel.js
const schema = new mongoose.Schema({
  // ... 필드 정의
});

module.exports = mongoose.model('NewModel', schema);
```

#### 2. 서비스 레이어 작성
```javascript
// src/services/newService.js
class NewService {
  static async processData(data) {
    // 비즈니스 로직
  }
}

module.exports = NewService;
```

#### 3. 라우트 정의
```javascript
// src/routes/new.js
router.post('/endpoint', authenticate, asyncHandler(async (req, res) => {
  const result = await NewService.processData(req.body);
  res.json(result);
}));
```

---

## 🧪 테스트 작성

### 단위 테스트 (Jest)

```javascript
// __tests__/services/gmailService.test.js
describe('GmailService', () => {
  test('extractDomain에서 올바른 도메인 추출', () => {
    const result = extractDomainFromEmail('noreply@example.com');
    expect(result).toBe('example.com');
  });

  test('빈 이메일에서 null 반환', () => {
    const result = extractDomainFromEmail('');
    expect(result).toBeNull();
  });
});
```

### 통합 테스트

```javascript
// __tests__/routes/accounts.test.js
describe('Account Routes', () => {
  test('GET /accounts 인증 필요', async () => {
    const res = await request(app)
      .get('/api/accounts')
      .expect(401);
  });

  test('GET /accounts 로그인 후 조회 가능', async () => {
    const res = await request(app)
      .get('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    expect(res.body).toHaveProperty('accounts');
  });
});
```

테스트 실행:
```bash
npm test
npm run test:watch
```

---

## 🐛 디버깅

### 로컬 디버깅

#### VS Code에서 디버깅

`.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch ACC Backend",
      "program": "${workspaceFolder}/src/index.js",
      "restart": true,
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

`F5`를 눌러 디버깅 시작

#### 콘솔 로깅
```javascript
// 간단한 로깅
console.log('정보:', data);
console.error('에러:', error);

// 더 나은 방법: Winston 라이브러리 사용
const logger = require('./utils/logger');
logger.info('메시지', { context: 'value' });
logger.error('에러', { error: error.message });
```

---

## 📦 의존성 관리

### 새 패키지 추가

```bash
# 프로덕션 의존성
npm install package-name

# 개발 의존성
npm install --save-dev package-name
```

### 의존성 업데이트

```bash
# 최신 버전 확인
npm outdated

# 업데이트
npm update

# 특정 패키지만
npm install package-name@latest
```

---

## 🔄 코드 스타일 가이드

### ESLint 설정

```bash
npm install --save-dev eslint
npx eslint --init
```

### 코드 포맷팅

```bash
npm install --save-dev prettier
npx prettier --write "src/**/*.js"
```

### 네이밍 컨벤션

```javascript
// ✅ 권장
const userName = 'John';  // camelCase
const USER_STATUS = 'active';  // UPPER_SNAKE_CASE (상수)
class UserService {}  // PascalCase (클래스)
function getUserById() {}  // camelCase (함수)

// ❌ 피할 것
const user_name = 'John';  // snake_case
const UserName = 'John';  // PascalCase (변수)
```

---

## 📝 에러 처리

### 표준화된 에러 처리

```javascript
// 200 OK
res.json({ success: true, data: {...} });

// 400 Bad Request
res.status(400).json({ error: 'Invalid input' });

// 401 Unauthorized
res.status(401).json({ error: 'Authentication required' });

// 403 Forbidden
res.status(403).json({ error: 'Permission denied' });

// 404 Not Found
res.status(404).json({ error: 'Resource not found' });

// 500 Internal Server Error
res.status(500).json({ error: 'Internal server error' });
```

### try-catch 패턴

```javascript
// ✅ 권장
router.get('/endpoint', asyncHandler(async (req, res) => {
  // asyncHandler가 에러를 자동으로 처리
  const data = await getData();
  res.json(data);
}));

// 기본 try-catch
try {
  // 코드
} catch (error) {
  console.error('상세 에러:', error);
  res.status(500).json({ error: 'Process failed' });
}
```

---

## 🚀 성능 최적화

### 데이터베이스 쿼리 최적화

```javascript
// ❌ N+1 쿼리 문제
const accounts = await Account.find();
for (const account of accounts) {
  const user = await User.findById(account.userId);  // 반복 쿼리!
}

// ✅ Population 사용
const accounts = await Account.find().populate('userId');

// ✅ 필요한 필드만 선택
const accounts = await Account.find()
  .select('serviceName serviceDomain')
  .limit(10);

// ✅ 인덱스 사용
// src/models/Account.js에서 정의:
accountSchema.index({ userId: 1, status: 1 });
```

### 응답 데이터 최적화

```javascript
// ❌ 불필요한 데이터 전송
res.json(account);  // 모든 필드

// ✅ 필요한 필드만 반환
res.json({
  id: account._id,
  serviceName: account.serviceName,
  serviceDomain: account.serviceDomain
});
```

### 캐싱

```javascript
// Redis를 사용한 캐싱 예제
const redis = require('redis');
const client = redis.createClient();

// 캐시에서 조회
const cached = await client.get(`policy:${policyId}`);
if (cached) {
  return JSON.parse(cached);
}

// 캐시 없으면 계산하고 저장
const result = await expensiveOperation();
await client.setEx(`policy:${policyId}`, 3600, JSON.stringify(result));
return result;
```

---

## 🔐 보안 베스트 프랙티스

### 입력 검증

```javascript
const { body, validationResult } = require('express-validator');

router.post('/endpoint',
  body('email').isEmail(),
  body('password').isLength({ min: 8 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // 처리
  }
);
```

### 민감 정보 보호

```javascript
// ❌ 피할 것
console.log('User password:', password);
res.json({ user, password });

// ✅ 권장
const userResponse = {
  id: user._id,
  email: user.email,
  name: user.name
  // 패스워드는 제외!
};

// 암호화
const encrypted = encryptToken(sensitiveData);
```

### CORS 설정

```javascript
const cors = require('cors');

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

## 📚 참고 자료

- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [OWASP API Security](https://owasp.org/www-project-api-security/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [MongoDB Best Practices](https://docs.mongodb.com/manual/administration/best-practices/)

---

## ❓ 자주 묻는 질문

**Q: "asyncHandler를 사용해야 하는 이유는?"**
A: 라우트 핸들러에서 발생한 에러를 자동으로 catch하고 에러 핸들러로 전달하기 위해서입니다.

**Q: "토큰을 어디에 저장해야 하나?"**
A: 프론트엔드에서는 httpOnly 쿠키 또는 메모리에 저장하세요. localStorage는 XSS 공격에 취약합니다.

**Q: "refresh token은 어떻게 관리하나?"**
A: 데이터베이스에 암호화되어 저장하고, 정기적으로 로테이션하세요.

**Q: "API 속도를 올리려면?"**
A: 캐싱, 인덱싱, 쿼리 최적화, CDN 사용을 고려하세요.

---

**질문이나 피드백이 있으면 이슈를 등록해주세요!**
