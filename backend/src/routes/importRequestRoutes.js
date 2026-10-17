import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { importRequestService } from '../services/importRequestService.js';

export const importRequestRouter = Router();

/**
 * GET /api/public-ideas/:ideaId/import-status
 * Pre-flight check retrieving active request status across a set of workspaces for the authenticated user.
 */
importRequestRouter.get('/:ideaId/import-status', requireAuth, async (req, res, next) => {
  try {
    const { ideaId } = req.params;
    const userUid = req.user.uid;
    const workspaceIds = String(req.query.workspaceIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const status = await importRequestService.getIdeaImportStatus({
      ideaId,
      userUid,
      workspaceIds,
    });

    return res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/public-ideas/:ideaId/import-requests
 * Submits a new import request for a public idea into a workspace.
 */
importRequestRouter.post('/:ideaId/import-requests', requireAuth, async (req, res, next) => {
  try {
    const { ideaId } = req.params;
    const { workspaceId, requestNote } = req.body;
    const requesterUid = req.user.uid;

    const result = await importRequestService.createRequest({
      ideaId,
      requesterUid,
      requesterWorkspaceId: workspaceId,
      requestNote,
      userRecord: req.user,
    });

    return res.status(201).json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/public-ideas/import-requests/received
 * Retrieves all import requests for ideas created by the authenticated user.
 */
importRequestRouter.get('/import-requests/received', requireAuth, async (req, res, next) => {
  try {
    const creatorUid = req.user.uid;
    const requests = await importRequestService.getRequestsForCreator(creatorUid);
    return res.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/public-ideas/import-requests/sent
 * Retrieves all import requests submitted by the authenticated user.
 */
importRequestRouter.get('/import-requests/sent', requireAuth, async (req, res, next) => {
  try {
    const requesterUid = req.user.uid;
    const requests = await importRequestService.getRequestsForRequester(requesterUid);
    return res.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/public-ideas/import-requests/:requestId/approve
 * Approves an import request and performs atomic server-side copy into the target workspace.
 */
importRequestRouter.post('/import-requests/:requestId/approve', requireAuth, async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const actorUid = req.user.uid;
    const actorName = req.user.displayName || req.user.name || req.user.email?.split('@')[0] || 'Creator';
    const actorAvatar = req.user.photoURL || null;

    const result = await importRequestService.approveRequest({
      requestId,
      actorUid,
      actorName,
      actorAvatar,
    });

    return res.json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/public-ideas/import-requests/:requestId/reject
 * Rejects an import request with a creator explanation.
 */
importRequestRouter.post('/import-requests/:requestId/reject', requireAuth, async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { rejectionReason } = req.body;
    const actorUid = req.user.uid;
    const actorName = req.user.displayName || req.user.name || req.user.email?.split('@')[0] || 'Creator';
    const actorAvatar = req.user.photoURL || null;

    const result = await importRequestService.rejectRequest({
      requestId,
      actorUid,
      actorName,
      actorAvatar,
      rejectionReason,
    });

    return res.json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/public-ideas/import-requests/:requestId/cancel
 * Allows a requester to cancel their pending import request.
 */
importRequestRouter.post('/import-requests/:requestId/cancel', requireAuth, async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const actorUid = req.user.uid;

    const result = await importRequestService.cancelRequest({
      requestId,
      actorUid,
    });

    return res.json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
});
