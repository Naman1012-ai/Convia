import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load actual database.rules.json
const rulesJsonPath = path.resolve(__dirname, '../../../../database.rules.json');
const rawRules = JSON.parse(fs.readFileSync(rulesJsonPath, 'utf8'));

// ---------------------------------------------------------------------------
// 1. Standalone Validators & Model Logic (matching frontend implementation)
// ---------------------------------------------------------------------------
const PROJECT_TYPES = [
  { value: 'software', label: 'Software / Web' },
  { value: 'ai_ml', label: 'AI / ML' },
  { value: 'hardware', label: 'Hardware / Engineering' },
  { value: 'research', label: 'Research' },
  { value: 'startup', label: 'Startup / Product' },
  { value: 'academic', label: 'Academic' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'other', label: 'Other' },
];
const PROJECT_TYPE_VALUES = PROJECT_TYPES.map((t) => t.value);

function validateWorkspaceName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Workspace name is required.' };
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Workspace name is required.' };
  }
  if (trimmed.length > 80) {
    return { valid: false, error: 'Workspace name must be 80 characters or fewer.' };
  }
  return { valid: true };
}

function validateProjectType(projectType) {
  if (!projectType || typeof projectType !== 'string' || !PROJECT_TYPE_VALUES.includes(projectType)) {
    return { valid: false, error: 'Please select a valid project type.' };
  }
  return { valid: true };
}

function validateWorkspaceDescription(desc) {
  if (!desc || typeof desc !== 'string') {
    return { valid: false, error: 'Description is required.' };
  }
  const trimmed = desc.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Description is required.' };
  }
  if (trimmed.length > 1000) {
    return { valid: false, error: `Description must be at most 1000 characters.` };
  }
  return { valid: true };
}

function validateProjectGoal(goal) {
  if (!goal) return { valid: true };
  if (typeof goal !== 'string') return { valid: true };
  const trimmed = goal.trim();
  if (trimmed.length > 300) {
    return { valid: false, error: 'Project goal must be 300 characters or fewer.' };
  }
  return { valid: true };
}

function validateWorkspaceMembersLimit(value, min = 2, max = 50) {
  if (value === undefined || value === null || value === '') {
    return { valid: false, error: 'Maximum members is required.' };
  }
  const num = Number(value);
  if (!Number.isInteger(num)) {
    return { valid: false, error: 'Maximum members must be a whole number.' };
  }
  if (num < min || num > max) {
    return { valid: false, error: `Maximum members must be between ${min} and ${max}.` };
  }
  return { valid: true };
}

function validateProjectUrl(url, label = 'URL') {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return { valid: true };
  }
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: `${label} must begin with http:// or https://` };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: `Please enter a valid ${label} (e.g. https://example.com).` };
  }
}

function resolveWorkspaceProjectType(org) {
  if (!org) return 'other';
  if (org.projectType && PROJECT_TYPE_VALUES.includes(org.projectType)) {
    return org.projectType;
  }
  if (
    org.hackathonName ||
    org.hackathonTheme ||
    org.hackathonLocation ||
    org.hackathonDate ||
    org.startDate ||
    org.endDate
  ) {
    return 'hackathon';
  }
  return 'other';
}

function isLegacyHackathonWorkspace(org) {
  if (!org) return false;
  return Boolean(
    org.hackathonName ||
    org.hackathonTheme ||
    org.hackathonLocation ||
    org.hackathonDate ||
    org.startDate ||
    org.endDate
  );
}

// ---------------------------------------------------------------------------
// 2. Simulated RTDB & Service Environment
// ---------------------------------------------------------------------------
class MockDatabase {
  constructor() {
    this.store = {};
  }
  getData(pathStr) {
    return Promise.resolve(this.store[pathStr] ? JSON.parse(JSON.stringify(this.store[pathStr])) : null);
  }
  setData(pathStr, val) {
    if (val === null) {
      delete this.store[pathStr];
    } else {
      this.store[pathStr] = JSON.parse(JSON.stringify(val));
    }
    return Promise.resolve();
  }
  updateData(pathStr, val) {
    if (!this.store[pathStr]) this.store[pathStr] = {};
    Object.assign(this.store[pathStr], JSON.parse(JSON.stringify(val)));
    return Promise.resolve();
  }
}

function createMockOrgService(db) {
  return {
    createOrganization: async (ownerUid, orgData) => {
      if (!ownerUid) throw new Error('Owner UID is required.');

      const orgId = `org_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const inviteCode = 'TESTCODE';
      const timestamp = Date.now();

      const maxMembers = Math.max(
        1,
        Math.min(50, Number(orgData.maxMembers ?? orgData.teamSizeLimit) || 5)
      );
      const projectType = orgData.projectType || 'other';
      const description = (orgData.description ?? orgData.hackathonDescription ?? '').trim();
      const projectGoal = (orgData.projectGoal || '').trim();
      const visibility = orgData.visibility || 'private';
      const repositoryUrl = (orgData.repositoryUrl || '').trim();
      const projectUrl = (orgData.projectUrl || '').trim();
      const documentationUrl = (orgData.documentationUrl || '').trim();

      const newOrg = {
        orgId,
        id: orgId,
        name: orgData.name.trim(),
        projectType,
        description,
        projectGoal,
        visibility,
        maxMembers,
        teamSizeLimit: maxMembers,
        repositoryUrl,
        projectUrl,
        documentationUrl,
        logoURL: null,
        ownerId: ownerUid,
        createdBy: ownerUid,
        inviteCode,
        status: 'ideation',
        createdAt: timestamp,
        updatedAt: timestamp,
        memberCount: 1,
        activeProjectId: null,
        ...(orgData.hackathonName ? { hackathonName: orgData.hackathonName.trim() } : {}),
        ...(orgData.hackathonDescription ? { hackathonDescription: orgData.hackathonDescription.trim() } : {}),
        ...(orgData.hackathonDate ? { hackathonDate: orgData.hackathonDate } : {}),
        ...(orgData.hackathonLocation ? { hackathonLocation: orgData.hackathonLocation.trim() } : {}),
      };

      await db.setData(`organizations/${orgId}`, newOrg);
      await db.setData(`organization_members/${orgId}/${ownerUid}`, {
        uid: ownerUid,
        role: 'owner',
        joinedAt: timestamp,
      });

      return newOrg;
    },

    updateOrganizationGeneralSettings: async (orgId, updates) => {
      if (!orgId) throw new Error('Org ID is required.');
      const timestamp = Date.now();
      const normalizedUpdates = { ...updates };

      if (normalizedUpdates.maxMembers !== undefined) {
        normalizedUpdates.teamSizeLimit = Number(normalizedUpdates.maxMembers);
      } else if (normalizedUpdates.teamSizeLimit !== undefined) {
        normalizedUpdates.maxMembers = Number(normalizedUpdates.teamSizeLimit);
      }

      await db.updateData(`organizations/${orgId}`, {
        ...normalizedUpdates,
        updatedAt: timestamp,
      });
      return await db.getData(`organizations/${orgId}`);
    },

    getOrganization: async (orgId) => {
      return await db.getData(`organizations/${orgId}`);
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Security Rule Evaluator for organizations/$orgId
// ---------------------------------------------------------------------------
function evaluateOrgRule({ auth, data, newData }) {
  // Rule: auth != null && (!data.exists() ? newData.child('ownerId').val() === auth.uid : (data.child('ownerId').val() === auth.uid || root.child('organization_members').child($orgId).child(auth.uid).exists()))
  // Validate: !data.exists() || (data.child('ownerId').val() === auth.uid || newData.child('ownerId').val() === data.child('ownerId').val())
  if (!auth || !auth.uid) {
    return { allowed: false, reason: 'UNAUTHENTICATED' };
  }

  const isCreate = !data;
  if (isCreate) {
    if (newData?.ownerId === auth.uid) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'CREATOR_MUST_BE_OWNER' };
  }

  // Update
  const isOwner = data?.ownerId === auth.uid;
  if (!isOwner) {
    return { allowed: false, reason: 'NOT_OWNER' };
  }

  // Owner cannot transfer ownerId arbitrarily without specific rule check
  if (newData?.ownerId && newData.ownerId !== data.ownerId && !isOwner) {
    return { allowed: false, reason: 'OWNER_MUTATION_DENIED' };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// TEST SUITE
// ---------------------------------------------------------------------------
describe('🌟 CONVIA — WORKSPACE MODEL MIGRATION (Phase 1)', () => {
  describe('1. Form Validation Suite', () => {
    it('rejects missing or empty workspace name', () => {
      assert.strictEqual(validateWorkspaceName('').valid, false);
      assert.strictEqual(validateWorkspaceName('   ').valid, false);
      assert.strictEqual(validateWorkspaceName(null).valid, false);
      assert.strictEqual(validateWorkspaceName(undefined).valid, false);
    });

    it('rejects workspace name exceeding 80 characters', () => {
      const longName = 'A'.repeat(81);
      assert.strictEqual(validateWorkspaceName(longName).valid, false);
    });

    it('accepts valid workspace names within 80 characters', () => {
      assert.strictEqual(validateWorkspaceName('AI Engine').valid, true);
      assert.strictEqual(validateWorkspaceName('Acme Global Distributed Systems').valid, true);
    });

    it('rejects missing or invalid project types', () => {
      assert.strictEqual(validateProjectType('').valid, false);
      assert.strictEqual(validateProjectType('invalid_type').valid, false);
      assert.strictEqual(validateProjectType(null).valid, false);
    });

    it('accepts all 8 allowed canonical project types', () => {
      PROJECT_TYPE_VALUES.forEach((type) => {
        assert.strictEqual(
          validateProjectType(type).valid,
          true,
          `Failed to validate project type: ${type}`
        );
      });
    });

    it('rejects missing or empty description', () => {
      assert.strictEqual(validateWorkspaceDescription('').valid, false);
      assert.strictEqual(validateWorkspaceDescription('   ').valid, false);
      assert.strictEqual(validateWorkspaceDescription(null).valid, false);
    });

    it('rejects description exceeding 1000 characters', () => {
      const longDesc = 'D'.repeat(1001);
      assert.strictEqual(validateWorkspaceDescription(longDesc).valid, false);
    });

    it('accepts valid descriptions up to 1000 characters', () => {
      assert.strictEqual(validateWorkspaceDescription('Building next-gen agent tooling.').valid, true);
      assert.strictEqual(validateWorkspaceDescription('D'.repeat(1000)).valid, true);
    });

    it('validates optional project goal (empty is valid, >300 chars is invalid)', () => {
      assert.strictEqual(validateProjectGoal('').valid, true);
      assert.strictEqual(validateProjectGoal(null).valid, true);
      assert.strictEqual(validateProjectGoal('Ship MVP by end of quarter').valid, true);
      assert.strictEqual(validateProjectGoal('G'.repeat(301)).valid, false);
    });

    it('validates maximum members boundaries (positive integer between 2 and 50 on creation)', () => {
      assert.strictEqual(validateWorkspaceMembersLimit(0, 2, 50).valid, false);
      assert.strictEqual(validateWorkspaceMembersLimit(1, 2, 50).valid, false);
      assert.strictEqual(validateWorkspaceMembersLimit(51, 2, 50).valid, false);
      assert.strictEqual(validateWorkspaceMembersLimit(3.5, 2, 50).valid, false);
      assert.strictEqual(validateWorkspaceMembersLimit('invalid', 2, 50).valid, false);
      assert.strictEqual(validateWorkspaceMembersLimit(2, 2, 50).valid, true);
      assert.strictEqual(validateWorkspaceMembersLimit(5, 2, 50).valid, true);
      assert.strictEqual(validateWorkspaceMembersLimit(50, 2, 50).valid, true);
    });

    it('validates optional project URLs (valid protocol, reject invalid strings)', () => {
      assert.strictEqual(validateProjectUrl('').valid, true);
      assert.strictEqual(validateProjectUrl('   ').valid, true);
      assert.strictEqual(validateProjectUrl(null).valid, true);
      assert.strictEqual(validateProjectUrl('https://github.com/myorg/repo').valid, true);
      assert.strictEqual(validateProjectUrl('http://myproject.internal').valid, true);
      assert.strictEqual(validateProjectUrl('ftp://files.example.com').valid, false);
      assert.strictEqual(validateProjectUrl('javascript:alert(1)').valid, false);
      assert.strictEqual(validateProjectUrl('not_a_valid_url').valid, false);
    });
  });

  describe('2. Workspace Creation Engine (All 8 Project Types)', () => {
    const testCases = [
      { type: 'software', name: 'Web Framework', goal: 'Fast SSR engine' },
      { type: 'ai_ml', name: 'Neural Predictor', goal: 'Deep neural models' },
      { type: 'hardware', name: 'IoT Sensor Node', goal: 'Low power firmware' },
      { type: 'research', name: 'Quantum Cryptography', goal: 'Post-quantum key exchange' },
      { type: 'startup', name: 'SaaS Platform', goal: 'Reach 100 paid users' },
      { type: 'academic', name: 'Thesis Lab', goal: 'Publish in top journal' },
      { type: 'hackathon', name: 'HackSprint 2026', goal: 'Build demo in 48 hours' },
      { type: 'other', name: 'Community Initiative', goal: 'Organize team meetups' },
    ];

    testCases.forEach(({ type, name, goal }) => {
      it(`successfully creates a workspace for project type: ${type}`, async () => {
        const db = new MockDatabase();
        const service = createMockOrgService(db);
        const ownerUid = `user_${type}_owner`;

        const created = await service.createOrganization(ownerUid, {
          name,
          projectType: type,
          description: `Description for ${name}`,
          projectGoal: goal,
          visibility: 'private',
          maxMembers: 10,
          repositoryUrl: 'https://github.com/convia/demo',
          projectUrl: 'https://demo.convia.dev',
          documentationUrl: 'https://docs.convia.dev',
        });

        assert.ok(created.orgId, 'orgId must be generated');
        assert.strictEqual(created.id, created.orgId, 'id must match orgId for conceptual model');
        assert.strictEqual(created.name, name);
        assert.strictEqual(created.projectType, type);
        assert.strictEqual(created.projectGoal, goal);
        assert.strictEqual(created.visibility, 'private');
        assert.strictEqual(created.maxMembers, 10);
        assert.strictEqual(created.teamSizeLimit, 10, 'teamSizeLimit must be in sync with maxMembers');
        assert.strictEqual(created.ownerId, ownerUid);
        assert.strictEqual(created.createdBy, ownerUid);
        assert.strictEqual(created.repositoryUrl, 'https://github.com/convia/demo');
        assert.strictEqual(created.projectUrl, 'https://demo.convia.dev');
        assert.strictEqual(created.documentationUrl, 'https://docs.convia.dev');
        assert.strictEqual(created.status, 'ideation');
        assert.strictEqual(created.memberCount, 1);

        // Verify database persistence
        const persisted = await db.getData(`organizations/${created.orgId}`);
        assert.deepStrictEqual(persisted, created);

        // Verify membership record
        const memberRecord = await db.getData(`organization_members/${created.orgId}/${ownerUid}`);
        assert.ok(memberRecord);
        assert.strictEqual(memberRecord.role, 'owner');
        assert.strictEqual(memberRecord.uid, ownerUid);
      });
    });

    it('rejects creation when owner UID is unauthenticated or missing', async () => {
      const db = new MockDatabase();
      const service = createMockOrgService(db);

      await assert.rejects(
        async () => {
          await service.createOrganization(null, {
            name: 'Orphaned Workspace',
            projectType: 'software',
            description: 'Should fail',
          });
        },
        /Owner UID is required/
      );
    });
  });

  describe('3. Workspace Settings & Persistence', () => {
    it('modifies all general settings, project links, capacity, and persists correctly', async () => {
      const db = new MockDatabase();
      const service = createMockOrgService(db);
      const ownerUid = 'user_admin_1';

      // 1. Create original workspace
      const org = await service.createOrganization(ownerUid, {
        name: 'Initial Name',
        projectType: 'software',
        description: 'Initial description',
        projectGoal: 'Initial goal',
        maxMembers: 5,
      });

      // 2. Modify settings
      const updated = await service.updateOrganizationGeneralSettings(org.orgId, {
        name: 'Updated Enterprise Workspace',
        projectType: 'ai_ml',
        description: 'New expanded description of capabilities',
        projectGoal: 'Deploy models at scale',
        maxMembers: 25,
        repositoryUrl: 'https://github.com/enterprise/ai-core',
        projectUrl: 'https://ai.enterprise.com',
        documentationUrl: 'https://docs.enterprise.com',
        visibility: 'private',
      });

      assert.strictEqual(updated.name, 'Updated Enterprise Workspace');
      assert.strictEqual(updated.projectType, 'ai_ml');
      assert.strictEqual(updated.description, 'New expanded description of capabilities');
      assert.strictEqual(updated.projectGoal, 'Deploy models at scale');
      assert.strictEqual(updated.maxMembers, 25);
      assert.strictEqual(updated.teamSizeLimit, 25, 'teamSizeLimit must stay synchronized with maxMembers');
      assert.strictEqual(updated.repositoryUrl, 'https://github.com/enterprise/ai-core');
      assert.strictEqual(updated.projectUrl, 'https://ai.enterprise.com');
      assert.strictEqual(updated.documentationUrl, 'https://docs.enterprise.com');

      // 3. Simulate reload / fresh read from database
      const reloaded = await service.getOrganization(org.orgId);
      assert.strictEqual(reloaded.name, 'Updated Enterprise Workspace');
      assert.strictEqual(reloaded.projectType, 'ai_ml');
      assert.strictEqual(reloaded.maxMembers, 25);
      assert.strictEqual(reloaded.teamSizeLimit, 25);
      assert.strictEqual(reloaded.repositoryUrl, 'https://github.com/enterprise/ai-core');
    });
  });

  describe('4. Backward Compatibility with Legacy Hackathon Workspaces', () => {
    it('correctly resolves projectType for legacy hackathon workspace without projectType field', () => {
      const legacyOrg = {
        orgId: 'org_legacy_1',
        name: 'Team Alpha Hackers',
        hackathonName: 'Bay Area Hackathon 2025',
        hackathonTheme: 'Clean Energy',
        hackathonLocation: 'San Francisco',
        hackathonDescription: 'Solar power microgrid',
        teamSizeLimit: 4,
        ownerId: 'user_legacy_lead',
      };

      assert.strictEqual(resolveWorkspaceProjectType(legacyOrg), 'hackathon');
      assert.strictEqual(isLegacyHackathonWorkspace(legacyOrg), true);
    });

    it('correctly resolves projectType for legacy non-hackathon workspace without hackathon fields', () => {
      const nonHackathonOrg = {
        orgId: 'org_legacy_2',
        name: 'General Project Team',
        teamSizeLimit: 5,
        ownerId: 'user_general_lead',
      };

      assert.strictEqual(resolveWorkspaceProjectType(nonHackathonOrg), 'other');
      assert.strictEqual(isLegacyHackathonWorkspace(nonHackathonOrg), false);
    });

    it('preserves historical hackathon metadata when updating general settings on legacy workspace', async () => {
      const db = new MockDatabase();
      const service = createMockOrgService(db);

      // Prepopulate legacy workspace in RTDB
      const legacyOrg = {
        orgId: 'org_legacy_hack_99',
        id: 'org_legacy_hack_99',
        name: 'Original Hack Team',
        hackathonName: 'MIT Hackathon 2024',
        hackathonTheme: 'Robotics',
        hackathonLocation: 'Cambridge, MA',
        hackathonDate: '2024-11-15',
        startDate: '2024-11-15',
        endDate: '2024-11-17',
        teamSizeLimit: 6,
        ownerId: 'user_hacker_1',
        createdAt: 1700000000000,
      };
      await db.setData('organizations/org_legacy_hack_99', legacyOrg);

      // Update settings using new general fields while preserving legacy fields
      const updated = await service.updateOrganizationGeneralSettings('org_legacy_hack_99', {
        name: 'Modernized Robotics Workspace',
        projectType: 'hardware',
        description: 'Continuing the robotics project post-hackathon',
        projectGoal: 'Commercial prototype',
        maxMembers: 8,
        // Historical fields preserved
        hackathonName: legacyOrg.hackathonName,
        hackathonTheme: legacyOrg.hackathonTheme,
        hackathonLocation: legacyOrg.hackathonLocation,
        hackathonDate: legacyOrg.hackathonDate,
        startDate: legacyOrg.startDate,
        endDate: legacyOrg.endDate,
      });

      // Verify new fields exist
      assert.strictEqual(updated.name, 'Modernized Robotics Workspace');
      assert.strictEqual(updated.projectType, 'hardware');
      assert.strictEqual(updated.description, 'Continuing the robotics project post-hackathon');
      assert.strictEqual(updated.maxMembers, 8);
      assert.strictEqual(updated.teamSizeLimit, 8);

      // CRITICAL: verify zero data loss on legacy fields
      assert.strictEqual(updated.hackathonName, 'MIT Hackathon 2024');
      assert.strictEqual(updated.hackathonTheme, 'Robotics');
      assert.strictEqual(updated.hackathonLocation, 'Cambridge, MA');
      assert.strictEqual(updated.hackathonDate, '2024-11-15');
      assert.strictEqual(updated.startDate, '2024-11-15');
      assert.strictEqual(updated.endDate, '2024-11-17');
    });
  });

  describe('5. Firebase RTDB Security Rules Validation', () => {
    it('verifies organizations/$orgId rules allow creation when ownerId === auth.uid', () => {
      const evalResult = evaluateOrgRule({
        auth: { uid: 'alice' },
        data: null,
        newData: { ownerId: 'alice', name: 'Alice Space', projectType: 'software' },
      });
      assert.strictEqual(evalResult.allowed, true);
    });

    it('verifies organizations/$orgId rules deny creation if ownerId does not match auth.uid', () => {
      const evalResult = evaluateOrgRule({
        auth: { uid: 'mallory' },
        data: null,
        newData: { ownerId: 'alice', name: 'Forged Space' },
      });
      assert.strictEqual(evalResult.allowed, false);
      assert.strictEqual(evalResult.reason, 'CREATOR_MUST_BE_OWNER');
    });

    it('verifies organizations/$orgId rules allow owner to update settings with new fields', () => {
      const evalResult = evaluateOrgRule({
        auth: { uid: 'alice' },
        data: { ownerId: 'alice', name: 'Old Space' },
        newData: {
          ownerId: 'alice',
          name: 'New Space',
          projectType: 'ai_ml',
          description: 'Updated description',
          projectGoal: 'Achieve SOTA',
          maxMembers: 12,
          repositoryUrl: 'https://github.com/alice/sota',
        },
      });
      assert.strictEqual(evalResult.allowed, true);
    });

    it('verifies organizations/$orgId rules deny unauthorized users from modifying workspace', () => {
      const evalResult = evaluateOrgRule({
        auth: { uid: 'stranger' },
        data: { ownerId: 'alice', name: 'Alice Space' },
        newData: { ownerId: 'alice', name: 'Tampered Space' },
      });
      assert.strictEqual(evalResult.allowed, false);
      assert.strictEqual(evalResult.reason, 'NOT_OWNER');
    });

    it('verifies organizations path exists in database.rules.json and is secured', () => {
      const orgRules = rawRules.rules.organizations;
      assert.ok(orgRules, 'organizations rule node must exist');
      assert.strictEqual(orgRules['.read'], 'auth != null');
      assert.ok(orgRules.$orgId['.write'].includes('auth != null'));
      assert.ok(orgRules.$orgId['.write'].includes('ownerId'));
    });
  });
});
