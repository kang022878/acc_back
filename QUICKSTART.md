# 🚀 ACC 백엔드 빠른 시작 가이드

ACC (Account Control Center) 백엔드를 몇 분 안에 실행하기!

## 📋 사전 요구사항

- Node.js 16+ (확인: `node --version`)
- npm (확인: `npm --version`)
- MongoDB (로컬 또는 MongoDB Atlas)
- Google OAuth 자격증명
- OpenAI API 키

## 1️⃣ 기본 설정 (5분)

### Step 1: 환경변수 파일 생성

```bash
cd acc_back
cp .env.example .env
```

### Step 2: `.env` 파일 편집

```env
# 필수 항목만 설정하면 동작합니다

# 기본
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/acc_db

# JWT (임시 값으로 테스트 가능)
JWT_SECRET=temporary_secret_for_testing_change_in_production
JWT_EXPIRE=7d

# Google OAuth (https://console.cloud.google.com에서 가져오기)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback

# OpenAI (https://platform.openai.com에서 가져오기)
OPENAI_API_KEY=sk-your_api_key_here

# 암호화 (아래 명령으로 생성)
ENCRYPTION_KEY=please_generate_32_char_random_string_here
ENCRYPTION_ALGORITHM=aes-256-cbc

# CORS
CORS_ORIGIN=http://localhost:3000
```

### Step 3: 강력한 키 생성

```bash
# ENCRYPTION_KEY 생성
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 출력된 32자 문자열을 ENCRYPTION_KEY에 붙여넣기
```

## 2️⃣ 의존성 설치 (2분)

```bash
npm install
```

## 3️⃣ 데이터베이스 시작

### MongoDB 로컬 설치 (Mac)

```bash
brew install mongodb-community
brew services start mongodb-community
```

또는 MongoDB Atlas 사용:
- [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)에서 클러스터 생성
- MONGODB_URI를 Atlas 연결 문자열로 업데이트

## 4️⃣ 개발 서버 실행

```bash
npm run dev
```

출력:
```
🚀 ACC 백엔드 서버 실행 중: http://localhost:5000
환경: development
✓ MongoDB 연결됨
```

## ✅ 동작 확인

### 헬스 체크

```bash
curl http://localhost:5000/health
```

응답:
```json
{"status":"ok","timestamp":"2024-01-15T10:30:00.000Z"}
```

### Google 로그인 URL 가져오기

```bash
curl http://localhost:5000/api/auth/google/auth-url
```

## 🎯 다음 단계

### 1. Google OAuth 설정

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 새 프로젝트 생성
3. OAuth 2.0 자격증명 생성
4. 승인된 URI에 `http://localhost:5000/api/auth/google/callback` 추가
5. Client ID와 Secret을 `.env`에 복사

### 2. OpenAI API 설정

1. [OpenAI Platform](https://platform.openai.com) 접속
2. API 키 생성
3. `.env`에 붙여넣기

### 3. 프론트엔드 연결

```javascript
// React에서
const API_URL = 'http://localhost:5000/api';

// 로그인
const response = await fetch(`${API_URL}/auth/google/callback`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: authCode })
});

const { token } = await response.json();
localStorage.setItem('token', token);
```

## 📚 더 알아보기

- **전체 API 문서**: [API_EXAMPLES.md](./API_EXAMPLES.md)
- **개발 가이드**: [DEVELOPMENT.md](./DEVELOPMENT.md)
- **프로젝트 구조**: [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)
- **배포 가이드**: [DEPLOYMENT.md](./DEPLOYMENT.md)

## 🐛 문제 해결

### MongoDB 연결 오류
```
MongoDB 연결 실패: connect ECONNREFUSED 127.0.0.1:27017
```

**해결책:**
```bash
# MongoDB 실행 확인
mongo --version

# MongoDB 시작 (Mac)
brew services start mongodb-community

# 또는 MongoDB Atlas 사용
```

### Google OAuth 오류
```
Error: invalid_client
```

**해결책:**
- Google Cloud Console에서 Client ID, Secret 확인
- 리다이렉트 URI가 정확한지 확인
- `.env`에 올바르게 입력

### OpenAI API 오류
```
Error: invalid_api_key
```

**해결책:**
- API 키가 활성화되어 있는지 확인
- 과금 방법이 설정되어 있는지 확인
- API 키를 다시 생성해보기

## 💡 팁과 트릭

### 로그 레벨 조절

```bash
# 더 자세한 로그
DEBUG=* npm run dev

# 조용한 모드
QUIET=true npm run dev
```

### 데이터베이스 초기화

```bash
# MongoDB 콘솔 접속
mongosh

# 데이터베이스 삭제 (개발 중에만!)
use acc_db
db.dropDatabase()
```

### API 테스트

```bash
# VS Code에서 REST Client 확장 설치
# requests.http 파일 생성

### 헬스 체크
GET http://localhost:5000/health

### Google 로그인 URL
GET http://localhost:5000/api/auth/google/auth-url
```

## 📊 성능 모니터링

```bash
# Node.js 프로세스 모니터링
node --prof src/index.js

# 힙 스냅샷
node --inspect src/index.js
# 브라우저에서 chrome://inspect 열기
```

## 🔐 보안 체크리스트

- [ ] ENCRYPTION_KEY가 설정되었는가?
- [ ] MONGODB_URI가 올바른가?
- [ ] Google OAuth 자격증명이 유효한가?
- [ ] OpenAI API 키가 유효한가?
- [ ] .env 파일이 .gitignore에 있는가?

## 🎓 학습 리소스

- [Express.js 공식 문서](https://expressjs.com)
- [MongoDB 공식 문서](https://docs.mongodb.com)
- [Google Gmail API](https://developers.google.com/gmail)
- [OpenAI API 가이드](https://platform.openai.com/docs)

## 📞 지원

문제가 발생하면:
1. **에러 메시지 확인** - 콘솔에 표시된 메시지 읽기
2. **문서 검색** - README.md, API_EXAMPLES.md 참고
3. **디버깅** - `npm run dev`로 실행하고 콘솔 확인
4. **이슈 등록** - GitHub 이슈 생성

---

## 🎉 축하합니다!

이제 ACC 백엔드가 실행 중입니다!

**다음 테스트:**
```bash
# 1. 헬스 체크
curl http://localhost:5000/health

# 2. Google 로그인 URL 확인
curl http://localhost:5000/api/auth/google/auth-url

# 3. API 문서 읽기
# API_EXAMPLES.md 참고
```

**질문이나 문제가 있으면 언제든 물어보세요!** 🚀
