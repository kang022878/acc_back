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
    const accounts = [];
    const domainMap = new Map(); // 중복 제거

    for (const email of emailMetadataArray) {
      const domain = 
        extractDomainFromEmail(email.from) || 
        extractDomainFromUnsubscribe(email.unsubscribeHeader);
      
      if (!domain || domainMap.has(domain)) continue;

      const serviceName = extractServiceNameFromSubject(email.subject) || domain;
      const category = categorizeEmail(email.subject, domain);

      const account = {
        userId,
        serviceName,
        serviceDomain: domain,
        category,
        firstSeenDate: new Date(email.date),
        evidenceTitle: email.subject?.substring(0, 100),
        evidenceSource: email.from?.split('@')[1] || domain,
        userConfirmed: false,
        status: 'active'
      };

      domainMap.set(domain, account);
      accounts.push(account);
    }

    // 기존 계정과 병합
    const savedAccounts = [];
    for (const account of accounts) {
      const existing = await Account.findOne({
        userId,
        serviceDomain: account.serviceDomain
      });

      if (existing) {
        // 기존 계정 업데이트 (firstSeenDate는 더 오래된 것)
        existing.firstSeenDate = 
          existing.firstSeenDate < account.firstSeenDate 
            ? existing.firstSeenDate 
            : account.firstSeenDate;
        existing.lastActivityDate = new Date();
        await existing.save();
        savedAccounts.push(existing);
      } else {
        // 새 계정 생성
        const newAccount = await Account.create(account);
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
