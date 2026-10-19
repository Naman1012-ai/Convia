import express from 'express';
import { rtdbService } from '../services/rtdbService.js';
import { requireWorkspaceMember } from '../utils/workspaceAuthHelper.js';
import { requireAuth, requirePlatformAdmin } from '../middleware/authMiddleware.js';

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

/**
 * GET /api/workspaces/:workspaceId/chat/channels/:channelId/pins
 * Retrieves all pinned messages in a workspace channel authoritatively via Admin SDK.
 */
chatRouter.get('/channels/:channelId/pins', async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.orgId;
    const channelId = req.params.channelId || 'general';
    const userUid = req.user?.uid;

    if (!userUid) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required.' } });
    }

    await requireWorkspaceMember(workspaceId, userUid);

    const rootPath = `workspaceChats/${workspaceId}/channels/${channelId}/pinnedMessages`;
    const pinsMap = (await rtdbService.getData(rootPath)) || {};

    const pinsList = Object.entries(pinsMap)
      .map(([k, v]) => ({ ...(typeof v === 'object' ? v : {}), messageId: v?.messageId || k }))
      .filter((p) => p && p.messageId)
      .sort((a, b) => (Number(b.pinnedAt) || 0) - (Number(a.pinnedAt) || 0));

    res.json({ success: true, data: pinsList });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: { message: err.message || 'Failed to retrieve pinned messages.' } });
  }
});

/**
 * POST /api/workspaces/:workspaceId/chat/channels/:channelId/pin
 * Authoritatively pins a message in a workspace channel (up to 3 pinned messages per channel).
 * Any active workspace member can pin a message.
 */
chatRouter.post('/channels/:channelId/pin', async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.orgId;
    const channelId = req.params.channelId || 'general';
    const userUid = req.user?.uid;
    const { messageId, message } = req.body || {};

    if (!userUid) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required.' } });
    }

    if (!messageId || typeof messageId !== 'string') {
      return res.status(400).json({ success: false, error: { message: 'Message ID is required.' } });
    }

    // Require user to be an active workspace member
    const membership = await requireWorkspaceMember(workspaceId, userUid);

    // Enforce channel pin limit (maximum of 3 pinned messages per workspace channel)
    const pinsPath = `workspaceChats/${workspaceId}/channels/${channelId}/pinnedMessages`;
    const existingPins = (await rtdbService.getData(pinsPath)) || {};
    const pinKeys = Object.keys(existingPins);

    if (!existingPins[messageId] && pinKeys.length >= 3) {
      return res.status(400).json({
        success: false,
        error: { message: 'Maximum of 3 pinned messages allowed in this channel. Please unpin an older message first.' },
      });
    }

    const pinPayload = {
      messageId: messageId.trim(),
      pinnedBy: userUid,
      pinnedByName: req.user?.displayName || req.user?.name || membership.displayName || 'Member',
      content: String(message?.content || '').substring(0, 2000),
      senderId: String(message?.senderId || ''),
      senderName: String(message?.senderName || ''),
      pinnedAt: Date.now(),
    };

    await rtdbService.setData(`${pinsPath}/${messageId.trim()}`, pinPayload);

    // Optionally mirror isPinned flag onto the message node for direct query fast path
    const msgPath = `workspaceChats/${workspaceId}/channels/${channelId}/messages/${messageId.trim()}`;
    await rtdbService.updateData(msgPath, {
      isPinned: true,
      pinnedAt: pinPayload.pinnedAt,
    }).catch(() => {});

    res.json({ success: true, data: pinPayload });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: { message: err.message || 'Failed to pin message.' } });
  }
});

/**
 * DELETE /api/workspaces/:workspaceId/chat/channels/:channelId/pin/:messageId
 * Unpins a message from a workspace channel.
 */
chatRouter.delete('/channels/:channelId/pin/:messageId', async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.orgId;
    const channelId = req.params.channelId || 'general';
    const messageId = req.params.messageId;
    const userUid = req.user?.uid;

    if (!userUid) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required.' } });
    }

    if (!messageId) {
      return res.status(400).json({ success: false, error: { message: 'Message ID is required.' } });
    }

    await requireWorkspaceMember(workspaceId, userUid);

    const pinPath = `workspaceChats/${workspaceId}/channels/${channelId}/pinnedMessages/${messageId.trim()}`;
    await rtdbService.removeData(pinPath);

    // Optionally remove isPinned flag from message node
    const msgPath = `workspaceChats/${workspaceId}/channels/${channelId}/messages/${messageId.trim()}`;
    await rtdbService.updateData(msgPath, {
      isPinned: false,
    }).catch(() => {});

    res.json({ success: true, data: { messageId, unpinned: true } });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: { message: err.message || 'Failed to unpin message.' } });
  }
});

/**
 * GET /api/chat/community/pins (or /api/workspaces/:workspaceId/chat/community/pins)
 * Retrieves all pinned community discussions (up to 5) authoritatively via Admin SDK.
 */
chatRouter.get('/community/pins', async (req, res) => {
  try {
    const rootPath = 'publicChats/ideas/pinnedMessages';
    let pinsMap = (await rtdbService.getData(rootPath)) || {};

    // If multi-pin collection is empty, check legacy single pinned node
    if (!pinsMap || Object.keys(pinsMap).length === 0) {
      const legacyPin = await rtdbService.getData('publicChats/ideas/pinned');
      if (legacyPin && legacyPin.messageId) {
        pinsMap = { [legacyPin.messageId]: legacyPin };
      }
    }

    const pinsList = Object.entries(pinsMap)
      .map(([k, v]) => ({ ...(typeof v === 'object' ? v : {}), messageId: v?.messageId || k }))
      .filter((p) => p && p.messageId)
      .sort((a, b) => (Number(b.pinnedAt) || 0) - (Number(a.pinnedAt) || 0));

    res.json({ success: true, data: pinsList });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to retrieve pinned discussions.' } });
  }
});

/**
 * POST /api/chat/community/pin (or /api/workspaces/:workspaceId/chat/community/pin)
 * Pins a discussion in the public community channel (up to 5 discussions, Admin only).
 */
chatRouter.post('/community/pin', requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const userUid = req.user?.uid;
    const { messageId, message } = req.body || {};

    if (!userUid) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required.' } });
    }

    if (!messageId || typeof messageId !== 'string') {
      return res.status(400).json({ success: false, error: { message: 'Message ID is required.' } });
    }

    const rootPath = 'publicChats/ideas/pinnedMessages';
    const existingPins = (await rtdbService.getData(rootPath)) || {};
    const pinKeys = Object.keys(existingPins);

    if (!existingPins[messageId] && pinKeys.length >= 5) {
      return res.status(400).json({
        success: false,
        error: { message: 'Maximum of 5 pinned discussions allowed in the community channel. Please unpin an older discussion first.' },
      });
    }

    const pinPayload = {
      messageId: messageId.trim(),
      pinnedBy: userUid,
      pinnedByName: req.user?.displayName || req.user?.name || 'Admin',
      content: String(message?.content || '').substring(0, 2000),
      senderId: String(message?.senderId || message?.authorId || ''),
      senderName: String(message?.senderName || message?.authorName || ''),
      pinnedAt: Date.now(),
    };

    await rtdbService.setData(`${rootPath}/${messageId.trim()}`, pinPayload);
    await rtdbService.setData('publicChats/ideas/pinned', pinPayload).catch(() => {});
    await rtdbService.setData('publicChats/ideas/pinnedMessageId', messageId.trim()).catch(() => {});

    res.json({ success: true, data: pinPayload });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: { message: err.message || 'Failed to pin community discussion.' } });
  }
});

/**
 * DELETE /api/chat/community/pin/:messageId (or /api/workspaces/:workspaceId/chat/community/pin/:messageId)
 * Unpins a discussion from the public community channel (Admin only).
 */
chatRouter.delete('/community/pin/:messageId', requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const userUid = req.user?.uid;
    const messageId = req.params.messageId;

    if (!userUid) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required.' } });
    }

    if (!messageId) {
      return res.status(400).json({ success: false, error: { message: 'Message ID is required.' } });
    }

    await rtdbService.removeData(`publicChats/ideas/pinnedMessages/${messageId.trim()}`);

    // Synchronize legacy single-pinned paths with remaining pinned items
    try {
      const legacyPinnedId = await rtdbService.getData('publicChats/ideas/pinnedMessageId');
      if (legacyPinnedId === messageId.trim()) {
        const remainingPins = (await rtdbService.getData('publicChats/ideas/pinnedMessages')) || {};
        const remainingList = Object.values(remainingPins).sort((a, b) => (Number(b.pinnedAt) || 0) - (Number(a.pinnedAt) || 0));
        if (remainingList.length > 0) {
          await rtdbService.setData('publicChats/ideas/pinned', remainingList[0]).catch(() => {});
          await rtdbService.setData('publicChats/ideas/pinnedMessageId', remainingList[0].messageId).catch(() => {});
        } else {
          await rtdbService.removeData('publicChats/ideas/pinned').catch(() => {});
          await rtdbService.removeData('publicChats/ideas/pinnedMessageId').catch(() => {});
        }
      }
    } catch (_) {}

    res.json({ success: true, data: { messageId, unpinned: true } });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: { message: err.message || 'Failed to unpin community discussion.' } });
  }
});
