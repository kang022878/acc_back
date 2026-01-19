const express = require('express');
const { authenticate } = require('../middleware/auth');
const PolicyAnalysisService = require('../services/policyAnalysisService');
const PolicyAnalysis = require('../models/PolicyAnalysis');
const asyncHandler = require('../middleware/asyncHandler');
const { hashString } = require('../utils/encryption');

const router = express.Router();

/**
 * URL로 약관 분석
 */
router.post('/analyze-url', authenticate, asyncHandler(async (req, res) => {
  const { url, serviceName } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL required' });
  }
  if (!PolicyAnalysisService.isEnabled()) {
    return res.status(503).json({ error: 'OpenAI API key not configured' });
  }

  try {
    // 분석 수행
    const analysis = await PolicyAnalysisService.analyzePolicyFromUrl(url, serviceName);

    // 결과 저장
    const savedAnalysis = await PolicyAnalysis.create({
      userId: req.userId,
      serviceName: serviceName || url,
      serviceUrl: url,
      policySource: 'url',
      ...analysis
    });

    res.json({
      success: true,
      analysis: {
        id: savedAnalysis._id,
        serviceName: savedAnalysis.serviceName,
        summary: savedAnalysis.summary,
        riskLevel: savedAnalysis.riskLevel,
        riskFlags: savedAnalysis.riskFlags,
        evidence: savedAnalysis.evidence,
        qaAnswers: savedAnalysis.qaAnswers
      }
    });
      } catch (error) {
        console.error('Policy analysis error:', error);

        if (error.code === 'insufficient_quota') {
          return res.status(402).json({
            error: 'AI 분석 사용량이 초과되었어요',
            detail: 'OpenAI API 크레딧이 부족합니다. 잠시 후 다시 시도해주세요.',
          });
        }

        res.status(500).json({
          error: 'Analysis failed',
          message: error.message,
        });
      }

}));
 
/**
 * 텍스트로 약관 분석
 */
router.post('/analyze-text', authenticate, asyncHandler(async (req, res) => {
  const { text, serviceName } = req.body;

  if (!text || text.length < 100) {
    return res.status(400).json({ error: 'Policy text required (min 100 characters)' });
  }
  if (!PolicyAnalysisService.isEnabled()) {
    return res.status(503).json({ error: 'OpenAI API key not configured' });
  }

  try {
    // 분석 수행
    const analysis = await PolicyAnalysisService.analyzePolicy(text, serviceName);

    // 결과 저장
    const savedAnalysis = await PolicyAnalysis.create({
      userId: req.userId,
      serviceName: serviceName || 'Unnamed Service',
      policySource: 'text',
      ...analysis
    });

    res.json({
      success: true,
      analysis: {
        id: savedAnalysis._id,
        serviceName: savedAnalysis.serviceName,
        summary: savedAnalysis.summary,
        riskLevel: savedAnalysis.riskLevel,
        riskFlags: savedAnalysis.riskFlags,
        evidence: savedAnalysis.evidence,
        qaAnswers: savedAnalysis.qaAnswers
      }
    });
  } catch (error) {
    console.error('Policy analysis error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
}));

/**
 * 분석 기록 조회
 */
router.get('/history', authenticate, asyncHandler(async (req, res) => {
  const analyses = await PolicyAnalysis.find({ userId: req.userId })
    .select('-policyHash') // 민감 정보 제외
    .sort('-createdAt')
    .limit(20);

  res.json({
    total: analyses.length,
    analyses: analyses.map(a => ({
      id: a._id,
      serviceName: a.serviceName,
      serviceUrl: a.serviceUrl,
      summary: a.summary,
      riskLevel: a.riskLevel,
      riskFlags: a.riskFlags,
      createdAt: a.createdAt
    }))
  });
}));

/**
 * 특정 분석 결과 조회
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const analysis = await PolicyAnalysis.findOne({
    _id: req.params.id,
    userId: req.userId
  });

  if (!analysis) {
    return res.status(404).json({ error: 'Analysis not found' });
  }

  res.json({
    analysis: {
      id: analysis._id,
      serviceName: analysis.serviceName,
      serviceUrl: analysis.serviceUrl,
      summary: analysis.summary,
      riskLevel: analysis.riskLevel,
      riskFlags: analysis.riskFlags,
      evidence: analysis.evidence,
      qaAnswers: analysis.qaAnswers,
      createdAt: analysis.createdAt
    }
  });
}));

/**
 * 위험 신호에 대한 가이드 조회
 */
router.get('/guidance/:flag', asyncHandler(async (req, res) => {
  const guidance = PolicyAnalysisService.getRiskGuidance(req.params.flag);
  
  if (!guidance) {
    return res.status(404).json({ error: 'Guidance not found' });
  }

  res.json({ guidance });
}));

/**
 * 분석 결과에 대한 사용자 피드백
 */
router.post('/:id/feedback', authenticate, asyncHandler(async (req, res) => {
  const { helpful, notes } = req.body;

  const analysis = await PolicyAnalysis.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    {
      userFeedback: {
        helpful,
        notes
      }
    },
    { new: true }
  );

  if (!analysis) {
    return res.status(404).json({ error: 'Analysis not found' });
  }

  res.json({ success: true });
}));

module.exports = router;
