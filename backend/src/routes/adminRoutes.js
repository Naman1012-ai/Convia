/**
 * Express Router for Privileged Administrative Operations.
 * Strictly protected by requireAuth and requirePlatformAdmin middleware.
 * All mutations are executed via Firebase Admin SDK with server-side validation.
 */

import express from 'express';
import { requireAuth, requirePlatformAdmin } from '../middleware/authMiddleware.js';
import { rtdbService } from '../services/rtdbService.js';
import { validatePathSegment } from '../utils/blueprintPathBuilder.js';
import { adminRateLimiter } from '../middleware/rateLimitMiddleware.js';
import { securityAuditService } from '../services/securityAuditService.js';
import { notificationService } from '../services/notificationService.js';
import { NOTIFICATION_TYPES } from '../constants/notificationConstants.js';

export const adminRouter = express.Router();

// Apply auth, platform admin verification, and tier 4 failClosed rate limiting to all admin routes
adminRouter.use(requireAuth);
adminRouter.use(requirePlatformAdmin);
adminRouter.use(adminRateLimiter);

/**
 * Helper to write internal administrative audit log via SecurityAuditService.
 */
async function logAdminAudit(actorUser, actionType, targetId, details, options = {}) {
  try {
    await securityAuditService.recordAdminAudit(actorUser, actionType, targetId, details, options);
  } catch (err) {
    console.warn('⚠️ [adminRoutes] Failed to record admin audit log:', err.message);
    if (options.isCritical) {
      throw err;
    }
  }
}

// =========================================================================
// 1. PLATFORM SETTINGS
// =========================================================================

const ALLOWED_SETTINGS_SECTIONS = new Set([
  'general',
  'auth',
  'workspaces',
  'ideas',
  'maintenance',
  'featureFlags',
]);

const ALLOWED_SETTINGS_KEYS = {
  general: new Set(['platformName', 'tagline', 'supportEmail', 'environment', 'copyright']),
  auth: new Set(['requireEmailVerification', 'allowRegistrations', 'minPasswordLength']),
  workspaces: new Set(['maxMembersPerOrg', 'maxOrgsPerUser', 'autoArchiveDays']),
  ideas: new Set(['maxIdeasPerUser', 'enableVoting', 'enableMvpSelection', 'enableSuggestions', 'enableComments']),
  maintenance: new Set(['maintenanceMode', 'maintenanceMessage']),
  featureFlags: new Set(['ideaImport', 'blueprint', 'resources', 'reports', 'analytics']),
};

/**
 * GET /api/admin/platform-settings
 */
adminRouter.get('/platform-settings', async (req, res) => {
  try {
    const settings = await rtdbService.getData('platform_settings');
    return res.json({
      success: true,
      data: settings || {},
    });
  } catch (error) {
    console.error('🚨 [adminRoutes] GET platform-settings error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'SETTINGS_READ_ERROR', message: 'Failed to retrieve platform settings.' },
    });
  }
});

/**
 * PATCH /api/admin/platform-settings
 */
adminRouter.patch('/platform-settings', async (req, res) => {
  try {
    const newSettings = req.body;
    if (!newSettings || typeof newSettings !== 'object') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Settings payload must be a JSON object.' },
      });
    }

    // Strict Allowlist Validation: Reject unknown top-level sections or unexpected sub-keys
    const sanitizedPayload = {};

    for (const [sectionKey, sectionVal] of Object.entries(newSettings)) {
      if (sectionKey === 'updatedAt' || sectionKey === 'updatedBy') continue;

      if (!ALLOWED_SETTINGS_SECTIONS.has(sectionKey)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SETTING_SECTION',
            message: `Unknown or disallowed platform setting section '${sectionKey}'.`,
          },
        });
      }

      if (sectionVal && typeof sectionVal === 'object') {
        sanitizedPayload[sectionKey] = {};
        const allowedKeys = ALLOWED_SETTINGS_KEYS[sectionKey] || new Set();

        for (const [k, v] of Object.entries(sectionVal)) {
          if (!allowedKeys.has(k)) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'INVALID_SETTING_KEY',
                message: `Unknown or disallowed setting key '${k}' in section '${sectionKey}'.`,
              },
            });
          }
          sanitizedPayload[sectionKey][k] = v;
        }
      }
    }

    const timestamp = Date.now();
    const payloadToSave = {
      ...sanitizedPayload,
      updatedAt: timestamp,
      updatedBy: req.user.name || req.user.email || 'Admin',
    };

    await rtdbService.setData('platform_settings', payloadToSave);
    await logAdminAudit(req.user, 'UPDATE_PLATFORM_SETTINGS', 'platform_settings', 'Updated platform configuration settings.');

    return res.json({
      success: true,
      data: payloadToSave,
      message: 'Platform settings updated successfully.',
    });
  } catch (error) {
    console.error('🚨 [adminRoutes] PATCH platform-settings error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'SETTINGS_UPDATE_ERROR', message: 'Failed to update platform settings.' },
    });
  }
});

// =========================================================================
// 2. ANNOUNCEMENTS & BROADCASTS
// =========================================================================

/**
 * POST /api/admin/announcements
 */
adminRouter.post('/announcements', async (req, res) => {
  try {
    const { title, description, category, priority, targetAudience, isPinned, expireHours } = req.body;

    if (!title || !String(title).trim() || !description || !String(description).trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ANNOUNCEMENT', message: 'Announcement title and description are required.' },
      });
    }

    const id = `anc_${Date.now()}`;
    const timestamp = Date.now();
    let expiresAt = null;

    if (expireHours && Number(expireHours) > 0) {
      expiresAt = timestamp + Number(expireHours) * 3600 * 1000;
    }

    const announcementData = {
      id,
      title: String(title).trim(),
      description: String(description).trim(),
      category: category || 'Platform Update',
      priority: priority || 'Normal',
      targetAudience: targetAudience || 'Entire Platform',
      isPinned: Boolean(isPinned),
      expiresAt,
      createdBy: req.user.name || req.user.email || 'Admin',
      authorUid: req.user.uid,
      createdAt: timestamp,
    };

    await rtdbService.setData(`announcements/${id}`, announcementData);
    await logAdminAudit(req.user, 'CREATE_ANNOUNCEMENT', id, `Created announcement "${title}"`);

    return res.status(201).json({
      success: true,
      data: announcementData,
      message: 'Announcement published successfully.',
    });
  } catch (error) {
    console.error('🚨 [adminRoutes] POST announcement error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'ANNOUNCEMENT_CREATE_ERROR', message: 'Failed to create announcement.' },
    });
  }
});

/**
 * DELETE /api/admin/announcements/:id
 */
adminRouter.delete('/announcements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Announcement ID is required.' },
      });
    }

    await rtdbService.removeData(`announcements/${id}`);
    await logAdminAudit(req.user, 'DELETE_ANNOUNCEMENT', id, 'Deleted global announcement.');

    return res.json({
      success: true,
      message: 'Announcement deleted successfully.',
    });
  } catch (error) {
    console.error('🚨 [adminRoutes] DELETE announcement error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'ANNOUNCEMENT_DELETE_ERROR', message: 'Failed to delete announcement.' },
    });
  }
});

/**
 * PATCH /api/admin/announcements/:id/pin
 */
adminRouter.patch('/announcements/:id/pin', async (req, res) => {
  try {
    const { id } = req.params;
    const current = await rtdbService.getData(`announcements/${id}`);
    if (!current) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Announcement not found.' },
      });
    }

    const newPinned = !current.isPinned;
    await rtdbService.updateData(`announcements/${id}`, {
      isPinned: newPinned,
      updatedAt: Date.now(),
    });

    await logAdminAudit(req.user, 'TOGGLE_ANNOUNCEMENT_PIN', id, `Toggled pinned status to ${newPinned}`);

    return res.json({
      success: true,
      data: { isPinned: newPinned },
      message: `Announcement ${newPinned ? 'pinned' : 'unpinned'} successfully.`,
    });
  } catch (error) {
    console.error('🚨 [adminRoutes] PATCH announcement pin error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'ANNOUNCEMENT_PIN_ERROR', message: 'Failed to toggle announcement pin status.' },
    });
  }
});

/**
 * POST /api/admin/announcements/broadcast
 */
adminRouter.post('/announcements/broadcast', async (req, res) => {
  try {
    const { title, message, targetAudience } = req.body;
    if (!title || !String(title).trim() || !message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_BROADCAST', message: 'Broadcast title and message are required.' },
      });
    }

    const usersMap = await rtdbService.getData('users');
    if (!usersMap) {
      return res.json({ success: true, message: 'No users to broadcast to.' });
    }

    const userList = Object.values(usersMap).filter(Boolean);
    const timestamp = Date.now();
    const notifId = `notif_bcast_${timestamp}`;

    // Canonical in-app notification center delivery
    const userUids = userList.map((u) => u.uid).filter(Boolean);
    await notificationService.createNotificationsForRecipients(userUids, {
      notificationId: notifId,
      type: NOTIFICATION_TYPES.ADMIN_BROADCAST,
      title: String(title).trim(),
      body: String(message).trim(),
      actorId: 'system',
      actorName: req.user.name || req.user.email || 'Convia Admin',
      resourceType: 'system',
      resourceId: notifId,
      actionUrl: '/dashboard',
      createdAt: timestamp,
    });

    await logAdminAudit(req.user, 'BROADCAST_NOTIFICATION', notifId, `Broadcasted notification "${title}" to ${userList.length} users.`);

    return res.json({
      success: true,
      message: `Notification broadcasted to ${userList.length} users.`,
    });
  } catch (error) {
    console.error('🚨 [adminRoutes] POST broadcast error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'BROADCAST_ERROR', message: 'Failed to broadcast notification.' },
    });
  }
});

// =========================================================================
// 3. USER MODERATION
// =========================================================================

/**
 * POST /api/admin/users/:userId/suspend
 */
adminRouter.post('/users/:userId/suspend', async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!userId || !reason || !String(reason).trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'User ID and suspension reason are required.' },
      });
    }

    // Prevent suspending self
    if (userId === req.user.uid) {
      return res.status(400).json({
        success: false,
        error: { code: 'SELF_SUSPENSION_BLOCKED', message: 'Administrators cannot suspend their own account.' },
      });
    }

    const timestamp = Date.now();
    const updates = {
      isSuspended: true,
      suspendedReason: String(reason).trim(),
      suspendedBy: req.user.name || req.user.email || 'Admin',
      suspendedAt: timestamp,
      updatedAt: timestamp,
    };

    await rtdbService.updateData(`users/${userId}`, updates);
    await logAdminAudit(req.user, 'SUSPEND_USER', userId, `Suspended user. Reason: ${reason}`);

    return res.json({
      success: true,
      message: 'User account suspended successfully.',
    });
  } catch (error) {
    console.error('🚨 [adminRoutes] Suspend user error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'SUSPEND_ERROR', message: 'Failed to suspend user account.' },
    });
  }
});

/**
 * POST /api/admin/users/:userId/restore
 */
adminRouter.post('/users/:userId/restore', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'User ID is required.' },
      });
    }

    const timestamp = Date.now();
    await rtdbService.updateData(`users/${userId}`, {
      isSuspended: false,
      suspendedReason: null,
      suspendedBy: null,
      suspendedAt: null,
      updatedAt: timestamp,
    });

    await logAdminAudit(req.user, 'RESTORE_USER', userId, 'Restored full user account access.');

    return res.json({
      success: true,
      message: 'User account access restored successfully.',
    });
  } catch (error) {
    console.error('🚨 [adminRoutes] Restore user error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'RESTORE_ERROR', message: 'Failed to restore user account.' },
    });
  }
});

/**
 * POST /api/admin/users/:userId/note
 */
adminRouter.post('/users/:userId/note', async (req, res) => {
  try {
    const { userId } = req.params;
    const { noteText } = req.body;

    if (!userId || !noteText || !String(noteText).trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'User ID and note content are required.' },
      });
    }

    const noteId = `note_${Date.now()}`;
    const noteData = {
      noteId,
      adminUid: req.user.uid,
      adminName: req.user.name || req.user.email || 'Admin',
      content: String(noteText).trim(),
      createdAt: Date.now(),
    };

    await rtdbService.setData(`user_admin_notes/${userId}/${noteId}`, noteData);
    await logAdminAudit(req.user, 'USER_NOTE_ADDED', userId, 'Added administrative note.');

    return res.status(201).json({
      success: true,
      data: noteData,
      message: 'Admin note added successfully.',
    });
  } catch (error) {
    console.error('🚨 [adminRoutes] Add user note error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'NOTE_ERROR', message: 'Failed to add admin note.' },
    });
  }
});

/**
 * POST /api/admin/users/:userId/warning
 */
adminRouter.post('/users/:userId/warning', async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, severity = 'Medium' } = req.body;

    if (!userId || !reason || !String(reason).trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'User ID and warning reason are required.' },
      });
    }

    const warningId = `warn_${Date.now()}`;
    const timestamp = Date.now();

    const warningData = {
      warningId,
      adminUid: req.user.uid,
      adminName: req.user.name || req.user.email || 'Admin',
      reason: String(reason).trim(),
      severity,
      createdAt: timestamp,
    };

    await rtdbService.setData(`user_admin_warnings/${userId}/${warningId}`, warningData);

    const notifId = `notif_${timestamp}`;
    await notificationService.createNotification(userId, {
      notificationId: notifId,
      type: NOTIFICATION_TYPES.ADMIN_BROADCAST,
      title: `Official Warning (${severity} Severity)`,
      body: `Administrator notice: ${String(reason).trim()}`,
      actorId: 'system',
      actorName: req.user.name || req.user.email || 'Convia Admin',
      resourceType: 'system',
      resourceId: warningId,
      actionUrl: '/dashboard',
      createdAt: timestamp,
    });

    await logAdminAudit(req.user, 'ISSUE_WARNING', userId, `Issued ${severity} warning: ${reason}`);

    return res.status(201).json({
      success: true,
      data: warningData,
      message: 'Official warning issued successfully.',
    });
  } catch (error) {
    console.error('🚨 [adminRoutes] Issue warning error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'WARNING_ERROR', message: 'Failed to issue user warning.' },
    });
  }
});

/**
 * DELETE /api/admin/users/:userId
 */
adminRouter.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'User ID is required.' },
      });
    }

    if (userId === req.user.uid) {
      return res.status(400).json({
        success: false,
        error: { code: 'SELF_DELETE_BLOCKED', message: 'Administrators cannot delete their own account via admin route.' },
      });
    }

    await Promise.all([
      rtdbService.removeData(`users/${userId}`),
      rtdbService.removeData(`user_reports/${userId}`),
      rtdbService.removeData(`user_admin_notes/${userId}`),
      rtdbService.removeData(`user_admin_warnings/${userId}`),
      rtdbService.removeData(`user_notifications/${userId}`),
      rtdbService.removeData(`notifications/${userId}`),
    ]);

    await logAdminAudit(req.user, 'DELETE_USER', userId, 'Deleted user profile and moderation index records.');

    return res.json({
      success: true,
      message: 'User profile and associated administrative records deleted.',
    });
  } catch (error) {
    console.error('🚨 [adminRoutes] Delete user error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'USER_DELETE_ERROR', message: 'Failed to delete user.' },
    });
  }
});

// =========================================================================
// 4. WORKSPACE ADMINISTRATION
// =========================================================================

/**
 * POST /api/admin/workspaces/:workspaceId/archive
 */
adminRouter.post('/workspaces/:workspaceId/archive', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Workspace ID is required.' },
      });
    }

    const timestamp = Date.now();
    await rtdbService.updateData(`organizations/${workspaceId}`, {
      isArchived: true,
      archivedAt: timestamp,
      archivedBy: req.user.name || req.user.email || 'Admin',
      updatedAt: timestamp,
    });

    await logAdminAudit(req.user, 'ARCHIVE_WORKSPACE', workspaceId, 'Archived workspace.');

    return res.json({
      success: true,
      message: 'Workspace archived successfully.',
    });
  } catch (error) {
    console.error('🚨 [adminRoutes] Archive workspace error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'ARCHIVE_ERROR', message: 'Failed to archive workspace.' },
    });
  }
});

/**
 * POST /api/admin/workspaces/:workspaceId/restore
 */
adminRouter.post('/workspaces/:workspaceId/restore', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Workspace ID is required.' },
      });
    }

    const timestamp = Date.now();
    await rtdbService.updateData(`organizations/${workspaceId}`, {
      isArchived: false,
      archivedAt: null,
      archivedBy: null,
      updatedAt: timestamp,
    });

    await logAdminAudit(req.user, 'RESTORE_WORKSPACE', workspaceId, 'Restored workspace from archive.');

    return res.json({
      success: true,
      message: 'Workspace restored successfully.',
    });
  } catch (error) {
    console.error('🚨 [adminRoutes] Restore workspace error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'RESTORE_ERROR', message: 'Failed to restore workspace.' },
    });
  }
});

/**
 * POST /api/admin/workspaces/:workspaceId/lock
 */
adminRouter.post('/workspaces/:workspaceId/lock', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { reason } = req.body;

    if (!workspaceId || !reason || !String(reason).trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'Workspace ID and lock reason are required.' },
      });
    }

    const timestamp = Date.now();
    await rtdbService.updateData(`organizations/${workspaceId}`, {
      isLocked: true,
      lockReason: String(reason).trim(),
      lockedAt: timestamp,
      lockedBy: req.user.name || req.user.email || 'Admin',
      updatedAt: timestamp,
    });

    await logAdminAudit(req.user, 'LOCK_WORKSPACE', workspaceId, `Locked workspace. Reason: ${reason}`);

    return res.json({
      success: true,
      message: 'Workspace locked successfully.',
    });
  } catch (error) {
    console.error('🚨 [adminRoutes] Lock workspace error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'LOCK_ERROR', message: 'Failed to lock workspace.' },
    });
  }
});

/**
 * POST /api/admin/workspaces/:workspaceId/unlock
 */
adminRouter.post('/workspaces/:workspaceId/unlock', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Workspace ID is required.' },
      });
    }

    const timestamp = Date.now();
    await rtdbService.updateData(`organizations/${workspaceId}`, {
      isLocked: false,
      lockReason: null,
      lockedAt: null,
      lockedBy: null,
      updatedAt: timestamp,
    });

    await logAdminAudit(req.user, 'UNLOCK_WORKSPACE', workspaceId, 'Unlocked workspace.');

    return res.json({
      success: true,
      message: 'Workspace unlocked successfully.',
    });
  } catch (error) {
    console.error('🚨 [adminRoutes] Unlock workspace error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'UNLOCK_ERROR', message: 'Failed to unlock workspace.' },
    });
  }
});

/**
 * POST /api/admin/workspaces/:workspaceId/transfer-ownership
 */
adminRouter.post('/workspaces/:workspaceId/transfer-ownership', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { newOwnerUid, newOwnerName } = req.body;

    if (!workspaceId || !newOwnerUid) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'Workspace ID and new owner UID are required.' },
      });
    }

    const timestamp = Date.now();
    await rtdbService.updateData(`organizations/${workspaceId}`, {
      ownerId: newOwnerUid,
      ownerName: newOwnerName || 'Owner',
      updatedAt: timestamp,
    });

    await logAdminAudit(req.user, 'TRANSFER_OWNERSHIP', workspaceId, `Transferred ownership to ${newOwnerName} (${newOwnerUid})`);

    return res.json({
      success: true,
      message: 'Workspace ownership transferred successfully.',
    });
  } catch (error) {
    console.error('🚨 [adminRoutes] Transfer ownership error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'TRANSFER_ERROR', message: 'Failed to transfer workspace ownership.' },
    });
  }
});

/**
 * DELETE /api/admin/workspaces/:workspaceId
 */
adminRouter.delete('/workspaces/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Workspace ID is required.' },
      });
    }

    await Promise.all([
      rtdbService.removeData(`organizations/${workspaceId}`),
      rtdbService.removeData(`organization_members/${workspaceId}`),
      rtdbService.removeData(`ideas/${workspaceId}`),
      rtdbService.removeData(`tasks/${workspaceId}`),
      rtdbService.removeData(`blueprints/${workspaceId}`),
      rtdbService.removeData(`workspaceChats/${workspaceId}`),
    ]);

    await logAdminAudit(req.user, 'DELETE_WORKSPACE', workspaceId, 'Cascade deleted workspace and child subtrees.');

    return res.json({
      success: true,
      message: 'Workspace purged successfully.',
    });
  } catch (error) {
    console.error('🚨 [adminRoutes] Delete workspace error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'WORKSPACE_DELETE_ERROR', message: 'Failed to delete workspace.' },
    });
  }
});

// =========================================================================
// 5. REPORTS, RBAC MATRIX & FEATURED IDEAS
// =========================================================================

/**
 * PATCH /api/admin/reports/:reportId/status
 */
adminRouter.patch('/reports/:reportId/status', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { newStatus, targetUid } = req.body;

    if (!reportId || !newStatus) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'Report ID and new status are required.' },
      });
    }

    const timestamp = Date.now();
    const updates = {
      status: newStatus,
      updatedAt: timestamp,
    };

    await Promise.all([
      rtdbService.updateData(`reports/${reportId}`, updates),
      targetUid ? rtdbService.updateData(`user_reports/${targetUid}/${reportId}`, updates) : Promise.resolve(),
    ]);

    if (targetUid) {
      const notifId = `notif_${Date.now()}`;
      await notificationService.createNotification(targetUid, {
        notificationId: notifId,
        type: NOTIFICATION_TYPES.ADMIN_BROADCAST,
        title: 'Report Status Updated',
        body: `Your issue report (${reportId}) status has been updated to "${newStatus}".`,
        actorId: 'system',
        actorName: req.user.name || req.user.email || 'Convia Admin',
        resourceType: 'report',
        resourceId: reportId,
        actionUrl: '/dashboard',
        createdAt: timestamp,
      });
    }

    await logAdminAudit(req.user, 'UPDATE_REPORT_STATUS', reportId, `Updated status to "${newStatus}"`);

    return res.json({
      success: true,
      message: 'Report status updated successfully.',
    });
  } catch (error) {
    console.error('🚨 [adminRoutes] Update report status error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'REPORT_UPDATE_ERROR', message: 'Failed to update report status.' },
    });
  }
});

/**
 * PATCH /api/admin/rbac-roles/:roleId
 */
adminRouter.patch('/rbac-roles/:roleId', async (req, res) => {
  try {
    const { roleId } = req.params;
    const { permissions } = req.body;

    if (!roleId || !Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'Role ID and permissions array are required.' },
      });
    }

    const timestamp = Date.now();
    await rtdbService.updateData(`rbac_roles/${roleId}`, {
      permissions,
      updatedAt: timestamp,
      updatedBy: req.user.name || req.user.email || 'Admin',
    });

    await logAdminAudit(req.user, 'UPDATE_RBAC_ROLE', roleId, `Updated permission matrix for role "${roleId}".`);

    return res.json({
      success: true,
      message: `Role "${roleId}" permissions updated successfully.`,
    });
  } catch (error) {
    console.error('🚨 [adminRoutes] Update RBAC role error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'RBAC_UPDATE_ERROR', message: 'Failed to update role permissions.' },
    });
  }
});

/**
 * POST /api/admin/ideas/:ideaId/toggle-featured
 */
adminRouter.post('/ideas/:ideaId/toggle-featured', async (req, res) => {
  try {
    const { ideaId } = req.params;
    const { isPublic, orgId } = req.body;

    if (!ideaId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Idea ID is required.' },
      });
    }

    const path = isPublic || !orgId ? `publicIdeas/${ideaId}` : `ideas/${orgId}/${ideaId}`;
    const current = await rtdbService.getData(path);
    if (!current) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Idea not found.' },
      });
    }

    const newFeatured = !current.isFeatured;
    await rtdbService.updateData(path, {
      isFeatured: newFeatured,
      updatedAt: Date.now(),
    });

    await logAdminAudit(req.user, 'TOGGLE_FEATURED', ideaId, `Toggled featured status to ${newFeatured}`);

    return res.json({
      success: true,
      data: { isFeatured: newFeatured },
      message: `Idea featured status toggled to ${newFeatured}.`,
    });
  } catch (error) {
    console.error('🚨 [adminRoutes] Toggle featured idea error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'FEATURED_TOGGLE_ERROR', message: 'Failed to toggle featured status.' },
    });
  }
});
