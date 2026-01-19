# ACC Backend 배포 가이드

## 🚀 프로덕션 배포

### 사전 요구사항
- Node.js 16 이상
- MongoDB (Atlas 또는 Self-hosted)
- Google OAuth Credentials
- OpenAI API Key

### 환경 변수 설정 (프로덕션)

```env
# 서버
NODE_ENV=production
PORT=5000

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/acc_db

# JWT
JWT_SECRET=generate_strong_random_string_here
JWT_EXPIRE=7d

# Google OAuth (프로덕션 URL 사용)
GOOGLE_CLIENT_ID=your_production_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_production_client_secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback

# OpenAI
OPENAI_API_KEY=sk-...

# 암호화 (중요: 안전한 키 생성)
ENCRYPTION_KEY=generate_32_char_random_string
ENCRYPTION_ALGORITHM=aes-256-cbc

# CORS
CORS_ORIGIN=https://yourdomain.com

# 개인정보 정책
DATA_RETENTION_DAYS=90
MAIL_SEARCH_PERIOD_MONTHS=24
```

### 강력한 키 생성

```bash
# 32자 난수 생성 (ENCRYPTION_KEY용)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# JWT_SECRET 생성
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 🐳 Docker 배포

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm ci --only=production

# 소스 코드 복사
COPY src ./src

# 포트 노출
EXPOSE 5000

# 헬스 체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {if(r.statusCode!==200)throw new Error()})"

# 시작
CMD ["node", "src/index.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    container_name: acc-mongodb
    volumes:
      - mongodb_data:/data/db
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_DATABASE: acc_db

  acc-backend:
    build: .
    container_name: acc-backend
    ports:
      - "5000:5000"
    depends_on:
      - mongodb
    environment:
      NODE_ENV: production
      PORT: 5000
      MONGODB_URI: mongodb://mongodb:27017/acc_db
      JWT_SECRET: ${JWT_SECRET}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      GOOGLE_REDIRECT_URI: ${GOOGLE_REDIRECT_URI}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      CORS_ORIGIN: ${CORS_ORIGIN}

volumes:
  mongodb_data:
```

빌드 및 실행:
```bash
docker-compose up -d
```

## 🔧 성능 최적화

### MongoDB 인덱스

```javascript
// 자동으로 생성되지만, 필요시 수동으로:
db.accounts.createIndex({ userId: 1, status: 1 })
db.accounts.createIndex({ serviceDomain: 1 })
db.policyanalyses.createIndex({ userId: 1 })
db.policyanalyses.createIndex({ createdAt: -1 })
```

### Node.js 최적화

```javascript
// cluster.js - 멀티 프로세싱
const cluster = require('cluster');
const os = require('os');

if (cluster.isMaster) {
  const numCPUs = os.cpus().length;
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  require('./src/index.js');
}
```

## 📊 모니터링

### PM2 프로세스 관리

```bash
npm install -g pm2

# 시작
pm2 start src/index.js --name "acc-backend" --env production

# 자동 재시작
pm2 startup
pm2 save

# 모니터링
pm2 monit

# 로그
pm2 logs acc-backend
```

### 로깅 설정

```bash
npm install winston

# src/utils/logger.js 생성
```

## 🔐 보안 체크리스트

- [ ] HTTPS 적용 (Let's Encrypt)
- [ ] 모든 환경 변수를 시크릿 관리로 이동
- [ ] Helmet.js로 보안 헤더 활성화
- [ ] Rate limiting 설정
- [ ] CORS 화이트리스트 설정
- [ ] MongoDB 인증 활성화
- [ ] API Key 로테이션 정책 수립
- [ ] 정기적인 보안 업데이트

### Rate Limiting 추가

```bash
npm install express-rate-limit
```

```javascript
// src/middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100 // 요청 제한
});

module.exports = limiter;
```

## 📈 스케일링

### 로드 밸런싱

Nginx를 사용한 로드 밸런싱:

```nginx
upstream acc_backend {
  server localhost:5000;
  server localhost:5001;
  server localhost:5002;
}

server {
  listen 80;
  server_name api.yourdomain.com;

  location / {
    proxy_pass http://acc_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

### Redis 캐싱

```bash
npm install redis

# 정책 분석 결과 캐싱 구현
```

## 🔄 CI/CD 파이프라인

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Deploy
        run: npm run deploy
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
```

## 📞 지원

배포 관련 문제는 이슈를 등록해주세요.
