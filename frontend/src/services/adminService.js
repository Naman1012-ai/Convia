import { rtdbService } from './rtdbService';
import { orgService } from './orgService';
import { ideaService } from './ideaService';
import { authService } from './authService';
import { apiClient } from './apiClient';
import { getErrorMessage } from '../utils/errorMessages';

/**
 * Service Layer for Admin Portal, User Moderation & Live Platform Analytics.
 * Subscribes directly to real Firebase RTDB trees to compute authoritative live statistics.
 */
export const adminService = {
  /**
   * Real-time subscription to full platform operational metrics & live activity.
   */
  subscribeToPlatformMetrics: (callback) => {
    let usersData = {};
    let orgsData = {};
    let ideasData = {};
    let publicIdeasData = {};
    let tasksData = {};
    let reportsData = {};
    let blueprintsData = {};

    let unsubscribeFunctions = [];

    const computeAndEmit = () => {
      const userList = Object.values(usersData || {}).filter(Boolean);
      const totalUsers = userList.length;
      const verifiedUsers = userList.filter((u) => u.emailVerified || u.profileCompleted).length;
      const onlineUsers = userList.filter((u) => u.onlineStatus === 'online').length;

      const orgList = Object.values(orgsData || {}).filter((o) => o && !o.isDeleted);
      const totalWorkspaces = orgList.length;
      const activeWorkspaces = orgList.filter((o) => o.status === 'project' || o.status === 'active').length;

      const workspaceIdeasObjList = Object.values(ideasData || {});
      let allWorkspaceIdeas = [];
      workspaceIdeasObjList.forEach((orgIdeasMap) => {
        if (orgIdeasMap) {
          allWorkspaceIdeas.push(...Object.values(orgIdeasMap).filter((i) => i && !i.isDeleted));
        }
      });

      const publicIdeasList = Object.values(publicIdeasData || {}).filter((i) => i && !i.isDeleted);
      const allIdeas = [...allWorkspaceIdeas, ...publicIdeasList];

      const totalIdeas = allIdeas.length;
      const selectedMvps = allIdeas.filter((i) => i.isSelected || i.projectStatus === 'Selected MVP').length;
      const projectIdeas = allIdeas.filter((i) => i.projectStatus === 'Project' || i.status === 'selected').length;
      const completedIdeas = allIdeas.filter((i) => i.projectStatus === 'Completed' || i.status === 'completed').length;
      const archivedIdeas = allIdeas.filter((i) => i.projectStatus === 'Archived' || i.status === 'archived').length;

      // Extract all AI Blueprints across workspaces
      let allBlueprints = [];
      Object.values(blueprintsData || {}).forEach((wsObj) => {
        if (wsObj && typeof wsObj === 'object') {
          Object.values(wsObj).forEach((bp) => {
            if (bp && typeof bp === 'object' && (bp.blueprintId || bp.status || bp.content || bp.ideaTitle)) {
              allBlueprints.push(bp);
            }
          });
        }
      });

      const totalBlueprints = allBlueprints.length;
      const completedBlueprints = allBlueprints.filter((b) => b.status === 'completed').length;
      const generatingBlueprints = allBlueprints.filter((b) => b.status === 'generating').length;
      const failedBlueprints = allBlueprints.filter((b) => b.status === 'failed').length;

      const tasksMapList = Object.values(tasksData || {});
      let allTasks = [];
      tasksMapList.forEach((orgTasksMap) => {
        if (orgTasksMap) {
          allTasks.push(...Object.values(orgTasksMap).filter((t) => t && !t.isDeleted));
        }
      });

      const totalTasks = allTasks.length;
      const completedTasks = allTasks.filter((t) => t.status === 'Completed').length;
      const pendingTasks = allTasks.filter((t) => t.status !== 'Completed').length;
      const overdueTasks = allTasks.filter((t) => {
        if (!t.dueDate || t.status === 'Completed') return false;
        return new Date(t.dueDate).getTime() < Date.now();
      }).length;

      const reportsList = Object.values(reportsData || {}).filter(Boolean);
      const totalReports = reportsList.length;
      const openReports = reportsList.filter((r) => r.status === 'OPEN').length;
      const resolvedReports = reportsList.filter((r) => r.status === 'RESOLVED').length;

      const activityFeed = [];

      userList.forEach((u) => {
        if (u.joinedAt) {
          activityFeed.push({
            id: `act_user_${u.uid}`,
            type: 'user_registered',
            title: `New user registered: ${u.displayName || u.email}`,
            timestamp: u.joinedAt,
            user: u.displayName || u.email,
          });
        }
      });

      orgList.forEach((o) => {
        if (o.createdAt) {
          activityFeed.push({
            id: `act_org_${o.orgId}`,
            type: 'workspace_created',
            title: `Workspace created: "${o.name}"`,
            timestamp: o.createdAt,
            user: o.ownerName || 'Owner',
          });
        }
      });

      allIdeas.forEach((i) => {
        if (i.createdAt) {
          activityFeed.push({
            id: `act_idea_${i.ideaId}`,
            type: i.isSelected ? 'mvp_selected' : 'idea_posted',
            title: i.isSelected
              ? `MVP Selected: "${i.title}"`
              : `New proposal: "${i.title}"`,
            timestamp: i.createdAt,
            user: i.authorName || 'Member',
          });
        }
      });

      allBlueprints.forEach((b) => {
        if (b.generationCompletedAt || b.updatedAt) {
          const isCompleted = b.status === 'completed';
          activityFeed.push({
            id: `act_bp_${b.blueprintId || b.updatedAt}`,
            type: isCompleted ? 'blueprint_generated' : b.status === 'failed' ? 'blueprint_failed' : 'blueprint_started',
            title: isCompleted
              ? `AI Blueprint Generated: "${b.ideaTitle || 'MVP'}" (v${b.version || '1.0'})`
              : b.status === 'failed'
              ? `AI Blueprint Generation Failed for "${b.ideaTitle || 'MVP'}"`
              : `AI Blueprint Generation Started for "${b.ideaTitle || 'MVP'}"`,
            timestamp: b.generationCompletedAt || b.updatedAt,
            user: b.authorName || 'AI Engine',
            model: b.aiModel || 'gemini-2.0-flash',
          });
        }
      });

      allTasks.forEach((t) => {
        if (t.updatedAt && t.status === 'Completed') {
          activityFeed.push({
            id: `act_task_${t.taskId}`,
            type: 'task_completed',
            title: `Task completed: "${t.title}"`,
            timestamp: t.updatedAt,
            user: t.assigneeName || 'Developer',
          });
        }
      });

      activityFeed.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      const recentUsers = [...userList]
        .sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0))
        .slice(0, 8);

      const recentWorkspaces = [...orgList]
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 8);

      const recentIdeas = [...allIdeas]
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 8);

      const recentBlueprints = [...allBlueprints]
        .sort((a, b) => (b.updatedAt || b.generationCompletedAt || 0) - (a.updatedAt || a.generationCompletedAt || 0))
        .slice(0, 8);

      callback({
        metrics: {
          users: { totalUsers, verifiedUsers, onlineUsers },
          workspaces: { totalWorkspaces, activeWorkspaces },
          ideas: { totalIdeas, selectedMvps, projectIdeas, completedIdeas, archivedIdeas },
          blueprints: { totalBlueprints, completedBlueprints, generatingBlueprints, failedBlueprints },
          tasks: { totalTasks, completedTasks, pendingTasks, overdueTasks },
          reports: { totalReports, openReports, resolvedReports },
        },
        activityFeed: activityFeed.slice(0, 30),
        recentUsers,
        recentWorkspaces,
        recentIdeas,
        recentBlueprints,
        health: {
          databaseConnected: true,
          activeListenersCount: 7,
          lastSyncTimestamp: Date.now(),
        },
      });
    };

    const unsubUsers = rtdbService.subscribe('users', (data) => {
      usersData = data || {};
      computeAndEmit();
    });

    const unsubOrgs = rtdbService.subscribe('organizations', (data) => {
      orgsData = data || {};
      computeAndEmit();
    });

    const unsubIdeas = rtdbService.subscribe('ideas', (data) => {
      ideasData = data || {};
      computeAndEmit();
    });

    const unsubPublicIdeas = rtdbService.subscribe('publicIdeas', (data) => {
      publicIdeasData = data || {};
      computeAndEmit();
    });

    const unsubBlueprints = rtdbService.subscribe('blueprints', (data) => {
      blueprintsData = data || {};
      computeAndEmit();
    });

    const unsubTasks = rtdbService.subscribe('tasks', (data) => {
      tasksData = data || {};
      computeAndEmit();
    });

    const unsubReports = rtdbService.subscribe('reports', (data) => {
      reportsData = data || {};
      computeAndEmit();
    });

    unsubscribeFunctions = [
      unsubUsers,
      unsubOrgs,
      unsubIdeas,
      unsubPublicIdeas,
      unsubBlueprints,
      unsubTasks,
      unsubReports,
    ];

    return () => {
      unsubscribeFunctions.forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  },

  /**
   * Real-time subscription to Global Announcements.
   */
  subscribeToAnnouncements: (callback) => {
    return rtdbService.subscribe('announcements', (data) => {
      if (!data) {
        callback([]);
        return;
      }
      const list = Object.values(data)
        .filter(Boolean)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(list);
    });
  },

  /**
   * Create Global Announcement (Admin Only)
   */
  createAnnouncement: async (adminUid, adminName, payload) => {
    return await apiClient.post('/api/admin/announcements', payload);
  },

  /**
   * Dismiss an announcement for a specific user (does not affect other users or delete from Firebase).
   */
  dismissAnnouncementForUser: async (uid, announcementId) => {
    if (!uid || !announcementId) return;
    const timestamp = Date.now();
    await rtdbService.setData(`user_announcements/${uid}/${announcementId}`, {
      dismissed: true,
      dismissedAt: timestamp,
    });
  },

  /**
   * Real-time subscription to active announcements tailored for a specific user.
   */
  subscribeToUserAnnouncements: (uid, userContext, callback) => {
    if (!uid) {
      callback([]);
      return () => {};
    }

    let rawAnnouncements = {};
    let userDismissedMap = {};

    const computeAndEmit = () => {
      const now = Date.now();
      const list = Object.values(rawAnnouncements || {}).filter((anc) => {
        if (!anc || anc.isDeleted) return false;
        // Check Expiration
        if (anc.expiresAt && now > anc.expiresAt) return false;
        // Check User Dismissal
        if (userDismissedMap[anc.id]?.dismissed) return false;

        // Check Target Audience
        if (anc.targetAudience && anc.targetAudience !== 'Entire Platform') {
          if (anc.targetAudience === 'Verified Users' && !userContext?.emailVerified) return false;
          if (anc.targetAudience === 'Workspace Owners' && !userContext?.isOwner) return false;
          if (anc.targetAudience === 'Workspace Members' && !userContext?.isMember) return false;
          if (anc.targetAudience === 'Administrators' && !userContext?.isAdmin) return false;
        }

        return true;
      });

      // Sort Pinned to top, then newest first
      list.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

      callback(list);
    };

    const unsubGlobal = rtdbService.subscribe('announcements', (data) => {
      rawAnnouncements = data || {};
      computeAndEmit();
    });

    const unsubUser = rtdbService.subscribe(`user_announcements/${uid}`, (data) => {
      userDismissedMap = data || {};
      computeAndEmit();
    });

    return () => {
      unsubGlobal();
      unsubUser();
    };
  },

  /**
   * Delete Global Announcement (Admin Only)
   */
  deleteAnnouncement: async (adminUid, adminName, id) => {
    if (!id) return;
    return await apiClient.delete(`/api/admin/announcements/${id}`);
  },

  /**
   * Toggle Announcement Pinned Status (Admin Only)
   */
  toggleAnnouncementPin: async (adminUid, adminName, id) => {
    if (!id) return;
    return await apiClient.patch(`/api/admin/announcements/${id}/pin`);
  },

  /**
   * Broadcast Notification to Target User Base (Admin Only)
   */
  broadcastNotification: async (adminUid, adminName, { title, message, targetAudience }) => {
    return await apiClient.post('/api/admin/announcements/broadcast', { title, message, targetAudience });
  },

  /**
   * Real-time subscription to Granular RBAC Roles & Permissions Matrix.
   */
  subscribeToRbacRoles: (callback) => {
    const defaultRoles = {
      superadmin: {
        roleId: 'superadmin',
        name: 'Super Admin',
        description: 'Full unconstrained platform control.',
        permissions: ['users.view', 'users.edit', 'users.delete', 'users.suspend', 'workspaces.view', 'workspaces.delete', 'ideas.view', 'ideas.delete', 'reports.view', 'reports.resolve', 'analytics.view', 'analytics.export', 'settings.view', 'settings.edit', 'audit.view', 'roles.manage'],
      },
      admin: {
        roleId: 'admin',
        name: 'Platform Admin',
        description: 'Standard administrator with full operational privileges.',
        permissions: ['users.view', 'users.edit', 'users.suspend', 'workspaces.view', 'ideas.view', 'ideas.edit', 'reports.view', 'reports.resolve', 'analytics.view', 'settings.view', 'audit.view'],
      },
      moderator: {
        roleId: 'moderator',
        name: 'Trust & Safety Moderator',
        description: 'Moderates user reports, content, and discussions.',
        permissions: ['users.view', 'users.suspend', 'reports.view', 'reports.resolve', 'ideas.view', 'audit.view'],
      },
      analytics: {
        roleId: 'analytics',
        name: 'Analytics Specialist',
        description: 'Access to business intelligence and analytics export.',
        permissions: ['analytics.view', 'analytics.export', 'audit.view'],
      },
      readonly: {
        roleId: 'readonly',
        name: 'Read Only',
        description: 'View-only access across all administrative panels.',
        permissions: ['users.view', 'workspaces.view', 'ideas.view', 'reports.view', 'analytics.view', 'audit.view'],
      },
    };

    return rtdbService.subscribe('rbac_roles', (data) => {
      if (!data) callback(defaultRoles);
      else callback({ ...defaultRoles, ...data });
    });
  },

  /**
   * Update RBAC Role Permissions (Admin Only)
   */
  updateRbacRolePermissions: async (adminUid, adminName, roleId, permissions) => {
    return await apiClient.patch(`/api/admin/rbac-roles/${roleId}`, { permissions });
  },

  /**
   * Real-time subscription to Centralized Platform Configuration Settings.
   */
  subscribeToPlatformSettings: (callback) => {
    const defaultSettings = {
      general: {
        platformName: 'Convia',
        tagline: 'Where Ideas Converge into Action.',
        supportEmail: 'support@convia.dev',
        environment: 'Production',
        copyright: '© 2026 Convia Inc. All rights reserved.',
      },
      auth: {
        requireEmailVerification: true,
        allowRegistrations: true,
        minPasswordLength: 8,
      },
      workspaces: {
        maxMembersPerOrg: 20,
        maxOrgsPerUser: 5,
        autoArchiveDays: 90,
      },
      ideas: {
        maxIdeasPerUser: 10,
        enableVoting: true,
        enableMvpSelection: true,
      },
      maintenance: {
        maintenanceMode: false,
        maintenanceMessage: 'Convia is currently undergoing scheduled system maintenance.',
      },
      featureFlags: {
        ideaImport: true,
        blueprint: true,
        resources: true,
        reports: true,
        analytics: true,
      },
    };

    return rtdbService.subscribe('platform_settings', (data) => {
      if (!data) {
        callback(defaultSettings);
      } else {
        callback({
          general: { ...defaultSettings.general, ...data.general },
          auth: { ...defaultSettings.auth, ...data.auth },
          workspaces: { ...defaultSettings.workspaces, ...data.workspaces },
          ideas: { ...defaultSettings.ideas, ...data.ideas },
          maintenance: { ...defaultSettings.maintenance, ...data.maintenance },
          featureFlags: { ...defaultSettings.featureFlags, ...data.featureFlags },
        });
      }
    });
  },

  /**
   * Update Centralized Platform Settings (Admin Only)
   */
  updatePlatformSettings: async (adminUid, adminName, newSettings) => {
    return await apiClient.patch('/api/admin/platform-settings', newSettings);
  },

  /**
   * Real-time subscription to Full Business Intelligence & Analytics.
   */
  subscribeToFullAnalytics: (callback) => {
    let usersData = {};
    let orgsData = {};
    let ideasData = {};
    let publicIdeasData = {};
    let tasksData = {};

    let unsubscribeFunctions = [];

    const computeAndEmit = () => {
      const userList = Object.values(usersData || {}).filter(Boolean);
      const orgList = Object.values(orgsData || {}).filter((o) => o && !o.isDeleted);

      const workspaceIdeasObjList = Object.values(ideasData || {});
      let allWorkspaceIdeas = [];
      workspaceIdeasObjList.forEach((map) => {
        if (map) allWorkspaceIdeas.push(...Object.values(map).filter((i) => i && !i.isDeleted));
      });
      const publicIdeasList = Object.values(publicIdeasData || {}).filter((i) => i && !i.isDeleted);
      const allIdeas = [...allWorkspaceIdeas, ...publicIdeasList];

      const tasksMapList = Object.values(tasksData || {});
      let allTasks = [];
      tasksMapList.forEach((map) => {
        if (map) allTasks.push(...Object.values(map).filter((t) => t && !t.isDeleted));
      });

      const totalUsers = userList.length;
      const verifiedUsers = userList.filter((u) => u.emailVerified || u.profileCompleted).length;
      const onlineUsers = userList.filter((u) => u.onlineStatus === 'online').length;
      const verificationRate = totalUsers > 0 ? Math.round((verifiedUsers / totalUsers) * 100) : 0;

      const ideationCount = allIdeas.filter((i) => !i.isSelected && (i.projectStatus || 'Ideation') === 'Ideation').length;
      const votingCount = allIdeas.filter((i) => i.projectStatus === 'Voting').length;
      const mvpCount = allIdeas.filter((i) => i.isSelected || i.projectStatus === 'Selected MVP').length;
      const projectCount = allIdeas.filter((i) => i.projectStatus === 'Project' || i.status === 'selected').length;
      const completedCount = allIdeas.filter((i) => i.projectStatus === 'Completed' || i.status === 'completed').length;
      const conversionRate = allIdeas.length > 0 ? Math.round((completedCount / allIdeas.length) * 100) : 0;

      const completedTasks = allTasks.filter((t) => t.status === 'Completed').length;
      const taskCompletionRate = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0;

      const topContributors = userList.map((u) => {
        const uIdeas = allIdeas.filter((i) => i.authorId === u.uid || i.createdBy === u.uid).length;
        const uTasksCompleted = allTasks.filter((t) => (t.assigneeId === u.uid || t.assignedTo === u.uid) && t.status === 'Completed').length;
        const collabScore = (uIdeas * 10) + (uTasksCompleted * 15) + ((u.voteCount || 0) * 2);

        return {
          ...u,
          uIdeas,
          uTasksCompleted,
          collabScore,
        };
      }).sort((a, b) => b.collabScore - a.collabScore).slice(0, 10);

      const topWorkspaces = orgList.map((w) => {
        const wTasks = allTasks.filter((t) => t.orgId === w.orgId || t.workspaceId === w.orgId);
        const wCompleted = wTasks.filter((t) => t.status === 'Completed').length;
        const wRate = wTasks.length > 0 ? Math.round((wCompleted / wTasks.length) * 100) : 0;

        return {
          ...w,
          taskCount: wTasks.length,
          completedCount: wCompleted,
          rate: wRate,
        };
      }).sort((a, b) => b.rate - a.rate).slice(0, 10);

      callback({
        kpis: {
          totalUsers,
          verifiedUsers,
          onlineUsers,
          verificationRate,
          totalWorkspaces: orgList.length,
          totalIdeas: allIdeas.length,
          mvpCount,
          completedCount,
          conversionRate,
          totalTasks: allTasks.length,
          completedTasks,
          taskCompletionRate,
        },
        funnel: {
          ideationCount,
          votingCount,
          mvpCount,
          projectCount,
          completedCount,
        },
        topContributors,
        topWorkspaces,
        recentIdeas: allIdeas.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 8),
      });
    };

    const unsubUsers = rtdbService.subscribe('users', (d) => {
      usersData = d || {};
      computeAndEmit();
    });
    const unsubOrgs = rtdbService.subscribe('organizations', (d) => {
      orgsData = d || {};
      computeAndEmit();
    });
    const unsubIdeas = rtdbService.subscribe('ideas', (d) => {
      ideasData = d || {};
      computeAndEmit();
    });
    const unsubPublic = rtdbService.subscribe('publicIdeas', (d) => {
      publicIdeasData = d || {};
      computeAndEmit();
    });
    const unsubTasks = rtdbService.subscribe('tasks', (d) => {
      tasksData = d || {};
      computeAndEmit();
    });

    unsubscribeFunctions = [unsubUsers, unsubOrgs, unsubIdeas, unsubPublic, unsubTasks];

    return () => {
      unsubscribeFunctions.forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  },

  /**
   * Real-time subscription to Moderation Queue (OPEN, IN_REVIEW, ESCALATED)
   */
  subscribeToModerationQueue: (callback) => {
    return rtdbService.subscribe('reports', (reportsObj) => {
      if (!reportsObj) {
        callback({ queue: [], history: [] });
        return;
      }

      const allReports = Object.values(reportsObj).filter(Boolean);
      const queue = allReports
        .filter((r) => r.status === 'OPEN' || r.status === 'IN_REVIEW' || r.status === 'ESCALATED')
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      const history = allReports
        .filter((r) => r.status === 'RESOLVED' || r.status === 'DISMISSED')
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

      callback({ queue, history });
    });
  },

  /**
   * Real-time subscription to full Audit Logs history.
   */
  subscribeToAuditLogs: (callback) => {
    return rtdbService.subscribe('admin_audit_logs', (logsObj) => {
      if (!logsObj) {
        callback([]);
        return;
      }
      const list = Object.values(logsObj)
        .filter(Boolean)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      callback(list);
    });
  },

  /**
   * Real-time Spam & Duplicate Content Detector
   */
  detectSpamAndDuplicates: (callback) => {
    let publicIdeasData = {};
    let workspaceIdeasData = {};

    const analyze = () => {
      const publicList = Object.values(publicIdeasData || {}).filter((i) => i && !i.isDeleted);
      let workspaceList = [];
      Object.values(workspaceIdeasData || {}).forEach((map) => {
        if (map) workspaceList.push(...Object.values(map).filter((i) => i && !i.isDeleted));
      });

      const allIdeas = [...publicList, ...workspaceList];
      const duplicates = [];
      const titleMap = {};

      allIdeas.forEach((i) => {
        const cleanTitle = (i.title || '').toLowerCase().trim();
        if (!titleMap[cleanTitle]) {
          titleMap[cleanTitle] = [i];
        } else {
          titleMap[cleanTitle].push(i);
        }
      });

      Object.entries(titleMap).forEach(([titleStr, matchArray]) => {
        if (matchArray.length > 1) {
          duplicates.push({
            title: matchArray[0].title,
            count: matchArray.length,
            items: matchArray,
            riskScore: 'High',
          });
        }
      });

      callback({ duplicates });
    };

    const unsub1 = rtdbService.subscribe('publicIdeas', (d) => {
      publicIdeasData = d || {};
      analyze();
    });
    const unsub2 = rtdbService.subscribe('ideas', (d) => {
      workspaceIdeasData = d || {};
      analyze();
    });

    return () => {
      if (typeof unsub1 === 'function') unsub1();
      if (typeof unsub2 === 'function') unsub2();
    };
  },

  /**
   * Real-time subscription to all ideas (Public + Workspace) with telemetry stats.
   */
  subscribeToAllIdeasWithStats: (callback) => {
    let publicData = {};
    let workspaceData = {};
    let orgsData = {};

    let unsubscribeFunctions = [];

    const computeAndEmit = () => {
      const orgMap = orgsData || {};

      const publicList = Object.values(publicData || {})
        .filter((i) => i && !i.isDeleted)
        .map((i) => ({
          ...i,
          isPublic: true,
          visibility: 'Public',
          workspaceName: 'Public Explorer',
          authorName: i.authorName || i.userName || 'Member',
          voteCount: i.voteCount || 0,
          commentsCount: i.commentsCount || 0,
          suggestionsCount: i.suggestionsCount || 0,
          status: i.status || 'Ideation',
        }));

      let workspaceList = [];
      const orgIdeasMaps = Object.entries(workspaceData || {});
      orgIdeasMaps.forEach(([orgId, map]) => {
        if (map) {
          const wName = orgMap[orgId]?.name || 'Workspace';
          const items = Object.values(map)
            .filter((i) => i && !i.isDeleted)
            .map((i) => ({
              ...i,
              orgId,
              isPublic: false,
              visibility: 'Workspace',
              workspaceName: wName,
              authorName: i.authorName || 'Member',
              voteCount: i.voteCount || 0,
              commentsCount: i.commentsCount || 0,
              suggestionsCount: i.suggestionsCount || 0,
              status: i.isSelected ? 'Selected MVP' : (i.projectStatus || 'Ideation'),
            }));
          workspaceList.push(...items);
        }
      });

      const combined = [...publicList, ...workspaceList].sort(
        (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
      );

      callback(combined);
    };

    const unsubPublic = rtdbService.subscribe('publicIdeas', (data) => {
      publicData = data || {};
      computeAndEmit();
    });
    const unsubWorkspace = rtdbService.subscribe('ideas', (data) => {
      workspaceData = data || {};
      computeAndEmit();
    });
    const unsubOrgs = rtdbService.subscribe('organizations', (data) => {
      orgsData = data || {};
      computeAndEmit();
    });

    unsubscribeFunctions = [unsubPublic, unsubWorkspace, unsubOrgs];

    return () => {
      unsubscribeFunctions.forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  },

  /**
   * Real-time subscription to dedicated Selected MVP list.
   */
  subscribeToAllMvps: (callback) => {
    let workspaceData = {};

    return rtdbService.subscribe('ideas', (data) => {
      workspaceData = data || {};

      rtdbService.getData('organizations').then((orgs) => {
        const orgMap = orgs || {};
        let mvpList = [];

        Object.entries(workspaceData).forEach(([orgId, map]) => {
          if (map) {
            const orgInfo = orgMap[orgId] || {};
            Object.values(map).forEach((i) => {
              if (i && !i.isDeleted && (i.isSelected || i.projectStatus === 'Selected MVP')) {
                mvpList.push({
                  ...i,
                  orgId,
                  workspaceName: orgInfo.name || 'Workspace',
                  workspaceOwner: orgInfo.ownerName || 'Owner',
                  statusTag: i.projectStatus || 'Selected MVP',
                });
              }
            });
          }
        });

        callback(mvpList);
      });
    });
  },

  /**
   * Real-time subscription to a specific proposal's deep telemetry.
   */
  subscribeToIdeaDetail: (ideaId, callback) => {
    if (!ideaId) return () => {};

    let ideaObj = null;
    let commentsObj = {};
    let suggestionsObj = {};
    let votesObj = {};

    const unsubPublic = rtdbService.subscribe(`publicIdeas/${ideaId}`, (pData) => {
      if (pData) {
        ideaObj = { ...pData, isPublic: true };
        fetchDiscussions();
      } else {
        rtdbService.getData('ideas').then((wIdeasMap) => {
          let found = null;
          let foundOrg = null;
          if (wIdeasMap) {
            Object.entries(wIdeasMap).forEach(([oId, map]) => {
              if (map && map[ideaId]) {
                found = map[ideaId];
                foundOrg = oId;
              }
            });
          }

          if (found) {
            ideaObj = { ...found, isPublic: false, orgId: foundOrg };
            fetchDiscussions();
          } else {
            callback(null);
          }
        });
      }
    });

    const fetchDiscussions = () => {
      const discPath = ideaObj.isPublic
        ? `public_idea_discussions/${ideaId}`
        : `idea_discussions/${ideaObj.orgId}/${ideaId}`;

      rtdbService.subscribe(discPath, (disc) => {
        commentsObj = disc?.comments || {};
        suggestionsObj = disc?.suggestions || {};
        votesObj = disc?.votes || {};

        const commentsList = Object.values(commentsObj).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        const suggestionsList = Object.values(suggestionsObj).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        const votesList = Object.values(votesObj);

        const timeline = [];
        if (ideaObj.createdAt) {
          timeline.push({ id: 'l_create', type: 'created', title: 'Proposal Authored & Posted', timestamp: ideaObj.createdAt, user: ideaObj.authorName || 'Member' });
        }
        if (suggestionsList.length > 0) {
          timeline.push({ id: 'l_sug', type: 'suggestion', title: `${suggestionsList.length} Community Suggestions Submitted`, timestamp: suggestionsList[0].createdAt, user: suggestionsList[0].authorName || 'Contributor' });
        }
        if (commentsList.length > 0) {
          timeline.push({ id: 'l_comm', type: 'comment', title: `${commentsList.length} Comments Posted`, timestamp: commentsList[0].createdAt, user: commentsList[0].authorName || 'Contributor' });
        }
        if (votesList.length > 0) {
          timeline.push({ id: 'l_vote', type: 'vote', title: `${votesList.length} Votes Cast`, timestamp: Date.now(), user: 'Community' });
        }
        if (ideaObj.isSelected) {
          timeline.push({ id: 'l_mvp', type: 'mvp', title: 'Selected as Workspace MVP', timestamp: ideaObj.updatedAt || ideaObj.createdAt, user: 'Workspace Leader' });
        }
        timeline.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        callback({
          idea: ideaObj,
          comments: commentsList,
          suggestions: suggestionsList,
          votes: votesList,
          timeline,
        });
      });
    };

    return () => {
      if (typeof unsubPublic === 'function') unsubPublic();
    };
  },

  /**
   * Toggle Featured Idea Status (Admin Only)
   */
  toggleIdeaFeatured: async (adminUid, adminName, ideaId, isPublic, orgId) => {
    return await apiClient.post(`/api/admin/ideas/${ideaId}/toggle-featured`, { isPublic, orgId });
  },

  /**
   * Update Proposal Status in Admin Portal (Enforces Single MVP validation)
   */
  updateAdminIdeaStatus: async (adminUid, adminName, ideaId, orgId, newStatus) => {
    if (!ideaId || !orgId) return;
    await ideaService.updateIdeaStatus(orgId, ideaId, newStatus);
    await adminService.logAdminAudit(adminUid, adminName, 'UPDATE_IDEA_STATUS', ideaId, `Updated status to "${newStatus}"`);
  },

  /**
   * Real-time subscription to all workspaces with detailed stats & moderation metadata.
   */
  subscribeToAllWorkspacesWithStats: (callback) => {
    let orgsData = {};
    let ideasData = {};
    let tasksData = {};
    let usersData = {};

    let unsubscribeFunctions = [];

    const computeAndEmit = () => {
      const orgList = Object.values(orgsData || {}).filter((o) => o && !o.isDeleted);
      const userMap = usersData || {};

      const workspacesWithStats = orgList.map((org) => {
        const membersCount = org.members ? Object.keys(org.members).length : 1;
        const ownerName = org.ownerName || userMap[org.ownerId]?.displayName || userMap[org.ownerId]?.email || 'Owner';

        const orgIdeasObj = ideasData[org.orgId] || {};
        const orgIdeas = Object.values(orgIdeasObj).filter((i) => i && !i.isDeleted);
        const selectedMvp = orgIdeas.find((i) => i.isSelected || i.projectStatus === 'Selected MVP');

        const orgTasksObj = tasksData[org.orgId] || {};
        const orgTasks = Object.values(orgTasksObj).filter((t) => t && !t.isDeleted);
        const completedTasks = orgTasks.filter((t) => t.status === 'Completed');
        const progressRate = orgTasks.length > 0 ? Math.round((completedTasks.length / orgTasks.length) * 100) : 0;

        let statusTag = 'Ideation';
        if (org.isLocked) statusTag = 'Locked';
        else if (org.isArchived) statusTag = 'Archived';
        else if (org.status === 'project' || selectedMvp) statusTag = 'Active Sprint';

        return {
          ...org,
          membersCount,
          ownerName,
          totalIdeas: orgIdeas.length,
          selectedMvpTitle: selectedMvp ? selectedMvp.title : null,
          totalTasks: orgTasks.length,
          completedTasks: completedTasks.length,
          progressRate,
          statusTag,
        };
      });

      callback(workspacesWithStats);
    };

    const unsubOrgs = rtdbService.subscribe('organizations', (data) => {
      orgsData = data || {};
      computeAndEmit();
    });
    const unsubIdeas = rtdbService.subscribe('ideas', (data) => {
      ideasData = data || {};
      computeAndEmit();
    });
    const unsubTasks = rtdbService.subscribe('tasks', (data) => {
      tasksData = data || {};
      computeAndEmit();
    });
    const unsubUsers = rtdbService.subscribe('users', (data) => {
      usersData = data || {};
      computeAndEmit();
    });

    unsubscribeFunctions = [unsubOrgs, unsubIdeas, unsubTasks, unsubUsers];

    return () => {
      unsubscribeFunctions.forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  },

  /**
   * Real-time subscription to deep telemetry and moderation view of a specific workspace.
   */
  subscribeToWorkspaceDetail: (workspaceId, callback) => {
    if (!workspaceId) return () => {};

    let orgData = null;
    let ideasData = {};
    let tasksData = {};
    let blueprintData = null;
    let usersData = {};
    let auditData = {};

    let unsubscribeFunctions = [];

    const computeAndEmit = () => {
      if (!orgData) {
        callback(null);
        return;
      }

      const userMap = usersData || {};
      const ownerName = orgData.ownerName || userMap[orgData.ownerId]?.displayName || 'Owner';

      const memberUids = orgData.members ? Object.keys(orgData.members) : [orgData.ownerId];
      const membersList = memberUids.map((uid) => {
        const uProfile = userMap[uid] || {};
        const isCreator = uid === (orgData.createdBy || orgData.ownerId);
        const memberRecord = orgData.members?.[uid] || {};
        return {
          uid,
          displayName: uProfile.displayName || uProfile.email?.split('@')[0] || 'Member',
          email: uProfile.email || 'N/A',
          role: memberRecord.role || (uid === orgData.ownerId ? 'owner' : 'member'),
          joinedAt: isCreator ? orgData.createdAt : (memberRecord.joinedAt || null),
          workspaceJoinedAt: isCreator ? orgData.createdAt : (memberRecord.joinedAt || null),
          onlineStatus: uProfile.onlineStatus || 'offline',
        };
      });

      const orgIdeasObj = ideasData[workspaceId] || {};
      const orgIdeas = Object.values(orgIdeasObj).filter((i) => i && !i.isDeleted);
      const selectedMvp = orgIdeas.find((i) => i.isSelected || i.projectStatus === 'Selected MVP');

      const orgTasksObj = tasksData[workspaceId] || {};
      const orgTasks = Object.values(orgTasksObj).filter((t) => t && !t.isDeleted);
      const completedTasks = orgTasks.filter((t) => t.status === 'Completed');
      const progressRate = orgTasks.length > 0 ? Math.round((completedTasks.length / orgTasks.length) * 100) : 0;

      const timeline = [];
      if (orgData.createdAt) {
        timeline.push({ id: 't_create', type: 'created', title: `Workspace "${orgData.name}" created`, timestamp: orgData.createdAt, user: ownerName });
      }
      orgIdeas.forEach((i) => {
        timeline.push({ id: `t_i_${i.ideaId}`, type: i.isSelected ? 'mvp_selected' : 'idea_posted', title: i.isSelected ? `Selected MVP: "${i.title}"` : `Proposed Idea: "${i.title}"`, timestamp: i.createdAt, user: i.authorName || 'Member' });
      });
      orgTasks.forEach((t) => {
        if (t.status === 'Completed') {
          timeline.push({ id: `t_t_${t.taskId}`, type: 'task_completed', title: `Completed Task: "${t.title}"`, timestamp: t.updatedAt || t.createdAt, user: t.assigneeName || 'Developer' });
        }
      });
      timeline.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      const auditLogs = Object.values(auditData || {})
        .filter((l) => l.targetId === workspaceId)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      let statusTag = 'Ideation Phase';
      if (orgData.isLocked) statusTag = 'Locked';
      else if (orgData.isArchived) statusTag = 'Archived';
      else if (orgData.status === 'project' || selectedMvp) statusTag = '⚡ Sprint Phase';

      callback({
        workspace: {
          ...orgData,
          ownerName,
          statusTag,
        },
        members: membersList,
        ideas: orgIdeas,
        selectedMvp,
        tasks: orgTasks,
        blueprint: blueprintData,
        timeline,
        auditLogs,
        stats: {
          membersCount: membersList.length,
          ideasCount: orgIdeas.length,
          tasksCount: orgTasks.length,
          completedTasks: completedTasks.length,
          progressRate,
        },
      });
    };

    const unsubOrg = rtdbService.subscribe(`organizations/${workspaceId}`, (data) => {
      orgData = data;
      computeAndEmit();
    });
    const unsubIdeas = rtdbService.subscribe('ideas', (data) => {
      ideasData = data || {};
      computeAndEmit();
    });
    const unsubTasks = rtdbService.subscribe('tasks', (data) => {
      tasksData = data || {};
      computeAndEmit();
    });
    const unsubBp = rtdbService.subscribe(`blueprints/${workspaceId}`, (data) => {
      blueprintData = data;
      computeAndEmit();
    });
    const unsubUsers = rtdbService.subscribe('users', (data) => {
      usersData = data || {};
      computeAndEmit();
    });
    const unsubAudit = rtdbService.subscribe('admin_audit_logs', (data) => {
      auditData = data || {};
      computeAndEmit();
    });

    unsubscribeFunctions = [unsubOrg, unsubIdeas, unsubTasks, unsubBp, unsubUsers, unsubAudit];

    return () => {
      unsubscribeFunctions.forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  },

  /**
   * Archive Workspace (Admin Only)
   */
  archiveWorkspace: async (adminUid, adminName, workspaceId) => {
    if (!workspaceId) return;
    return await apiClient.post(`/api/admin/workspaces/${workspaceId}/archive`);
  },

  /**
   * Restore Workspace from Archive (Admin Only)
   */
  restoreWorkspace: async (adminUid, adminName, workspaceId) => {
    if (!workspaceId) return;
    return await apiClient.post(`/api/admin/workspaces/${workspaceId}/restore`);
  },

  /**
   * Lock Workspace (Admin Only)
   */
  lockWorkspace: async (adminUid, adminName, workspaceId, reason) => {
    if (!workspaceId || !reason) throw new Error('Lock reason is required.');
    return await apiClient.post(`/api/admin/workspaces/${workspaceId}/lock`, { reason });
  },

  /**
   * Unlock Workspace (Admin Only)
   */
  unlockWorkspace: async (adminUid, adminName, workspaceId) => {
    if (!workspaceId) return;
    return await apiClient.post(`/api/admin/workspaces/${workspaceId}/unlock`);
  },

  /**
   * Transfer Workspace Ownership (Admin Only)
   */
  transferWorkspaceOwnership: async (adminUid, adminName, workspaceId, newOwnerUid, newOwnerName) => {
    if (!workspaceId || !newOwnerUid) throw new Error('New owner is required.');
    return await apiClient.post(`/api/admin/workspaces/${workspaceId}/transfer-ownership`, { newOwnerUid, newOwnerName });
  },

  /**
   * Cascade Delete Workspace (Super Admin Only)
   */
  deleteWorkspaceByAdmin: async (adminUid, adminName, workspaceId) => {
    if (!workspaceId) return;
    return await apiClient.delete(`/api/admin/workspaces/${workspaceId}`);
  },

  /**
   * Real-time subscription to full list of users with calculated moderation telemetry.
   */
  subscribeToAllUsersWithStats: (callback) => {
    let usersData = {};
    let orgsData = {};
    let ideasData = {};
    let publicIdeasData = {};
    let tasksData = {};

    let unsubscribeFunctions = [];

    const computeAndEmit = () => {
      const userList = Object.values(usersData || {}).filter(Boolean);
      const orgList = Object.values(orgsData || {}).filter((o) => o && !o.isDeleted);

      const workspaceIdeasObjList = Object.values(ideasData || {});
      let allWorkspaceIdeas = [];
      workspaceIdeasObjList.forEach((map) => {
        if (map) allWorkspaceIdeas.push(...Object.values(map).filter((i) => i && !i.isDeleted));
      });
      const publicIdeasList = Object.values(publicIdeasData || {}).filter((i) => i && !i.isDeleted);
      const allIdeas = [...allWorkspaceIdeas, ...publicIdeasList];

      const tasksMapList = Object.values(tasksData || {});
      let allTasks = [];
      tasksMapList.forEach((map) => {
        if (map) allTasks.push(...Object.values(map).filter((t) => t && !t.isDeleted));
      });

      const usersWithStats = userList.map((u) => {
        const userWorkspaces = orgList.filter((o) => {
          if (o.ownerId === u.uid) return true;
          return o.members && o.members[u.uid];
        });

        const userIdeas = allIdeas.filter((i) => i.authorId === u.uid || i.createdBy === u.uid);
        const userTasks = allTasks.filter((t) => t.assigneeId === u.uid || t.assignedTo === u.uid);
        const completedTasks = userTasks.filter((t) => t.status === 'Completed');

        return {
          ...u,
          role: u.role || (u.isAdmin ? 'superadmin' : 'user'),
          status: u.isSuspended ? 'Suspended' : u.onlineStatus === 'online' ? 'Active' : 'Offline',
          lastLoginAt: u.lastLoginAt || null,
          totalWorkspaces: userWorkspaces.length,
          totalIdeas: userIdeas.length,
          totalTasks: userTasks.length,
          completedTasks: completedTasks.length,
          completionRate: userTasks.length > 0 ? Math.round((completedTasks.length / userTasks.length) * 100) : 0,
        };
      });

      callback(usersWithStats);
    };

    const unsubUsers = rtdbService.subscribe('users', (data) => {
      usersData = data || {};
      computeAndEmit();
    });
    const unsubOrgs = rtdbService.subscribe('organizations', (data) => {
      orgsData = data || {};
      computeAndEmit();
    });
    const unsubIdeas = rtdbService.subscribe('ideas', (data) => {
      ideasData = data || {};
      computeAndEmit();
    });
    const unsubPublicIdeas = rtdbService.subscribe('publicIdeas', (data) => {
      publicIdeasData = data || {};
      computeAndEmit();
    });
    const unsubTasks = rtdbService.subscribe('tasks', (data) => {
      tasksData = data || {};
      computeAndEmit();
    });

    unsubscribeFunctions = [unsubUsers, unsubOrgs, unsubIdeas, unsubPublicIdeas, unsubTasks];

    return () => {
      unsubscribeFunctions.forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  },

  /**
   * Real-time subscription to a specific user's deep telemetry profile.
   */
  subscribeToUserDetail: (userId, callback) => {
    if (!userId) return () => {};

    let userData = null;
    let orgsData = {};
    let ideasData = {};
    let publicIdeasData = {};
    let tasksData = {};
    let blueprintsData = {};
    let invitationsData = {};
    let workspaceActivityData = {};
    let notesData = {};
    let warningsData = {};
    let auditData = {};

    let unsubscribeFunctions = [];

    const computeAndEmit = () => {
      if (!userData) {
        callback(null);
        return;
      }

      const orgList = Object.values(orgsData || {}).filter((o) => o && !o.isDeleted);

      const workspaceIdeasObjList = Object.values(ideasData || {});
      let userWorkspaceIdeas = [];
      workspaceIdeasObjList.forEach((map) => {
        if (map) {
          userWorkspaceIdeas.push(...Object.values(map).filter((i) => i && !i.isDeleted && (i.authorId === userId || i.createdBy === userId)));
        }
      });
      const userPublicIdeas = Object.values(publicIdeasData || {}).filter((i) => i && !i.isDeleted && (i.authorId === userId || i.createdBy === userId));
      const userIdeas = [...userWorkspaceIdeas, ...userPublicIdeas];

      const tasksMapList = Object.values(tasksData || {});
      let userTasks = [];
      tasksMapList.forEach((map) => {
        if (map) {
          userTasks.push(...Object.values(map).filter((t) => t && !t.isDeleted && (t.assigneeId === userId || t.assignedTo === userId || t.createdBy === userId)));
        }
      });

      const userWorkspaces = orgList.filter((o) => {
        if (o.ownerId === userId) return true;
        return o.members && o.members[userId];
      });

      // AI Blueprints for user's workspaces
      let userBlueprints = [];
      Object.entries(blueprintsData || {}).forEach(([orgId, wsObj]) => {
        if (wsObj && typeof wsObj === 'object') {
          const isUserWs = userWorkspaces.some((w) => w.orgId === orgId);
          Object.values(wsObj).forEach((bp) => {
            if (bp && typeof bp === 'object' && (bp.blueprintId || bp.status || bp.content || bp.ideaTitle)) {
              if (isUserWs || bp.authorId === userId || bp.createdBy === userId) {
                userBlueprints.push({ ...bp, orgId });
              }
            }
          });
        }
      });

      // Invitations sent or received by user
      let userInvitations = [];
      Object.values(invitationsData || {}).forEach((inv) => {
        if (inv && (inv.invitedBy === userId || inv.creatorUid === userId || inv.invitedEmail === userData.email)) {
          userInvitations.push(inv);
        }
      });

      // Timeline compilation
      const timeline = [];

      // 1. Account Created
      if (userData.joinedAt) {
        timeline.push({ id: `t_join`, type: 'registered', title: 'User Account Created', timestamp: userData.joinedAt });
      }

      // 2. Last Login Event (distinguished from current presence)
      if (userData.lastLoginAt) {
        timeline.push({ id: `t_login_${userData.lastLoginAt}`, type: 'login', title: 'Last Successful Login', timestamp: userData.lastLoginAt });
      }

      // 3. Workspaces Created / Joined
      userWorkspaces.forEach((w) => {
        const isCreator = userId === (w.createdBy || w.ownerId);
        const memberJoined = w.members?.[userId]?.joinedAt;
        const wsTimestamp = isCreator ? w.createdAt : (memberJoined || w.createdAt);
        const title = isCreator ? `Created Workspace "${w.name}"` : `Joined Workspace "${w.name}"`;
        timeline.push({ id: `t_w_${w.orgId}`, type: isCreator ? 'workspace_created' : 'workspace_joined', title, timestamp: wsTimestamp, workspaceId: w.orgId });
      });

      // 4. Proposals Authored & MVP selections
      userIdeas.forEach((i) => {
        timeline.push({
          id: `t_i_${i.ideaId}`,
          type: i.isSelected ? 'mvp_selected' : 'idea_posted',
          title: i.isSelected ? `MVP Selected: "${i.title}"` : `Proposed Idea: "${i.title}"`,
          timestamp: i.createdAt,
          workspaceId: i.orgId || null,
        });
      });

      // 5. Tasks created / completed
      userTasks.forEach((t) => {
        if (t.status === 'Completed') {
          timeline.push({ id: `t_t_comp_${t.taskId}`, type: 'task_completed', title: `Completed Task: "${t.title}"`, timestamp: t.completedAt || t.updatedAt || t.createdAt, workspaceId: t.orgId });
        } else if (t.createdBy === userId) {
          timeline.push({ id: `t_t_create_${t.taskId}`, type: 'task_created', title: `Created Task: "${t.title}"`, timestamp: t.createdAt, workspaceId: t.orgId });
        }
      });

      // 6. Blueprints generated or approved
      userBlueprints.forEach((bp) => {
        const bpTime = bp.generationCompletedAt || bp.updatedAt || bp.createdAt;
        if (bpTime) {
          timeline.push({
            id: `t_bp_${bp.blueprintId || bpTime}`,
            type: bp.status === 'completed' ? 'blueprint_generated' : bp.status === 'failed' ? 'blueprint_failed' : 'blueprint_activity',
            title: bp.status === 'completed'
              ? `Generated AI Blueprint for "${bp.ideaTitle || 'Project'}" (v${bp.version || '1.0'})`
              : bp.status === 'failed'
              ? `AI Blueprint Generation Failed for "${bp.ideaTitle || 'Project'}"`
              : `AI Blueprint Updated for "${bp.ideaTitle || 'Project'}"`,
            timestamp: bpTime,
            workspaceId: bp.orgId,
          });
        }
      });

      // 7. Workspace Activity events where user was actor
      Object.entries(workspaceActivityData || {}).forEach(([orgId, actMap]) => {
        if (actMap && typeof actMap === 'object') {
          Object.values(actMap).forEach((event) => {
            if (event && event.actorId === userId && event.id) {
              timeline.push({
                id: `t_act_${event.id}`,
                type: event.eventType ? event.eventType.replace(/\./g, '_') : 'workspace_activity',
                title: event.summary || `Activity in Workspace: ${event.eventType}`,
                timestamp: event.createdAt,
                workspaceId: orgId,
              });
            }
          });
        }
      });

      // 8. Deduplicate timeline by unique id & sort newest first
      const seenTimelineIds = new Set();
      const dedupedTimeline = [];
      timeline.forEach((item) => {
        if (item.id && !seenTimelineIds.has(item.id)) {
          seenTimelineIds.add(item.id);
          dedupedTimeline.push(item);
        }
      });
      dedupedTimeline.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      const notes = Object.values(notesData || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const warnings = Object.values(warningsData || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const auditLogs = Object.values(auditData || {})
        .filter((l) => l.targetId === userId)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      const completedTasks = userTasks.filter((t) => t.status === 'Completed');

      callback({
        user: {
          ...userData,
          role: userData.role || (userData.isAdmin ? 'superadmin' : 'user'),
          status: userData.isSuspended ? 'Suspended' : userData.onlineStatus === 'online' ? 'Active' : 'Offline',
          lastLoginAt: userData.lastLoginAt || null,
        },
        stats: {
          totalWorkspaces: userWorkspaces.length,
          ownedWorkspaces: userWorkspaces.filter((w) => w.ownerId === userId).length,
          totalIdeas: userIdeas.length,
          publicIdeas: userPublicIdeas.length,
          workspaceIdeas: userWorkspaceIdeas.length,
          selectedMvps: userIdeas.filter((i) => i.isSelected).length,
          totalTasks: userTasks.length,
          completedTasks: completedTasks.length,
          completionRate: userTasks.length > 0 ? Math.round((completedTasks.length / userTasks.length) * 100) : 0,
          totalBlueprints: userBlueprints.length,
          totalInvitations: userInvitations.length,
        },
        workspaces: userWorkspaces,
        ideas: userIdeas,
        tasks: userTasks,
        blueprints: userBlueprints,
        invitations: userInvitations,
        timeline: dedupedTimeline,
        notes,
        warnings,
        auditLogs,
      });
    };

    const unsubUser = rtdbService.subscribe(`users/${userId}`, (data) => {
      userData = data;
      computeAndEmit();
    });
    const unsubOrgs = rtdbService.subscribe('organizations', (data) => {
      orgsData = data || {};
      computeAndEmit();
    });
    const unsubIdeas = rtdbService.subscribe('ideas', (data) => {
      ideasData = data || {};
      computeAndEmit();
    });
    const unsubPublicIdeas = rtdbService.subscribe('publicIdeas', (data) => {
      publicIdeasData = data || {};
      computeAndEmit();
    });
    const unsubTasks = rtdbService.subscribe('tasks', (data) => {
      tasksData = data || {};
      computeAndEmit();
    });
    const unsubBlueprints = rtdbService.subscribe('blueprints', (data) => {
      blueprintsData = data || {};
      computeAndEmit();
    });
    const unsubInvitations = rtdbService.subscribe('invitations', (data) => {
      invitationsData = data || {};
      computeAndEmit();
    });
    const unsubActivity = rtdbService.subscribe('workspace_activity', (data) => {
      workspaceActivityData = data || {};
      computeAndEmit();
    });
    const unsubNotes = rtdbService.subscribe(`user_admin_notes/${userId}`, (data) => {
      notesData = data || {};
      computeAndEmit();
    });
    const unsubWarnings = rtdbService.subscribe(`user_admin_warnings/${userId}`, (data) => {
      warningsData = data || {};
      computeAndEmit();
    });
    const unsubAudit = rtdbService.subscribe('admin_audit_logs', (data) => {
      auditData = data || {};
      computeAndEmit();
    });

    unsubscribeFunctions = [
      unsubUser,
      unsubOrgs,
      unsubIdeas,
      unsubPublicIdeas,
      unsubTasks,
      unsubBlueprints,
      unsubInvitations,
      unsubActivity,
      unsubNotes,
      unsubWarnings,
      unsubAudit,
    ];

    return () => {
      unsubscribeFunctions.forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  },

  /**
   * Suspend a user account (Admin Only)
   */
  suspendUser: async (adminUid, adminName, userId, reason) => {
    if (!userId || !reason) throw new Error('Suspension reason is required.');
    return await apiClient.post(`/api/admin/users/${userId}/suspend`, { reason });
  },

  /**
   * Restore a suspended user account (Admin Only)
   */
  restoreUser: async (adminUid, adminName, userId) => {
    if (!userId) return;
    return await apiClient.post(`/api/admin/users/${userId}/restore`);
  },

  /**
   * Add internal admin note to user profile
   */
  addUserNote: async (adminUid, adminName, userId, noteText) => {
    if (!userId || !noteText.trim()) return;
    return await apiClient.post(`/api/admin/users/${userId}/note`, { noteText });
  },

  /**
   * Issue warning record to user
   */
  addUserWarning: async (adminUid, adminName, userId, reason, severity = 'Medium') => {
    if (!userId || !reason.trim()) return;
    return await apiClient.post(`/api/admin/users/${userId}/warning`, { reason, severity });
  },

  /**
   * Log administrative audit record (Handled authoritatively by backend on privileged mutations)
   */
  logAdminAudit: async (adminUid, adminName, actionType, targetId, details) => {
    // Audit logs are written authoritatively by the backend Express router.
    return Promise.resolve();
  },

  /**
   * Admin Cascade Delete User Data
   */
  deleteUserByAdmin: async (adminUid, adminName, targetUid) => {
    if (!targetUid) return;
    return await apiClient.delete(`/api/admin/users/${targetUid}`);
  },

  /**
   * Update Report Status (Admin Only)
   */
  updateReportStatus: async (reportId, newStatus, targetUid, resolutionNotes = null) => {
    if (!reportId || !newStatus) return;
    return await apiClient.patch(`/api/admin/reports/${reportId}/status`, {
      newStatus,
      targetUid,
      resolutionNotes,
    });
  },

  /**
   * Fetch All Reports (Admin Only) via Server-Authoritative API
   */
  getAllReports: async () => {
    const res = await apiClient.get('/api/admin/reports');
    return res.data?.data || res.data || [];
  },

  /**
   * Fetch Single Report Detail (Admin Only) via Server-Authoritative API
   */
  getReportDetail: async (reportId) => {
    if (!reportId) return null;
    const res = await apiClient.get(`/api/admin/reports/${reportId}`);
    return res.data?.data || res.data || null;
  },
};
