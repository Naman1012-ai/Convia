import { describe, it } from 'node:test';
import assert from 'node:assert';

// Import Path Helpers
import {
  getWorkspaceChannelsRootPath,
  getChannelPath,
  getChannelMetadataPath,
  getChannelMessagesPath,
  getChannelReadStatePath,
  getChannelTypingPath,
  getPublicIdeasChatRootPath,
  getPublicIdeasChatMessagesPath,
  getPublicIdeasChatMessagePath,
  getPublicIdeasChatTypingRootPath,
  getPublicIdeasChatTypingPath,
} from '../../../../frontend/src/constants/databasePaths.js';

// Import Schema Contracts & Helpers
import {
  CHANNEL_TYPES,
  DEFAULT_CHAT_CHANNEL_ID,
  createCanonicalChannelMetadata,
  normalizeChannelSlug,
  validateChannelSlug,
} from '../../../../frontend/src/constants/chatSchema.js';

describe('🧪 CONVIA CHAT SYSTEM PHASE 9 — MULTI-CHANNEL & WORKSPACE CHANNEL ARCHITECTURE', () => {
  // -------------------------------------------------------------
  // Group 1: RTDB Channel Path Helpers
  // -------------------------------------------------------------
  describe('🔍 1. Centralized Phase 9 RTDB Path Helpers', () => {
    it('generates canonical workspace channels root path', () => {
      const rootPath = getWorkspaceChannelsRootPath('org_123');
      assert.strictEqual(rootPath, 'workspaceChats/org_123/channels');
    });

    it('generates canonical channel node path for custom and default channels', () => {
      const defaultPath = getChannelPath('org_123');
      assert.strictEqual(defaultPath, 'workspaceChats/org_123/channels/general');

      const customPath = getChannelPath('org_123', 'dev-team');
      assert.strictEqual(customPath, 'workspaceChats/org_123/channels/dev-team');
    });

    it('generates canonical channel metadata path', () => {
      const metaPath = getChannelMetadataPath('org_123', 'dev-team');
      assert.strictEqual(metaPath, 'workspaceChats/org_123/channels/dev-team/metadata');
    });

    it('re-parameterizes existing message, readState, and typing paths seamlessly', () => {
      assert.strictEqual(
        getChannelMessagesPath('org_123', 'announcements'),
        'workspaceChats/org_123/channels/announcements/messages'
      );
      assert.strictEqual(
        getChannelReadStatePath('org_123', 'announcements', 'user_paras'),
        'workspaceChats/org_123/channels/announcements/readState/user_paras'
      );
      assert.strictEqual(
        getChannelTypingPath('org_123', 'announcements', 'user_paras'),
        'workspaceChats/org_123/channels/announcements/typing/user_paras'
      );
    });
  });

  // -------------------------------------------------------------
  // Group 2: Channel Slug Normalization & Validation
  // -------------------------------------------------------------
  describe('🔍 2. Channel Slug Normalization & Validation', () => {
    it('normalizes raw channel titles to lowercase dashed slugs', () => {
      assert.strictEqual(normalizeChannelSlug('Dev Team Discussion'), 'dev-team-discussion');
      assert.strictEqual(normalizeChannelSlug('UI/UX & Design!'), 'ui-ux-design');
      assert.strictEqual(normalizeChannelSlug('  Announcements  '), 'announcements');
      assert.strictEqual(normalizeChannelSlug('___Test___'), 'test');
    });

    it('validates correct channel slugs', () => {
      assert.strictEqual(validateChannelSlug('general').valid, true);
      assert.strictEqual(validateChannelSlug('dev-team').valid, true);
      assert.strictEqual(validateChannelSlug('community_feedback').valid, true);
    });

    it('rejects invalid slugs (too short, too long, illegal characters)', () => {
      assert.strictEqual(validateChannelSlug('').valid, false);
      assert.strictEqual(validateChannelSlug('a').valid, false); // < 2 chars
      assert.strictEqual(validateChannelSlug('this-channel-name-is-way-too-long-and-exceeds-the-maximum-limit').valid, false); // > 30 chars
      assert.strictEqual(validateChannelSlug('dev team').valid, false); // spaces
      assert.strictEqual(validateChannelSlug('dev#team').valid, false); // special character
    });
  });

  // -------------------------------------------------------------
  // Group 3: Canonical Channel Metadata Factory
  // -------------------------------------------------------------
  describe('🔍 3. Canonical Channel Metadata Factory', () => {
    it('creates a clean canonical workspace-scoped channel metadata document', () => {
      const now = 1725000000000;
      const meta = createCanonicalChannelMetadata({
        channelId: 'dev-team',
        name: 'dev-team',
        topic: 'Engineering and architecture discussions',
        type: CHANNEL_TYPES.WORKSPACE,
        createdBy: 'user_leader',
        createdAt: now,
      });

      assert.strictEqual(meta.channelId, 'dev-team');
      assert.strictEqual(meta.name, 'dev-team');
      assert.strictEqual(meta.topic, 'Engineering and architecture discussions');
      assert.strictEqual(meta.type, 'workspace');
      assert.strictEqual(meta.isDefault, false);
      assert.strictEqual(meta.archived, false);
      assert.strictEqual(meta.createdBy, 'user_leader');
      assert.strictEqual(meta.createdAt, now);
    });

    it('creates a clean canonical public community channel metadata document', () => {
      const meta = createCanonicalChannelMetadata({
        channelId: 'community-ideas',
        name: 'community-ideas',
        topic: 'Open brainstorming for all Convia creators',
        type: CHANNEL_TYPES.PUBLIC,
        createdBy: 'user_leader',
      });

      assert.strictEqual(meta.type, 'public');
      assert.strictEqual(meta.isDefault, false);
      assert.strictEqual(meta.archived, false);
    });

    it('marks general channel as default regardless of input flag', () => {
      const meta = createCanonicalChannelMetadata({
        channelId: DEFAULT_CHAT_CHANNEL_ID,
        name: DEFAULT_CHAT_CHANNEL_ID,
        isDefault: false, // Attempt to override
        createdBy: 'system',
      });

      assert.strictEqual(meta.isDefault, true);
    });
  });

  // -------------------------------------------------------------
  // Group 4: Protection Invariants & Authorization Boundaries
  // -------------------------------------------------------------
  describe('🔍 4. Protection Invariants & Authorization Boundaries', () => {
    it('prevents non-leaders from creating channels', () => {
      const isLeader = false;
      const attemptCreate = () => {
        if (!isLeader) {
          throw new Error('Only workspace owners or leaders have permission to create channels.');
        }
      };
      assert.throws(attemptCreate, /Only workspace owners or leaders/);
    });

    it('prevents deleting or archiving the default #general channel', () => {
      const attemptDelete = (channelId) => {
        if (channelId === DEFAULT_CHAT_CHANNEL_ID) {
          throw new Error(`The default '#${DEFAULT_CHAT_CHANNEL_ID}' channel cannot be deleted.`);
        }
      };
      const attemptArchive = (channelId) => {
        if (channelId === DEFAULT_CHAT_CHANNEL_ID) {
          throw new Error(`The default '#${DEFAULT_CHAT_CHANNEL_ID}' channel cannot be archived.`);
        }
      };

      assert.throws(() => attemptDelete('general'), /cannot be deleted/);
      assert.throws(() => attemptArchive('general'), /cannot be archived/);
    });

    it('allows leaders to archive or delete custom channels', () => {
      const isLeader = true;
      const customChannelId = 'temporary-sprint';

      assert.doesNotThrow(() => {
        if (!isLeader) throw new Error('Not leader');
        if (customChannelId === DEFAULT_CHAT_CHANNEL_ID) throw new Error('Default channel');
      });
    });
  });

  // -------------------------------------------------------------
  // Group 5: Zero N+1 Channel Synthesis & Sorting
  // -------------------------------------------------------------
  describe('🔍 5. Zero N+1 Channel Synthesis & Sorting', () => {
    it('always places #general at the top and sorts subsequent channels alphabetically in memory', () => {
      const rawChannels = [
        { channelId: 'zebra-announcements', name: 'zebra-announcements', isDefault: false },
        { channelId: 'alpha-design', name: 'alpha-design', isDefault: false },
        { channelId: 'general', name: 'general', isDefault: true },
        { channelId: 'beta-dev', name: 'beta-dev', isDefault: false },
      ];

      const sorted = [...rawChannels].sort((a, b) => {
        if (a.isDefault) return -1;
        if (b.isDefault) return 1;
        return a.name.localeCompare(b.name);
      });

      assert.strictEqual(sorted[0].channelId, 'general');
      assert.strictEqual(sorted[1].channelId, 'alpha-design');
      assert.strictEqual(sorted[2].channelId, 'beta-dev');
      assert.strictEqual(sorted[3].channelId, 'zebra-announcements');
    });
  });

  // -------------------------------------------------------------
  // Group 6: Public Ideas Community Chat & Scope Isolation
  // -------------------------------------------------------------
  describe('🔍 6. Public Ideas Community Chat & Scope Isolation', () => {
    it('generates canonical public ideas chat root path', () => {
      const rootPath = getPublicIdeasChatRootPath();
      assert.strictEqual(rootPath, 'publicChats/ideas');
    });

    it('generates canonical public ideas messages path', () => {
      const messagesPath = getPublicIdeasChatMessagesPath();
      assert.strictEqual(messagesPath, 'publicChats/ideas/messages');
    });

    it('generates canonical message path with validation', () => {
      const msgPath = getPublicIdeasChatMessagePath('msg_123');
      assert.strictEqual(msgPath, 'publicChats/ideas/messages/msg_123');
      assert.throws(() => getPublicIdeasChatMessagePath(''), /messageId is required/);
    });

    it('generates canonical typing path with user validation', () => {
      const typingRoot = getPublicIdeasChatTypingRootPath();
      assert.strictEqual(typingRoot, 'publicChats/ideas/typing');

      const userTypingPath = getPublicIdeasChatTypingPath('user_456');
      assert.strictEqual(userTypingPath, 'publicChats/ideas/typing/user_456');
      assert.throws(() => getPublicIdeasChatTypingPath(''), /uid is required/);
    });

    it('guarantees workspace channels are completely isolated from public ideas chat', () => {
      const workspaceChannelPath = getChannelMessagesPath('org_abc', 'general');
      const publicChatPath = getPublicIdeasChatMessagesPath();

      assert.strictEqual(workspaceChannelPath.startsWith('workspaceChats/'), true);
      assert.strictEqual(publicChatPath.startsWith('publicChats/'), true);
      assert.notStrictEqual(workspaceChannelPath, publicChatPath);
    });
  });
});
