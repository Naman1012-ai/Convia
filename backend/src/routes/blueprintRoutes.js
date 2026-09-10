import { Router } from 'express';
import { blueprintController } from '../controllers/blueprintController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validatePathSegment } from '../utils/blueprintPathBuilder.js';
import {
  aiRateLimiter,
  highCostRateLimiter,
  standardRateLimiter,
} from '../middleware/rateLimitMiddleware.js';
import { securityAuditService, AUDIT_EVENT_TYPES } from '../services/securityAuditService.js';

export const blueprintRouter = Router();

// Apply requireAuth and standard rate limiting to all blueprint operational routes
blueprintRouter.use(requireAuth);
blueprintRouter.use(standardRateLimiter);

/**
 * Helper wrapper for authenticated Express async handlers.
 * Extracts identity strictly from verified req.user.uid to prevent impersonation attacks.
 */
function asyncAuthenticatedRoute(fn) {
  return async (req, res) => {
    try {
      const payload = req.body || {};
      const rawWorkspaceId = payload.workspaceId || req.query.workspaceId;
      
      // CRITICAL SECURITY ENFORCEMENT:
      // Authoritative identity MUST derive strictly from verified req.user.uid.
      // Any userUid supplied in req.body or req.query is deliberately ignored.
      const verifiedUserUid = req.user.uid;

      if (!rawWorkspaceId || typeof rawWorkspaceId !== 'string' || !rawWorkspaceId.trim()) {
        return res.status(400).json({
          success: false,
          error: { message: 'A valid Workspace ID string is required.', code: 'INVALID_PARAMETERS' },
        });
      }

      const resolvedWorkspaceId = validatePathSegment(rawWorkspaceId, 'workspaceId');

      const result = await fn(
        resolvedWorkspaceId,
        verifiedUserUid,
        payload,
        req.user
      );
      res.json({ success: true, data: result });
    } catch (err) {
      console.error(`🚨 [Blueprint API Error] Route: ${req.path} | Error:`, err.message);
      const isAuthzDenial = err.statusCode === 403 || err.message?.includes('Unauthorized') || err.message?.includes('permission') || err.message?.includes('member of this workspace');
      const statusCode = err.statusCode || (isAuthzDenial ? 403 : 400);

      if (isAuthzDenial) {
        securityAuditService.recordAuthzDenial(req, err.message, {
          eventType: AUDIT_EVENT_TYPES.CROSS_WORKSPACE_ACCESS_DENIED,
          targetType: 'WORKSPACE_BLUEPRINT',
          targetId: req.body?.workspaceId || req.query?.workspaceId || null,
          workspaceId: req.body?.workspaceId || req.query?.workspaceId || null,
        }).catch(() => {});
      }

      res.status(statusCode).json({
        success: false,
        error: { message: err.message, code: err.code || 'BLUEPRINT_ERROR' },
      });
    }
  };
}

blueprintRouter.get('/active', asyncAuthenticatedRoute((workspaceId, userUid, payload) => blueprintController.getActiveBlueprintHandler(workspaceId, userUid, payload)));
blueprintRouter.post('/active', asyncAuthenticatedRoute((workspaceId, userUid, payload) => blueprintController.getActiveBlueprintHandler(workspaceId, userUid, payload)));
blueprintRouter.get('/versions', asyncAuthenticatedRoute((workspaceId, userUid) => blueprintController.getBlueprintVersionsHandler(workspaceId, userUid)));
blueprintRouter.post('/versions', asyncAuthenticatedRoute((workspaceId, userUid) => blueprintController.getBlueprintVersionsHandler(workspaceId, userUid)));
blueprintRouter.post('/generate', aiRateLimiter, asyncAuthenticatedRoute((workspaceId, userUid) => blueprintController.generateBlueprintHandler(workspaceId, userUid)));
blueprintRouter.post('/recover', highCostRateLimiter, asyncAuthenticatedRoute((workspaceId, userUid) => blueprintController.recoverStaleGenerationHandler(workspaceId, userUid)));
blueprintRouter.put('/update', asyncAuthenticatedRoute((workspaceId, userUid, payload) => blueprintController.updateBlueprintHandler(workspaceId, userUid, payload.updatedContent || payload)));
blueprintRouter.post('/assign-task', asyncAuthenticatedRoute((workspaceId, userUid, payload) => blueprintController.assignBlueprintTaskHandler(workspaceId, userUid, payload)));
blueprintRouter.post('/sync-tasks', highCostRateLimiter, asyncAuthenticatedRoute((workspaceId, userUid, payload) => blueprintController.syncBlueprintTasksHandler(workspaceId, userUid, payload)));
blueprintRouter.post('/export-json', asyncAuthenticatedRoute((workspaceId, userUid, payload) => blueprintController.exportJsonHandler(workspaceId, userUid, payload)));
blueprintRouter.post('/analyze-community', aiRateLimiter, asyncAuthenticatedRoute((workspaceId, userUid) => blueprintController.analyzeCommunityIntelligenceHandler(workspaceId, userUid)));

// Phase 7: Decision & Change Recommendation Authorization Routes
blueprintRouter.post('/decision/approve', asyncAuthenticatedRoute((workspaceId, userUid, payload) => blueprintController.approveDecisionHandler(workspaceId, userUid, payload)));
blueprintRouter.post('/decision/reject', asyncAuthenticatedRoute((workspaceId, userUid, payload) => blueprintController.rejectDecisionHandler(workspaceId, userUid, payload)));
blueprintRouter.post('/decision/create', asyncAuthenticatedRoute((workspaceId, userUid, payload) => blueprintController.createDecisionHandler(workspaceId, userUid, payload)));
blueprintRouter.post('/change-recommendation/approve', asyncAuthenticatedRoute((workspaceId, userUid, payload) => blueprintController.approveChangeRecommendationHandler(workspaceId, userUid, payload)));
blueprintRouter.post('/change-recommendation/reject', asyncAuthenticatedRoute((workspaceId, userUid, payload) => blueprintController.rejectChangeRecommendationHandler(workspaceId, userUid, payload)));

// Phase 9: Persistence, Versioning, Concurrency & Staleness Routes
blueprintRouter.post('/version/activate', highCostRateLimiter, asyncAuthenticatedRoute((workspaceId, userUid, payload) => blueprintController.activateBlueprintVersionHandler(workspaceId, userUid, payload)));
blueprintRouter.post('/check-staleness', asyncAuthenticatedRoute((workspaceId, userUid) => blueprintController.checkBlueprintStalenessHandler(workspaceId, userUid)));
blueprintRouter.post('/version/compare', asyncAuthenticatedRoute((workspaceId, userUid, payload) => blueprintController.compareBlueprintVersionsHandler(workspaceId, userUid, payload)));

// Phase 11: Formal Human Approval & Readiness Gates
blueprintRouter.post('/version/approve', highCostRateLimiter, asyncAuthenticatedRoute((workspaceId, userUid, payload) => blueprintController.approveBlueprintVersionHandler(workspaceId, userUid, payload)));
blueprintRouter.post('/version/approval-readiness', asyncAuthenticatedRoute((workspaceId, userUid, payload) => blueprintController.checkApprovalReadinessHandler(workspaceId, userUid, payload)));



