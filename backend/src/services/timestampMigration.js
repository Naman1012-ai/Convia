import { rtdbService } from './rtdbService.js';

/**
 * Idempotent Migration Service for User and Workspace Join Timestamps.
 *
 * Enforces two separate, immutable timestamp invariants across Convia:
 * 1. `firstSignedInAt`: Immutable timestamp recorded in user profile (`users/${uid}`)
 *    upon the user's first successful authenticated sign-in to Convia.
 * 2. `joinedAt`: Immutable timestamp recorded in membership record (`organization_members/${workspaceId}/${uid}`)
 *    upon first becoming a member of a specific workspace.
 */
export const timestampMigration = {
  /**
   * Idempotently backfills missing `firstSignedInAt` on user profile records.
   * Never overwrites existing `firstSignedInAt` values.
   */
  migrateUserFirstSignedInAt: async () => {
    try {
      const usersObj = (await rtdbService.getData('users')) || {};
      const updates = {};
      let migratedCount = 0;

      for (const [uid, userProfile] of Object.entries(usersObj)) {
        if (!userProfile || typeof userProfile !== 'object') continue;

        // Skip if firstSignedInAt is already established
        if (userProfile.firstSignedInAt) continue;

        // Determine earliest authoritative fallback
        const fallbackTime =
          userProfile.createdAt ||
          userProfile.joinedAt ||
          userProfile.updatedAt ||
          null;

        if (fallbackTime) {
          updates[`users/${uid}/firstSignedInAt`] = fallbackTime;
          migratedCount++;
        }
      }

      if (Object.keys(updates).length > 0) {
        await rtdbService.updateData('', updates);
      }

      return {
        success: true,
        migratedCount,
        message: `Successfully migrated ${migratedCount} user profile firstSignedInAt timestamps.`,
      };
    } catch (error) {
      console.error('[timestampMigration] migrateUserFirstSignedInAt error:', error);
      throw error;
    }
  },

  /**
   * Verifies and idempotently backfills workspace membership `joinedAt` timestamps.
   * Never overwrites existing `joinedAt` values.
   */
  verifyWorkspaceMemberJoinedAt: async () => {
    try {
      const orgMembersObj = (await rtdbService.getData('organization_members')) || {};
      const orgsObj = (await rtdbService.getData('organizations')) || {};
      const updates = {};
      let verifiedCount = 0;

      for (const [orgId, membersMap] of Object.entries(orgMembersObj)) {
        if (!membersMap || typeof membersMap !== 'object') continue;
        const orgCreatedAt = orgsObj[orgId]?.createdAt || null;

        for (const [uid, memberData] of Object.entries(membersMap)) {
          if (!memberData || typeof memberData !== 'object') continue;

          // Skip if joinedAt is already established
          if (memberData.joinedAt) continue;

          // Determine fallback timestamp from org creation or member update
          const fallbackTime = memberData.updatedAt || orgCreatedAt || null;
          if (fallbackTime) {
            updates[`organization_members/${orgId}/${uid}/joinedAt`] = fallbackTime;
            verifiedCount++;
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await rtdbService.updateData('', updates);
      }

      return {
        success: true,
        verifiedCount,
        message: `Successfully verified ${verifiedCount} workspace membership joinedAt timestamps.`,
      };
    } catch (error) {
      console.error('[timestampMigration] verifyWorkspaceMemberJoinedAt error:', error);
      throw error;
    }
  },

  /**
   * Run full global timestamp audit & migration.
   */
  runGlobalTimestampMigration: async () => {
    const userResult = await timestampMigration.migrateUserFirstSignedInAt();
    const memberResult = await timestampMigration.verifyWorkspaceMemberJoinedAt();

    return {
      success: true,
      usersMigrated: userResult.migratedCount,
      membersVerified: memberResult.verifiedCount,
      message: 'Global timestamp audit & migration completed successfully.',
    };
  },
};
