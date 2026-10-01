import { Router } from 'express';
import { workspaceDashboardController } from '../controllers/workspaceDashboardController.js';
import { workspaceMembershipController } from '../controllers/workspaceMembershipController.js';
import { activityController } from '../controllers/activityController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { standardRateLimiter } from '../middleware/rateLimitMiddleware.js';
import { validatePathSegment } from '../utils/blueprintPathBuilder.js';

export const workspaceDashboardRouter = Router();

workspaceDashboardRouter.use(requireAuth);
workspaceDashboardRouter.use(standardRateLimiter);

/**
 * POST /api/workspace/join
 * Server-authorized workspace joining via 8-character invite code.
 * Identity is derived strictly from verified Firebase token (req.user.uid).
 */
workspaceDashboardRouter.post('/join', async (req, res) => {
  try {
    const verifiedUserUid = req.user.uid;
    const { inviteCode } = req.body || {};

    const result = await workspaceMembershipController.joinWorkspaceByCodeHandler(
      verifiedUserUid,
      inviteCode,
      req
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    console.error(`🚨 [Join Workspace API Error] User: ${req.user?.uid} | Error:`, err.message);
    return res.status(statusCode).json({
      success: false,
      error: { message: err.message, code: err.code || 'JOIN_WORKSPACE_ERROR' },
    });
  }
});

/**
 * GET /api/workspace/:workspaceId/dashboard
 * Authenticated workspace dashboard overview.
 */
workspaceDashboardRouter.get('/:workspaceId/dashboard', async (req, res) => {
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

    const result = await workspaceDashboardController.getWorkspaceDashboardHandler(
      resolvedWorkspaceId,
      verifiedUserUid
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    console.error(`🚨 [Dashboard API Error] Workspace: ${req.params?.workspaceId} | Error:`, err.message);
    return res.status(statusCode).json({
      success: false,
      error: { message: err.message, code: err.code || 'DASHBOARD_ERROR' },
    });
  }
});

/**
 * POST /api/workspace/:workspaceId/activity
 * Authoritative activity recording endpoint enforcing token identity, membership, and server timestamp.
 */
workspaceDashboardRouter.post('/:workspaceId/activity', activityController.recordActivityHandler);

/**
 * GET /api/workspace/:workspaceId/activity
 * Authenticated workspace activity retrieval with limit and beforeTimestamp pagination.
 */
workspaceDashboardRouter.get('/:workspaceId/activity', activityController.getWorkspaceActivitiesHandler);

/**
 * POST /api/workspace/:workspaceId/leave
 * Authoritative leave-workspace endpoint.
 */
workspaceDashboardRouter.post('/:workspaceId/leave', async (req, res) => {
  try {
    const rawWorkspaceId = req.params.workspaceId;
    const verifiedUserUid = req.user.uid;

    const result = await workspaceMembershipController.leaveWorkspaceHandler(
      verifiedUserUid,
      rawWorkspaceId,
      req
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: { message: err.message, code: err.code || 'LEAVE_WORKSPACE_ERROR' },
    });
  }
});

/**
 * DELETE /api/workspace/:workspaceId/members/:memberUid
 * Authoritative member removal endpoint.
 */
workspaceDashboardRouter.delete('/:workspaceId/members/:memberUid', async (req, res) => {
  try {
    const rawWorkspaceId = req.params.workspaceId;
    const rawTargetUid = req.params.memberUid;
    const verifiedUserUid = req.user.uid;

    const result = await workspaceMembershipController.removeMemberHandler(
      verifiedUserUid,
      rawWorkspaceId,
      rawTargetUid,
      req
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: { message: err.message, code: err.code || 'REMOVE_MEMBER_ERROR' },
    });
  }
});

/**
 * POST /api/workspace/:workspaceId/reconcile-members
 * Authoritative member-count reconciliation endpoint.
 */
workspaceDashboardRouter.post('/:workspaceId/reconcile-members', async (req, res) => {
  try {
    const rawWorkspaceId = req.params.workspaceId;
    const result = await workspaceMembershipController.reconcileWorkspaceMemberCountHandler(
      rawWorkspaceId
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: { message: err.message, code: err.code || 'RECONCILE_MEMBERS_ERROR' },
    });
  }
});

/**
 * POST /api/workspace/:workspaceId/members/:memberUid/second-owner
 * Authoritative Second Owner designation management endpoint.
 */
workspaceDashboardRouter.post('/:workspaceId/members/:memberUid/second-owner', async (req, res) => {
  try {
    const rawWorkspaceId = req.params.workspaceId;
    const rawTargetUid = req.params.memberUid;
    const verifiedUserUid = req.user.uid;
    const { action } = req.body || {};

    const result = await workspaceMembershipController.updateSecondOwnerHandler(
      verifiedUserUid,
      rawWorkspaceId,
      rawTargetUid,
      action || 'assign',
      req
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: { message: err.message, code: err.code || 'SECOND_OWNER_UPDATE_ERROR' },
    });
  }
});

/**
 * POST /api/workspace/:workspaceId/members/:memberUid/team-captain
 * Authoritative Team Captain designation management endpoint.
 */
workspaceDashboardRouter.post('/:workspaceId/members/:memberUid/team-captain', async (req, res) => {
  try {
    const rawWorkspaceId = req.params.workspaceId;
    const rawTargetUid = req.params.memberUid;
    const verifiedUserUid = req.user.uid;
    const { action } = req.body || {};

    const result = await workspaceMembershipController.updateTeamCaptainHandler(
      verifiedUserUid,
      rawWorkspaceId,
      rawTargetUid,
      action || 'assign',
      req
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: { message: err.message, code: err.code || 'TEAM_CAPTAIN_UPDATE_ERROR' },
    });
  }
});

/**
 * POST /api/workspace/:workspaceId/transfer-ownership
 * Authoritative workspace ownership transfer endpoint.
 */
workspaceDashboardRouter.post('/:workspaceId/transfer-ownership', async (req, res) => {
  try {
    const rawWorkspaceId = req.params.workspaceId;
    const verifiedUserUid = req.user.uid;
    const { newOwnerUid, formerOwnerRole } = req.body || {};

    const result = await workspaceMembershipController.transferOwnershipHandler(
      verifiedUserUid,
      rawWorkspaceId,
      newOwnerUid,
      formerOwnerRole || 'team_captain',
      req
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: { message: err.message, code: err.code || 'TRANSFER_OWNERSHIP_ERROR' },
    });
  }
});

