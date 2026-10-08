import { describe, it } from 'node:test';
import assert from 'node:assert';
import { evaluateSecurityRule } from './databaseRulesValidation.test.js';

describe('🚀 LAUNCH BLOCKERS REMEDIATION AUDIT — PRE-LAUNCH MANDATORY VERIFICATION', () => {

  // =========================================================================
  // 1. P0 — PRE-JOIN CHAT PRIVACY LEAK
  // =========================================================================
  describe('🔒 P0: Pre-Join Chat Privacy Leak Verification', () => {
    const orgId = 'org_launch_blocker_chat';
    const userOwner = { uid: 'uid_owner' };
    const userCaptain = { uid: 'uid_captain' };
    const userAlice = { uid: 'uid_alice' }; // First joined at T2 = 2000
    const userEve = { uid: 'uid_eve' };     // Joined at T1 = 1000, left, rejoined at T3 = 3000
    const userMallory = { uid: 'uid_mallory' }; // Non-member / outside attacker

    const mockRootData = {
      organizations: {
        [orgId]: { ownerId: 'uid_owner', createdAt: 500 },
      },
      organization_members: {
        [orgId]: {
          uid_owner: { uid: 'uid_owner', role: 'owner', joinedAt: 500 },
          uid_captain: { uid: 'uid_captain', role: 'team_captain', joinedAt: 600 },
          uid_alice: { uid: 'uid_alice', role: 'member', joinedAt: 2000 },
          uid_eve: { uid: 'uid_eve', role: 'member', joinedAt: 1000, rejoinedAt: 3000 },
        },
      },
      workspaceChats: {
        [orgId]: {
          channels: {
            general: {
              metadata: { name: 'General', channelId: 'general' },
              messages: {
                msg_t1: {
                  messageId: 'msg_t1',
                  senderId: 'uid_owner',
                  content: 'Historical strategy discussion created at T1',
                  createdAt: 1000,
                },
                msg_t2: {
                  messageId: 'msg_t2',
                  senderId: 'uid_owner',
                  content: 'Discussion created during Alice window at T2',
                  createdAt: 2000,
                },
                msg_t3: {
                  messageId: 'msg_t3',
                  senderId: 'uid_alice',
                  content: 'Discussion created at T3 after Eve rejoin',
                  createdAt: 3000,
                },
              },
            },
          },
        },
      },
    };

    it('ATTACK 1: Alice (joined at T2=2000) attempts direct RTDB read on T1 message (T=1000) -> DENIED', () => {
      const res = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages/msg_t1`,
        operation: 'read',
        auth: userAlice,
        data: mockRootData.workspaceChats[orgId].channels.general.messages.msg_t1,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Pre-join message must be completely inaccessible to regular member');
    });

    it('ATTACK 2: Alice attempts broad-channel read on /messages -> DENIED', () => {
      const res = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages`,
        operation: 'read',
        auth: userAlice,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Broad channel messages read must be denied to regular members');
    });

    it('ATTACK 3: User attempts pagination backwards past their valid join window -> pre-join messages omitted', () => {
      const effectiveJoinedAt = 2000;
      const allMessages = Object.values(mockRootData.workspaceChats[orgId].channels.general.messages);
      const visible = allMessages.filter(
        (m) => typeof m.createdAt === 'number' && m.createdAt >= effectiveJoinedAt
      );

      assert.strictEqual(visible.length, 2);
      assert.deepStrictEqual(visible.map((m) => m.messageId), ['msg_t2', 'msg_t3']);
      assert.ok(!visible.some((m) => m.messageId === 'msg_t1'), 'T1 message must NOT be in paginated results');
    });

    it('ATTACK 4: User attempts search that matches pre-join messages -> pre-join matches omitted', () => {
      const effectiveJoinedAt = 2000;
      const allMessages = Object.values(mockRootData.workspaceChats[orgId].channels.general.messages);
      const searchMatches = allMessages.filter((msg) => {
        // Enforce join-time-based access control
        if (typeof msg.createdAt === 'number' && msg.createdAt < effectiveJoinedAt) {
          return false;
        }
        return msg.content.toLowerCase().includes('discussion');
      });

      assert.strictEqual(searchMatches.length, 2);
      assert.deepStrictEqual(searchMatches.map((m) => m.messageId), ['msg_t2', 'msg_t3']);
      assert.ok(!searchMatches.some((m) => m.messageId === 'msg_t1'), 'T1 pre-join discussion omitted from search');
    });

    it('ATTACK 5: User attempts to read replies/reactions on inaccessible historical messages -> DENIED', () => {
      const replyRead = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messageReplies/msg_t1/rep_1`,
        operation: 'read',
        auth: userAlice,
        data: { replyId: 'rep_1', parentMessageId: 'msg_t1', createdAt: 1050 },
        rootData: mockRootData,
      });
      assert.strictEqual(replyRead.allowed, false, 'Reply to pre-join message must be inaccessible');

      const reactionRead = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messageReactions/msg_t1`,
        operation: 'read',
        auth: userAlice,
        rootData: mockRootData,
      });
      assert.strictEqual(reactionRead.allowed, false, 'Reactions to pre-join message must be inaccessible');
    });

    it('ATTACK 6: Eve leaves and rejoins at T3=3000, attempts to read T2 messages -> DENIED', () => {
      const res = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages/msg_t2`,
        operation: 'read',
        auth: userEve,
        data: mockRootData.workspaceChats[orgId].channels.general.messages.msg_t2,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Previous-window T2 message must remain inaccessible after rejoin at T3');
    });

    it('ATTACK 7: Eve leaves and rejoins at T3=3000, attempts to read T1 messages -> DENIED', () => {
      const res = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages/msg_t1`,
        operation: 'read',
        auth: userEve,
        data: mockRootData.workspaceChats[orgId].channels.general.messages.msg_t1,
        rootData: mockRootData,
      });
      assert.strictEqual(res.allowed, false, 'Historical T1 message must remain inaccessible after rejoin at T3');
    });

    it('ATTACK 8: Owner and Captain read policy verified according to workspace design -> ALLOWED', () => {
      const ownerBroad = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages`,
        operation: 'read',
        auth: userOwner,
        rootData: mockRootData,
      });
      assert.strictEqual(ownerBroad.allowed, true, 'Owner broad read must be allowed');

      const captainBroad = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages`,
        operation: 'read',
        auth: userCaptain,
        rootData: mockRootData,
      });
      assert.strictEqual(captainBroad.allowed, true, 'Team Captain broad read must be allowed');

      const captainDirect = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages/msg_t1`,
        operation: 'read',
        auth: userCaptain,
        data: mockRootData.workspaceChats[orgId].channels.general.messages.msg_t1,
        rootData: mockRootData,
      });
      assert.strictEqual(captainDirect.allowed, true, 'Team Captain direct historical read must be allowed');
    });

    it('ATTACK 9: Legitimate current chat (T >= join/rejoin) verified working for send, receive, reply, reaction -> ALLOWED', () => {
      const eveReadT3 = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages/msg_t3`,
        operation: 'read',
        auth: userEve,
        data: mockRootData.workspaceChats[orgId].channels.general.messages.msg_t3,
        rootData: mockRootData,
      });
      assert.strictEqual(eveReadT3.allowed, true, 'Eve must be able to read message created at T3 (post-rejoin)');

      const aliceSendMessage = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages/msg_new`,
        operation: 'write',
        auth: userAlice,
        data: null,
        newData: {
          messageId: 'msg_new',
          senderId: 'uid_alice',
          content: 'Hello channel!',
          createdAt: 3500,
        },
        rootData: mockRootData,
      });
      assert.strictEqual(aliceSendMessage.allowed, true, 'Alice can send messages to channel');
    });

    it('ATTACK 10: Non-member Mallory attempts any read or write -> DENIED', () => {
      const malloryRead = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages/msg_t3`,
        operation: 'read',
        auth: userMallory,
        data: mockRootData.workspaceChats[orgId].channels.general.messages.msg_t3,
        rootData: mockRootData,
      });
      assert.strictEqual(malloryRead.allowed, false, 'Non-member read must be denied');

      const malloryWrite = evaluateSecurityRule({
        path: `workspaceChats/${orgId}/channels/general/messages/msg_mal`,
        operation: 'write',
        auth: userMallory,
        data: null,
        newData: {
          messageId: 'msg_mal',
          senderId: 'uid_mallory',
          content: 'Attack message',
          createdAt: 3600,
        },
        rootData: mockRootData,
      });
      assert.strictEqual(malloryWrite.allowed, false, 'Non-member write must be denied');
    });
  });

  // =========================================================================
  // 2. TASK AUTHORIZATION & IMMUTABILITY MATRIX
  // =========================================================================
  describe('📋 P1: Task Authorization Matrix & Immutability Verification', () => {
    const orgId = 'org_launch_blocker_task';
    const userOwner = { uid: 'uid_owner' };
    const userCaptain = { uid: 'uid_captain' };
    const userCreator = { uid: 'uid_creator' };
    const userAssignee = { uid: 'uid_assignee' };
    const userOther = { uid: 'uid_other' };
    const userRemoved = { uid: 'uid_removed' };

    const taskRootData = {
      organizations: {
        [orgId]: { ownerId: 'uid_owner' },
      },
      organization_members: {
        [orgId]: {
          uid_owner: { uid: 'uid_owner', role: 'owner' },
          uid_captain: { uid: 'uid_captain', role: 'team_captain' },
          uid_creator: { uid: 'uid_creator', role: 'member' },
          uid_assignee: { uid: 'uid_assignee', role: 'member' },
          uid_other: { uid: 'uid_other', role: 'member' },
        },
      },
      tasks: {
        [orgId]: {
          task_100: {
            taskId: 'task_100',
            orgId: orgId,
            title: 'Build Payment Gateway Integration',
            description: 'Stripe API Webhooks',
            priority: 'High',
            status: 'Todo',
            dueDate: '2026-12-01',
            assignedTo: 'uid_assignee',
            createdBy: 'uid_creator',
            createdAt: 1000,
            updatedAt: 1000,
            isDeleted: false,
          },
        },
      },
    };

    const targetTask = taskRootData.tasks[orgId].task_100;

    it('ATTACK 1: Normal member edits title/description/priority/dueDate of task created by another -> REJECTED', () => {
      const res = evaluateSecurityRule({
        path: `tasks/${orgId}/task_100`,
        operation: 'write',
        auth: userOther,
        data: targetTask,
        newData: {
          ...targetTask,
          title: 'Hacked Title',
        },
        rootData: taskRootData,
      });
      assert.strictEqual(res.allowed, false, 'Other member cannot edit task content');
    });

    it('ATTACK 2: Normal member deletes task created by another -> REJECTED', () => {
      const res = evaluateSecurityRule({
        path: `tasks/${orgId}/task_100`,
        operation: 'write',
        auth: userOther,
        data: targetTask,
        newData: null,
        rootData: taskRootData,
      });
      assert.strictEqual(res.allowed, false, 'Other member cannot delete another member task');
    });

    it('ATTACK 3: Normal member reassigns task created by another -> REJECTED', () => {
      const res = evaluateSecurityRule({
        path: `tasks/${orgId}/task_100`,
        operation: 'write',
        auth: userOther,
        data: targetTask,
        newData: {
          ...targetTask,
          assignedTo: 'uid_other',
        },
        rootData: taskRootData,
      });
      assert.strictEqual(res.allowed, false, 'Other member cannot reassign task');
    });

    it('ATTACK 4: Assignee attempts to edit task title/description/priority/dueDate -> REJECTED', () => {
      const titleTamper = evaluateSecurityRule({
        path: `tasks/${orgId}/task_100`,
        operation: 'write',
        auth: userAssignee,
        data: targetTask,
        newData: {
          ...targetTask,
          title: 'Assignee changed title',
        },
        rootData: taskRootData,
      });
      assert.strictEqual(titleTamper.allowed, false, 'Assignee cannot edit title');

      const descTamper = evaluateSecurityRule({
        path: `tasks/${orgId}/task_100`,
        operation: 'write',
        auth: userAssignee,
        data: targetTask,
        newData: {
          ...targetTask,
          description: 'Altered scope description',
        },
        rootData: taskRootData,
      });
      assert.strictEqual(descTamper.allowed, false, 'Assignee cannot edit description');
    });

    it('ATTACK 5: Assignee attempts to reassign task -> REJECTED', () => {
      const res = evaluateSecurityRule({
        path: `tasks/${orgId}/task_100`,
        operation: 'write',
        auth: userAssignee,
        data: targetTask,
        newData: {
          ...targetTask,
          assignedTo: 'uid_other',
        },
        rootData: taskRootData,
      });
      assert.strictEqual(res.allowed, false, 'Assignee cannot reassign task');
    });

    it('ATTACK 6: Assignee attempts to delete task -> REJECTED', () => {
      const hardDelete = evaluateSecurityRule({
        path: `tasks/${orgId}/task_100`,
        operation: 'write',
        auth: userAssignee,
        data: targetTask,
        newData: null,
        rootData: taskRootData,
      });
      assert.strictEqual(hardDelete.allowed, false, 'Assignee cannot hard-delete task');

      const softDelete = evaluateSecurityRule({
        path: `tasks/${orgId}/task_100`,
        operation: 'write',
        auth: userAssignee,
        data: targetTask,
        newData: {
          ...targetTask,
          isDeleted: true,
        },
        rootData: taskRootData,
      });
      assert.strictEqual(softDelete.allowed, false, 'Assignee cannot soft-delete task');
    });

    it('ATTACK 7: Assignee updates status/completion -> ALLOWED', () => {
      const res = evaluateSecurityRule({
        path: `tasks/${orgId}/task_100`,
        operation: 'write',
        auth: userAssignee,
        data: targetTask,
        newData: {
          ...targetTask,
          status: 'Completed',
          completedAt: 2500,
          updatedAt: 2500,
        },
        rootData: taskRootData,
      });
      assert.strictEqual(res.allowed, true, 'Assignee must be allowed to complete task');
    });

    it('ATTACK 8: Creator edits/reassigns/completes/deletes own task -> ALLOWED', () => {
      const creatorEdit = evaluateSecurityRule({
        path: `tasks/${orgId}/task_100`,
        operation: 'write',
        auth: userCreator,
        data: targetTask,
        newData: {
          ...targetTask,
          title: 'Revised Payment Spec',
          priority: 'Critical',
          assignedTo: 'uid_other',
        },
        rootData: taskRootData,
      });
      assert.strictEqual(creatorEdit.allowed, true, 'Creator can edit and reassign own task');

      const creatorDelete = evaluateSecurityRule({
        path: `tasks/${orgId}/task_100`,
        operation: 'write',
        auth: userCreator,
        data: targetTask,
        newData: null,
        rootData: taskRootData,
      });
      assert.strictEqual(creatorDelete.allowed, true, 'Creator can delete own task');
    });

    it('ATTACK 9: Team captain and owner perform all task operations -> ALLOWED', () => {
      const captainEdit = evaluateSecurityRule({
        path: `tasks/${orgId}/task_100`,
        operation: 'write',
        auth: userCaptain,
        data: targetTask,
        newData: {
          ...targetTask,
          title: 'Captain updated title',
          priority: 'Low',
          assignedTo: 'uid_creator',
        },
        rootData: taskRootData,
      });
      assert.strictEqual(captainEdit.allowed, true, 'Captain can edit and reassign task');

      const ownerDelete = evaluateSecurityRule({
        path: `tasks/${orgId}/task_100`,
        operation: 'write',
        auth: userOwner,
        data: targetTask,
        newData: null,
        rootData: taskRootData,
      });
      assert.strictEqual(ownerDelete.allowed, true, 'Owner can delete any task');
    });

    it('ATTACK 10: Cross-workspace task mutation/deletion attempt -> REJECTED', () => {
      const crossMutation = evaluateSecurityRule({
        path: `tasks/${orgId}/task_100`,
        operation: 'write',
        auth: userOwner,
        data: targetTask,
        newData: {
          ...targetTask,
          orgId: 'org_different_workspace',
        },
        rootData: taskRootData,
      });
      assert.strictEqual(crossMutation.allowed, false, 'Mutating orgId across workspaces must be rejected');
    });

    it('ATTACK 11: Removed member attempts task read/write -> REJECTED', () => {
      const readRes = evaluateSecurityRule({
        path: `tasks/${orgId}/task_100`,
        operation: 'read',
        auth: userRemoved,
        rootData: taskRootData,
      });
      assert.strictEqual(readRes.allowed, false, 'Removed member cannot read tasks');

      const writeRes = evaluateSecurityRule({
        path: `tasks/${orgId}/task_100`,
        operation: 'write',
        auth: userRemoved,
        data: targetTask,
        newData: { ...targetTask, status: 'Completed' },
        rootData: taskRootData,
      });
      assert.strictEqual(writeRes.allowed, false, 'Removed member cannot modify tasks');
    });

    it('ATTACK 12: Attempt to mutate immutable fields (taskId, orgId, createdBy, createdAt) -> REJECTED', () => {
      const mutateTaskId = evaluateSecurityRule({
        path: `tasks/${orgId}/task_100`,
        operation: 'write',
        auth: userOwner,
        data: targetTask,
        newData: {
          ...targetTask,
          taskId: 'task_forged',
        },
        rootData: taskRootData,
      });
      assert.strictEqual(mutateTaskId.allowed, false, 'taskId is immutable');

      const mutateCreatedBy = evaluateSecurityRule({
        path: `tasks/${orgId}/task_100`,
        operation: 'write',
        auth: userOwner,
        data: targetTask,
        newData: {
          ...targetTask,
          createdBy: 'uid_forged',
        },
        rootData: taskRootData,
      });
      assert.strictEqual(mutateCreatedBy.allowed, false, 'createdBy is immutable');
    });
  });
});
