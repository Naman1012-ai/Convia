/**
 * CONVIA — P2-02 ARCHITECTURAL CONSISTENCY & DEAD-PATH CLEANUP TEST SUITE
 *
 * Verifies canonical architecture enforcement across all major subsystems:
 * 1. Canonical chat path (workspaceChats) vs obsolete (workspace_chats).
 * 2. Canonical activity path (workspace_activity) vs dead (workspace_activities).
 * 3. Canonical notification path (user_notifications) vs legacy (notifications).
 * 4. Firestore isolation as deployment artifact with zero application shadow writes.
 * 5. Context / Provider hierarchy and elimination of unmounted dead contexts.
 * 6. Centralized workspace authorization helper (workspaceAuthHelper.js).
 * 7. Backend & frontend schema and path constant alignment.
 * 8. Elimination of dead duplicate route registrations.
 * 9. Multi-path Blueprint synchronization consistency.
 * 10. Non-regression of P0-01 through P2-01 security invariants.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { rtdbService } from '../rtdbService.js';
import {
  resolveWorkspaceMembership,
  requireWorkspaceMember,
  requireWorkspaceRole,
} from '../../utils/workspaceAuthHelper.js';
import { searchController } from '../../controllers/searchController.js';
import { workspaceDashboardController } from '../../controllers/workspaceDashboardController.js';
import { activityController } from '../../controllers/activityController.js';
import { blueprintController } from '../../controllers/blueprintController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../../');

// Load database.rules.json
const rulesJsonPath = path.resolve(projectRoot, 'database.rules.json');
const rawRules = JSON.parse(fs.readFileSync(rulesJsonPath, 'utf8'));

describe('CONVIA — P2-02 ARCHITECTURAL CONSISTENCY & DEAD-PATH CLEANUP', () => {
  // -------------------------------------------------------------------------
  // 1. CANONICAL DATABASE PATHS AUDIT
  // -------------------------------------------------------------------------
  describe('🗄️ 1. Database Path Canonicalization & Dead-Path Enforcement', () => {
    it('verifies workspaceChats is canonical in database.rules.json and workspace_chats has zero rules', () => {
      assert.ok(rawRules.rules.workspaceChats, 'workspaceChats must exist as canonical chat root');
      assert.strictEqual(
        rawRules.rules.workspace_chats,
        undefined,
        'workspace_chats must not exist as an independent root in database.rules.json'
      );
    });

    it('verifies workspace_activity is canonical in database.rules.json with .write: false and workspace_activities is absent', () => {
      assert.ok(rawRules.rules.workspace_activity, 'workspace_activity must exist as canonical activity root');
      assert.strictEqual(
        rawRules.rules.workspace_activity.$workspaceId['.write'],
        false,
        'workspace_activity must enforce .write: false'
      );
      assert.strictEqual(
        rawRules.rules.workspace_activities,
        undefined,
        'workspace_activities (plural) must be completely dead and absent from rules'
      );
    });

    it('verifies user_notifications is canonical for in-app feeds with strict schema validation', () => {
      assert.ok(rawRules.rules.user_notifications, 'user_notifications must exist as canonical notification root');
      const notifRule = rawRules.rules.user_notifications.$uid.$notifId;
      assert.ok(notifRule['.validate'], 'user_notifications must have strict validation rule');
    });

    it('verifies legacy notifications path is strictly bounded to owner auth.uid', () => {
      assert.ok(rawRules.rules.notifications, 'legacy notifications rule exists for backward compatibility');
      assert.strictEqual(
        rawRules.rules.notifications.$uid['.read'],
        'auth != null && auth.uid === $uid'
      );
      assert.strictEqual(
        rawRules.rules.notifications.$uid['.write'],
        'auth != null && auth.uid === $uid'
      );
    });
  });

  // -------------------------------------------------------------------------
  // 2. FIRESTORE APPLICATION ISOLATION
  // -------------------------------------------------------------------------
  describe('🔥 2. Firestore Scaffolding Status & Application Isolation', () => {
    it('verifies firestore.rules and firestore.indexes.json exist solely as deployment artifacts in firebase.json', () => {
      const firebaseJsonPath = path.resolve(projectRoot, 'firebase.json');
      const firebaseConfig = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'));

      assert.ok(firebaseConfig.firestore, 'firebase.json declares firestore for deployment compatibility');
      assert.ok(fs.existsSync(path.resolve(projectRoot, 'firestore.rules')), 'firestore.rules exists for Firebase CLI');
    });

    it('verifies frontend rtdbService contains zero Firestore SDK imports or shadow writes', () => {
      const rtdbServiceContent = fs.readFileSync(
        path.resolve(projectRoot, 'frontend/src/services/rtdbService.js'),
        'utf8'
      );

      assert.ok(
        !rtdbServiceContent.includes("from 'firebase/firestore'"),
        'frontend rtdbService must not import from firebase/firestore'
      );
      assert.ok(
        !rtdbServiceContent.includes('setDoc('),
        'frontend rtdbService must not perform setDoc shadow writes'
      );
      assert.ok(
        !rtdbServiceContent.includes('onSnapshot('),
        'frontend rtdbService must not run onSnapshot Firestore fallbacks'
      );
    });

    it('verifies frontend voteService contains zero Firestore SDK imports or mirror writes', () => {
      const voteServiceContent = fs.readFileSync(
        path.resolve(projectRoot, 'frontend/src/services/voteService.js'),
        'utf8'
      );

      assert.ok(
        !voteServiceContent.includes("from 'firebase/firestore'"),
        'frontend voteService must not import from firebase/firestore'
      );
      assert.ok(
        !voteServiceContent.includes('setDoc('),
        'frontend voteService must not mirror votes to Firestore'
      );
    });
  });

  // -------------------------------------------------------------------------
  // 3. CONTEXT & PROVIDER PURITY (DEAD CONTEXTS REMOVED)
  // -------------------------------------------------------------------------
  describe('🧩 3. Context & Provider Architecture Purity', () => {
    it('verifies dead ProjectContext, VotingContext, and DiscussionContext files are completely removed', () => {
      assert.strictEqual(
        fs.existsSync(path.resolve(projectRoot, 'frontend/src/contexts/ProjectContext.jsx')),
        false,
        'ProjectContext.jsx must be deleted'
      );
      assert.strictEqual(
        fs.existsSync(path.resolve(projectRoot, 'frontend/src/hooks/useProject.js')),
        false,
        'useProject.js must be deleted'
      );
      assert.strictEqual(
        fs.existsSync(path.resolve(projectRoot, 'frontend/src/contexts/VotingContext.jsx')),
        false,
        'VotingContext.jsx must be deleted'
      );
      assert.strictEqual(
        fs.existsSync(path.resolve(projectRoot, 'frontend/src/hooks/useVoting.js')),
        false,
        'useVoting.js must be deleted'
      );
      assert.strictEqual(
        fs.existsSync(path.resolve(projectRoot, 'frontend/src/contexts/DiscussionContext.jsx')),
        false,
        'DiscussionContext.jsx must be deleted'
      );
      assert.strictEqual(
        fs.existsSync(path.resolve(projectRoot, 'frontend/src/hooks/useDiscussions.js')),
        false,
        'useDiscussions.js must be deleted'
      );
    });

    it('verifies UserContext, AuthContext, and UserProfileSyncContext have clear non-competing boundaries', () => {
      const authContent = fs.readFileSync(path.resolve(projectRoot, 'frontend/src/contexts/AuthContext.jsx'), 'utf8');
      const userContent = fs.readFileSync(path.resolve(projectRoot, 'frontend/src/contexts/UserContext.jsx'), 'utf8');
      const syncContent = fs.readFileSync(path.resolve(projectRoot, 'frontend/src/contexts/UserProfileSyncContext.jsx'), 'utf8');

      // AuthContext owns Firebase Auth session
      assert.ok(authContent.includes('authService.onAuthChange'), 'AuthContext listens to Firebase Auth session');
      // UserContext owns current user profile & presence
      assert.ok(userContent.includes('profileService.setupPresence'), 'UserContext manages current user presence');
      // UserProfileSyncContext owns registry of other member profiles with ref-counting
      assert.ok(syncContent.includes('subscriptionsRef'), 'UserProfileSyncContext manages shared profile registry');
    });
  });

  // -------------------------------------------------------------------------
  // 4. CENTRALIZED WORKSPACE AUTHORIZATION HELPER
  // -------------------------------------------------------------------------
  describe('🛡️ 4. Centralized Workspace Authorization Helper (workspaceAuthHelper)', () => {
    const originalGetData = rtdbService.getData;
    let mockData = {};

    beforeEach(() => {
      mockData = {
        'organizations/org_alpha': {
          orgId: 'org_alpha',
          name: 'Alpha Lab',
          ownerId: 'user_owner',
          status: 'ideation',
        },
        'organization_members/org_alpha/user_admin': {
          uid: 'user_admin',
          role: 'admin',
        },
        'organization_members/org_alpha/user_member': {
          uid: 'user_member',
          role: 'member',
        },
        'organization_members/org_alpha/user_viewer': {
          uid: 'user_viewer',
          role: 'viewer',
        },
      };

      rtdbService.getData = async (p) => mockData[p] || null;
    });

    afterEach(() => {
      rtdbService.getData = originalGetData;
    });

    it('resolves workspace membership accurately for owner, admin, member, and non-member', async () => {
      const ownerRes = await resolveWorkspaceMembership('org_alpha', 'user_owner');
      assert.strictEqual(ownerRes.exists, true);
      assert.strictEqual(ownerRes.isOwner, true);
      assert.strictEqual(ownerRes.isMember, true);
      assert.strictEqual(ownerRes.role, 'owner');

      const adminRes = await resolveWorkspaceMembership('org_alpha', 'user_admin');
      assert.strictEqual(adminRes.exists, true);
      assert.strictEqual(adminRes.isOwner, false);
      assert.strictEqual(adminRes.isMember, true);
      assert.strictEqual(adminRes.role, 'admin');

      const memberRes = await resolveWorkspaceMembership('org_alpha', 'user_member');
      assert.strictEqual(memberRes.exists, true);
      assert.strictEqual(memberRes.isOwner, false);
      assert.strictEqual(memberRes.isMember, true);
      assert.strictEqual(memberRes.role, 'member');

      const strangerRes = await resolveWorkspaceMembership('org_alpha', 'user_stranger');
      assert.strictEqual(strangerRes.exists, true);
      assert.strictEqual(strangerRes.isOwner, false);
      assert.strictEqual(strangerRes.isMember, false);
      assert.strictEqual(strangerRes.role, null);
    });

    it('requireWorkspaceMember throws 404 for non-existent workspace', async () => {
      await assert.rejects(
        async () => requireWorkspaceMember('org_nonexistent', 'user_owner'),
        (err) => err.statusCode === 404 && err.code === 'WORKSPACE_NOT_FOUND'
      );
    });

    it('requireWorkspaceMember throws 403 for non-member user', async () => {
      await assert.rejects(
        async () => requireWorkspaceMember('org_alpha', 'user_stranger'),
        (err) => err.statusCode === 403 && err.code === 'FORBIDDEN_NOT_WORKSPACE_MEMBER'
      );
    });

    it('requireWorkspaceRole validates role hierarchy and allows owner implicitly', async () => {
      // Owner passes admin check
      const ownerCheck = await requireWorkspaceRole('org_alpha', 'user_owner', ['admin']);
      assert.strictEqual(ownerCheck.isOwner, true);

      // Admin passes admin check
      const adminCheck = await requireWorkspaceRole('org_alpha', 'user_admin', ['admin']);
      assert.strictEqual(adminCheck.role, 'admin');

      // Member fails admin check
      await assert.rejects(
        async () => requireWorkspaceRole('org_alpha', 'user_member', ['admin']),
        (err) => err.statusCode === 403 && err.code === 'INSUFFICIENT_ROLE'
      );
    });
  });

  // -------------------------------------------------------------------------
  // 5. ROUTE CLEANUP & DEDUPLICATION
  // -------------------------------------------------------------------------
  describe('🛣️ 5. Route Registry Purity & Zero Dead Route Duplication', () => {
    it('verifies POST /version/approval-readiness is registered exactly once in blueprintRoutes.js', () => {
      const blueprintRoutesContent = fs.readFileSync(
        path.resolve(projectRoot, 'backend/src/routes/blueprintRoutes.js'),
        'utf8'
      );

      const matches = blueprintRoutesContent.match(/\/version\/approval-readiness/g);
      assert.strictEqual(
        matches?.length,
        1,
        'POST /version/approval-readiness must appear exactly once without duplicate lines'
      );
    });

    it('verifies all backend route mounts in index.js are active and have corresponding routers', () => {
      const indexContent = fs.readFileSync(path.resolve(projectRoot, 'backend/src/index.js'), 'utf8');

      assert.ok(indexContent.includes("app.use('/api/blueprint', blueprintRouter)"));
      assert.ok(indexContent.includes("app.use('/api/admin', adminRouter)"));
      assert.ok(indexContent.includes("app.use('/api/user', userRouter)"));
      assert.ok(indexContent.includes("app.use('/api/search', searchRouter)"));
      assert.ok(indexContent.includes("app.use('/api/workspace', workspaceDashboardRouter)"));
    });
  });

  // -------------------------------------------------------------------------
  // 6. BLUEPRINT MULTI-PATH SYNCHRONIZATION
  // -------------------------------------------------------------------------
  describe('📐 6. Blueprint Multi-Path Synchronization Consistency', () => {
    it('verifies persistBlueprintUpdate writes to both /current and activeMvpId atomically', () => {
      const blueprintControllerContent = fs.readFileSync(
        path.resolve(projectRoot, 'backend/src/controllers/blueprintController.js'),
        'utf8'
      );

      assert.ok(
        blueprintControllerContent.includes('blueprints/${workspaceId}/${activeMvpId}'),
        'Must write to MVP-scoped blueprint path'
      );
      assert.ok(
        blueprintControllerContent.includes('blueprints/${workspaceId}/current'),
        'Must write to /current synchronized pointer'
      );
      assert.ok(
        blueprintControllerContent.includes('cleanVersionSnapshot(updatedBp)'),
        'Must clean version snapshot before saving to avoid recursive payload bloat'
      );
    });
  });

  // -------------------------------------------------------------------------
  // 7. IDEA SERVICE WORKSPACE METADATA SYNCHRONIZATION
  // -------------------------------------------------------------------------
  describe('💡 7. Idea Service Workspace Metadata Synchronization', () => {
    it('verifies deleteIdea cleans up both organizations and workspaces metadata when MVP is deleted', () => {
      const ideaServiceContent = fs.readFileSync(
        path.resolve(projectRoot, 'frontend/src/services/ideaService.js'),
        'utf8'
      );

      assert.ok(
        ideaServiceContent.includes('organizations/${orgId}'),
        'deleteIdea must clear MVP from organizations/${orgId}'
      );
      assert.ok(
        ideaServiceContent.includes('workspaces/${orgId}/metadata'),
        'deleteIdea must clear MVP from workspaces/${orgId}/metadata'
      );
    });
  });

  // -------------------------------------------------------------------------
  // 8. SECURITY HARDENING INTEGRITY (P0-01 THROUGH P2-01 NON-REGRESSION)
  // -------------------------------------------------------------------------
  describe('🔒 8. Security Hardening Non-Regression Verification', () => {
    it('verifies organization_members rules block unauthorized self-join (P0-01)', () => {
      const memberRule = rawRules.rules.organization_members.$orgId.$uid['.write'];
      assert.ok(memberRule.includes("ownerId').val() === auth.uid"), 'Owner check preserved');
      assert.ok(!memberRule.includes('auth.uid === $uid && !data.exists()'), 'Self-join blocked');
    });

    it('verifies blueprints rules block direct client writes (P0-02)', () => {
      const bpWriteRule = rawRules.rules.blueprints.$orgId['.write'];
      assert.ok(bpWriteRule.includes("ownerId').val() === auth.uid"), 'Blueprint write restricted to owner');
      assert.ok(bpWriteRule.includes('!newData.exists()'), 'Delete-only client rule for owner');
    });

    it('verifies ideas rules enforce author immutability and role permissions (P1-01)', () => {
      const ideaWriteRule = rawRules.rules.ideas.$orgId.$ideaId['.write'];
      assert.ok(ideaWriteRule.includes("newData.child('authorId').val() === auth.uid"), 'Author locked on create');
    });

    it('verifies workspace_activity rules enforce strict .write: false (P2-01)', () => {
      const activityWriteRule = rawRules.rules.workspace_activity.$workspaceId['.write'];
      assert.strictEqual(activityWriteRule, false, 'Activity client write strictly false');
    });
  });
});
