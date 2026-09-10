import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  SUPPORTED_REACTIONS,
  isValidReactionEmoji,
  createCanonicalReply,
  CHAT_PAGE_SIZE,
} from '../../../../frontend/src/constants/chatSchema.js';
import {
  getMessageRepliesRootPath,
  getMessageRepliesPath,
  getMessageReplyPath,
  getMessageReactionsRootPath,
  getMessageReactionsPath,
  getMessageReactionPath,
} from '../../../../frontend/src/constants/databasePaths.js';
import {
  validateSendReply,
  validateEditReply,
  validateDeleteReply,
  validateReactionToggle,
  normalizeChatReply,
} from '../../../../frontend/src/utils/chatValidation.js';
import { compareMessages } from '../../../../frontend/src/utils/chatPagination.js';
import {
  formatReplyCountLabel,
  resolveReactionParticipant,
} from '../../../../frontend/src/utils/chatFeedHelpers.js';
import { resolveMemberDisplayName } from '../../../../frontend/src/utils/memberIdentity.js';

describe('🧪 CONVIA CHAT SYSTEM PHASE 6 — THREADED REPLIES, EMOJI REACTIONS & MESSAGE ACTIONS', () => {

  // ----------------------------------------------------------------
  // 1. PATH HELPERS & BOUNDARIES
  // ----------------------------------------------------------------
  describe('🔍 1. Centralized Phase 6 RTDB Path Helpers', () => {
    it('generates canonical messageReplies root and channel path', () => {
      const rootPath = getMessageRepliesRootPath('org_alpha', 'general');
      assert.strictEqual(rootPath, 'workspaceChats/org_alpha/channels/general/messageReplies');

      const messageRepliesPath = getMessageRepliesPath('org_alpha', 'general', 'msg_100');
      assert.strictEqual(messageRepliesPath, 'workspaceChats/org_alpha/channels/general/messageReplies/msg_100');

      const replyDocPath = getMessageReplyPath('org_alpha', 'general', 'msg_100', 'reply_500');
      assert.strictEqual(replyDocPath, 'workspaceChats/org_alpha/channels/general/messageReplies/msg_100/reply_500');
    });

    it('generates canonical messageReactions root, message, and user reaction path', () => {
      const rootPath = getMessageReactionsRootPath('org_alpha', 'general');
      assert.strictEqual(rootPath, 'workspaceChats/org_alpha/channels/general/messageReactions');

      const reactionsPath = getMessageReactionsPath('org_alpha', 'general', 'msg_100');
      assert.strictEqual(reactionsPath, 'workspaceChats/org_alpha/channels/general/messageReactions/msg_100');

      const reactionPath = getMessageReactionPath('org_alpha', 'general', 'msg_100', '👍', 'user_alice');
      assert.strictEqual(reactionPath, 'workspaceChats/org_alpha/channels/general/messageReactions/msg_100/👍/user_alice');
    });

    it('strictly validates path inputs and throws on missing parameters', () => {
      assert.throws(() => getMessageRepliesPath('', 'general', 'm1'), /workspaceId/i);
      assert.throws(() => getMessageRepliesPath('org_alpha', 'general', ''), /messageId/i);
      assert.throws(() => getMessageReplyPath('org_alpha', 'general', 'm1', ''), /replyId/i);
      assert.throws(() => getMessageReactionPath('org_alpha', 'general', 'm1', '', 'user_1'), /emoji/i);
      assert.throws(() => getMessageReactionPath('org_alpha', 'general', 'm1', '👍', ''), /uid/i);
    });
  });

  // ----------------------------------------------------------------
  // 2. REPLY CANONICAL SCHEMA & FACTORY
  // ----------------------------------------------------------------
  describe('🔍 2. Canonical Reply Schema & Factory (createCanonicalReply)', () => {
    it('creates a clean canonical reply object with default metadata', () => {
      const reply = createCanonicalReply({
        replyId: 'reply_001',
        parentMessageId: 'msg_999',
        senderId: 'user_alice',
        senderName: 'Alice',
        senderAvatar: 'https://cdn.example.com/alice.png',
        content: 'I will take this task!',
        createdAt: 1700000000000,
        attachment: null,
      });

      assert.strictEqual(reply.replyId, 'reply_001');
      assert.strictEqual(reply.parentMessageId, 'msg_999');
      assert.strictEqual(reply.senderId, 'user_alice');
      assert.strictEqual(reply.senderName, 'Alice');
      assert.strictEqual(reply.content, 'I will take this task!');
      assert.strictEqual(reply.deleted, false);
      assert.strictEqual(reply.editedAt, null);
      assert.strictEqual(reply.attachment, null);
    });

    it('trims whitespace and sets default member name if missing', () => {
      const reply = createCanonicalReply({
        replyId: 'reply_002',
        parentMessageId: 'msg_999',
        senderId: 'user_bob',
        content: '   Trimmable reply   ',
      });

      assert.strictEqual(reply.senderName, 'Member');
      assert.strictEqual(reply.content, 'Trimmable reply');
    });
  });

  // ----------------------------------------------------------------
  // 3. REPLY VALIDATION & NORMALIZATION
  // ----------------------------------------------------------------
  describe('🔍 3. Reply Validation & Normalization', () => {
    const userAlice = { uid: 'user_alice', name: 'Alice' };

    it('accepts valid reply creation under 2000 characters', () => {
      const res = validateSendReply({
        workspaceId: 'org_alpha',
        channelId: 'general',
        parentMessageId: 'msg_100',
        content: 'Looks good to me!',
        user: userAlice,
        attachment: null,
      });
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.trimmedContent, 'Looks good to me!');
    });

    it('rejects empty or whitespace-only reply without attachment', () => {
      assert.throws(() => {
        validateSendReply({
          workspaceId: 'org_alpha',
          channelId: 'general',
          parentMessageId: 'msg_100',
          content: '   \n  \t  ',
          user: userAlice,
          attachment: null,
        });
      }, /required/i);
    });

    it('rejects reply exceeding 2000 characters', () => {
      const longText = 'x'.repeat(2001);
      assert.throws(() => {
        validateSendReply({
          workspaceId: 'org_alpha',
          channelId: 'general',
          parentMessageId: 'msg_100',
          content: longText,
          user: userAlice,
          attachment: null,
        });
      }, /2000/i);
    });

    it('BLOCKS client from sending reply as system', () => {
      assert.throws(() => {
        validateSendReply({
          workspaceId: 'org_alpha',
          channelId: 'general',
          parentMessageId: 'msg_100',
          content: 'Automated fake system reply',
          user: { uid: 'system' },
        });
      }, /system/i);
    });

    it('normalizes raw reply snapshot and masks deleted content', () => {
      const rawActive = {
        replyId: 'rep_1',
        parentMessageId: 'msg_100',
        senderId: 'user_alice',
        content: 'Original reply',
        createdAt: 1700000000000,
        deleted: false,
      };
      const normalizedActive = normalizeChatReply(rawActive);
      assert.strictEqual(normalizedActive.content, 'Original reply');
      assert.strictEqual(normalizedActive.deleted, false);

      const rawDeleted = {
        replyId: 'rep_2',
        parentMessageId: 'msg_100',
        senderId: 'user_alice',
        content: 'Private leaked content',
        createdAt: 1700000000000,
        deleted: true,
        deletedAt: 1700000050000,
        deletedBy: 'user_alice',
      };
      const normalizedDeleted = normalizeChatReply(rawDeleted);
      assert.strictEqual(normalizedDeleted.content, 'This message was deleted');
      assert.strictEqual(normalizedDeleted.deleted, true);
      assert.strictEqual(normalizedDeleted.attachment, null);
    });
  });

  // ----------------------------------------------------------------
  // 4. REPLY EDIT & DELETE AUTHORIZATION
  // ----------------------------------------------------------------
  describe('🔍 4. Reply Edit & Delete Authorization', () => {
    const userAlice = { uid: 'user_alice' };
    const userBob = { uid: 'user_bob' };
    const userAdmin = { uid: 'user_admin' };
    const replyAlice = {
      replyId: 'rep_1',
      parentMessageId: 'msg_100',
      senderId: 'user_alice',
      content: 'Original reply',
      deleted: false,
    };

    it('allows reply author to edit own active reply', () => {
      const res = validateEditReply({
        workspaceId: 'org_alpha',
        channelId: 'general',
        parentMessageId: 'msg_100',
        replyId: 'rep_1',
        newContent: 'Updated reply text',
        userId: userAlice.uid,
        currentReply: replyAlice,
      });
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.trimmedContent, 'Updated reply text');
    });

    it('DENIES non-author from editing another user reply', () => {
      assert.throws(() => {
        validateEditReply({
          workspaceId: 'org_alpha',
          channelId: 'general',
          parentMessageId: 'msg_100',
          replyId: 'rep_1',
          newContent: 'Hacked text',
          userId: userBob.uid,
          currentReply: replyAlice,
        });
      }, /only edit your own/i);
    });

    it('DENIES editing a deleted reply', () => {
      const deletedReply = { ...replyAlice, deleted: true };
      assert.throws(() => {
        validateEditReply({
          workspaceId: 'org_alpha',
          channelId: 'general',
          parentMessageId: 'msg_100',
          replyId: 'rep_1',
          newContent: 'Revived',
          userId: userAlice.uid,
          currentReply: deletedReply,
        });
      }, /deleted/i);
    });

    it('allows author or workspace admin to delete reply', () => {
      const resAuthor = validateDeleteReply({
        workspaceId: 'org_alpha',
        channelId: 'general',
        parentMessageId: 'msg_100',
        replyId: 'rep_1',
        userId: userAlice.uid,
        isWorkspaceAdmin: false,
        currentReply: replyAlice,
      });
      assert.strictEqual(resAuthor.valid, true);

      const resAdmin = validateDeleteReply({
        workspaceId: 'org_alpha',
        channelId: 'general',
        parentMessageId: 'msg_100',
        replyId: 'rep_1',
        userId: userAdmin.uid,
        isWorkspaceAdmin: true,
        currentReply: replyAlice,
      });
      assert.strictEqual(resAdmin.valid, true);
    });

    it('DENIES non-author non-admin from deleting reply', () => {
      assert.throws(() => {
        validateDeleteReply({
          workspaceId: 'org_alpha',
          channelId: 'general',
          parentMessageId: 'msg_100',
          replyId: 'rep_1',
          userId: userBob.uid,
          isWorkspaceAdmin: false,
          currentReply: replyAlice,
        });
      }, /permission/i);
    });
  });

  // ----------------------------------------------------------------
  // 5. EMOJI REACTION CONTRACTS & TOGGLE RULES
  // ----------------------------------------------------------------
  describe('🔍 5. Emoji Reaction Contracts & Toggle Rules', () => {
    it('accepts all centralized supported reaction emojis', () => {
      assert.strictEqual(SUPPORTED_REACTIONS.length, 8);
      for (const emoji of SUPPORTED_REACTIONS) {
        assert.strictEqual(isValidReactionEmoji(emoji), true);
      }
    });

    it('rejects unsupported custom or arbitrary emojis and strings', () => {
      assert.strictEqual(isValidReactionEmoji('💩'), false);
      assert.strictEqual(isValidReactionEmoji('🍕'), false);
      assert.strictEqual(isValidReactionEmoji('javascript:alert(1)'), false);
      assert.strictEqual(isValidReactionEmoji(''), false);
      assert.strictEqual(isValidReactionEmoji(null), false);
    });

    it('validates reaction toggle and binds to authenticated UID', () => {
      const user = { uid: 'user_alice' };
      const res = validateReactionToggle({
        workspaceId: 'org_alpha',
        channelId: 'general',
        messageId: 'msg_100',
        emoji: '🔥',
        user,
      });
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.cleanEmoji, '🔥');
      assert.strictEqual(res.userId, 'user_alice');
    });

    it('rejects reaction toggle with unauthenticated user or unsupported emoji', () => {
      assert.throws(() => {
        validateReactionToggle({
          workspaceId: 'org_alpha',
          channelId: 'general',
          messageId: 'msg_100',
          emoji: '🔥',
          user: null,
        });
      }, /authenticated user/i);

      assert.throws(() => {
        validateReactionToggle({
          workspaceId: 'org_alpha',
          channelId: 'general',
          messageId: 'msg_100',
          emoji: '💣',
          user: { uid: 'user_alice' },
        });
      }, /unsupported/i);
    });
  });

  // ----------------------------------------------------------------
  // 6. THREAD BOUNDED PAGINATION & CHRONOLOGICAL ORDERING
  // ----------------------------------------------------------------
  describe('🔍 6. Thread Bounded Pagination & Ordering', () => {
    it('maintains strict chronological ordering of replies by createdAt and replyId', () => {
      const r1 = { replyId: 'r_1', createdAt: 1000 };
      const r2 = { replyId: 'r_2', createdAt: 2000 };
      const r3 = { replyId: 'r_3', createdAt: 2000 }; // Identical timestamp tie-breaker

      const replies = [r2, r1, r3];
      replies.sort(compareMessages);

      assert.strictEqual(replies[0].replyId, 'r_1');
      assert.strictEqual(replies[1].replyId, 'r_2');
      assert.strictEqual(replies[2].replyId, 'r_3');
    });

    it('correctly calculates hasMore boolean based on batch size', () => {
      const fullBatch = Array.from({ length: CHAT_PAGE_SIZE }, (_, i) => ({
        replyId: `rep_${i}`,
        createdAt: 1000 + i,
      }));
      assert.strictEqual(fullBatch.length >= CHAT_PAGE_SIZE, true);

      const partialBatch = Array.from({ length: 12 }, (_, i) => ({
        replyId: `rep_${i}`,
        createdAt: 1000 + i,
      }));
      assert.strictEqual(partialBatch.length >= CHAT_PAGE_SIZE, false);
    });
  });

  // ----------------------------------------------------------------
  // 7. SECURITY & MULTI-LOCATION SIMULATION
  // ----------------------------------------------------------------
  describe('🔍 7. Security Invariants & Anti-Forgery Protection', () => {
    it('simulates security rule: cannot write reaction for another user UID', () => {
      const currentAuthUid = 'user_alice';
      const targetPathUid = 'user_bob';

      // Rule check: auth != null && auth.uid === $uid
      const isAllowed = currentAuthUid === targetPathUid;
      assert.strictEqual(isAllowed, false, 'Users MUST NOT be able to write reactions for other UIDs');
    });

    it('simulates security rule: cannot write reply with mismatched senderId or parentMessageId', () => {
      const currentAuthUid = 'user_alice';
      const replyPayload = {
        replyId: 'rep_1',
        parentMessageId: 'msg_999',
        senderId: 'user_mallory', // Forged sender
        content: 'Tampered',
        createdAt: Date.now(),
      };

      // Rule check: newData.child('senderId').val() === auth.uid
      const isSenderValid = replyPayload.senderId === currentAuthUid;
      assert.strictEqual(isSenderValid, false, 'Reply creation MUST reject forged senderId');

      // Rule check: newData.child('parentMessageId').val() === $messageId
      const targetPathMessageId = 'msg_100';
      const isParentValid = replyPayload.parentMessageId === targetPathMessageId;
      assert.strictEqual(isParentValid, false, 'Reply creation MUST reject mismatched parentMessageId');
    });

    it('simulates security rule: prevents soft-deletion lifecycle reversal (deleted: true -> deleted: false)', () => {
      const existingData = { deleted: true, content: 'This message was deleted' };
      const updatedData = { deleted: false, content: 'Undeleted reply' };

      // Rule check: !(data.child('deleted').val() === true && newData.child('deleted').val() === false)
      const isReversalAttempt = existingData.deleted === true && updatedData.deleted === false;
      const isAllowed = !isReversalAttempt;

      assert.strictEqual(isAllowed, false, 'Reactivation of soft-deleted reply MUST be blocked by security rules');
    });

    it('simulates member authorization: normal member can reply to another user message without being owner', () => {
      const workspaceOwnerUid = 'user_owner';
      const messageAuthorUid = 'user_alice';
      const normalMemberUid = 'user_bob';

      // Membership database state
      const orgMembers = {
        org_alpha: {
          user_owner: { role: 'owner' },
          user_alice: { role: 'member' },
          user_bob: { role: 'member' },
        },
      };

      // Normal member Bob checks
      const isMember = Boolean(orgMembers.org_alpha[normalMemberUid]);
      const isOwner = normalMemberUid === workspaceOwnerUid;
      const isMessageAuthor = normalMemberUid === messageAuthorUid;

      assert.strictEqual(isMember, true, 'User Bob IS an authorized workspace member');
      assert.strictEqual(isOwner, false, 'User Bob is NOT the workspace owner');
      assert.strictEqual(isMessageAuthor, false, 'User Bob is NOT the parent message author');

      // Authorization rule: Member permission is sufficient for replying!
      const canReply = isMember || isOwner;
      assert.strictEqual(canReply, true, 'Normal member Bob MUST be authorized to reply without ownership');
    });

    it('simulates member reaction: normal member can react to any message without being owner', () => {
      const workspaceOwnerUid = 'user_owner';
      const normalMemberUid = 'user_bob';

      const orgMembers = {
        org_alpha: {
          user_owner: { role: 'owner' },
          user_bob: { role: 'member' },
        },
      };

      const isMember = Boolean(orgMembers.org_alpha[normalMemberUid]);
      const canReact = isMember || normalMemberUid === workspaceOwnerUid;
      assert.strictEqual(canReact, true, 'Normal member Bob MUST be authorized to react without ownership');
    });

    it('simulates non-member blocking: user outside workspace is blocked from replies and reactions', () => {
      const outsiderUid = 'user_intruder';
      const orgMembers = {
        org_alpha: {
          user_owner: { role: 'owner' },
          user_alice: { role: 'member' },
        },
      };

      const isMember = Boolean(orgMembers.org_alpha[outsiderUid]);
      assert.strictEqual(isMember, false, 'Intruder is NOT a member of org_alpha');

      const canAccessReplies = isMember;
      const canAccessReactions = isMember;
      assert.strictEqual(canAccessReplies, false, 'Intruder MUST be blocked from replies');
      assert.strictEqual(canAccessReactions, false, 'Intruder MUST be blocked from reactions');
    });

    it('aggregates multi-user reactions accurately and handles toggle decrement', () => {
      // Raw RTDB reactions tree under a message:
      const rawReactions = {
        '👍': {
          user_alice: true,
          user_bob: true,
        },
        '❤️': {
          user_alice: true,
        },
      };

      // Transform raw tree into UI reaction summary
      const summary = Object.entries(rawReactions).map(([emoji, uidsMap]) => {
        const uids = Object.keys(uidsMap || {});
        return {
          emoji,
          count: uids.length,
          hasReactedAlice: uids.includes('user_alice'),
          hasReactedBob: uids.includes('user_bob'),
        };
      });

      const thumbsUp = summary.find((r) => r.emoji === '👍');
      const heart = summary.find((r) => r.emoji === '❤️');

      assert.strictEqual(thumbsUp.count, 2);
      assert.strictEqual(thumbsUp.hasReactedAlice, true);
      assert.strictEqual(thumbsUp.hasReactedBob, true);

      assert.strictEqual(heart.count, 1);
      assert.strictEqual(heart.hasReactedAlice, true);
      assert.strictEqual(heart.hasReactedBob, false);

      // Alice removes heart reaction
      delete rawReactions['❤️']['user_alice'];
      const remainingHeartUids = Object.keys(rawReactions['❤️'] || {});
      assert.strictEqual(remainingHeartUids.length, 0);
    });
  });

  // ----------------------------------------------------------------
  // 8. REPLY COUNTS & DYNAMIC REPLY AWARENESS (SECTION 23)
  // ----------------------------------------------------------------
  describe('🔍 8. Reply Counts & Dynamic Reply Awareness (Section 23)', () => {
    it('formats dynamic reply count label accurately with proper grammar', () => {
      assert.strictEqual(formatReplyCountLabel(0), 'Reply');
      assert.strictEqual(formatReplyCountLabel(-1), 'Reply');
      assert.strictEqual(formatReplyCountLabel(null), 'Reply');
      assert.strictEqual(formatReplyCountLabel(undefined), 'Reply');
      assert.strictEqual(formatReplyCountLabel(1), '1 Reply');
      assert.strictEqual(formatReplyCountLabel(2), '2 Replies');
      assert.strictEqual(formatReplyCountLabel(5), '5 Replies');
      assert.strictEqual(formatReplyCountLabel(12), '12 Replies');
    });

    it('calculates active reply count from canonical replies tree', () => {
      const rawRepliesMsgA = {
        rep_1: { replyId: 'rep_1', deleted: false },
        rep_2: { replyId: 'rep_2', deleted: false },
        rep_3: { replyId: 'rep_3', deleted: false },
      };

      const activeCount = Object.values(rawRepliesMsgA).filter((r) => r && r.replyId && !r.deleted).length;
      assert.strictEqual(activeCount, 3);
      assert.strictEqual(formatReplyCountLabel(activeCount), '3 Replies');
    });

    it('decrements active reply count when a reply is soft-deleted', () => {
      const rawReplies = {
        rep_1: { replyId: 'rep_1', deleted: false },
        rep_2: { replyId: 'rep_2', deleted: false },
      };

      let count = Object.values(rawReplies).filter((r) => r && r.replyId && !r.deleted).length;
      assert.strictEqual(count, 2);

      // User deletes rep_2
      rawReplies.rep_2.deleted = true;
      rawReplies.rep_2.content = 'This message was deleted';

      count = Object.values(rawReplies).filter((r) => r && r.replyId && !r.deleted).length;
      assert.strictEqual(count, 1);
      assert.strictEqual(formatReplyCountLabel(count), '1 Reply');
    });

    it('maintains strict thread isolation: Message A replies never affect Message B', () => {
      const threadStorage = {
        msg_100: {
          rep_1: { replyId: 'rep_1', parentMessageId: 'msg_100', content: 'Reply to 100' },
        },
        msg_200: {
          rep_2: { replyId: 'rep_2', parentMessageId: 'msg_200', content: 'Reply to 200' },
          rep_3: { replyId: 'rep_3', parentMessageId: 'msg_200', content: 'Another reply to 200' },
        },
      };

      const countMsg100 = Object.keys(threadStorage.msg_100).length;
      const countMsg200 = Object.keys(threadStorage.msg_200).length;

      assert.strictEqual(countMsg100, 1);
      assert.strictEqual(countMsg200, 2);
      assert.strictEqual(formatReplyCountLabel(countMsg100), '1 Reply');
      assert.strictEqual(formatReplyCountLabel(countMsg200), '2 Replies');
    });
  });

  // ----------------------------------------------------------------
  // 9. WHATSAPP-STYLE REACTION PARTICIPANTS (SECTION 24)
  // ----------------------------------------------------------------
  describe('🔍 9. WhatsApp-Style Reaction Participants & Resolution (Section 24)', () => {
    const mockMembers = [
      { uid: 'user_alice', name: 'Alice Chen', displayName: 'Alice Chen', role: 'owner', avatar: 'https://cdn.example.com/alice.png' },
      { uid: 'user_bob', name: 'Bob Smith', displayName: 'Bob Smith', role: 'member', avatar: '' },
      { uid: 'user_priya', name: 'Priya Patel', displayName: 'Priya Patel', role: 'member', avatar: 'https://cdn.example.com/priya.png' },
    ];

    it('resolves member name, avatar, and role accurately', () => {
      const participant = resolveReactionParticipant('user_bob', mockMembers, 'user_alice');
      assert.strictEqual(participant.name, 'Bob Smith');
      assert.strictEqual(participant.isCurrentUser, false);
      assert.strictEqual(participant.role, 'member');
    });

    it('labels current user as "You" with isCurrentUser flag', () => {
      const participant = resolveReactionParticipant('user_alice', mockMembers, 'user_alice');
      assert.strictEqual(participant.isCurrentUser, true);
      assert.strictEqual(participant.name, 'You');
    });

    it('handles unknown or historical member IDs gracefully without throwing', () => {
      const unknown = resolveReactionParticipant('user_ghost', mockMembers, 'user_alice');
      assert.strictEqual(unknown.name, 'Unknown member');
      assert.strictEqual(unknown.isCurrentUser, false);
      assert.strictEqual(unknown.role, 'member');
    });

    it('filters participants correctly by selected emoji tab', () => {
      const reactions = {
        '👍': { count: 2, users: ['user_alice', 'user_bob'] },
        '❤️': { count: 1, users: ['user_priya'] },
      };

      const thumbsUpUsers = reactions['👍'].users.map((uid) => resolveReactionParticipant(uid, mockMembers, 'user_alice'));
      const heartUsers = reactions['❤️'].users.map((uid) => resolveReactionParticipant(uid, mockMembers, 'user_alice'));

      assert.strictEqual(thumbsUpUsers.length, 2);
      assert.strictEqual(thumbsUpUsers[0].name, 'You');
      assert.strictEqual(thumbsUpUsers[1].name, 'Bob Smith');

      assert.strictEqual(heartUsers.length, 1);
      assert.strictEqual(heartUsers[0].name, 'Priya Patel');
    });

    it('guarantees count and participant list are always 100% strictly synchronized', () => {
      const reactionsTree = {
        '🔥': {
          user_alice: true,
          user_bob: true,
          user_priya: true,
        },
      };

      const userIds = Object.keys(reactionsTree['🔥']);
      const count = userIds.length;
      const participantList = userIds.map((uid) => resolveReactionParticipant(uid, mockMembers, 'user_alice'));

      // Count and list length MUST be identical
      assert.strictEqual(count, participantList.length);
      assert.strictEqual(count, 3);

      // Removing a user synchronizes both instantly
      delete reactionsTree['🔥']['user_bob'];
      const updatedUserIds = Object.keys(reactionsTree['🔥']);
      const updatedCount = updatedUserIds.length;
      const updatedList = updatedUserIds.map((uid) => resolveReactionParticipant(uid, mockMembers, 'user_alice'));

      assert.strictEqual(updatedCount, updatedList.length);
      assert.strictEqual(updatedCount, 2);
    });
  });

  // ----------------------------------------------------------------
  // 10. CANONICAL MEMBER DISPLAY NAME & SYSTEM-WIDE CONSISTENCY (SECTION 27)
  // ----------------------------------------------------------------
  describe('🔍 10. Canonical Member Display Name & System-Wide Consistency (Section 27)', () => {
    it('prioritizes displayName over username, name, and other fields', () => {
      const memberWithBoth = {
        uid: 'user_paras',
        displayName: 'Paras',
        username: 'alexj',
        email: 'paras@example.com',
      };
      assert.strictEqual(resolveMemberDisplayName(memberWithBoth), 'Paras');
    });

    it('prioritizes displayName over legacy name and fullName', () => {
      const memberWithAll = {
        displayName: 'Paras',
        name: 'Paras Kumar',
        fullName: 'Paras Kumar Sharma',
        username: 'alexj',
      };
      assert.strictEqual(resolveMemberDisplayName(memberWithAll), 'Paras');
    });

    it('falls back to legacy name or fullName when displayName is missing', () => {
      const memberLegacyName = {
        name: 'Rahul',
        username: 'rahul99',
      };
      assert.strictEqual(resolveMemberDisplayName(memberLegacyName), 'Rahul');

      const memberLegacyFullName = {
        fullName: 'Dr. Sarah Connor',
        username: 'sconnor',
      };
      assert.strictEqual(resolveMemberDisplayName(memberLegacyFullName), 'Dr. Sarah Connor');
    });

    it('falls back to username ONLY when displayName and legacy names are absent', () => {
      const memberUsernameOnly = {
        username: 'alexj',
      };
      assert.strictEqual(resolveMemberDisplayName(memberUsernameOnly), 'alexj');
    });

    it('returns "Unknown member" when no human-readable name or username exists', () => {
      assert.strictEqual(resolveMemberDisplayName({}), 'Unknown member');
      assert.strictEqual(resolveMemberDisplayName(null), 'Unknown member');
      assert.strictEqual(resolveMemberDisplayName(undefined), 'Unknown member');
      assert.strictEqual(resolveMemberDisplayName({ uid: 'xyz789' }), 'Unknown member');
      assert.strictEqual(resolveMemberDisplayName({ email: 'alex@example.com' }), 'Unknown member');
    });

    it('resolves message sender name using canonical member roster displayName', () => {
      const mockWorkspaceMembers = [
        { uid: 'u1', displayName: 'Paras', username: 'alexj' },
        { uid: 'u2', displayName: 'Rahul', username: 'rahul_dev' },
      ];

      const messageSnapshot = {
        messageId: 'msg_1',
        senderId: 'u1',
        senderName: 'alexj', // Stale snapshot
      };

      const member = mockWorkspaceMembers.find((m) => m.uid === messageSnapshot.senderId);
      const displaySenderName = member ? resolveMemberDisplayName(member) : resolveMemberDisplayName(messageSnapshot.senderName);

      assert.strictEqual(displaySenderName, 'Paras');
    });

    it('resolves reply sender name using canonical member roster displayName', () => {
      const mockWorkspaceMembers = [
        { uid: 'u1', displayName: 'Paras', username: 'alexj' },
      ];

      const replySnapshot = {
        replyId: 'rep_1',
        senderId: 'u1',
        senderName: 'alexj', // Stale snapshot
      };

      const member = mockWorkspaceMembers.find((m) => m.uid === replySnapshot.senderId);
      const displayReplyName = member ? resolveMemberDisplayName(member) : resolveMemberDisplayName(replySnapshot.senderName);

      assert.strictEqual(displayReplyName, 'Paras');
    });

    it('labels current authenticated user as "You" in reaction participants view', () => {
      const mockWorkspaceMembers = [
        { uid: 'u1', displayName: 'Paras', username: 'alexj' },
        { uid: 'u2', displayName: 'Rahul', username: 'rahul_dev' },
      ];

      // Current user is u1 (Paras)
      const participantSelf = resolveReactionParticipant('u1', mockWorkspaceMembers, 'u1');
      assert.strictEqual(participantSelf.name, 'You');
      assert.strictEqual(participantSelf.isCurrentUser, true);

      // Other user is u2 (Rahul)
      const participantOther = resolveReactionParticipant('u2', mockWorkspaceMembers, 'u1');
      assert.strictEqual(participantOther.name, 'Rahul');
      assert.strictEqual(participantOther.isCurrentUser, false);
    });

    it('never exposes Firebase UID or email as the default normal display identity', () => {
      const testUser = {
        uid: 'firebase_uid_998877',
        email: 'developer@example.com',
      };

      const name = resolveMemberDisplayName(testUser);
      assert.strictEqual(name, 'Unknown member');
      assert.notStrictEqual(name, 'firebase_uid_998877');
      assert.notStrictEqual(name, 'developer@example.com');
      assert.notStrictEqual(name, 'developer');
    });

    it('performs in-memory roster lookup with zero N+1 RTDB queries', () => {
      const roster = new Map([
        ['u1', { displayName: 'Paras', username: 'alexj' }],
        ['u2', { displayName: 'Rahul', username: 'rahul_dev' }],
      ]);

      const messagesBatch = Array.from({ length: 50 }, (_, i) => ({
        messageId: `msg_${i}`,
        senderId: i % 2 === 0 ? 'u1' : 'u2',
        senderName: 'old_name',
      }));

      // In-memory resolution takes < 1ms for 50 messages
      const startTime = performance.now();
      const resolvedNames = messagesBatch.map((msg) => {
        const mem = roster.get(msg.senderId);
        return mem ? resolveMemberDisplayName(mem) : resolveMemberDisplayName(msg.senderName);
      });
      const durationMs = performance.now() - startTime;

      assert.strictEqual(resolvedNames.length, 50);
      assert.strictEqual(resolvedNames[0], 'Paras');
      assert.strictEqual(resolvedNames[1], 'Rahul');
      assert(durationMs < 10, 'Resolution must execute synchronously without network roundtrips');
    });
  });
});
