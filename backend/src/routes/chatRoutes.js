import express from 'express';
import { rtdbService } from '../services/rtdbService.js';
import { requireWorkspaceMember } from '../utils/workspaceAuthHelper.js';

export const chatRouter = express.Router({ mergeParams: true });

/**
 * Convia Phase 3 / Phase 9 Authoritative Chat Access & Privacy Router
 * Schema: /workspaceChats/{workspaceId}/channels/{channelId}/messages
 * Enforces historical privacy boundary: members cannot access messages before effectiveJoinedAt (join/rejoin).
 */

// Helper to determine member chat boundary
function resolveEffectiveJoinTime(membership) {
  const isPrivileged = Boolean(
    membership.isOwner ||
    membership.isTeamCaptain ||
    membership.isSecondOwner ||
    membership.role === 'team_captain' ||
    membership.role === 'admin'
  );
  if (isPrivileged) return 0; // Privileged roles have unrestricted historical visibility

  const effectiveJoinedAt =
    membership.memberRecord?.rejoinedAt ||
    membership.memberRecord?.joinedAt ||
    membership.joinedAt ||
    0;
  return effectiveJoinedAt;
}

/**
 * GET /api/workspaces/:workspaceId/chat/channels/:channelId/messages
 * Retrieves channel messages bounded by the member's join/rejoin timestamp.
 */
chatRouter.get('/channels/:channelId/messages', async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.orgId;
    const channelId = req.params.channelId || 'general';
    const userUid = req.user?.uid;

    if (!userUid) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required.' } });
    }

    const membership = await requireWorkspaceMember(workspaceId, userUid);
    const effectiveJoinedAt = resolveEffectiveJoinTime(membership);
    const isPrivileged = effectiveJoinedAt === 0;

    const pageSize = Math.max(1, Math.min(Number(req.query.pageSize) || 50, 100));
    const beforeMessageId = req.query.beforeMessageId ? String(req.query.beforeMessageId).trim() : null;

    const rawMessages = (await rtdbService.getData(`workspaceChats/${workspaceId}/channels/${channelId}/messages`)) || {};
    
    // Convert to array and filter out inaccessible messages
    const allMessages = Object.entries(rawMessages)
      .map(([key, msg]) => ({ ...(typeof msg === 'object' ? msg : {}), messageId: msg?.messageId || key }))
      .filter((msg) => {
        if (!msg || !msg.messageId) return false;
        if (!isPrivileged && typeof msg.createdAt === 'number' && msg.createdAt < effectiveJoinedAt) {
          return false;
        }
        return true;
      })
      .sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));

    // Handle cursor-based pagination
    let sliceMessages = allMessages;
    let hasMore = false;

    if (beforeMessageId) {
      const cursorIndex = allMessages.findIndex((m) => m.messageId === beforeMessageId);
      if (cursorIndex === -1) {
        sliceMessages = [];
      } else {
        const older = allMessages.slice(0, cursorIndex);
        sliceMessages = older.slice(Math.max(0, older.length - pageSize));
        hasMore = older.length > pageSize;
      }
    } else {
      sliceMessages = allMessages.slice(Math.max(0, allMessages.length - pageSize));
      hasMore = allMessages.length > pageSize;
    }

    const oldestKey = sliceMessages.length > 0 ? sliceMessages[0].messageId : null;
    const newestKey = sliceMessages.length > 0 ? sliceMessages[sliceMessages.length - 1].messageId : null;

    res.json({
      success: true,
      data: {
        messages: sliceMessages,
        hasMore,
        oldestKey,
        newestKey,
        count: sliceMessages.length,
      },
    });
  } catch (err) {
    const status = err.statusCode || (err.message.includes('Unauthorized') ? 403 : 500);
    res.status(status).json({
      success: false,
      error: { message: err.message || 'Failed to retrieve messages.' },
    });
  }
});

/**
 * GET /api/workspaces/:workspaceId/chat/channels/:channelId/messages/:messageId
 * Retrieves a single message, strictly rejecting pre-join access.
 */
chatRouter.get('/channels/:channelId/messages/:messageId', async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.orgId;
    const channelId = req.params.channelId || 'general';
    const messageId = req.params.messageId;
    const userUid = req.user?.uid;

    if (!userUid) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required.' } });
    }

    const membership = await requireWorkspaceMember(workspaceId, userUid);
    const effectiveJoinedAt = resolveEffectiveJoinTime(membership);
    const isPrivileged = effectiveJoinedAt === 0;

    const message = await rtdbService.getData(`workspaceChats/${workspaceId}/channels/${channelId}/messages/${messageId}`);
    if (!message) {
      return res.status(404).json({ success: false, error: { message: 'Message not found.' } });
    }

    if (!isPrivileged && typeof message.createdAt === 'number' && message.createdAt < effectiveJoinedAt) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied: message was created prior to your workspace membership.' },
      });
    }

    res.json({ success: true, data: message });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: { message: err.message } });
  }
});

/**
 * GET /api/workspaces/:workspaceId/chat/channels/:channelId/messages/:messageId/replies
 * Retrieves replies for a message, rejecting if parent is pre-join.
 */
chatRouter.get('/channels/:channelId/messages/:messageId/replies', async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.orgId;
    const channelId = req.params.channelId || 'general';
    const messageId = req.params.messageId;
    const userUid = req.user?.uid;

    if (!userUid) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required.' } });
    }

    const membership = await requireWorkspaceMember(workspaceId, userUid);
    const effectiveJoinedAt = resolveEffectiveJoinTime(membership);
    const isPrivileged = effectiveJoinedAt === 0;

    // Check parent message timestamp
    const parentMsg = await rtdbService.getData(`workspaceChats/${workspaceId}/channels/${channelId}/messages/${messageId}`);
    if (parentMsg && !isPrivileged && typeof parentMsg.createdAt === 'number' && parentMsg.createdAt < effectiveJoinedAt) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied: message was created prior to your workspace membership.' },
      });
    }

    const rawReplies = (await rtdbService.getData(`workspaceChats/${workspaceId}/channels/${channelId}/messageReplies/${messageId}`)) || {};
    const replies = Object.entries(rawReplies)
      .map(([key, rep]) => ({ ...(typeof rep === 'object' ? rep : {}), replyId: rep?.replyId || key }))
      .filter((rep) => {
        if (!isPrivileged && typeof rep.createdAt === 'number' && rep.createdAt < effectiveJoinedAt) {
          return false;
        }
        return true;
      })
      .sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));

    res.json({ success: true, data: replies });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: { message: err.message } });
  }
});
