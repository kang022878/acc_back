const { getGmailClient } = require('../config/google');
const Account = require('../models/Account');
const {
  extractDomainFromEmail,
  extractDomainFromUnsubscribe,
  extractServiceNameFromSubject,
  categorizeEmail,
  calculateInactivityDays
} = require('../utils/emailParser');

class GmailService {
  /**
   * Gmail API 쿼리로 메시지 검색
   */
  static async searchEmails(accessToken, queries, maxResults = 50) {
    try {
      const gmail = getGmailClient(accessToken);
      const results = [];

      for (const query of queries) {
        const response = await gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults,
          fields: 'messages(id)'
        });

        if (response.data.messages) {
          results.push(...response.data.messages);
        }
      }

      // 중복 제거
      return Array.from(new Map(results.map(m => [m.id, m])).values());
    } catch (error) {
      throw new Error(`Gmail 검색 실패: ${error.message}`);
    }
  }

  /**
   * 메시지 상세 정보 가져오기
   */
  static async getMessageDetails(accessToken, messageId) {
    try {
      const gmail = getGmailClient(accessToken);
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date', 'List-Unsubscribe']
      });

      return this.parseMessageMetadata(response.data);
    } catch (error) {
      throw new Error(`메시지 조회 실패: ${error.message}`);
    }
  }

  /**
   * 메시지 메타데이터 파싱
   */
  static parseMessageMetadata(message) {
    const headers = message.payload.headers || [];
    const headerMap = {};
    
    headers.forEach(header => {
      headerMap[header.name.toLowerCase()] = header.value;
    });

    return {
      messageId: message.id,
      from: headerMap.from,
      subject: headerMap.subject,
      date: headerMap.date,
      unsubscribeHeader: headerMap['list-unsubscribe']
    };
  }

  /**
   * 발견된 이메일들을 Account로 변환 및 저장
   */
  static async processDiscoveredEmails(userId, emailMetadataArray) {
    const domainMap = new Map(); // domain -> aggregate

    for (const email of emailMetadataArray) {
      const domain =
        extractDomainFromEmail(email.from) ||
        extractDomainFromUnsubscribe(email.unsubscribeHeader);

      if (!domain) continue;

      const mailDate = new Date(email.date);
      if (Number.isNaN(mailDate.getTime())) continue;

      // 처음 보는 domain이면 초기화
      if (!domainMap.has(domain)) {
        const serviceName = extractServiceNameFromSubject(email.subject) || domain;
        const category = categorizeEmail(email.subject, domain);

        domainMap.set(domain, {
          userId,
          serviceName,
          serviceDomain: domain,
          category,
          // ✅ 집계용
          firstSeenDate: mailDate,
          lastActivityDate: mailDate,
          evidenceTitle: email.subject?.substring(0, 100),
          evidenceSource: email.from?.split("@")[1] || domain,
          userConfirmed: false,
          status: "active",
        });
        continue;
      }

      // 이미 있는 domain이면 first/last 갱신
      const agg = domainMap.get(domain);

      if (mailDate < agg.firstSeenDate) agg.firstSeenDate = mailDate;
      if (mailDate > agg.lastActivityDate) {
        agg.lastActivityDate = mailDate;
        // 최신 메일의 제목/출처를 evidence로 쓰고 싶으면 업데이트
        agg.evidenceTitle = email.subject?.substring(0, 100);
        agg.evidenceSource = email.from?.split("@")[1] || domain;
      }

      // 카테고리는 더 “강한” 분류가 나오면 바꾸고 싶다면 여기서 정책 추가 가능
    }

    const accounts = Array.from(domainMap.values());

    // 기존 계정과 병합
    const savedAccounts = [];
    for (const account of accounts) {
      const existing = await Account.findOne({
        userId,
        serviceDomain: account.serviceDomain,
      });

      // ✅ inactivityDays 계산(메일 기준)
      const inactivityDays = calculateInactivityDays(account.lastActivityDate);

      if (existing) {
        // firstSeenDate는 더 오래된 것 유지
        if (!existing.firstSeenDate || account.firstSeenDate < existing.firstSeenDate) {
          existing.firstSeenDate = account.firstSeenDate;
        }

        // lastActivityDate는 더 최신인 것 유지 (절대 new Date()로 덮지 말기!)
        if (!existing.lastActivityDate || account.lastActivityDate > existing.lastActivityDate) {
          existing.lastActivityDate = account.lastActivityDate;
        }

        // 부가 정보 업데이트(원하면)
        existing.serviceName = existing.serviceName || account.serviceName;
        existing.category = existing.category || account.category;
        existing.evidenceTitle = account.evidenceTitle;
        existing.evidenceSource = account.evidenceSource;

        // ✅ inactivityDays도 갱신
        existing.inactivityDays = calculateInactivityDays(existing.lastActivityDate);

        await existing.save();
        savedAccounts.push(existing);
      } else {
        const newAccount = await Account.create({
          ...account,
          inactivityDays,
        });
        savedAccounts.push(newAccount);
      }
    }

    return savedAccounts;
  }


  /**
   * 기본 Gmail 검색 쿼리 생성
   */
  static getDefaultSearchQueries() {
    const baseQueries = [
      'subject:(가입 OR 회원가입 OR verify OR welcome OR confirmation)',
      'subject:(영수증 OR 결제 OR 주문 OR invoice OR receipt OR order)',
      'subject:(인증 OR 비밀번호 OR password OR code OR verify)'
    ];
    
    // 기간 제한 (기본 24개월)
    const monthsBack = process.env.MAIL_SEARCH_PERIOD_MONTHS || 24;
    const dateFilter = `newer_than:${monthsBack}m`;
    
    return baseQueries.map(q => `${q} ${dateFilter}`);
  }
}

module.exports = GmailService;
