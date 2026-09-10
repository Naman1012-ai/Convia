import { Router } from 'express';
import { searchController } from '../controllers/searchController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { standardRateLimiter } from '../middleware/rateLimitMiddleware.js';
import { validatePathSegment } from '../utils/blueprintPathBuilder.js';

export const searchRouter = Router();

searchRouter.use(requireAuth);
searchRouter.use(standardRateLimiter);

/**
 * POST /api/search/workspace
 * Unified, authenticated workspace search endpoint.
 */
searchRouter.post('/workspace', async (req, res) => {
  try {
    const payload = req.body || {};
    const rawWorkspaceId = payload.workspaceId || req.query.workspaceId;
    const verifiedUserUid = req.user.uid;

    if (!rawWorkspaceId || typeof rawWorkspaceId !== 'string' || !rawWorkspaceId.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'A valid Workspace ID is required.', code: 'INVALID_PARAMETERS' },
      });
    }

    const resolvedWorkspaceId = validatePathSegment(rawWorkspaceId, 'workspaceId');

    const result = await searchController.searchWorkspaceHandler(
      resolvedWorkspaceId,
      verifiedUserUid,
      payload
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    console.error(`🚨 [Search API Error] Workspace: ${req.body?.workspaceId} | Error:`, err.message);
    return res.status(statusCode).json({
      success: false,
      error: { message: err.message, code: err.code || 'SEARCH_ERROR' },
    });
  }
});

/**
 * GET /api/search/:workspaceId
 * RESTful, authenticated workspace search endpoint with query params.
 */
searchRouter.get('/:workspaceId', async (req, res) => {
  try {
    const rawWorkspaceId = req.params.workspaceId;
    const verifiedUserUid = req.user.uid;

    if (!rawWorkspaceId || typeof rawWorkspaceId !== 'string' || !rawWorkspaceId.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'A valid Workspace ID is required.', code: 'INVALID_PARAMETERS' },
      });
    }

    const resolvedWorkspaceId = validatePathSegment(rawWorkspaceId, 'workspaceId');

    const payload = {
      query: req.query.q || req.query.query || '',
      filter: req.query.filter,
      limit: req.query.limit,
    };

    const result = await searchController.searchWorkspaceHandler(
      resolvedWorkspaceId,
      verifiedUserUid,
      payload
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    console.error(`🚨 [Search API Error] Workspace: ${req.params?.workspaceId} | Error:`, err.message);
    return res.status(statusCode).json({
      success: false,
      error: { message: err.message, code: err.code || 'SEARCH_ERROR' },
    });
  }
});
