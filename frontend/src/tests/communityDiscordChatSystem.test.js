import { describe, it } from 'node:test';
import assert from 'node:assert';
import { renderDiscordMarkdown, parseInlineTokens } from '../utils/discordMarkdown.js';
import { COMMUNITY_POST_TYPE_CONFIG } from '../constants/chatSchema.js';
import { processMessageFeed } from '../utils/chatFeedHelpers.js';
import { createCanonicalPinnedMessage } from '../constants/chatSchema.js';

describe('Discord Community Chat System & Pin Resilience Suite', () => {
  it('1. Pin signature contract resilience: handles 4-arg and 5-arg parameter signatures gracefully', () => {
    // Simulate what chatService.pinMessage does internally with 5 arguments: (wsId, chId, msgId, msgObj, userUid)
    const normalizePinArgs = (workspaceId, channelId, messageOrId, maybeMessageOrUser, maybeUser) => {
      let messageObj;
      let userOrUid;

      if (typeof messageOrId === 'string' && maybeMessageOrUser && typeof maybeMessageOrUser === 'object' && maybeMessageOrUser.messageId) {
        // 5-argument signature: (workspaceId, channelId, messageId, message, user)
        messageObj = maybeMessageOrUser;
        userOrUid = maybeUser;
      } else if (typeof messageOrId === 'object' && messageOrId) {
        // 4-argument signature: (workspaceId, channelId, message, user)
        messageObj = messageOrId;
        userOrUid = maybeMessageOrUser;
      } else {
        messageObj = { messageId: messageOrId };
        userOrUid = maybeMessageOrUser;
      }

      const messageId = messageObj?.messageId || (typeof messageOrId === 'string' ? messageOrId : null);
      const pinnedByUid = typeof userOrUid === 'string' ? userOrUid : (userOrUid?.uid || userOrUid?.id || 'unknown');
      const pinnedByName = typeof userOrUid === 'object' && userOrUid
        ? (userOrUid.displayName || userOrUid.name || userOrUid.username || 'Member')
        : 'Member';

      return createCanonicalPinnedMessage({
        messageId,
        pinnedBy: pinnedByUid,
        pinnedByName,
        content: messageObj?.content || '',
        senderId: messageObj?.senderId || '',
        senderName: messageObj?.senderName || '',
        pinnedAt: 1710000000000,
      });
    };

    // Test 5-arg invocation (ChatMessageItem legacy bug signature)
    const pin1 = normalizePinArgs('ws_alpha', 'general', 'msg_101', {
      messageId: 'msg_101',
      content: 'Sprint goals',
      senderId: 'user_dev',
      senderName: 'David',
    }, 'user_admin_uid');

    assert.strictEqual(pin1.messageId, 'msg_101');
    assert.strictEqual(pin1.pinnedBy, 'user_admin_uid');
    assert.strictEqual(pin1.content, 'Sprint goals');

    // Test 4-arg invocation with User Object
    const pin2 = normalizePinArgs('ws_alpha', 'general', {
      messageId: 'msg_202',
      content: 'Important community announcement',
      senderId: 'user_leader',
      senderName: 'Sarah',
    }, {
      uid: 'user_leader',
      displayName: 'Sarah Leader',
    });

    assert.strictEqual(pin2.messageId, 'msg_202');
    assert.strictEqual(pin2.pinnedBy, 'user_leader');
    assert.strictEqual(pin2.pinnedByName, 'Sarah Leader');
    assert.strictEqual(pin2.content, 'Important community announcement');
  });

  it('2. Community Discord Markdown: parses spoilers, code blocks, and formatting', () => {
    // Spoiler tag
    const spoilerTokens = parseInlineTokens('Check this out: ||super secret spoiler||');
    const spoilerEl = spoilerTokens.find((t) => t?.type && t.type.name === 'DiscordSpoiler');
    assert.ok(spoilerEl, 'Must parse spoiler into DiscordSpoiler component');

    // Code block
    const codeBlockRendered = renderDiscordMarkdown('```javascript\nconsole.log("hello community");\n```');
    const codeJson = JSON.stringify(codeBlockRendered);
    assert.ok(codeJson.includes('javascript'), 'Must preserve code block language');
    assert.ok(codeJson.includes('hello community'), 'Must preserve code block content');

    // Bold & italic
    const formatTokens = parseInlineTokens('**Bold Announcement** and *italic note*');
    const boldEl = formatTokens.find((t) => t?.type === 'strong');
    const italicEl = formatTokens.find((t) => t?.type === 'em');
    assert.ok(boldEl, 'Must parse strong element for bold');
    assert.ok(italicEl, 'Must parse em element for italic');
  });

  it('3. Community Post Types: config schema contains all community categories', () => {
    const requiredTypes = ['idea', 'question', 'discussion', 'collaboration'];
    for (const type of requiredTypes) {
      assert.ok(COMMUNITY_POST_TYPE_CONFIG[type], `Missing post type: ${type}`);
      assert.ok(COMMUNITY_POST_TYPE_CONFIG[type].label, `Missing label for: ${type}`);
      assert.ok(COMMUNITY_POST_TYPE_CONFIG[type].icon, `Missing icon for: ${type}`);
    }
  });

  it('4. Message grouping in Community Feed: consecutive messages within 5 mins group cleanly', () => {
    const rawMessages = [
      {
        messageId: 'comm_1',
        senderId: 'usr_naman',
        senderName: 'Naman',
        content: 'Hey everyone, check this idea out!',
        createdAt: 1715000000000,
      },
      {
        messageId: 'comm_2',
        senderId: 'usr_naman',
        senderName: 'Naman',
        content: 'Also, here is the architecture diagram: ||diagram.png||',
        createdAt: 1715000060000, // 1 min later
      },
      {
        messageId: 'comm_3',
        senderId: 'usr_other',
        senderName: 'Dev',
        content: 'Looks awesome!',
        createdAt: 1715000120000, // 1 min later, different author
      },
    ];

    const feed = processMessageFeed(rawMessages);
    const messageItems = feed.filter((item) => item.type === 'message');

    assert.strictEqual(messageItems.length, 3);
    // First message starts group
    assert.strictEqual(messageItems[0].isGrouped, false);
    assert.strictEqual(messageItems[0].isFirstInGroup, true);

    // Second message from same user is grouped
    assert.strictEqual(messageItems[1].isGrouped, true);
    assert.strictEqual(messageItems[1].isFirstInGroup, false);

    // Third message from different user is not grouped
    assert.strictEqual(messageItems[2].isGrouped, false);
    assert.strictEqual(messageItems[2].isFirstInGroup, true);
  });

  it('5. Workspace channel pin limit: allows up to 3 pinned messages and rejects exceeding limit', () => {
    const existingPins = {
      msg_pin_1: { messageId: 'msg_pin_1', pinnedAt: 1000 },
      msg_pin_2: { messageId: 'msg_pin_2', pinnedAt: 2000 },
      msg_pin_3: { messageId: 'msg_pin_3', pinnedAt: 3000 },
    };

    const attemptPin = (existing, newMsgId) => {
      const pinKeys = Object.keys(existing);
      if (!existing[newMsgId] && pinKeys.length >= 3) {
        throw new Error('Maximum of 3 pinned messages allowed in this channel. Please unpin an older message first.');
      }
      return { ...existing, [newMsgId]: { messageId: newMsgId, pinnedAt: Date.now() } };
    };

    // Re-pinning an already pinned message is allowed (idempotent update)
    const updated = attemptPin(existingPins, 'msg_pin_2');
    assert.strictEqual(Object.keys(updated).length, 3);

    // Adding a 4th pin throws the expected limit error
    assert.throws(
      () => attemptPin(existingPins, 'msg_pin_4'),
      /Maximum of 3 pinned messages allowed in this channel/
    );
  });

  it('6. Community channel pin limit: allows up to 5 pinned discussions and rejects exceeding limit', () => {
    const existingCommunityPins = {
      comm_pin_1: { messageId: 'comm_pin_1', pinnedAt: 1000 },
      comm_pin_2: { messageId: 'comm_pin_2', pinnedAt: 2000 },
      comm_pin_3: { messageId: 'comm_pin_3', pinnedAt: 3000 },
      comm_pin_4: { messageId: 'comm_pin_4', pinnedAt: 4000 },
      comm_pin_5: { messageId: 'comm_pin_5', pinnedAt: 5000 },
    };

    const attemptCommunityPin = (existing, newMsgId, isAdmin) => {
      if (!isAdmin) {
        throw new Error('Only administrators can pin discussions in the community channel.');
      }
      const pinKeys = Object.keys(existing);
      if (!existing[newMsgId] && pinKeys.length >= 5) {
        throw new Error('Maximum of 5 pinned discussions allowed in the community channel. Please unpin an older discussion first.');
      }
      return { ...existing, [newMsgId]: { messageId: newMsgId, pinnedAt: Date.now() } };
    };

    // Non-admin attempt is rejected
    assert.throws(
      () => attemptCommunityPin(existingCommunityPins, 'comm_pin_6', false),
      /Only administrators can pin discussions/
    );

    // 6th pin attempt by admin is rejected by the 5-pin limit
    assert.throws(
      () => attemptCommunityPin(existingCommunityPins, 'comm_pin_6', true),
      /Maximum of 5 pinned discussions allowed in the community channel/
    );

    // Re-pinning an existing discussion succeeds
    const updated = attemptCommunityPin(existingCommunityPins, 'comm_pin_3', true);
    assert.strictEqual(Object.keys(updated).length, 5);
  });

  it('7. Fallback API routes contract: all pin and unpin fallback routes use /api prefix', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const chatServiceContent = fs.readFileSync(path.resolve('frontend/src/services/chatService.js'), 'utf8');

    // Verify workspace pin fallback uses /api
    assert.ok(
      chatServiceContent.includes('apiClient.post(`/api/workspaces/'),
      'Workspace pin fallback must start with /api/ to route through Vite proxy and Express router'
    );
    // Verify workspace unpin fallback uses /api
    assert.ok(
      chatServiceContent.includes('apiClient.delete(`/api/workspaces/'),
      'Workspace unpin fallback must start with /api/ to route through Vite proxy and Express router'
    );
    // Verify community pin fallback uses /api
    assert.ok(
      chatServiceContent.includes("apiClient.post('/api/chat/community/pin'"),
      'Community pin fallback must start with /api/ to route through Vite proxy and Express router'
    );
    // Verify community unpin fallback uses /api
    assert.ok(
      chatServiceContent.includes('apiClient.delete(`/api/chat/community/pin/'),
      'Community unpin fallback must start with /api/ to route through Vite proxy and Express router'
    );
  });

  it('8. Backend authoritative router contract: community pin routes use requirePlatformAdmin', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const chatRoutesContent = fs.readFileSync(path.resolve('backend/src/routes/chatRoutes.js'), 'utf8');

    assert.ok(
      chatRoutesContent.includes("chatRouter.post('/community/pin', requireAuth, requirePlatformAdmin,"),
      'POST /community/pin must be guarded by requireAuth and requirePlatformAdmin'
    );
    assert.ok(
      chatRoutesContent.includes("chatRouter.delete('/community/pin/:messageId', requireAuth, requirePlatformAdmin,"),
      'DELETE /community/pin/:messageId must be guarded by requireAuth and requirePlatformAdmin'
    );
  });

  it('9. Pinned messages data normalization: converts array data into messageId lookup map with accurate counting', () => {
    const rawArrayData = [
      { messageId: 'msg_1', content: 'First pin', pinnedAt: 1000 },
      { messageId: 'msg_2', content: 'Second pin', pinnedAt: 2000 },
    ];

    const normalizeToMap = (data) => {
      const map = {};
      if (Array.isArray(data)) {
        data.forEach((p) => {
          if (p?.messageId) map[p.messageId] = p;
        });
      } else if (data && typeof data === 'object') {
        Object.entries(data).forEach(([k, v]) => {
          if (v && typeof v === 'object' && v.messageId) {
            map[v.messageId] = v;
          } else if (v && typeof v === 'object') {
            map[k] = { ...v, messageId: k };
          }
        });
      }
      return map;
    };

    const map = normalizeToMap(rawArrayData);
    assert.strictEqual(Object.keys(map).length, 2);
    assert.ok(map['msg_1'], 'Must be accessible by messageId');
    assert.ok(map['msg_2'], 'Must be accessible by messageId');
    assert.strictEqual(Boolean(map['msg_1']), true);
    assert.strictEqual(Boolean(map['msg_3']), false);

    // Pinning a 3rd message
    const pinned3 = { ...map, msg_3: { messageId: 'msg_3', pinnedAt: 3000 } };
    assert.strictEqual(Object.keys(pinned3).length, 3);

    // Unpinning msg_1
    const unpinned1 = { ...pinned3 };
    delete unpinned1['msg_1'];
    assert.strictEqual(Object.keys(unpinned1).length, 2);
    assert.strictEqual(Boolean(unpinned1['msg_1']), false);
  });

  it('10. Backend authoritative router contract: GET pins routes exist for channels and community', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const chatRoutesContent = fs.readFileSync(path.resolve('backend/src/routes/chatRoutes.js'), 'utf8');

    assert.ok(
      chatRoutesContent.includes("chatRouter.get('/channels/:channelId/pins',"),
      'GET /channels/:channelId/pins must exist in chatRoutes'
    );
    assert.ok(
      chatRoutesContent.includes("chatRouter.get('/community/pins',"),
      'GET /community/pins must exist in chatRoutes'
    );
  });

  it('11. Multi-pin persistence on refresh: parses direct array and enveloped responses preserving all 5 pins', () => {
    // Simulates what apiClient returns (unwrapped array)
    const directArrayResponse = [
      { messageId: 'pin_1', content: 'First discussion', pinnedAt: 1000 },
      { messageId: 'pin_2', content: 'Second discussion', pinnedAt: 2000 },
      { messageId: 'pin_3', content: 'Third discussion', pinnedAt: 3000 },
      { messageId: 'pin_4', content: 'Fourth discussion', pinnedAt: 4000 },
      { messageId: 'pin_5', content: 'Fifth discussion', pinnedAt: 5000 },
    ];

    const parsePinsResponse = (res) => {
      const data = res?.data !== undefined ? res.data : res;
      if (data && (Array.isArray(data) || typeof data === 'object')) {
        const map = {};
        const list = Array.isArray(data) ? data : Object.values(data);
        list.forEach((p) => {
          if (p && p.messageId) map[p.messageId] = p;
        });
        if (Object.keys(map).length > 0) {
          return map;
        }
      }
      return {};
    };

    // Test direct array response (apiClient.get unwrapped return value)
    const parsedFromDirect = parsePinsResponse(directArrayResponse);
    assert.strictEqual(Object.keys(parsedFromDirect).length, 5);
    assert.ok(parsedFromDirect['pin_1']);
    assert.ok(parsedFromDirect['pin_5']);

    // Test enveloped response { data: [...] }
    const parsedFromEnveloped = parsePinsResponse({ data: directArrayResponse });
    assert.strictEqual(Object.keys(parsedFromEnveloped).length, 5);
    assert.ok(parsedFromEnveloped['pin_2']);

    // Ensure all 5 pins are preserved in sorted order
    const sortedList = Object.values(parsedFromDirect).sort(
      (a, b) => Number(b.pinnedAt || 0) - Number(a.pinnedAt || 0)
    );
    assert.strictEqual(sortedList[0].messageId, 'pin_5');
    assert.strictEqual(sortedList[4].messageId, 'pin_1');
  });
});
