import { rtdbService } from './rtdbService.js';

/**
 * Convia Two-Role Model Idempotent Database Migration Utility
 *
 * Scans Realtime Database nodes:
 * 1. organization_members/{orgId}
 * 2. workspace_invitations/{orgId}
 *
 * Converts legacy 'second_owner' and 'isSecondOwner' records to canonical 'team_captain' and 'isTeamCaptain'.
 * Ensures Original Owner identity remains untouched.
 *
 * @returns {Promise<{
 *   scannedWorkspaces: number,
 *   migratedMembers: number,
 *   migratedInvitations: number,
 *   updatedNodes: number
 * }>}
 */
export async function migrateWorkspaceRolesToTwoRoleModel() {
  const [allMembersData, allInvitesData, allOrgsData] = await Promise.all([
    rtdbService.getData('organization_members').catch(() => ({})),
    rtdbService.getData('workspace_invitations').catch(() => ({})),
    rtdbService.getData('organizations').catch(() => ({})),
  ]);

  const atomicUpdates = {};
  let scannedWorkspaces = 0;
  let migratedMembers = 0;
  let migratedInvitations = 0;

  const orgIds = new Set([
    ...Object.keys(allMembersData || {}),
    ...Object.keys(allInvitesData || {}),
    ...Object.keys(allOrgsData || {}),
  ]);

  const timestamp = Date.now();

  for (const orgId of orgIds) {
    if (!orgId || typeof orgId !== 'string') continue;
    scannedWorkspaces++;

    const orgRecord = (allOrgsData && allOrgsData[orgId]) || {};
    const ownerUid = orgRecord.ownerId || orgRecord.createdBy || orgRecord.ownerUid || null;

    // 1. Migrate Membership Records
    const membersObj = (allMembersData && allMembersData[orgId]) || {};
    let captainAssigned = false;

    for (const [uid, member] of Object.entries(membersObj)) {
      if (!member || typeof member !== 'object') continue;

      // Original owner remains canonical owner
      if (uid === ownerUid || member.role === 'owner') continue;

      const isLegacySecondOwner = Boolean(member.isSecondOwner || member.role === 'second_owner');
      const isCaptain = Boolean(member.isTeamCaptain || member.role === 'team_captain');

      if (isLegacySecondOwner || isCaptain) {
        if (!captainAssigned) {
          // Promote first second_owner / team_captain to canonical team_captain role
          atomicUpdates[`organization_members/${orgId}/${uid}/role`] = 'team_captain';
          atomicUpdates[`organization_members/${orgId}/${uid}/isTeamCaptain`] = true;
          atomicUpdates[`organization_members/${orgId}/${uid}/isSecondOwner`] = false;
          atomicUpdates[`organization_members/${orgId}/${uid}/updatedAt`] = timestamp;
          migratedMembers++;
          captainAssigned = true;
        } else {
          // If a captain already exists, convert additional second_owner to standard member to enforce 1-Captain rule
          atomicUpdates[`organization_members/${orgId}/${uid}/role`] = 'member';
          atomicUpdates[`organization_members/${orgId}/${uid}/isTeamCaptain`] = false;
          atomicUpdates[`organization_members/${orgId}/${uid}/isSecondOwner`] = false;
          atomicUpdates[`organization_members/${orgId}/${uid}/updatedAt`] = timestamp;
          migratedMembers++;
        }
      }
    }

    // 2. Migrate Invitation Records
    const invitesObj = (allInvitesData && allInvitesData[orgId]) || {};
    for (const [invId, inv] of Object.entries(invitesObj)) {
      if (!inv || typeof inv !== 'object') continue;

      if (inv.isSecondOwner || inv.role === 'second_owner') {
        atomicUpdates[`workspace_invitations/${orgId}/${invId}/role`] = 'team_captain';
        atomicUpdates[`workspace_invitations/${orgId}/${invId}/isTeamCaptain`] = true;
        atomicUpdates[`workspace_invitations/${orgId}/${invId}/isSecondOwner`] = false;
        migratedInvitations++;
      }
    }
  }

  const updatedNodes = Object.keys(atomicUpdates).length;
  if (updatedNodes > 0) {
    await rtdbService.updateData('', atomicUpdates);
  }

  return {
    scannedWorkspaces,
    migratedMembers,
    migratedInvitations,
    updatedNodes,
  };
}
