import { rtdbService } from './rtdbService.js';
import { pushDeliveryService } from './pushDeliveryService.js';
import {
  NOTIFICATION_TYPES,
  createCanonicalNotification,
} from '../constants/notificationConstants.js';

/**
 * Convia Phase 7: Centralized Backend Notification Service.
 *
 * Responsibilities:
 * - Persistent creation of in-app notifications at canonical path: user_notifications/{recipientUid}/{notifId}
 * - Deterministic recipient resolution and workspace boundary isolation.
 * - Idempotent multi-path database writes.
 * - Non-blocking push delivery triggering.
 * - Fault tolerance: notification failures never break primary caller transactions.
 */
export const notificationService = {
  /**
   * Creates a single persistent notification record for a recipient.
   *
   * @param {string} recipientUid - Recipient Auth UID
   * @param {Object} payload - Notification details
   * @returns {Promise<Object|null>} Created notification record or null on error
   */
  createNotification: async (recipientUid, payload) => {
    if (!recipientUid || !payload) return null;

    // Suppress self-notification by default if actor matches recipient
    const actorUid = payload.actorId || payload.senderId;
    if (actorUid && actorUid !== 'system' && actorUid === recipientUid && !payload.allowSelfNotification) {
      return null;
    }

    try {
      const notifId = payload.notificationId || (payload.dedupeKey
        ? `notif_${String(payload.dedupeKey).replace(/[^a-zA-Z0-9_-]/g, '_')}`
        : `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
      const canonicalNotif = createCanonicalNotification({
        ...payload,
        notificationId: notifId,
        recipientId: recipientUid,
      });

      const notifPath = `user_notifications/${recipientUid}/${notifId}`;
      await rtdbService.setData(notifPath, canonicalNotif);

      // Trigger background push delivery (non-blocking)
      pushDeliveryService.sendPushNotification(recipientUid, canonicalNotif).catch((e) =>
        console.warn(`[notificationService] Push delivery warning for ${recipientUid}:`, e.message)
      );

      return canonicalNotif;
    } catch (err) {
      console.warn(`⚠️ [notificationService] Failed to create notification for ${recipientUid}:`, err.message);
      return null;
    }
  },

  /**
   * Creates notifications for multiple recipients atomically using RTDB multi-path update.
   *
   * @param {Array<string>} recipientUids - Array of recipient Auth UIDs
   * @param {Object} payload - Notification payload template
   * @returns {Promise<Array<Object>>} Array of created canonical notifications
   */
  createNotificationsForRecipients: async (recipientUids = [], payload = {}) => {
    const validUids = Array.from(new Set((recipientUids || []).filter((id) => id && typeof id === 'string'))).map((id) => id.trim());
    if (validUids.length === 0) return [];

    try {
      const updates = {};
      const createdList = [];
      const timestamp = Date.now();
      const baseDedupe = payload.notificationId || (payload.dedupeKey ? `notif_${String(payload.dedupeKey).replace(/[^a-zA-Z0-9_-]/g, '_')}` : null);

      for (const uid of validUids) {
        const notifId = baseDedupe
          ? `${baseDedupe}_${uid.replace(/[^a-zA-Z0-9_-]/g, '_')}`
          : `notif_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;
        const canonical = createCanonicalNotification({
          ...payload,
          notificationId: notifId,
          recipientId: uid,
          createdAt: timestamp,
        });

        updates[`user_notifications/${uid}/${notifId}`] = canonical;
        createdList.push(canonical);
      }

      if (Object.keys(updates).length > 0) {
        await rtdbService.updateData('/', updates);
      }

      // Asynchronously invoke push delivery for recipients
      Promise.all(
        createdList.map((notif) =>
          pushDeliveryService.sendPushNotification(notif.recipientId, notif).catch((pushErr) => {
            console.warn(`[notificationService] Push delivery warning for ${notif.recipientId}:`, pushErr?.message);
          })
        )
      ).catch((e) => console.warn('[notificationService] Push broadcast warning:', e?.message));

      return createdList;
    } catch (err) {
      console.warn('⚠️ [notificationService] Bulk notification update error:', err.message);
      return [];
    }
  },

  /**
   * Resolves eligible member UIDs for a workspace, strictly excluding the actor.
   *
   * @param {string} workspaceId - Target Workspace / Org ID
   * @param {string|null} [actorUid=null] - Triggering user UID to exclude
   * @returns {Promise<Array<string>>} Array of authorized member UIDs
   */
  resolveWorkspaceRecipients: async (workspaceId, actorUid = null) => {
    if (!workspaceId) return [];

    try {
      const cleanWorkspaceId = String(workspaceId).trim();
      const [orgMembers, orgDoc] = await Promise.all([
        rtdbService.getData(`organization_members/${cleanWorkspaceId}`).catch(() => null),
        rtdbService.getData(`organizations/${cleanWorkspaceId}`).catch(() => null),
      ]);

      const memberUids = new Set();

      if (orgMembers && typeof orgMembers === 'object') {
        Object.keys(orgMembers).forEach((uid) => memberUids.add(uid));
      }
      if (orgDoc && typeof orgDoc === 'object') {
        if (orgDoc.ownerId) memberUids.add(orgDoc.ownerId);
        if (orgDoc.createdBy) memberUids.add(orgDoc.createdBy);
        if (orgDoc.members && typeof orgDoc.members === 'object') {
          Object.keys(orgDoc.members).forEach((uid) => memberUids.add(uid));
        }
      }

      // Strictly exclude actor from receiving their own notification
      if (actorUid) {
        memberUids.delete(String(actorUid).trim());
      }

      return Array.from(memberUids);
    } catch (err) {
      console.warn(`⚠️ [notificationService] resolveWorkspaceRecipients error for ${workspaceId}:`, err.message);
      return [];
    }
  },

  /**
   * Dispatches a high-level notification event across Convia.
   *
   * @param {string} eventType - Canonical NOTIFICATION_TYPES
   * @param {Object} eventData - Contextual event details
   * @param {Object|null} [actorUser=null] - Actor who triggered the event
   * @returns {Promise<Array<Object>>} Created notifications
   */
  dispatchNotificationEvent: async (eventType, eventData, actorUser = null) => {
    if (!eventType || !eventData) return [];

    const actorUid = actorUser?.uid || eventData.actorId || eventData.senderId || 'system';
    const actorName = actorUser?.displayName || actorUser?.name || eventData.actorName || eventData.senderName || 'Member';
    const actorAvatar = actorUser?.photoURL || actorUser?.avatar || eventData.actorAvatar || '';

    try {
      switch (eventType) {
        // -------------------------------------------------------------
        // 1. BLUEPRINT EVENTS
        // -------------------------------------------------------------
        case NOTIFICATION_TYPES.BLUEPRINT_COMPLETED: {
          const { workspaceId, version, ideaTitle, mvpIdeaId, resourceId, secondaryEntityId, initiatorUid, dedupeKey: customDedupe } = eventData;
          const targetInitiator = initiatorUid || actorUid;
          const resolvedResourceId = resourceId || (mvpIdeaId ? `bp_${workspaceId}_${mvpIdeaId}` : `bp_${workspaceId}`);
          const resolvedSecondaryId = secondaryEntityId || (version ? String(version) : '1.0');

          // Convia Phase 7B-2 Step 3: Default to generation initiator unless explicit recipients provided
          const targetRecipients = Array.isArray(eventData.recipients) && eventData.recipients.length > 0
            ? eventData.recipients
            : (targetInitiator && targetInitiator !== 'system' ? [targetInitiator] : []);

          if (targetRecipients.length === 0) return [];

          const baseDedupeKey = customDedupe || `bp_comp_${workspaceId}_${mvpIdeaId || 'mvp'}_${version || '1.0'}`;

          return await notificationService.createNotificationsForRecipients(targetRecipients, {
            type: NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
            workspaceId,
            orgId: workspaceId,
            title: `Blueprint v${version || '1.0'} Completed`,
            body: `AI Architecture Blueprint for "${ideaTitle || 'Workspace MVP'}" is ready for review.`,
            actorId: 'system',
            actorName: 'Convia AI Engine',
            entityType: 'blueprint',
            resourceType: 'blueprint',
            entityId: resolvedResourceId,
            resourceId: resolvedResourceId,
            secondaryEntityId: resolvedSecondaryId,
            actionUrl: `/workspaces/${workspaceId}/blueprint`,
            dedupeKey: baseDedupeKey,
            allowSelfNotification: true,
            metadata: {
              workspaceId,
              ideaId: mvpIdeaId || null,
              mvpIdeaId: mvpIdeaId || null,
              version: resolvedSecondaryId,
              secondaryEntityId: resolvedSecondaryId,
              generationId: eventData.attemptId || null,
              initiatorUid: targetInitiator,
            },
          });
        }

        case NOTIFICATION_TYPES.BLUEPRINT_FAILED: {
          const { workspaceId, ideaTitle, errorReason, mvpIdeaId, resourceId, initiatorUid, attemptId } = eventData;
          const targetInitiator = initiatorUid || actorUid;
          if (!targetInitiator || targetInitiator === 'system') return [];

          // Phase 7B-2 Step 5: Sanitize failure reason to eliminate internal errors, tokens, and stack traces
          let safeReason = 'Blueprint generation failed. Please try again.';
          if (errorReason && typeof errorReason === 'string') {
            const lower = errorReason.toLowerCase();
            const hasSensitiveData = lower.includes('key') ||
              lower.includes('token') ||
              lower.includes('secret') ||
              lower.includes('bearer') ||
              lower.includes('http://') ||
              lower.includes('https://') ||
              lower.includes('at ') ||
              lower.includes('node:') ||
              lower.includes('econnrefused') ||
              lower.includes('stack');

            if (!hasSensitiveData && errorReason.trim().length > 0) {
              safeReason = errorReason.trim().substring(0, 150);
            }
          }

          const resolvedResourceId = resourceId || (mvpIdeaId ? `bp_${workspaceId}_${mvpIdeaId}` : `bp_${workspaceId}`);
          const dedupeKey = `bp_fail_${workspaceId}_${mvpIdeaId || 'mvp'}_${attemptId || Date.now()}`;

          const notif = await notificationService.createNotification(targetInitiator, {
            type: NOTIFICATION_TYPES.BLUEPRINT_FAILED,
            workspaceId,
            orgId: workspaceId,
            title: 'Blueprint Generation Notice',
            body: `Generation for "${ideaTitle || 'Workspace MVP'}" could not be completed: ${safeReason}`,
            actorId: 'system',
            actorName: 'Convia AI Engine',
            entityType: 'blueprint',
            resourceType: 'blueprint',
            entityId: resolvedResourceId,
            resourceId: resolvedResourceId,
            actionUrl: `/workspaces/${workspaceId}/blueprint`,
            dedupeKey,
            allowSelfNotification: true,
            metadata: {
              workspaceId,
              ideaId: mvpIdeaId || null,
              errorReason: safeReason,
              attemptId: attemptId || null,
              initiatorUid: targetInitiator,
            },
          });
          return notif ? [notif] : [];
        }

        case NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED: {
          const { workspaceId, version, ideaTitle, creatorUid, mvpIdeaId, resourceId, secondaryEntityId, dedupeKey: customDedupe } = eventData;
          const resolvedResourceId = resourceId || (mvpIdeaId ? `bp_${workspaceId}_${mvpIdeaId}` : `bp_${workspaceId}`);
          const resolvedSecondaryId = secondaryEntityId || (version ? String(version) : '1.0');

          // Convia Phase 7B-2 Step 6: Target blueprint creator + eligible workspace members, excluding the approver (actorUid)
          const memberRecipients = await notificationService.resolveWorkspaceRecipients(workspaceId, actorUid);
          const allEligible = Array.from(new Set([
            ...(creatorUid ? [creatorUid] : []),
            ...memberRecipients,
          ])).filter((id) => id && id !== actorUid); // Strictly exclude approver via self-notification defense

          if (allEligible.length === 0) return [];

          const baseDedupeKey = customDedupe || `bp_appr_${workspaceId}_${mvpIdeaId || 'mvp'}_${version || '1.0'}`;

          return await notificationService.createNotificationsForRecipients(allEligible, {
            type: NOTIFICATION_TYPES.BLUEPRINT_VERSION_APPROVED,
            workspaceId,
            orgId: workspaceId,
            title: `Blueprint v${version || '1.0'} Approved`,
            body: `${actorName} approved Blueprint v${version || '1.0'}${ideaTitle ? ` for "${ideaTitle}"` : ''}.`,
            actorId: actorUid,
            actorName,
            actorAvatar,
            entityType: 'blueprint',
            resourceType: 'blueprint',
            entityId: resolvedResourceId,
            resourceId: resolvedResourceId,
            secondaryEntityId: resolvedSecondaryId,
            actionUrl: `/workspaces/${workspaceId}/blueprint`,
            dedupeKey: baseDedupeKey,
            metadata: {
              version: resolvedSecondaryId,
              secondaryEntityId: resolvedSecondaryId,
              workspaceId,
              ideaId: mvpIdeaId || null,
              approverUid: actorUid,
              creatorUid: creatorUid || null,
            },
          });
        }

        // -------------------------------------------------------------
        // 2. IDEA EVENTS
        // -------------------------------------------------------------
        case NOTIFICATION_TYPES.IDEA_CREATED: {
          const { workspaceId, ideaId, title } = eventData;
          const recipients = await notificationService.resolveWorkspaceRecipients(workspaceId, actorUid);

          return await notificationService.createNotificationsForRecipients(recipients, {
            type: NOTIFICATION_TYPES.IDEA_CREATED,
            workspaceId,
            orgId: workspaceId,
            title: 'New Proposal Posted',
            body: `${actorName} submitted proposal "${title || 'Untitled'}".`,
            actorId: actorUid,
            actorName,
            actorAvatar,
            resourceType: 'idea',
            resourceId: ideaId,
            actionUrl: `/workspaces/${workspaceId}/ideas/${ideaId}`,
            metadata: { ideaId, workspaceId },
          });
        }

        // -------------------------------------------------------------
        // 3. SUGGESTION EVENTS
        // -------------------------------------------------------------
        case NOTIFICATION_TYPES.IDEA_SUGGESTION_CREATED: {
          const { workspaceId, ideaId, ideaTitle, ideaAuthorId, suggestionSnippet, discussionId } = eventData;
          if (!ideaAuthorId || ideaAuthorId === actorUid) return [];

          const notif = await notificationService.createNotification(ideaAuthorId, {
            type: NOTIFICATION_TYPES.IDEA_SUGGESTION_CREATED,
            workspaceId,
            orgId: workspaceId,
            title: 'New Suggestion on your Proposal',
            body: `${actorName} suggested: "${suggestionSnippet || 'View suggestion'}"`,
            actorId: actorUid,
            actorName,
            actorAvatar,
            resourceType: 'suggestion',
            resourceId: discussionId || ideaId,
            actionUrl: workspaceId
              ? `/workspaces/${workspaceId}/ideas/${ideaId}?tab=suggestions&discussionId=${discussionId}`
              : `/explore?ideaId=${ideaId}&tab=suggestions`,
            metadata: { ideaId, discussionId, workspaceId },
          });
          return notif ? [notif] : [];
        }

        // -------------------------------------------------------------
        // 4. COMMENT EVENTS
        // -------------------------------------------------------------
        case NOTIFICATION_TYPES.COMMENT_CREATED: {
          const { workspaceId, ideaId, targetAuthorId, commentSnippet, discussionId, isReply } = eventData;
          if (!targetAuthorId || targetAuthorId === actorUid) return [];

          const notif = await notificationService.createNotification(targetAuthorId, {
            type: NOTIFICATION_TYPES.COMMENT_CREATED,
            workspaceId,
            orgId: workspaceId,
            title: isReply ? 'New Reply to your Discussion' : 'New Comment on your Proposal',
            body: `${actorName}: "${commentSnippet || 'View comment'}"`,
            actorId: actorUid,
            actorName,
            actorAvatar,
            resourceType: 'comment',
            resourceId: discussionId || ideaId,
            actionUrl: workspaceId
              ? `/workspaces/${workspaceId}/ideas/${ideaId}?tab=comments&discussionId=${discussionId}`
              : `/explore?ideaId=${ideaId}&tab=comments`,
            metadata: { ideaId, discussionId, workspaceId, isReply },
          });
          return notif ? [notif] : [];
        }

        // -------------------------------------------------------------
        // 5. QUESTION EVENTS
        // -------------------------------------------------------------
        case NOTIFICATION_TYPES.QUESTION_CREATED: {
          const { workspaceId, ideaId, targetAuthorId, questionSnippet, discussionId, isAnswer } = eventData;
          if (!targetAuthorId || targetAuthorId === actorUid) return [];

          const notif = await notificationService.createNotification(targetAuthorId, {
            type: NOTIFICATION_TYPES.QUESTION_CREATED,
            workspaceId,
            orgId: workspaceId,
            title: isAnswer ? 'Answer to your Question' : 'Question asked on your Proposal',
            body: `${actorName}: "${questionSnippet || 'View question'}"`,
            actorId: actorUid,
            actorName,
            actorAvatar,
            resourceType: 'question',
            resourceId: discussionId || ideaId,
            actionUrl: workspaceId
              ? `/workspaces/${workspaceId}/ideas/${ideaId}?tab=questions&discussionId=${discussionId}`
              : `/explore?ideaId=${ideaId}&tab=questions`,
            metadata: { ideaId, discussionId, workspaceId, isAnswer },
          });
          return notif ? [notif] : [];
        }

        // -------------------------------------------------------------
        // 6. CHAT EVENTS
        // -------------------------------------------------------------
        case NOTIFICATION_TYPES.CHAT_MESSAGE: {
          const { workspaceId, channelId = 'general', messageId, content, recipients = [], excludedUids = [] } = eventData;
          if (!workspaceId || !messageId) return [];

          let targetRecipients = recipients;
          if (!Array.isArray(targetRecipients) || targetRecipients.length === 0) {
            targetRecipients = await notificationService.resolveWorkspaceRecipients(workspaceId, actorUid);
          }

          const excludeSet = new Set([actorUid, ...(excludedUids || [])].filter(Boolean));
          const finalRecipients = targetRecipients.filter((uid) => !excludeSet.has(uid));
          if (finalRecipients.length === 0) return [];

          const activeChannel = (channelId || 'general').trim();
          const preview = (content || '').substring(0, 100);

          return await notificationService.createNotificationsForRecipients(finalRecipients, {
            type: NOTIFICATION_TYPES.CHAT_MESSAGE,
            workspaceId,
            orgId: workspaceId,
            channelId: activeChannel,
            title: `New message in #${activeChannel}`,
            body: `${actorName}: ${preview}`,
            previewText: content,
            actorId: actorUid,
            senderId: actorUid,
            actorName,
            senderName: actorName,
            actorAvatar,
            senderAvatar: actorAvatar,
            resourceType: 'chat_message',
            resourceId: messageId,
            actionUrl: `/workspaces/${workspaceId}/chat?channel=${activeChannel}&messageId=${messageId}`,
            metadata: { channelId: activeChannel, messageId, workspaceId },
            dedupeKey: `chat_msg_${workspaceId}_${activeChannel}_${messageId}_${actorUid}`,
          });
        }

        case NOTIFICATION_TYPES.CHAT_MENTION:
        case NOTIFICATION_TYPES.MENTION: {
          const { workspaceId, channelId = 'general', messageId, content, mentionedUids = [], parentMessageId = null } = eventData;
          if (!workspaceId || !messageId) return [];

          const validMentioned = Array.from(new Set(
            (mentionedUids || [])
              .filter((uid) => uid && uid !== actorUid)
              .map((uid) => String(uid).trim())
          ));
          if (validMentioned.length === 0) return [];

          const activeChannel = (channelId || 'general').trim();
          const preview = (content || '').substring(0, 100);
          const deepLink = parentMessageId
            ? `/workspaces/${workspaceId}/chat?channel=${activeChannel}&threadId=${parentMessageId}&replyId=${messageId}`
            : `/workspaces/${workspaceId}/chat?channel=${activeChannel}&messageId=${messageId}`;

          return await notificationService.createNotificationsForRecipients(validMentioned, {
            type: NOTIFICATION_TYPES.CHAT_MENTION,
            workspaceId,
            orgId: workspaceId,
            channelId: activeChannel,
            title: `${actorName} mentioned you in #${activeChannel}`,
            body: `${actorName}: ${preview}`,
            previewText: content,
            actorId: actorUid,
            senderId: actorUid,
            actorName,
            senderName: actorName,
            actorAvatar,
            senderAvatar: actorAvatar,
            resourceType: 'chat_mention',
            resourceId: messageId,
            secondaryEntityId: parentMessageId || null,
            actionUrl: deepLink,
            metadata: { channelId: activeChannel, messageId, parentMessageId, workspaceId },
            dedupeKey: `chat_mention_${workspaceId}_${activeChannel}_${messageId}_${actorUid}`,
          });
        }

        case NOTIFICATION_TYPES.MESSAGE_REPLY:
        case NOTIFICATION_TYPES.CHAT_REPLY: {
          const { workspaceId, channelId = 'general', parentMessageId, replyId, content, parentAuthorId, recipients = [] } = eventData;
          if (!workspaceId || !parentMessageId || !replyId) return [];

          let targetRecipients = recipients;
          if (!Array.isArray(targetRecipients) || targetRecipients.length === 0) {
            targetRecipients = parentAuthorId ? [parentAuthorId] : [];
          }

          const validRecipients = Array.from(new Set(
            targetRecipients
              .filter((uid) => uid && uid !== actorUid)
              .map((uid) => String(uid).trim())
          ));
          if (validRecipients.length === 0) return [];

          const activeChannel = (channelId || 'general').trim();
          const preview = (content || '').substring(0, 100);
          const deepLink = `/workspaces/${workspaceId}/chat?channel=${activeChannel}&threadId=${parentMessageId}&replyId=${replyId}`;

          return await notificationService.createNotificationsForRecipients(validRecipients, {
            type: NOTIFICATION_TYPES.MESSAGE_REPLY,
            workspaceId,
            orgId: workspaceId,
            channelId: activeChannel,
            title: `${actorName} replied to your message`,
            body: `${actorName}: ${preview}`,
            previewText: content,
            actorId: actorUid,
            senderId: actorUid,
            actorName,
            senderName: actorName,
            actorAvatar,
            senderAvatar: actorAvatar,
            resourceType: 'chat_reply',
            resourceId: replyId,
            secondaryEntityId: parentMessageId,
            actionUrl: deepLink,
            metadata: { channelId: activeChannel, parentMessageId, replyId, workspaceId },
            dedupeKey: `chat_reply_${workspaceId}_${activeChannel}_${parentMessageId}_${replyId}_${actorUid}`,
          });
        }

        // -------------------------------------------------------------
        // 7. WORKSPACE MEMBERSHIP EVENTS
        // -------------------------------------------------------------
        case NOTIFICATION_TYPES.WORKSPACE_MEMBER_JOINED: {
          const { workspaceId, memberUid, memberName } = eventData;
          const effectiveActorUid = actorUid !== 'system' ? actorUid : (memberUid || 'system');
          const effectiveActorName = actorName !== 'Member' ? actorName : (memberName || 'A new member');
          const recipients = await notificationService.resolveWorkspaceRecipients(workspaceId, effectiveActorUid);

          return await notificationService.createNotificationsForRecipients(recipients, {
            type: NOTIFICATION_TYPES.WORKSPACE_MEMBER_JOINED,
            workspaceId,
            orgId: workspaceId,
            title: 'New Member Joined Workspace',
            body: `${effectiveActorName} has joined the workspace.`,
            actorId: effectiveActorUid,
            actorName: effectiveActorName,
            actorAvatar,
            resourceType: 'workspace',
            resourceId: workspaceId,
            actionUrl: `/workspaces/${workspaceId}/members`,
            metadata: { workspaceId, memberUid: effectiveActorUid },
          });
        }

        case NOTIFICATION_TYPES.WORKSPACE_MEMBER_LEFT: {
          const { workspaceId, memberUid, memberName } = eventData;
          const effectiveActorUid = actorUid !== 'system' ? actorUid : (memberUid || 'system');
          const effectiveActorName = actorName !== 'Member' ? actorName : (memberName || 'A member');
          const recipients = await notificationService.resolveWorkspaceRecipients(workspaceId, effectiveActorUid);

          return await notificationService.createNotificationsForRecipients(recipients, {
            type: NOTIFICATION_TYPES.WORKSPACE_MEMBER_LEFT,
            workspaceId,
            orgId: workspaceId,
            title: 'Member Left Workspace',
            body: `${effectiveActorName} has left the workspace.`,
            actorId: effectiveActorUid,
            actorName: effectiveActorName,
            actorAvatar,
            resourceType: 'workspace',
            resourceId: workspaceId,
            actionUrl: `/workspaces/${workspaceId}/members`,
            metadata: { workspaceId, memberUid: effectiveActorUid },
          });
        }

        // -------------------------------------------------------------
        // 8. SYSTEM / ADMIN EVENTS
        // -------------------------------------------------------------
        case NOTIFICATION_TYPES.ADMIN_BROADCAST: {
          const { title, message, body, recipients = [], severity, actionUrl } = eventData;
          const cleanTitle = title || 'System Announcement';
          const cleanBody = body || message || 'An administrative broadcast was posted.';

          return await notificationService.createNotificationsForRecipients(recipients, {
            type: NOTIFICATION_TYPES.ADMIN_BROADCAST,
            title: cleanTitle,
            body: cleanBody,
            actorId: actorUid || 'system',
            actorName: actorName || 'Convia Admin',
            actorAvatar,
            resourceType: 'system',
            resourceId: 'admin_broadcast',
            actionUrl: actionUrl || '/dashboard',
            metadata: { severity: severity || 'info' },
          });
        }

        default:
          console.warn(`[notificationService] Unhandled eventType: ${eventType}`);
          return [];
      }
    } catch (err) {
      console.warn(`⚠️ [notificationService] dispatchNotificationEvent error:`, err.message);
      return [];
    }
  },

  /**
   * Generalized recipient resolution engine for workspace events.
   *
   * Supports:
   * - SINGLE: single recipient ID
   * - MULTIPLE: explicit list of recipient IDs
   * - WORKSPACE_MEMBERS: all workspace members
   * - IDEA_AUTHOR: author of an idea
   * - MESSAGE_AUTHOR: author of a parent message
   * - MENTIONS: mentioned user UIDs
   *
   * In all cases, the triggering actor is strictly excluded from self-notification by default.
   */
  resolveRecipients: async ({
    workspaceId = null,
    actorUid = null,
    recipientType = 'WORKSPACE_MEMBERS',
    recipientId = null,
    recipientIds = [],
    ideaId = null,
    ideaAuthorId = null,
    parentMessageAuthorId = null,
    mentionedUids = [],
    allowSelfNotification = false,
  }) => {
    const recipients = new Set();

    switch (recipientType) {
      case 'SINGLE': {
        if (recipientId) recipients.add(String(recipientId).trim());
        break;
      }

      case 'MULTIPLE': {
        (recipientIds || []).forEach((id) => {
          if (id) recipients.add(String(id).trim());
        });
        break;
      }

      case 'IDEA_AUTHOR': {
        if (ideaAuthorId) {
          recipients.add(String(ideaAuthorId).trim());
        } else if (workspaceId && ideaId) {
          try {
            const ideaDoc = await rtdbService.getData(`ideas/${workspaceId}/${ideaId}`);
            if (ideaDoc?.authorId) recipients.add(String(ideaDoc.authorId).trim());
          } catch (e) {
            console.warn('[notificationService] Failed to resolve idea author:', e.message);
          }
        }
        break;
      }

      case 'MESSAGE_AUTHOR': {
        if (parentMessageAuthorId) {
          recipients.add(String(parentMessageAuthorId).trim());
        }
        break;
      }

      case 'MENTIONS': {
        (mentionedUids || []).forEach((id) => {
          if (id) recipients.add(String(id).trim());
        });
        break;
      }

      case 'WORKSPACE_MEMBERS':
      default: {
        if (workspaceId) {
          const wsRecipients = await notificationService.resolveWorkspaceRecipients(workspaceId, null);
          wsRecipients.forEach((id) => recipients.add(id));
        }
        break;
      }
    }

    // Strictly exclude the triggering actor unless explicitly allowed
    if (!allowSelfNotification && actorUid) {
      recipients.delete(String(actorUid).trim());
    }

    return Array.from(recipients);
  },

  /**
   * Fetches latest notifications for a user with pagination and unread filtering.
   *
   * @param {string} userId - User Auth UID
   * @param {Object} [options]
   * @param {number} [options.limit=50] - Maximum items to retrieve
   * @param {number|null} [options.beforeTimestamp=null] - Pagination cursor
   * @param {boolean} [options.unreadOnly=false] - Filter unread items only
   * @returns {Promise<Array<Object>>} Sorted notifications list (newest first)
   */
  fetchNotifications: async (userId, options = {}) => {
    if (!userId) return [];

    try {
      const cleanUid = String(userId).trim();
      const limit = Math.max(1, Math.min(100, Number(options.limit) || 50));
      const beforeTimestamp = options.beforeTimestamp ? Number(options.beforeTimestamp) : null;
      const unreadOnly = Boolean(options.unreadOnly);

      const rawVal = await rtdbService.getData(`user_notifications/${cleanUid}`);
      if (!rawVal || typeof rawVal !== 'object') return [];

      let list = Object.entries(rawVal)
        .map(([key, item]) => {
          if (!item || typeof item !== 'object') return null;
          return {
            ...item,
            id: item.id || item.notificationId || key,
            notificationId: item.notificationId || key,
          };
        })
        .filter(Boolean);

      if (unreadOnly) {
        list = list.filter((n) => !n.read);
      }

      if (beforeTimestamp) {
        list = list.filter((n) => (n.createdAt || 0) < beforeTimestamp);
      }

      // Newest notifications appear first
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      return list.slice(0, limit);
    } catch (err) {
      console.warn(`[notificationService] fetchNotifications error for ${userId}:`, err.message);
      return [];
    }
  },

  /**
   * Calculates unread notification count for a user without downloading unbounded history.
   *
   * @param {string} userId - User Auth UID
   * @returns {Promise<number>} Unread count
   */
  fetchUnreadCount: async (userId) => {
    if (!userId) return 0;

    try {
      const cleanUid = String(userId).trim();
      const rawVal = await rtdbService.getData(`user_notifications/${cleanUid}`);
      if (!rawVal || typeof rawVal !== 'object') return 0;

      let count = 0;
      for (const item of Object.values(rawVal)) {
        if (item && typeof item === 'object' && !item.read) {
          count++;
        }
      }
      return count;
    } catch (err) {
      console.warn(`[notificationService] fetchUnreadCount error for ${userId}:`, err.message);
      return 0;
    }
  },

  /**
   * Marks a single notification as read.
   *
   * @param {string} userId - User Auth UID
   * @param {string} notificationId - Notification ID
   * @returns {Promise<boolean>} Success flag
   */
  markNotificationAsRead: async (userId, notificationId) => {
    if (!userId || !notificationId) return false;

    try {
      const cleanUid = String(userId).trim();
      const cleanNotifId = String(notificationId).trim();
      await rtdbService.updateData(`user_notifications/${cleanUid}/${cleanNotifId}`, {
        read: true,
        readAt: Date.now(),
      });
      return true;
    } catch (err) {
      console.warn(`[notificationService] markNotificationAsRead error:`, err.message);
      return false;
    }
  },

  /**
   * Marks a single notification as unread.
   *
   * @param {string} userId - User Auth UID
   * @param {string} notificationId - Notification ID
   * @returns {Promise<boolean>} Success flag
   */
  markNotificationAsUnread: async (userId, notificationId) => {
    if (!userId || !notificationId) return false;

    try {
      const cleanUid = String(userId).trim();
      const cleanNotifId = String(notificationId).trim();
      await rtdbService.updateData(`user_notifications/${cleanUid}/${cleanNotifId}`, {
        read: false,
        readAt: null,
      });
      return true;
    } catch (err) {
      console.warn(`[notificationService] markNotificationAsUnread error:`, err.message);
      return false;
    }
  },

  /**
   * Marks all unread notifications as read for a user atomically.
   *
   * @param {string} userId - User Auth UID
   * @returns {Promise<number>} Number of marked notifications
   */
  markAllNotificationsAsRead: async (userId) => {
    if (!userId) return 0;

    try {
      const cleanUid = String(userId).trim();
      const rawVal = await rtdbService.getData(`user_notifications/${cleanUid}`);
      if (!rawVal || typeof rawVal !== 'object') return 0;

      const updates = {};
      const now = Date.now();
      let count = 0;

      for (const [notifId, item] of Object.entries(rawVal)) {
        if (item && typeof item === 'object' && !item.read) {
          updates[`user_notifications/${cleanUid}/${notifId}/read`] = true;
          updates[`user_notifications/${cleanUid}/${notifId}/readAt`] = now;
          count++;
        }
      }

      if (Object.keys(updates).length > 0) {
        await rtdbService.updateData('/', updates);
      }

      return count;
    } catch (err) {
      console.warn(`[notificationService] markAllNotificationsAsRead error:`, err.message);
      return 0;
    }
  },
};
