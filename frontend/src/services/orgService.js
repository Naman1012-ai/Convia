import { rtdbService } from './rtdbService';
import { apiClient } from './apiClient';
import { chatService } from './chatService';
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
      status: 'ideation', // 'ideation' | 'project'
      createdAt: timestamp,
      updatedAt: timestamp,
      memberCount: 1,
      activeProjectId: null,
      ...(orgData.hackathonName ? { hackathonName: orgData.hackathonName.trim() } : {}),
      ...(orgData.hackathonDescription ? { hackathonDescription: orgData.hackathonDescription.trim() } : {}),
      ...(orgData.hackathonDate ? { hackathonDate: orgData.hackathonDate } : {}),
      ...(orgData.hackathonLocation ? { hackathonLocation: orgData.hackathonLocation.trim() } : {}),
    };

    try {
      await rtdbService.setData(`organizations/${orgId}`, newOrg);
      await rtdbService.setData(`organization_members/${orgId}/${ownerUid}`, {
        uid: ownerUid,
        role: 'owner',
        joinedAt: timestamp,
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
   * Retired: Legacy 8-character invite code join flow.
   * Convia now exclusively uses email-bound invitation codes (format: CNV-XXXX-XXXX).
   */
  joinOrganization: async () => {
    throw new Error(
      'Legacy 8-character workspace invite codes have been retired. Please use an email-bound invitation code (format: CNV-XXXX-XXXX).'
    );
  },

  /**
   * Member leave flow (delegates to canonical leaveWorkspace).
   */
  leaveOrganization: async (uid, orgId) => {
    return await orgService.leaveWorkspace(orgId, uid);
  },

  /**
   * Remove a member from an organization (delegates to canonical removeMemberFromWorkspace).
   */
  removeMember: async (ownerUid, orgId, memberUid) => {
    return await orgService.removeMemberFromWorkspace(orgId, memberUid);
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
          const memberData = membersObj[uid] || {};
          return {
            uid,
            id: uid,
            name: resolvedDisplayName,
            displayName: resolvedDisplayName,
            username: profile.username || '',
            avatar: profile.avatar || profile.photoURL || '',
            photoURL: profile.photoURL || profile.avatar || '',
            role: memberData.role || 'member',
            workspaceRole: memberData.role || 'member',
            isSecondOwner: Boolean(memberData.isSecondOwner || memberData.role === 'second_owner'),
            isTeamCaptain: Boolean(memberData.isTeamCaptain || memberData.role === 'team_captain'),
            joinedAt: memberData.joinedAt,
            email: profile.email || memberData.email || '',
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
   * Counts unique active member UIDs from an organization_members object.
   * Excludes inactive or removed records and guarantees UID uniqueness (Set).
   */
  countUniqueActiveMembers: (membersObj) => {
    if (!membersObj || typeof membersObj !== 'object') return 0;
    const activeUids = new Set();
    for (const [key, val] of Object.entries(membersObj)) {
      if (!val || typeof val !== 'object') continue;
      if (val.status === 'inactive' || val.status === 'removed' || val.isDeleted) continue;
      const uid = val.uid || key;
      if (uid && typeof uid === 'string' && uid.trim()) {
        activeUids.add(uid.trim());
      }
    }
    return activeUids.size;
  },

  /**
   * Retrieves canonical active member count from RTDB organization_members node.
   */
  getActiveWorkspaceMemberCount: async (orgId) => {
    if (!orgId) return 0;
    const membersObj = await rtdbService.getData(`organization_members/${orgId}`);
    return orgService.countUniqueActiveMembers(membersObj);
  },

  /**
   * Get all organizations where the user is an active member or owner.
   * Guarantees 100% data retrieval and derives member count canonically from active membership data.
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
          const isMember = Boolean(
            isOwner || (memberRecord && memberRecord.status !== 'inactive' && memberRecord.status !== 'removed')
          );

          // Section 10: Workspace should appear in user's active list only if user has active membership
          if (!isOwner && !isMember) {
            continue;
          }

          // Canonical member count derived authoritatively from active membership records
          const canonicalCount = orgService.countUniqueActiveMembers(orgMembers);
          const role = isOwner ? 'owner' : (memberRecord?.role || 'member');

          userOrgs.push({
            ...orgData,
            memberCount: canonicalCount,
            isMember: true,
            userRole: role,
          });
        }
      }

      // Sort organizations: owned first, then alphabetically
      userOrgs.sort((a, b) => {
        if (a.ownerId === uid && b.ownerId !== uid) return -1;
        if (a.ownerId !== uid && b.ownerId === uid) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });

      return userOrgs;
    } catch (error) {
      console.error('[orgService] getUserOrganizations error:', error);
      return [];
    }
  },

  /**
   * Subscribes to real-time updates of the user's active workspaces.
   * Listens to both organizations and organization_members for live count and roster changes.
   */
  subscribeToUserOrganizations: (uid, callback) => {
    if (!uid) {
      callback([]);
      return () => {};
    }

    let isSubscribed = true;
    let latestOrgs = null;
    let latestMembers = null;

    const emitUserOrgs = () => {
      if (!isSubscribed || !latestOrgs) return;
      const membersMap = latestMembers || {};
      const userOrgs = [];

      for (const [orgId, orgData] of Object.entries(latestOrgs)) {
        if (!orgData || !orgId) continue;
        if (orgData.isDeleted && orgData.ownerId !== uid) continue;

        const orgMembers = membersMap[orgId] || {};
        const isOwner = orgData.ownerId === uid;
        const memberRecord = orgMembers[uid];
        const isMember = Boolean(
          isOwner || (memberRecord && memberRecord.status !== 'inactive' && memberRecord.status !== 'removed')
        );

        if (!isOwner && !isMember) continue;

        const canonicalCount = orgService.countUniqueActiveMembers(orgMembers);
        const role = isOwner ? 'owner' : (memberRecord?.role || 'member');

        userOrgs.push({
          ...orgData,
          memberCount: canonicalCount,
          isMember: true,
          userRole: role,
        });
      }

      userOrgs.sort((a, b) => {
        if (a.ownerId === uid && b.ownerId !== uid) return -1;
        if (a.ownerId !== uid && b.ownerId === uid) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });

      callback(userOrgs);
    };

    const unsubOrgs = rtdbService.subscribe('organizations', (orgsData) => {
      latestOrgs = orgsData || {};
      emitUserOrgs();
    });

    const unsubMembers = rtdbService.subscribe('organization_members', (membersData) => {
      latestMembers = membersData || {};
      emitUserOrgs();
    });

    return () => {
      isSubscribed = false;
      unsubOrgs();
      unsubMembers();
    };
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
          const memberData = membersObj[uid] || {};
          return {
            uid,
            id: uid,
            name: profile.displayName || profile.name || (profile.email ? profile.email.split('@')[0] : 'Team Member'),
            role: memberData.role || 'member',
            workspaceRole: memberData.role || 'member',
            isSecondOwner: Boolean(memberData.isSecondOwner || memberData.role === 'second_owner'),
            isTeamCaptain: Boolean(memberData.isTeamCaptain || memberData.role === 'team_captain'),
            joinedAt: memberData.joinedAt,
            displayName: profile.displayName || 'Team Member',
            email: profile.email || memberData.email || '',
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
   * Update general organization settings (Workspace Name, Description, Project Details, max members).
   */
  updateOrganizationGeneralSettings: async (orgId, updates) => {
    if (!orgId) throw new Error('Org ID is required.');
    const timestamp = Date.now();
    const normalizedUpdates = { ...updates };

    if (normalizedUpdates.maxMembers !== undefined) {
      normalizedUpdates.teamSizeLimit = Number(normalizedUpdates.maxMembers);
    } else if (normalizedUpdates.teamSizeLimit !== undefined) {
      normalizedUpdates.maxMembers = Number(normalizedUpdates.teamSizeLimit);
    }

    try {
      return await rtdbService.updateData(`organizations/${orgId}`, {
        ...normalizedUpdates,
        updatedAt: timestamp,
      });
    } catch (error) {
      if (
        error.code === 'PERMISSION_DENIED' ||
        error.message?.includes('PERMISSION_DENIED') ||
        error.message?.includes('permission') ||
        error.message?.includes('Permission denied')
      ) {
        throw new Error("You don't have permission to modify this workspace.");
      }
      throw error;
    }
  },

  /**
   * Save workspace preferences.
   */
  updateWorkspacePreferences: async (orgId, preferences) => {
    if (!orgId) throw new Error('Org ID is required.');
    try {
      return await rtdbService.setData(`organizations/${orgId}/settings/preferences`, preferences);
    } catch (error) {
      if (
        error.code === 'PERMISSION_DENIED' ||
        error.message?.includes('PERMISSION_DENIED') ||
        error.message?.includes('permission') ||
        error.message?.includes('Permission denied')
      ) {
        throw new Error("You don't have permission to modify this workspace.");
      }
      throw error;
    }
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
   * Assign or remove Second Owner designation authoritatively via Express API.
   */
  updateSecondOwner: async (orgId, targetUid, action = 'assign') => {
    if (!orgId || !targetUid) throw new Error('Workspace ID and target UID are required.');
    const response = await apiClient.post(`/api/workspace/${orgId}/members/${targetUid}/second-owner`, { action });
    if (response && response.success) {
      return response.data;
    }
    throw new Error(response?.error?.message || 'Failed to update Second Owner designation.');
  },

  /**
   * Assign or remove Team Captain designation authoritatively via Express API.
   */
  updateTeamCaptain: async (orgId, targetUid, action = 'assign') => {
    if (!orgId || !targetUid) throw new Error('Workspace ID and target UID are required.');
    const response = await apiClient.post(`/api/workspace/${orgId}/members/${targetUid}/team-captain`, { action });
    if (response && response.success) {
      return response.data;
    }
    throw new Error(response?.error?.message || 'Failed to update Team Captain designation.');
  },

  /**
   * Transfer workspace ownership authoritatively via Express API.
   */
  transferOwnership: async (orgId, newOwnerUid, formerOwnerRole = 'team_captain') => {
    if (!orgId || !newOwnerUid) throw new Error('Workspace ID and new Owner UID are required.');
    const response = await apiClient.post(`/api/workspace/${orgId}/transfer-ownership`, {
      newOwnerUid,
      formerOwnerRole,
    });
    if (response && response.success) {
      return response.data;
    }
    throw new Error(response?.error?.message || 'Failed to transfer workspace ownership.');
  },

  /**
   * Compatibility alias for removeMemberFromWorkspace.
   */
  removeMember: async (ownerUid, orgId, targetUid) => {
    return orgService.removeMemberFromWorkspace(orgId || ownerUid, targetUid || orgId);
  },

  /**
   * Remove member from organization authoritatively.
   */
  removeMemberFromWorkspace: async (orgId, targetUid) => {
    if (!orgId || !targetUid) throw new Error('Org ID and target UID are required.');

    // 1. Authoritative Backend Flow via Admin SDK
    try {
      const response = await apiClient.delete(`/api/workspace/${orgId}/members/${targetUid}`);
      if (response && response.success) {
        return response.data;
      }
    } catch (apiErr) {
      if (
        apiErr.code === 'CANNOT_REMOVE_OWNER' ||
        apiErr.code === 'CANNOT_REMOVE_ADMIN' ||
        apiErr.code === 'INSUFFICIENT_ROLE'
      ) {
        throw apiErr;
      }
      console.warn('⚠️ [orgService] Backend remove member endpoint unavailable, falling back to direct RTDB write:', apiErr.message);
    }

    // 2. Direct RTDB Fallback
    const org = await rtdbService.getData(`organizations/${orgId}`);
    if (org && (org.ownerId === targetUid || org.createdBy === targetUid)) {
      throw new Error('The workspace owner cannot be removed.');
    }

    await rtdbService.setData(`organization_members/${orgId}/${targetUid}`, null);

    const membersObj = (await rtdbService.getData(`organization_members/${orgId}`)) || {};
    delete membersObj[targetUid];
    const canonicalCount = orgService.countUniqueActiveMembers(membersObj);

    try {
      await rtdbService.updateData(`organizations/${orgId}`, {
        memberCount: canonicalCount,
        updatedAt: Date.now(),
      });
    } catch (countErr) {
      console.warn('⚠️ [orgService] Could not update memberCount on organization directly:', countErr.message);
    }

    const profile = await rtdbService.getData(`users/${targetUid}`);
    if (profile && profile.organizationId === orgId) {
      await rtdbService.updateData(`users/${targetUid}`, { organizationId: null });
    }

    return { success: true, memberCount: canonicalCount };
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
   * Authoritative leave workspace flow.
   * Enforces owner leave restrictions and decreases canonical member count.
   */
  leaveWorkspace: async (orgId, uid) => {
    if (!orgId || !uid) throw new Error('Org ID and User UID are required.');

    // 1. Authoritative Backend Flow via Admin SDK
    try {
      const response = await apiClient.post(`/api/workspace/${orgId}/leave`);
      if (response && response.success) {
        return response.data;
      }
    } catch (apiErr) {
      if (
        apiErr.code === 'OWNER_CANNOT_LEAVE' ||
        apiErr.code === 'OWNER_CANNOT_LEAVE_WITH_MEMBERS' ||
        apiErr.code === 'NOT_A_MEMBER'
      ) {
        throw apiErr;
      }
      console.warn('⚠️ [orgService] Backend leave endpoint unavailable, falling back to direct RTDB write:', apiErr.message);
    }

    // 2. Direct RTDB Fallback
    const org = await rtdbService.getData(`organizations/${orgId}`);
    if (!org) return;

    const membersObj = (await rtdbService.getData(`organization_members/${orgId}`)) || {};
    const memberUids = Object.keys(membersObj);
    const isOwner = org.ownerId === uid || org.createdBy === uid;

    if (isOwner && memberUids.length > 1) {
      throw new Error('As the Owner, please remove members or transfer ownership before leaving.');
    } else if (isOwner) {
      throw new Error('Workspace owners cannot leave their workspace. You can transfer ownership or delete the workspace.');
    }

    const timestamp = Date.now();
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
    }).catch(() => {});

    await rtdbService.setData(`organization_members/${orgId}/${uid}`, null);

    delete membersObj[uid];
    const canonicalCount = orgService.countUniqueActiveMembers(membersObj);
    try {
      await rtdbService.updateData(`organizations/${orgId}`, {
        memberCount: canonicalCount,
        updatedAt: timestamp,
      });
    } catch (countErr) {
      // Direct write denied for non-admins by RTDB rules; UI derives from organization_members
    }

    await rtdbService.updateData(`users/${uid}`, { organizationId: null });
    return { success: true, memberCount: canonicalCount };
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
    updates[`discussions/${orgId}`] = null;
    updates[getWorkspaceChatRootPath(orgId)] = null;

    // Delete user votes for each idea
    for (const ideaId of ideaIds) {
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
