import { Router } from 'express';
import { workspaceInvitationController } from '../controllers/workspaceInvitationController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { standardRateLimiter } from '../middleware/rateLimitMiddleware.js';
import { validatePathSegment } from '../utils/blueprintPathBuilder.js';

export const workspaceInvitationRouter = Router();

/**
 * POST /api/invitations/lookup
 * Public/Unauthenticated code lookup.
 * Resolves safe preview metadata so invitees can see what workspace invited them before signing in.
 */
workspaceInvitationRouter.post('/lookup', standardRateLimiter, async (req, res) => {
  try {
    const { code } = req.body || {};
    const result = await workspaceInvitationController.lookupInvitationByCodeHandler(code);
    return res.json({ success: true, data: result });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: { message: err.message, code: err.code || 'INVITATION_LOOKUP_ERROR' },
    });
  }
});

/**
 * POST /api/invitations/accept
 * Authenticated invitation acceptance.
 * Verifies email binding: authenticated token email MUST match invitedEmail.
 */
workspaceInvitationRouter.post('/accept', requireAuth, standardRateLimiter, async (req, res) => {
  try {
    const verifiedUserUid = req.user.uid;
    const verifiedUserEmail = req.user.email;
    const { code } = req.body || {};

    const result = await workspaceInvitationController.acceptInvitationHandler(
      verifiedUserUid,
      verifiedUserEmail,
      code,
      req
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code || 'INVITATION_ACCEPT_ERROR',
        invitedEmail: err.invitedEmail,
        currentEmail: err.currentEmail,
      },
    });
  }
});

/**
 * POST /api/invitations/decline
 * Authenticated invitation decline by invitee.
 */
workspaceInvitationRouter.post('/decline', requireAuth, standardRateLimiter, async (req, res) => {
  try {
    const verifiedUserUid = req.user.uid;
    const verifiedUserEmail = req.user.email;
    const { code } = req.body || {};

    const result = await workspaceInvitationController.declineInvitationHandler(
      verifiedUserUid,
      verifiedUserEmail,
      code
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: { message: err.message, code: err.code || 'INVITATION_DECLINE_ERROR' },
    });
  }
});

/**
 * GET /api/invitations/workspace/:workspaceId
 * List all invitations for a workspace. Owner/Admin only.
 */
workspaceInvitationRouter.get('/workspace/:workspaceId', requireAuth, standardRateLimiter, async (req, res) => {
  try {
    const rawWorkspaceId = req.params.workspaceId;
    const resolvedWorkspaceId = validatePathSegment(rawWorkspaceId, 'workspaceId');
    const result = await workspaceInvitationController.listInvitationsHandler(
      resolvedWorkspaceId,
      req.user.uid
    );
    return res.json({ success: true, data: result });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: { message: err.message, code: err.code || 'INVITATION_LIST_ERROR' },
    });
  }
});

/**
 * POST /api/invitations/workspace/:workspaceId
 * Create an email-bound invitation code. Owner/Admin only.
 */
workspaceInvitationRouter.post('/workspace/:workspaceId', requireAuth, standardRateLimiter, async (req, res) => {
  try {
    const rawWorkspaceId = req.params.workspaceId;
    const resolvedWorkspaceId = validatePathSegment(rawWorkspaceId, 'workspaceId');
    const { email, role, isTeamCaptain, requireRegistered } = req.body || {};

    const result = await workspaceInvitationController.createInvitationHandler(
      resolvedWorkspaceId,
      req.user.uid,
      { email, role, isTeamCaptain, requireRegistered },
      req
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: { message: err.message, code: err.code || 'INVITATION_CREATE_ERROR' },
    });
  }
});

/**
 * POST /api/invitations/workspace/:workspaceId/:invitationId/regenerate
 * Invalidate previous code and generate a new code for pending invitation. Owner/Admin only.
 */
workspaceInvitationRouter.post(
  '/workspace/:workspaceId/:invitationId/regenerate',
  requireAuth,
  standardRateLimiter,
  async (req, res) => {
    try {
      const resolvedWorkspaceId = validatePathSegment(req.params.workspaceId, 'workspaceId');
      const resolvedInvitationId = validatePathSegment(req.params.invitationId, 'invitationId');

      const result = await workspaceInvitationController.regenerateInvitationHandler(
        resolvedWorkspaceId,
        resolvedInvitationId,
        req.user.uid,
        req
      );

      return res.json({ success: true, data: result });
    } catch (err) {
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        error: { message: err.message, code: err.code || 'INVITATION_REGENERATE_ERROR' },
      });
    }
  }
);

/**
 * POST /api/invitations/workspace/:workspaceId/:invitationId/revoke
 * Revoke an active pending invitation. Owner/Admin only.
 */
workspaceInvitationRouter.post(
  '/workspace/:workspaceId/:invitationId/revoke',
  requireAuth,
  standardRateLimiter,
  async (req, res) => {
    try {
      const resolvedWorkspaceId = validatePathSegment(req.params.workspaceId, 'workspaceId');
      const resolvedInvitationId = validatePathSegment(req.params.invitationId, 'invitationId');

      const result = await workspaceInvitationController.revokeInvitationHandler(
        resolvedWorkspaceId,
        resolvedInvitationId,
        req.user.uid,
        req
      );

      return res.json({ success: true, data: result });
    } catch (err) {
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        error: { message: err.message, code: err.code || 'INVITATION_REVOKE_ERROR' },
      });
    }
  }
);
