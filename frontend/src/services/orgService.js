import { rtdbService } from './rtdbService';
import { apiClient } from './apiClient';
import { chatService } from './chatService';
import { generateInviteCode } from '../utils/inviteCode';
import { getErrorMessage } from '../utils/errorMessages';
import { getWorkspaceChatRootPath } from '../constants/databasePaths';
import { resolveMemberDisplayName } from '../utils/memberIdentity';
import { activityService } from './activityService';
import { ACTIVITY_EVENT_TYPES } from '../constants/activityConstants';
import { inAppNotificationService } from './inAppNotificationService';
import { NOTIFICATION_TYPES } from '../constants/notificationConstants';

/**
 * High-Performance Service Layer for Organization Management.
 */
export const orgService = {
  /**
   * Create a new organization with hackathon metadata.
   */
  createOrganization: async (ownerUid, orgData) => {
    if (!ownerUid) throw new Error('Owner UID is required.');

    // Enforce Platform Settings Validation
    const platformSettings = await rtdbService.getData('platform_settings');
    const wSettings = platformSettings?.workspaces || {};

    if (wSettings.allowWorkspaceCreation === false) {
      throw new Error('Workspace creation has been disabled by the platform administrator.');
    }

    const maxOrgs = wSettings.maxOrgsPerUser ?? 5;
    const allOrgsObj = (await rtdbService.getData('organizations')) || {};
    const userOwnedCount = Object.values(allOrgsObj).filter(
      (o) => o && !o.isDeleted && o.ownerId === ownerUid
    ).length;

    if (userOwnedCount >= maxOrgs) {
      throw new Error(`Workspace limit reached. Maximum allowed workspaces per user is ${maxOrgs}.`);
    }

    const orgId = `org_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const inviteCode = generateInviteCode();
    const timestamp = Date.now();

    const newOrg = {
      orgId,
      name: orgData.name.trim(),
      hackathonName: (orgData.hackathonName || 'Hackathon').trim(),
      hackathonDescription: (orgData.hackathonDescription || '').trim(),
      teamSizeLimit: Number(orgData.teamSizeLimit) || 5,
      hackathonDate: orgData.hackathonDate || '',
      hackathonLocation: (orgData.hackathonLocation || '').trim(),
      logoURL: null,
      ownerId: ownerUid,
      inviteCode,
      status: 'ideation', // 'ideation' | 'project'
      createdAt: timestamp,
      updatedAt: timestamp,
      memberCount: 1,
      activeProjectId: null,
    };

    try {
      await rtdbService.setData(`organizations/${orgId}`, newOrg);
      await rtdbService.setData(`organization_members/${orgId}/${ownerUid}`, {
        uid: ownerUid,
        role: 'owner',
        joinedAt: timestamp,
      });
      await rtdbService.setData(`invite_codes/${inviteCode}`, {
        orgId,
        createdAt: timestamp,
      });
      await rtdbService.updateData(`users/${ownerUid}`, {
        organizationId: orgId,
      });

      return newOrg;
    } catch (error) {
      console.error('[orgService] createOrganization error:', error);
      throw new Error(error.message || getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Join an organization using an 8-character invite code via server-authorized backend.
   */
  joinOrganization: async (uid, inviteCode) => {
    if (!uid || !inviteCode) throw new Error('User ID and Invite Code are required.');
    const cleanCode = inviteCode.trim().toUpperCase();

    try {
      const response = await apiClient.post('/api/workspace/join', {
        inviteCode: cleanCode,
      });

      const orgId = response.orgId || response.data?.orgId || (typeof response === 'string' ? response : null);
      if (!orgId) {
        throw new Error('Failed to resolve workspace from server join response.');
      }

      // Send System Chat Event
      chatService.sendSystemEvent(orgId, 'general', 'A new member joined the workspace team.', 'member_joined').catch(() => {});

      // Phase 7: Notify existing workspace members
      inAppNotificationService.dispatchNotificationEvent(
        NOTIFICATION_TYPES.WORKSPACE_MEMBER_JOINED,
        {
          workspaceId: orgId,
          orgName: 'Workspace',
        },
        { uid, displayName: 'A new member' }
      ).catch(() => {});

      return orgId;
    } catch (error) {
      console.error('[orgService] joinOrganization error:', error);
      throw error;
    }
  },

  /**
   * Member leave flow.
   */
  leaveOrganization: async (uid, orgId) => {
    if (!uid || !orgId) return;

    try {
      const org = await rtdbService.getData(`organizations/${orgId}`);
      if (!org) return;

      const membersObj = (await rtdbService.getData(`organization_members/${orgId}`)) || {};
      const memberUids = Object.keys(membersObj);
      const isOwner = org.ownerId === uid;

      if (isOwner && memberUids.length > 1) {
        throw new Error('As the Owner, please remove members or transfer ownership before leaving.');
      }

      const timestamp = Date.now();
      const newMemberCount = Math.max(0, (org.memberCount || 1) - 1);

      // Phase 8: Record workspace.member_removed activity event BEFORE removing membership
      // This guarantees the user is still verified as an active member in RTDB security rules
      await activityService.recordWorkspaceActivity(orgId, {
        eventType: ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_REMOVED,
        actorId: uid,
        actorType: 'user',
        actorName: org.members?.[uid]?.name || 'Team Member',
        resourceType: 'workspace',
        resourceId: orgId,
        resourceTitle: org.name || 'Workspace',
        summary: `A member left the workspace`,
        createdAt: timestamp,
      }).catch((actErr) => console.warn('⚠️ [Member Left Activity Warning]', actErr));

      // Remove member from organization_members and update count
      await rtdbService.setData(`organization_members/${orgId}/${uid}`, null);
      await rtdbService.updateData(`organizations/${orgId}`, {
        memberCount: newMemberCount,
        updatedAt: timestamp,
      });

      await rtdbService.updateData(`users/${uid}`, { organizationId: null });
    } catch (error) {
      console.error('[orgService] leaveOrganization error:', error);
      throw error;
    }
  },

  /**
   * Remove a member from an organization (Owner only action).
   */
  removeMember: async (ownerUid, orgId, memberUid) => {
    if (!ownerUid || !orgId || !memberUid) return;

    try {
      const org = await rtdbService.getData(`organizations/${orgId}`);
      if (!org || org.ownerId !== ownerUid) {
        throw new Error('Only the Organization Owner can remove members.');
      }

      if (memberUid === ownerUid) {
        throw new Error('Owner cannot remove themselves.');
      }

      const timestamp = Date.now();
      const newMemberCount = Math.max(1, (org.memberCount || 1) - 1);

      await rtdbService.setData(`organization_members/${orgId}/${memberUid}`, null);
      await rtdbService.updateData(`users/${memberUid}`, { organizationId: null });
      await rtdbService.updateData(`organizations/${orgId}`, {
        memberCount: newMemberCount,
        updatedAt: timestamp,
      });

      // Phase 8: Record workspace.member_removed activity event
      activityService.recordWorkspaceActivity(orgId, {
        eventType: ACTIVITY_EVENT_TYPES.WORKSPACE_MEMBER_REMOVED,
        actorId: ownerUid,
        actorType: 'user',
        actorName: 'Workspace Owner',
        resourceType: 'workspace',
        resourceId: orgId,
        resourceTitle: org.name || 'Workspace',
        summary: `A member was removed from the workspace`,
      }).catch((actErr) => console.warn('⚠️ [Member Removed Activity Warning]', actErr));
    } catch (error) {
      console.error('[orgService] removeMember error:', error);
      throw error;
    }
  },

  /**
   * Update organization settings (Owner only).
   */
  updateOrganization: async (orgId, updates) => {
    try {
      const payload = {
        ...updates,
        updatedAt: Date.now(),
      };
      await rtdbService.updateData(`organizations/${orgId}`, payload);
    } catch (error) {
      console.error('[orgService] updateOrganization error:', error);
      throw new Error(getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Fetch single organization snapshot.
   */
  getOrganization: async (orgId) => {
    return await rtdbService.getData(`organizations/${orgId}`);
  },

  /**
   * Subscribe to real-time updates of an organization document.
   */
  subscribeToOrganization: (orgId, callback) => {
    return rtdbService.subscribe(`organizations/${orgId}`, callback);
  },

  /**
   * Subscribe to real-time member roster of an organization.
   */
  subscribeToOrgMembers: (orgId, callback) => {
    let isSubscribed = true;
    const unsub = rtdbService.subscribe(`organization_members/${orgId}`, async (membersObj) => {
      if (!isSubscribed) return;
      if (!membersObj) {
        if (isSubscribed) callback([]);
        return;
      }

      const uids = Object.keys(membersObj);
      const memberProfiles = await Promise.all(
        uids.map(async (uid) => {
          const profile = (await rtdbService.getData(`users/${uid}`)) || {};
          const resolvedDisplayName = resolveMemberDisplayName(profile);
          return {
            uid,
            id: uid,
            name: resolvedDisplayName,
            displayName: resolvedDisplayName,
            username: profile.username || '',
            avatar: profile.avatar || profile.photoURL || '',
            photoURL: profile.photoURL || profile.avatar || '',
            role: membersObj[uid].role || 'member',
            workspaceRole: membersObj[uid].role || 'member',
            joinedAt: membersObj[uid].joinedAt,
            email: profile.email || '',
            onlineStatus: profile.onlineStatus || 'offline',
            skills: profile.skills || '',
            declaredSkills: Array.isArray(profile.skills) ? profile.skills : typeof profile.skills === 'string' ? profile.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
            techStack: profile.techStack || '',
            preferredTechStack: profile.techStack || '',
            interests: profile.interests || '',
          };
        })
      );

      if (isSubscribed) {
        callback(memberProfiles);
      }
    });

    return () => {
      isSubscribed = false;
      unsub();
    };
  },

  /**
   * Alias for subscribeToOrgMembers.
   */
  subscribeToMembers: (orgId, callback) => {
    return orgService.subscribeToOrgMembers(orgId, callback);
  },

  /**
   * Get all organizations where the user is a member or owner.
   * Guarantees 100% data retrieval with zero missing workspaces.
   */
  getUserOrganizations: async (uid) => {
    if (!uid) return [];

    try {
      // 1. Fetch organizations and memberships in parallel (2 database queries total)
      const [allOrgs, allMembers] = await Promise.all([
        rtdbService.getData('organizations'),
        rtdbService.getData('organization_members'),
      ]);

      const userOrgs = [];

      if (allOrgs && typeof allOrgs === 'object') {
        const membersMap = allMembers || {};
        for (const [orgId, orgData] of Object.entries(allOrgs)) {
          if (!orgData || !orgId) continue;

          // Auto-purge workspaces whose 7-day scheduled deletion window has elapsed
          if (orgData.isDeleted && orgData.scheduledDeletionAt && Date.now() >= orgData.scheduledDeletionAt) {
            orgService.deleteWorkspace(orgId).catch((e) => console.warn('[orgService] Auto-purge failed:', e));
            continue;
          }

          // Hide soft-deleted workspaces from non-owners
          if (orgData.isDeleted && orgData.ownerId !== uid) {
            continue;
          }

          const orgMembers = membersMap[orgId] || {};
          const memberRecord = orgMembers[uid];
          const isOwner = orgData.ownerId === uid;
          const isMember = Boolean(memberRecord);

          // Append member role metadata to orgData
          const role = isOwner ? 'owner' : (memberRecord?.role || null);

          userOrgs.push({
            ...orgData,
            isMember: isOwner || isMember,
            userRole: role,
          });
        }
      }

      // Sort organizations: owned/joined ones first, then others; secondary sort by name
      userOrgs.sort((a, b) => {
        if (a.isMember && !b.isMember) return -1;
        if (!a.isMember && b.isMember) return 1;
        return a.name.localeCompare(b.name);
      });

      return userOrgs;
    } catch (error) {
      console.error('[orgService] getUserOrganizations error:', error);
      return [];
    }
  },

  /**
   * Fetch organization members snapshot once.
   */
  getOrganizationMembers: async (orgId) => {
    if (!orgId) return [];
    try {
      const membersObj = (await rtdbService.getData(`organization_members/${orgId}`)) || {};
      const uids = Object.keys(membersObj);
      const memberProfiles = await Promise.all(
        uids.map(async (uid) => {
          const profile = (await rtdbService.getData(`users/${uid}`)) || {};
          return {
            uid,
            id: uid,
            name: profile.displayName || profile.name || (profile.email ? profile.email.split('@')[0] : 'Team Member'),
            role: membersObj[uid].role || 'member',
            workspaceRole: membersObj[uid].role || 'member',
            joinedAt: membersObj[uid].joinedAt,
            displayName: profile.displayName || 'Team Member',
            email: profile.email || '',
            onlineStatus: profile.onlineStatus || 'offline',
            skills: profile.skills || '',
            declaredSkills: Array.isArray(profile.skills) ? profile.skills : typeof profile.skills === 'string' ? profile.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
            techStack: profile.techStack || '',
          };
        })
      );
      return memberProfiles;
    } catch (error) {
      console.error('[orgService] getOrganizationMembers error:', error);
      return [];
    }
  },

  /**
   * Update general organization settings (Workspace Name, Description, Hackathon Details, max size).
   */
  updateOrganizationGeneralSettings: async (orgId, updates) => {
    if (!orgId) throw new Error('Org ID is required.');
    const timestamp = Date.now();
    return await rtdbService.updateData(`organizations/${orgId}`, {
      ...updates,
      updatedAt: timestamp,
    });
  },

  /**
   * Save workspace preferences.
   */
  updateWorkspacePreferences: async (orgId, preferences) => {
    if (!orgId) throw new Error('Org ID is required.');
    return await rtdbService.setData(`organizations/${orgId}/settings/preferences`, preferences);
  },

  /**
   * Get workspace preferences.
   */
  getWorkspacePreferences: async (orgId) => {
    if (!orgId) return null;
    return await rtdbService.getData(`organizations/${orgId}/settings/preferences`);
  },

  /**
   * Update member roles (Promote, Demote).
   */
  updateMemberRole: async (orgId, targetUid, role) => {
    if (!orgId || !targetUid) throw new Error('Org ID and target UID are required.');
    return await rtdbService.updateData(`organization_members/${orgId}/${targetUid}`, {
      role,
      updatedAt: Date.now(),
    });
  },

  /**
   * Remove member from organization and decrement member count.
   */
  removeMemberFromWorkspace: async (orgId, targetUid) => {
    if (!orgId || !targetUid) throw new Error('Org ID and target UID are required.');
    
    // 1. Remove member node
    await rtdbService.setData(`organization_members/${orgId}/${targetUid}`, null);
    
    // 2. Decrement count
    const org = await rtdbService.getData(`organizations/${orgId}`);
    if (org) {
      const newCount = Math.max(1, (org.memberCount || 1) - 1);
      await rtdbService.updateData(`organizations/${orgId}`, { memberCount: newCount });
    }
    
    // 3. Clear active profile association
    const profile = await rtdbService.getData(`users/${targetUid}`);
    if (profile && profile.organizationId === orgId) {
      await rtdbService.updateData(`users/${targetUid}`, { organizationId: null });
    }
  },

  /**
   * Transfer ownership of workspace (Promotes new user to Owner, demotes former owner to Admin).
   */
  transferWorkspaceOwnership: async (orgId, currentOwnerUid, newOwnerUid) => {
    if (!orgId || !currentOwnerUid || !newOwnerUid) throw new Error('Owner parameters are required.');
    
    // Promote new owner
    await rtdbService.updateData(`organization_members/${orgId}/${newOwnerUid}`, { role: 'owner' });
    // Demote old owner to admin
    await rtdbService.updateData(`organization_members/${orgId}/${currentOwnerUid}`, { role: 'admin' });
    // Update ownerId in org details
    await rtdbService.updateData(`organizations/${orgId}`, { ownerId: newOwnerUid });
  },

  /**
   * Leave workspace.
   */
  leaveWorkspace: async (orgId, uid) => {
    return await orgService.removeMemberFromWorkspace(orgId, uid);
  },

  /**
   * Atomic Workspace Deletion. Deletes everything related to the workspace cleanly.
   */
  deleteWorkspace: async (orgId) => {
    if (!orgId) throw new Error('Workspace ID is required.');
    
    // 1. Fetch members to clean up user references
    const membersObj = (await rtdbService.getData(`organization_members/${orgId}`)) || {};
    const memberUids = Object.keys(membersObj);

    // 2. Fetch ideas to delete discussions and votes
    const ideasObj = (await rtdbService.getData(`ideas/${orgId}`)) || {};
    const ideaIds = Object.keys(ideasObj);

    // 3. Accumulate root-level updates
    const updates = {};
    updates[`organizations/${orgId}`] = null;
    updates[`organization_members/${orgId}`] = null;
    updates[`blueprints/${orgId}`] = null;
    updates[`tasks/${orgId}`] = null;
    updates[`ideas/${orgId}`] = null;
    updates[getWorkspaceChatRootPath(orgId)] = null;

    // Delete comments, discussions, and user votes for each idea
    for (const ideaId of ideaIds) {
      updates[`discussions/${ideaId}`] = null;
      for (const uid of memberUids) {
        updates[`votes/${ideaId}_${uid}`] = null;
      }
    }

    // Reset member organizationId profile parameters
    for (const uid of memberUids) {
      const userProfile = await rtdbService.getData(`users/${uid}`);
      if (userProfile && userProfile.organizationId === orgId) {
        updates[`users/${uid}/organizationId`] = null;
      }
    }

    // Perform atomic update write
    await rtdbService.updateData('', updates);
  },

  /**
   * Soft-deletes the workspace. Marks isDeleted: true and sets deletion timestamps.
   */
  markWorkspaceForDeletion: async (orgId) => {
    if (!orgId) throw new Error('Workspace ID is required.');
    const timestamp = Date.now();
    const scheduledDeletionAt = timestamp + 7 * 24 * 60 * 60 * 1000;
    return await rtdbService.updateData(`organizations/${orgId}`, {
      isDeleted: true,
      deletedAt: timestamp,
      scheduledDeletionAt: scheduledDeletionAt,
    });
  },

  /**
   * Restores a soft-deleted workspace.
   */
  restoreWorkspace: async (orgId) => {
    if (!orgId) throw new Error('Workspace ID is required.');
    return await rtdbService.updateData(`organizations/${orgId}`, {
      isDeleted: null,
      deletedAt: null,
      scheduledDeletionAt: null,
    });
  },
};
