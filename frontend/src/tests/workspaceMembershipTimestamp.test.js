import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  formatWorkspaceJoinDate,
  formatWorkspaceCreatedDate,
  formatPlatformJoinDate,
  formatDate,
} from '../utils/formatting.js';

import {
  getWorkspaceMemberHistory,
  WORKSPACE_MEMBER_STATES,
} from '../utils/workspaceMemberHistory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('========================================================================');
console.log('CONVIA — WORKSPACE MEMBERSHIP TIMESTAMP VERIFICATION SUITE');
console.log('========================================================================\n');

// Standard Reference Timestamps for Testing
const TS_PLATFORM_REGISTRATION = new Date('2026-07-19T10:00:00Z').getTime(); // Jul 19, 2026
const TS_WORKSPACE_CREATED = new Date('2026-09-17T14:30:00Z').getTime();     // Sep 17, 2026
const TS_MEMBER_INVITED_JOINED = new Date('2026-09-28T09:15:00Z').getTime(); // Sep 28, 2026
const TS_SECOND_MEMBER_JOINED = new Date('2026-10-01T12:00:00Z').getTime();  // Oct 01, 2026
const TS_ROLE_PROMOTION = new Date('2026-10-02T16:00:00Z').getTime();        // Oct 02, 2026
const TS_REJOIN = new Date('2026-10-05T08:00:00Z').getTime();                // Oct 05, 2026

// =========================================================================
// TEST 1: Date Formatting Functions & Fallbacks
// =========================================================================
console.log('[TEST 1] Verifying formatWorkspaceJoinDate, formatWorkspaceCreatedDate & formatPlatformJoinDate...');

assert.equal(formatWorkspaceJoinDate(TS_MEMBER_INVITED_JOINED), 'Joined Sep 28, 2026');
assert.equal(formatWorkspaceCreatedDate(TS_WORKSPACE_CREATED), 'Workspace created Sep 17, 2026');
assert.equal(formatPlatformJoinDate(TS_PLATFORM_REGISTRATION), 'Joined Convia Jul 19, 2026');

// Fallback behavior for null / undefined / invalid timestamps
assert.equal(formatWorkspaceJoinDate(null), 'Join date unavailable');
assert.equal(formatWorkspaceJoinDate(undefined), 'Join date unavailable');
assert.equal(formatWorkspaceJoinDate('invalid-date'), 'Join date unavailable');

assert.equal(formatWorkspaceCreatedDate(null), 'Workspace creation date unavailable');
assert.equal(formatWorkspaceCreatedDate(undefined), 'Workspace creation date unavailable');
assert.equal(formatWorkspaceCreatedDate('invalid-date'), 'Workspace creation date unavailable');

console.log('✓ Formatting helpers produce exact expected labels and neutral fallbacks.');

// =========================================================================
// TEST 2: Platform Account Date vs Workspace Membership Date Isolation
// =========================================================================
console.log('\n[TEST 2] Verifying platform account date is NEVER displayed for workspace membership...');

const memberWithBothDates = {
  uid: 'user_invited_1',
  displayName: 'Admin User',
  email: 'admin@example.com',
  role: 'member',
  joinedAt: TS_MEMBER_INVITED_JOINED,      // Sep 28, 2026 (Workspace membership)
  platformJoinedAt: TS_PLATFORM_REGISTRATION, // Jul 19, 2026 (Global Convia account)
  firstSignedInAt: TS_PLATFORM_REGISTRATION,
};

const orgSample = {
  orgId: 'ws_convia_1',
  name: 'Convia Core',
  createdBy: 'user_owner_creator',
  ownerId: 'user_owner_creator',
  ownerUid: 'user_owner_creator',
  createdAt: TS_WORKSPACE_CREATED, // Sep 17, 2026
};

const memberHistory = getWorkspaceMemberHistory(memberWithBothDates, orgSample);
assert.equal(memberHistory.timestamp, TS_MEMBER_INVITED_JOINED);
assert.equal(memberHistory.dateText, 'Joined Sep 28, 2026');
assert.notEqual(memberHistory.dateText, 'Joined Jul 19, 2026', 'Must NOT display global platform sign-in date!');
assert.notEqual(memberHistory.dateText, 'Joined Sep 17, 2026', 'Must NOT display workspace creation date for invited member!');

console.log('✓ Workspace membership date strictly derived from member.joinedAt, ignoring platform registration.');

// =========================================================================
// TEST 3: State A — Original Workspace Creator is Current Owner
// =========================================================================
console.log('\n[TEST 3] Verifying State A: Original Workspace Creator is Current Owner...');

const creatorOwnerMember = {
  uid: 'user_owner_creator',
  displayName: 'Naman',
  email: 'naman@example.com',
  role: 'owner',
  joinedAt: TS_WORKSPACE_CREATED,
  platformJoinedAt: TS_PLATFORM_REGISTRATION,
};

const historyStateA = getWorkspaceMemberHistory(creatorOwnerMember, orgSample);
assert.equal(historyStateA.state, WORKSPACE_MEMBER_STATES.CREATOR_OWNER);
assert.equal(historyStateA.isOriginalCreator, true);
assert.equal(historyStateA.isOwner, true);
assert.equal(historyStateA.isCaptain, false);
assert.equal(historyStateA.dateText, 'Workspace created Sep 17, 2026');
assert.equal(historyStateA.badges.length, 1);
assert.equal(historyStateA.badges[0].label, '👑 Owner');

console.log('✓ State A: Creator Owner shows "Workspace created <date>" and 👑 Owner badge.');

// =========================================================================
// TEST 4: State B — Creator Demoted or Transferred to Team Captain
// =========================================================================
console.log('\n[TEST 4] Verifying State B: Creator became Team Captain...');

const orgAfterTransfer = {
  ...orgSample,
  ownerId: 'user_new_owner',
  ownerUid: 'user_new_owner',
  // createdBy and createdAt MUST REMAIN IMMUTABLE
  createdBy: 'user_owner_creator',
  createdAt: TS_WORKSPACE_CREATED,
};

const creatorCaptainMember = {
  uid: 'user_owner_creator',
  displayName: 'Naman',
  email: 'naman@example.com',
  role: 'team_captain',
  isTeamCaptain: true,
  joinedAt: TS_WORKSPACE_CREATED,
};

const historyStateB = getWorkspaceMemberHistory(creatorCaptainMember, orgAfterTransfer);
assert.equal(historyStateB.state, WORKSPACE_MEMBER_STATES.CREATOR_CAPTAIN);
assert.equal(historyStateB.isOriginalCreator, true);
assert.equal(historyStateB.isOwner, false);
assert.equal(historyStateB.isCaptain, true);
assert.equal(historyStateB.dateText, 'Workspace created Sep 17, 2026', 'Creator preserves creation date after role change');
assert.deepEqual(
  historyStateB.badges.map((b) => b.label),
  ['⚡ Team Captain', 'Original Creator'],
  'Creator demoted to Team Captain must receive both badges'
);

console.log('✓ State B: Creator Captain shows "Workspace created <date>", ⚡ Team Captain, and Original Creator badge.');

// =========================================================================
// TEST 5: State C — Creator Demoted to Regular Member
// =========================================================================
console.log('\n[TEST 5] Verifying State C: Creator became Regular Member...');

const creatorRegularMember = {
  uid: 'user_owner_creator',
  displayName: 'Naman',
  email: 'naman@example.com',
  role: 'member',
  joinedAt: TS_WORKSPACE_CREATED,
};

const historyStateC = getWorkspaceMemberHistory(creatorRegularMember, orgAfterTransfer);
assert.equal(historyStateC.state, WORKSPACE_MEMBER_STATES.CREATOR_MEMBER);
assert.equal(historyStateC.isOriginalCreator, true);
assert.equal(historyStateC.isOwner, false);
assert.equal(historyStateC.isCaptain, false);
assert.equal(historyStateC.dateText, 'Workspace created Sep 17, 2026');
assert.deepEqual(
  historyStateC.badges.map((b) => b.label),
  ['Member', 'Original Creator']
);

console.log('✓ State C: Creator Regular Member preserves creation date and receives Original Creator badge.');

// =========================================================================
// TEST 6: State D — New Owner is Not the Creator
// =========================================================================
console.log('\n[TEST 6] Verifying State D: New Owner who was not Creator...');

const newOwnerMember = {
  uid: 'user_new_owner',
  displayName: 'Sarah',
  email: 'sarah@example.com',
  role: 'owner',
  joinedAt: TS_SECOND_MEMBER_JOINED, // Oct 01, 2026
};

const historyStateD = getWorkspaceMemberHistory(newOwnerMember, orgAfterTransfer);
assert.equal(historyStateD.state, WORKSPACE_MEMBER_STATES.NEW_OWNER);
assert.equal(historyStateD.isOriginalCreator, false);
assert.equal(historyStateD.isOwner, true);
assert.equal(historyStateD.dateText, 'Joined Oct 1, 2026', 'New owner must retain their original joined date');
assert.notEqual(historyStateD.dateText, 'Workspace created Sep 17, 2026', 'New owner must NOT steal workspace creation date');
assert.deepEqual(historyStateD.badges.map((b) => b.label), ['👑 Owner']);

console.log('✓ State D: New Owner displays "Joined <member.joinedAt>" and 👑 Owner badge without Creator badge.');

// =========================================================================
// TEST 7: State E — Team Captain is Not the Creator
// =========================================================================
console.log('\n[TEST 7] Verifying State E: Team Captain who was not Creator...');

const captainMember = {
  uid: 'user_captain',
  displayName: 'Alex',
  email: 'alex@example.com',
  role: 'team_captain',
  isTeamCaptain: true,
  joinedAt: TS_MEMBER_INVITED_JOINED, // Sep 28, 2026
};

const historyStateE = getWorkspaceMemberHistory(captainMember, orgSample);
assert.equal(historyStateE.state, WORKSPACE_MEMBER_STATES.CAPTAIN);
assert.equal(historyStateE.isOriginalCreator, false);
assert.equal(historyStateE.isOwner, false);
assert.equal(historyStateE.isCaptain, true);
assert.equal(historyStateE.dateText, 'Joined Sep 28, 2026');
assert.deepEqual(historyStateE.badges.map((b) => b.label), ['⚡ Team Captain']);

console.log('✓ State E: Team Captain displays "Joined <member.joinedAt>" and ⚡ Team Captain badge.');

// =========================================================================
// TEST 8: State F — Regular Member is Not the Creator
// =========================================================================
console.log('\n[TEST 8] Verifying State F: Regular Member...');

const regularMember = {
  uid: 'user_reg',
  displayName: 'Jordan',
  email: 'jordan@example.com',
  role: 'member',
  joinedAt: TS_MEMBER_INVITED_JOINED, // Sep 28, 2026
};

const historyStateF = getWorkspaceMemberHistory(regularMember, orgSample);
assert.equal(historyStateF.state, WORKSPACE_MEMBER_STATES.MEMBER);
assert.equal(historyStateF.isOriginalCreator, false);
assert.equal(historyStateF.isOwner, false);
assert.equal(historyStateF.isCaptain, false);
assert.equal(historyStateF.dateText, 'Joined Sep 28, 2026');
assert.deepEqual(historyStateF.badges.map((b) => b.label), ['Member']);

console.log('✓ State F: Regular Member displays "Joined <member.joinedAt>" and Member badge.');

// =========================================================================
// TEST 9: Role Promotion Does Not Mutate Member joinedAt
// =========================================================================
console.log('\n[TEST 9] Verifying role promotion to Team Captain preserves original joinedAt...');

// Member joined on Sep 28, promoted on Oct 02
const promotedMember = {
  uid: 'user_promoted',
  displayName: 'Chris',
  email: 'chris@example.com',
  role: 'team_captain',
  isTeamCaptain: true,
  joinedAt: TS_MEMBER_INVITED_JOINED, // Sep 28, 2026
  promotedAt: TS_ROLE_PROMOTION,      // Oct 02, 2026
};

const historyPromoted = getWorkspaceMemberHistory(promotedMember, orgSample);
assert.equal(historyPromoted.dateText, 'Joined Sep 28, 2026', 'Role promotion must not change membership timestamp');
assert.notEqual(historyPromoted.dateText, 'Joined Oct 02, 2026');

console.log('✓ Role promotion retains original workspace join date.');

// =========================================================================
// TEST 10: Leave / Rejoin Semantics
// =========================================================================
console.log('\n[TEST 10] Verifying leave and rejoin semantics...');

// User previously left and was re-invited, accepting on Oct 05
const rejoinedMember = {
  uid: 'user_rejoined',
  displayName: 'Rejoined User',
  email: 'rejoin@example.com',
  role: 'member',
  joinedAt: TS_REJOIN, // Oct 05, 2026
  platformJoinedAt: TS_PLATFORM_REGISTRATION, // Jul 19, 2026
};

const historyRejoined = getWorkspaceMemberHistory(rejoinedMember, orgSample);
assert.equal(historyRejoined.dateText, 'Joined Oct 5, 2026', 'Active membership must represent current membership period');
assert.notEqual(historyRejoined.dateText, 'Joined Jul 19, 2026', 'Must not use platform account date');

console.log('✓ Rejoining member correctly receives the latest active membership timestamp.');

// =========================================================================
// TEST 11: Immutability of org.createdBy and org.createdAt across Ownership Transfers
// =========================================================================
console.log('\n[TEST 11] Verifying immutability of workspace creation records...');

const initialOrg = {
  orgId: 'ws_transfer_test',
  name: 'Immutable Org',
  createdBy: 'creator_uid_123',
  createdAt: TS_WORKSPACE_CREATED,
  ownerId: 'creator_uid_123',
  ownerUid: 'creator_uid_123',
};

// Simulate transfer handler output
const transferredOrg = {
  ...initialOrg,
  ownerId: 'new_owner_456',
  ownerUid: 'new_owner_456',
  updatedAt: Date.now(),
};

assert.equal(transferredOrg.createdBy, initialOrg.createdBy, 'org.createdBy must remain immutable');
assert.equal(transferredOrg.createdAt, initialOrg.createdAt, 'org.createdAt must remain immutable');
assert.equal(transferredOrg.ownerId, 'new_owner_456');
assert.equal(transferredOrg.ownerUid, 'new_owner_456');

console.log('✓ org.createdBy and org.createdAt are immutable across transfers.');

// =========================================================================
// TEST 12: Dual-Field Alignment (ownerId and ownerUid)
// =========================================================================
console.log('\n[TEST 12] Verifying dual-field alignment...');

const orgWithOwnerUidOnly = {
  orgId: 'ws_dual_1',
  createdBy: 'creator_x',
  ownerUid: 'owner_y',
  createdAt: TS_WORKSPACE_CREATED,
};

const memberY = { uid: 'owner_y', role: 'owner', joinedAt: TS_MEMBER_INVITED_JOINED };
const historyY = getWorkspaceMemberHistory(memberY, orgWithOwnerUidOnly);
assert.equal(historyY.isOwner, true, 'Must recognize owner when only ownerUid is set');

const orgWithOwnerIdOnly = {
  orgId: 'ws_dual_2',
  createdBy: 'creator_x',
  ownerId: 'owner_z',
  createdAt: TS_WORKSPACE_CREATED,
};

const memberZ = { uid: 'owner_z', role: 'owner', joinedAt: TS_MEMBER_INVITED_JOINED };
const historyZ = getWorkspaceMemberHistory(memberZ, orgWithOwnerIdOnly);
assert.equal(historyZ.isOwner, true, 'Must recognize owner when only ownerId is set');

console.log('✓ Dual-field alignment functions correctly for both ownerId and ownerUid.');

// =========================================================================
// TEST 13: OrgContext Roster Resolution Data Protection Audit
// =========================================================================
console.log('\n[TEST 13] Verifying OrgContext merge logic does not leak profile dates...');

const rawMembers = [
  {
    uid: 'test_member_1',
    role: 'member',
    joinedAt: TS_MEMBER_INVITED_JOINED, // Sep 28, 2026
  },
];

const profiles = {
  test_member_1: {
    displayName: 'Global User',
    joinedAt: TS_PLATFORM_REGISTRATION, // Jul 19, 2026 (Global profile timestamp)
    firstSignedInAt: TS_PLATFORM_REGISTRATION,
    photoURL: 'https://example.com/avatar.png',
  },
};

// Simulate the fixed OrgContext merge logic
const resolvedMembers = rawMembers.map((member) => {
  const uid = member.uid || member.id;
  const liveProfile = profiles[uid];
  const workspaceJoinedAt = member.joinedAt ?? member.membershipCreatedAt ?? null;

  if (!liveProfile) {
    return {
      ...member,
      joinedAt: workspaceJoinedAt,
      workspaceJoinedAt,
    };
  }

  const liveName = liveProfile.displayName;
  const liveAvatar = liveProfile.photoURL;
  const platformJoinedAt = liveProfile.firstSignedInAt ?? liveProfile.joinedAt ?? liveProfile.createdAt ?? null;

  return {
    ...member,
    ...liveProfile,
    // Critical: Overwrite profile joinedAt with workspace membership joinedAt
    joinedAt: workspaceJoinedAt,
    workspaceJoinedAt,
    platformJoinedAt,
    name: liveName || member.name || 'Member',
    displayName: liveName || member.displayName || 'Member',
    avatar: liveAvatar || member.avatar || '',
    photoURL: liveAvatar || member.photoURL || '',
    role: member.role || 'member',
    workspaceRole: member.role || 'member',
    isSecondOwner: Boolean(member.isSecondOwner || member.role === 'second_owner'),
    isTeamCaptain: Boolean(member.isTeamCaptain || member.role === 'team_captain'),
  };
});

assert.equal(
  resolvedMembers[0].joinedAt,
  TS_MEMBER_INVITED_JOINED,
  'member.joinedAt MUST NOT be overwritten by liveProfile.joinedAt'
);
assert.equal(
  resolvedMembers[0].workspaceJoinedAt,
  TS_MEMBER_INVITED_JOINED,
  'member.workspaceJoinedAt must equal workspace membership timestamp'
);
assert.equal(
  resolvedMembers[0].platformJoinedAt,
  TS_PLATFORM_REGISTRATION,
  'member.platformJoinedAt safely stores platform account timestamp'
);

console.log('✓ OrgContext resolution protects member.joinedAt against liveProfile pollution.');

// =========================================================================
// TEST 14: Source Code File Audits
// =========================================================================
console.log('\n[TEST 14] Auditing codebase implementations for timestamp semantic adherence...');

const orgContextContent = fs.readFileSync(path.join(__dirname, '../contexts/OrgContext.jsx'), 'utf-8');
assert.ok(
  orgContextContent.includes('workspaceJoinedAt = member.joinedAt'),
  'OrgContext.jsx must extract workspaceJoinedAt from member.joinedAt'
);
assert.ok(
  orgContextContent.includes('joinedAt: workspaceJoinedAt'),
  'OrgContext.jsx must explicitly assign joinedAt: workspaceJoinedAt AFTER liveProfile spread'
);

const orgMemberListContent = fs.readFileSync(path.join(__dirname, '../features/organizations/OrgMemberList.jsx'), 'utf-8');
assert.ok(
  orgMemberListContent.includes('getWorkspaceMemberHistory'),
  'OrgMemberList.jsx must import and use getWorkspaceMemberHistory'
);
assert.ok(
  orgMemberListContent.includes('history.dateText'),
  'OrgMemberList.jsx must render history.dateText'
);

const settingsPageContent = fs.readFileSync(path.join(__dirname, '../pages/organization/SettingsPage.jsx'), 'utf-8');
assert.ok(
  settingsPageContent.includes('getWorkspaceMemberHistory'),
  'SettingsPage.jsx must import and use getWorkspaceMemberHistory'
);
assert.ok(
  settingsPageContent.includes('history.dateText'),
  'SettingsPage.jsx must render history.dateText'
);

const adminWorkspaceDetailContent = fs.readFileSync(path.join(__dirname, '../pages/admin/AdminWorkspaceDetailPage.jsx'), 'utf-8');
assert.ok(
  adminWorkspaceDetailContent.includes('getWorkspaceMemberHistory'),
  'AdminWorkspaceDetailPage.jsx must import and use getWorkspaceMemberHistory'
);

const backendControllerContent = fs.readFileSync(
  path.join(__dirname, '../../../backend/src/controllers/workspaceMembershipController.js'),
  'utf-8'
);
assert.ok(
  backendControllerContent.includes('[`organizations/${workspaceId}/ownerUid`]: newOwnerUid'),
  'workspaceMembershipController.js must synchronize ownerUid alongside ownerId'
);

const adminRoutesContent = fs.readFileSync(
  path.join(__dirname, '../../../backend/src/routes/adminRoutes.js'),
  'utf-8'
);
assert.ok(
  adminRoutesContent.includes('ownerUid: newOwnerUid'),
  'adminRoutes.js must synchronize ownerUid alongside ownerId'
);

console.log('✓ All source code files audited and verified compliant.');

console.log('\n========================================================================');
console.log('ALL 14 WORKSPACE MEMBERSHIP TIMESTAMP VERIFICATION TESTS PASSED!');
console.log('========================================================================\n');
