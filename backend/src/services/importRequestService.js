import { rtdbService } from './rtdbService.js';
import { notificationService } from './notificationService.js';
import { emailService } from './emailService.js';
import { NOTIFICATION_TYPES } from '../constants/notificationConstants.js';

export const importRequestService = {
  /**
   * Submits a request to import a public idea into a workspace.
   * If the requester is already the creator of the public idea, performs an instant direct copy.
   */
  createRequest: async ({ ideaId, requesterUid, requesterWorkspaceId, requestNote, userRecord = {} }) => {
    if (!ideaId || typeof ideaId !== 'string') {
      const err = new Error('Public Idea ID is required.');
      err.statusCode = 400;
      err.code = 'INVALID_IDEA_ID';
      throw err;
    }

    if (!requesterWorkspaceId || typeof requesterWorkspaceId !== 'string') {
      const err = new Error('Target workspace ID is required.');
      err.statusCode = 400;
      err.code = 'INVALID_WORKSPACE_ID';
      throw err;
    }

    if (!requesterUid || typeof requesterUid !== 'string') {
      const err = new Error('Requester identity is required.');
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    // 1. Fetch public idea
    const publicIdea = await rtdbService.getData(`publicIdeas/${ideaId}`);
    if (!publicIdea || publicIdea.isDeleted) {
      const err = new Error('Public idea not found or has been removed.');
      err.statusCode = 404;
      err.code = 'IDEA_NOT_FOUND';
      throw err;
    }

    const creatorUid = publicIdea.authorId || publicIdea.createdBy;
    if (!creatorUid) {
      const err = new Error('Public idea has no valid creator attribution.');
      err.statusCode = 500;
      err.code = 'INVALID_CREATOR';
      throw err;
    }

    // 2. Validate workspace existence & requester's active membership
    const [orgData, memberRecord] = await Promise.all([
      rtdbService.getData(`organizations/${requesterWorkspaceId}`),
      rtdbService.getData(`organization_members/${requesterWorkspaceId}/${requesterUid}`),
    ]);

    const isOrgOwner = orgData && (orgData.ownerId === requesterUid || orgData.createdBy === requesterUid);
    const isMember = memberRecord && !memberRecord.isDeleted && memberRecord.role !== 'viewer';

    if (!isOrgOwner && !isMember) {
      const err = new Error('You must be an active member or owner of the target workspace to import ideas.');
      err.statusCode = 403;
      err.code = 'FORBIDDEN_WORKSPACE_MEMBERSHIP';
      throw err;
    }

    const workspaceName = orgData?.name || 'Workspace';

    // 3. Check if idea is ALREADY imported into target workspace
    // Must run before creator shortcut: even the creator cannot import an idea if a teammate already imported it
    const workspaceIdeas = (await rtdbService.getData(`ideas/${requesterWorkspaceId}`)) || {};
    const existingImportedIdea = Object.values(workspaceIdeas).find(
      (item) => item && !item.isDeleted && (item.importedFromPublicId === ideaId || item.origin?.publicIdeaId === ideaId)
    );

    if (existingImportedIdea) {
      const importerName = existingImportedIdea.authorName || 'A team member';
      const importerUid = existingImportedIdea.authorId || existingImportedIdea.origin?.importedBy;
      const isSelf = importerUid === requesterUid;
      const err = new Error(
        isSelf
          ? `You have already imported this idea into '${workspaceName}'.`
          : `@${importerName} has already imported this idea into '${workspaceName}'.`
      );
      err.statusCode = 409;
      err.code = 'ALREADY_IMPORTED';
      err.details = {
        importedIdeaId: existingImportedIdea.ideaId,
        importerUid,
        importerName,
        isSelf,
        workspaceId: requesterWorkspaceId,
        workspaceName,
      };
      throw err;
    }

    // 4. Creator Self-Import Shortcut:
    // If the requester is the original creator and it's not yet in the workspace, allow direct copy without approval
    if (requesterUid === creatorUid) {
      const directIdea = await importRequestService._executeImportCopy({
        publicIdea,
        targetWorkspaceId: requesterWorkspaceId,
        requesterUid,
        requesterName: userRecord.displayName || publicIdea.authorName || 'Innovator',
        requestId: null,
      });

      return {
        selfImport: true,
        message: 'Imported directly into your workspace as the original creator.',
        importedIdea: directIdea,
      };
    }

    // 5. Validate request note length (20 - 500 characters)
    const sanitizedNote = String(requestNote || '').trim();
    if (sanitizedNote.length < 20 || sanitizedNote.length > 500) {
      const err = new Error('Import request note must be between 20 and 500 characters.');
      err.statusCode = 400;
      err.code = 'INVALID_NOTE_LENGTH';
      throw err;
    }

    // 6. Check for duplicate and cross-workspace active PENDING requests
    const allRequests = (await rtdbService.getData('import_requests')) || {};
    const requestsList = Object.values(allRequests).filter(Boolean);

    // Rule 1: A user cannot request the same idea for multiple workspaces simultaneously.
    const userPendingInAnotherWs = requestsList.find(
      (req) =>
        req.ideaId === ideaId &&
        req.requesterUid === requesterUid &&
        req.requesterWorkspaceId !== requesterWorkspaceId &&
        req.status === 'PENDING'
    );

    if (userPendingInAnotherWs) {
      const otherWsName = userPendingInAnotherWs.requesterWorkspaceName || 'another workspace';
      const err = new Error(
        `You already have an active pending import request for this idea in '${otherWsName}'. Please wait for the creator's decision or cancel it before requesting for another workspace.`
      );
      err.statusCode = 409;
      err.code = 'USER_PENDING_IN_ANOTHER_WORKSPACE';
      err.details = {
        conflictingWorkspaceId: userPendingInAnotherWs.requesterWorkspaceId,
        conflictingWorkspaceName: otherWsName,
        requestId: userPendingInAnotherWs.requestId,
      };
      throw err;
    }

    // Rule 2: Workspace-level check for the target workspace:
    const existingPendingForWs = requestsList.find(
      (req) =>
        req.ideaId === ideaId &&
        req.requesterWorkspaceId === requesterWorkspaceId &&
        req.status === 'PENDING'
    );

    if (existingPendingForWs) {
      if (existingPendingForWs.requesterUid === requesterUid) {
        // Same user, same workspace
        const err = new Error(
          `You have already submitted an import request for this idea into '${workspaceName}'. It is awaiting creator approval.`
        );
        err.statusCode = 409;
        err.code = 'USER_REQUEST_ALREADY_PENDING';
        err.details = {
          requestId: existingPendingForWs.requestId,
          createdAt: existingPendingForWs.createdAt,
        };
        throw err;
      } else {
        // Teammate in same workspace
        const teammate = existingPendingForWs.requesterName || 'A teammate';
        const err = new Error(
          `@${teammate} has already submitted an import request for this idea into '${workspaceName}'. It is currently awaiting creator approval.`
        );
        err.statusCode = 409;
        err.code = 'TEAMMATE_REQUEST_ALREADY_PENDING';
        err.details = {
          teammateName: teammate,
          teammateUid: existingPendingForWs.requesterUid,
          requestId: existingPendingForWs.requestId,
          createdAt: existingPendingForWs.createdAt,
        };
        throw err;
      }
    }

    // 7. Construct and store import request
    const requestId = `impreq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = Date.now();

    const requesterDisplayName =
      userRecord.displayName || userRecord.name || userRecord.username || userRecord.email?.split('@')[0] || 'Team Member';
    const requesterEmail = userRecord.email || '';

    const newRequest = {
      requestId,
      ideaId,
      ideaTitle: publicIdea.title || 'Untitled Proposal',
      creatorUid,
      creatorName: publicIdea.authorName || 'Original Innovator',
      requesterUid,
      requesterName: requesterDisplayName,
      requesterEmail,
      requesterWorkspaceId,
      requesterWorkspaceName: workspaceName,
      requestNote: sanitizedNote,
      status: 'PENDING',
      createdAt: timestamp,
      updatedAt: timestamp,
      respondedAt: null,
      rejectionReason: null,
      importedIdeaId: null,
    };

    await rtdbService.setData(`import_requests/${requestId}`, newRequest);

    // 8. Non-blocking notifications (In-app + Email)
    const creatorUser = await rtdbService.getData(`users/${creatorUid}`);
    const creatorEmail = creatorUser?.email;

    // In-app notification to Creator
    notificationService
      .dispatchNotificationEvent(
        NOTIFICATION_TYPES.IMPORT_REQUEST_RECEIVED,
        {
          targetUid: creatorUid,
          ideaId,
          ideaTitle: publicIdea.title,
          workspaceName,
          requestNote: sanitizedNote,
          requestId,
        },
        requesterUid,
        requesterDisplayName,
        userRecord.photoURL || null
      )
      .catch((err) => console.warn('[importRequestService] In-app notification error:', err.message));

    // Secondary Email Notification to Creator
    if (creatorEmail) {
      emailService
        .sendImportRequestEmail({
          toEmail: creatorEmail,
          creatorName: publicIdea.authorName || creatorUser.displayName || 'Innovator',
          requesterName: requesterDisplayName,
          requesterWorkspaceName: workspaceName,
          ideaTitle: publicIdea.title,
          requestNote: sanitizedNote,
          reviewUrl: `${process.env.VITE_API_URL || 'http://localhost:3000'}/explore?tab=requests`,
        })
        .catch((err) => console.warn('[importRequestService] Email error:', err.message));
    }

    return {
      success: true,
      request: newRequest,
      message: 'Import request sent to the creator successfully.',
    };
  },

  /**
   * Approves an import request and atomically creates an attributed copy in the requester's workspace.
   */
  approveRequest: async ({ requestId, actorUid, actorName = 'Creator', actorAvatar = null }) => {
    if (!requestId) {
      const err = new Error('Request ID is required.');
      err.statusCode = 400;
      err.code = 'INVALID_REQUEST_ID';
      throw err;
    }

    const request = await rtdbService.getData(`import_requests/${requestId}`);
    if (!request) {
      const err = new Error('Import request not found.');
      err.statusCode = 404;
      err.code = 'REQUEST_NOT_FOUND';
      throw err;
    }

    if (request.status !== 'PENDING') {
      const err = new Error(`Cannot approve request with status "${request.status}".`);
      err.statusCode = 400;
      err.code = 'INVALID_STATUS_TRANSITION';
      throw err;
    }

    // Authorization: Only the creator of the public idea can approve
    if (request.creatorUid !== actorUid) {
      const err = new Error('Only the original idea creator is authorized to approve this import request.');
      err.statusCode = 403;
      err.code = 'FORBIDDEN_APPROVAL';
      throw err;
    }

    // Requester cannot approve their own request
    if (request.requesterUid === actorUid) {
      const err = new Error('You cannot approve your own import request.');
      err.statusCode = 403;
      err.code = 'FORBIDDEN_SELF_APPROVAL';
      throw err;
    }

    // Verify public idea still exists and is not deleted
    const publicIdea = await rtdbService.getData(`publicIdeas/${request.ideaId}`);
    if (!publicIdea || publicIdea.isDeleted) {
      const err = new Error('Target public idea no longer exists or was removed.');
      err.statusCode = 410;
      err.code = 'IDEA_GONE';
      throw err;
    }

    // Verify target workspace still exists and requester is still a member
    const [orgData, memberRecord] = await Promise.all([
      rtdbService.getData(`organizations/${request.requesterWorkspaceId}`),
      rtdbService.getData(`organization_members/${request.requesterWorkspaceId}/${request.requesterUid}`),
    ]);

    const isOrgOwner = orgData && (orgData.ownerId === request.requesterUid || orgData.createdBy === request.requesterUid);
    const isMember = memberRecord && !memberRecord.isDeleted;

    if (!isOrgOwner && !isMember) {
      const err = new Error('Requester is no longer an active member of the target workspace.');
      err.statusCode = 400;
      err.code = 'REQUESTER_LEFT_WORKSPACE';
      throw err;
    }

    const timestamp = Date.now();
    const newIdeaId = `idea_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;

    // Prepare attributed copy
    const importedWorkspaceIdea = {
      ideaId: newIdeaId,
      orgId: request.requesterWorkspaceId,
      authorId: request.requesterUid,
      authorName: request.requesterName || 'Team Member',
      title: publicIdea.title.trim(),
      description: (publicIdea.description || publicIdea.problemStatement || '').trim(),
      problemStatement: (publicIdea.problemStatement || '').trim(),
      proposedSolution: (publicIdea.proposedSolution || '').trim(),
      techStack: (publicIdea.techStack || '').trim(),
      category: publicIdea.category || 'General',
      visibility: 'private',
      status: 'active',
      projectStatus: 'Ideation',
      createdBy: request.requesterUid,
      createdAt: timestamp,
      updatedAt: timestamp,
      voteCount: 0,
      discussionCount: 0,
      suggestionCount: 0,
      commentCount: 0,
      isSelected: false,
      isDeleted: false,
      origin: {
        type: 'imported',
        publicIdeaId: request.ideaId,
        originalAuthorId: request.creatorUid,
        originalAuthorName: request.creatorName || publicIdea.authorName || 'Original Innovator',
        originalCreatedAt: publicIdea.createdAt || timestamp,
        importedAt: timestamp,
        importedBy: request.requesterUid,
        importRequestId: requestId,
      },
      permissions: {
        deletionAuthority: 'workspaceOwner',
      },
      originalAuthorId: request.creatorUid,
      originalAuthorName: request.creatorName || publicIdea.authorName || 'Original Innovator',
      originalCreatedAt: publicIdea.createdAt || null,
      importedFromPublicId: request.ideaId,
      importedAt: timestamp,
    };

    // Atomic Multi-Path Write: create idea copy + update request status to IMPORTED
    const updates = {
      [`ideas/${request.requesterWorkspaceId}/${newIdeaId}`]: importedWorkspaceIdea,
      [`import_requests/${requestId}/status`]: 'IMPORTED',
      [`import_requests/${requestId}/importedIdeaId`]: newIdeaId,
      [`import_requests/${requestId}/respondedAt`]: timestamp,
      [`import_requests/${requestId}/updatedAt`]: timestamp,
    };

    await rtdbService.updateData('/', updates);

    // Non-blocking notifications (In-app + Email)
    const requesterUser = await rtdbService.getData(`users/${request.requesterUid}`);
    const requesterEmail = request.requesterEmail || requesterUser?.email;

    notificationService
      .dispatchNotificationEvent(
        NOTIFICATION_TYPES.IMPORT_REQUEST_APPROVED,
        {
          targetUid: request.requesterUid,
          ideaId: request.ideaId,
          ideaTitle: publicIdea.title,
          workspaceId: request.requesterWorkspaceId,
          workspaceName: request.requesterWorkspaceName,
          importedIdeaId: newIdeaId,
          requestId,
        },
        actorUid,
        actorName,
        actorAvatar
      )
      .catch((err) => console.warn('[importRequestService] In-app notification error:', err.message));

    if (requesterEmail) {
      emailService
        .sendImportApprovedEmail({
          toEmail: requesterEmail,
          requesterName: request.requesterName,
          creatorName: request.creatorName || actorName,
          ideaTitle: publicIdea.title,
          workspaceName: request.requesterWorkspaceName,
          workspaceIdeaUrl: `${process.env.VITE_API_URL || 'http://localhost:3000'}/workspaces/${request.requesterWorkspaceId}/ideas`,
        })
        .catch((err) => console.warn('[importRequestService] Email error:', err.message));
    }

    return {
      success: true,
      request: {
        ...request,
        status: 'IMPORTED',
        importedIdeaId: newIdeaId,
        respondedAt: timestamp,
      },
      importedIdea: importedWorkspaceIdea,
      message: 'Import request approved and attributed copy created in workspace.',
    };
  },

  /**
   * Rejects an import request with a required short explanation.
   */
  rejectRequest: async ({ requestId, actorUid, actorName = 'Creator', actorAvatar = null, rejectionReason }) => {
    if (!requestId) {
      const err = new Error('Request ID is required.');
      err.statusCode = 400;
      err.code = 'INVALID_REQUEST_ID';
      throw err;
    }

    const sanitizedReason = String(rejectionReason || '').trim();
    if (sanitizedReason.length < 5 || sanitizedReason.length > 500) {
      const err = new Error('Please provide a brief rejection reason (5 to 500 characters).');
      err.statusCode = 400;
      err.code = 'INVALID_REJECTION_REASON';
      throw err;
    }

    const request = await rtdbService.getData(`import_requests/${requestId}`);
    if (!request) {
      const err = new Error('Import request not found.');
      err.statusCode = 404;
      err.code = 'REQUEST_NOT_FOUND';
      throw err;
    }

    if (request.status !== 'PENDING') {
      const err = new Error(`Cannot reject request with status "${request.status}".`);
      err.statusCode = 400;
      err.code = 'INVALID_STATUS_TRANSITION';
      throw err;
    }

    // Authorization: Only the creator of the public idea can reject
    if (request.creatorUid !== actorUid) {
      const err = new Error('Only the original idea creator is authorized to reject this import request.');
      err.statusCode = 403;
      err.code = 'FORBIDDEN_REJECTION';
      throw err;
    }

    const timestamp = Date.now();

    const updates = {
      [`import_requests/${requestId}/status`]: 'REJECTED',
      [`import_requests/${requestId}/rejectionReason`]: sanitizedReason,
      [`import_requests/${requestId}/respondedAt`]: timestamp,
      [`import_requests/${requestId}/updatedAt`]: timestamp,
    };

    await rtdbService.updateData('/', updates);

    // Non-blocking notifications (In-app + Email)
    const requesterUser = await rtdbService.getData(`users/${request.requesterUid}`);
    const requesterEmail = request.requesterEmail || requesterUser?.email;

    notificationService
      .dispatchNotificationEvent(
        NOTIFICATION_TYPES.IMPORT_REQUEST_REJECTED,
        {
          targetUid: request.requesterUid,
          ideaId: request.ideaId,
          ideaTitle: request.ideaTitle,
          rejectionReason: sanitizedReason,
          requestId,
        },
        actorUid,
        actorName,
        actorAvatar
      )
      .catch((err) => console.warn('[importRequestService] In-app notification error:', err.message));

    if (requesterEmail) {
      emailService
        .sendImportRejectedEmail({
          toEmail: requesterEmail,
          requesterName: request.requesterName,
          creatorName: request.creatorName || actorName,
          ideaTitle: request.ideaTitle,
          rejectionReason: sanitizedReason,
        })
        .catch((err) => console.warn('[importRequestService] Email error:', err.message));
    }

    return {
      success: true,
      request: {
        ...request,
        status: 'REJECTED',
        rejectionReason: sanitizedReason,
        respondedAt: timestamp,
      },
      message: 'Import request rejected.',
    };
  },

  /**
   * Cancels a pending import request (Requester only).
   */
  cancelRequest: async ({ requestId, actorUid }) => {
    if (!requestId) {
      const err = new Error('Request ID is required.');
      err.statusCode = 400;
      err.code = 'INVALID_REQUEST_ID';
      throw err;
    }

    const request = await rtdbService.getData(`import_requests/${requestId}`);
    if (!request) {
      const err = new Error('Import request not found.');
      err.statusCode = 404;
      err.code = 'REQUEST_NOT_FOUND';
      throw err;
    }

    if (request.requesterUid !== actorUid) {
      const err = new Error('You are only authorized to cancel your own import requests.');
      err.statusCode = 403;
      err.code = 'FORBIDDEN_CANCELLATION';
      throw err;
    }

    if (request.status !== 'PENDING') {
      const err = new Error(`Cannot cancel a request that is already ${request.status}.`);
      err.statusCode = 400;
      err.code = 'CANNOT_CANCEL';
      throw err;
    }

    const timestamp = Date.now();
    await rtdbService.updateData(`import_requests/${requestId}`, {
      status: 'CANCELLED',
      updatedAt: timestamp,
      respondedAt: timestamp,
    });

    return {
      success: true,
      message: 'Import request cancelled successfully.',
    };
  },

  /**
   * Retrieves all import requests where the user is the idea creator.
   */
  getRequestsForCreator: async (creatorUid) => {
    if (!creatorUid) return [];
    const all = (await rtdbService.getData('import_requests')) || {};
    return Object.values(all)
      .filter((r) => r && r.creatorUid === creatorUid)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  /**
   * Retrieves all import requests sent by a requester.
   */
  getRequestsForRequester: async (requesterUid) => {
    if (!requesterUid) return [];
    const all = (await rtdbService.getData('import_requests')) || {};
    return Object.values(all)
      .filter((r) => r && r.requesterUid === requesterUid)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  /**
   * Retrieves comprehensive import status for an idea across a set of workspaces for a given user.
   * Informs the frontend whether the idea is already imported, pending by the user, pending by a teammate,
   * or if the user is locked because they have a pending request in another workspace.
   */
  getIdeaImportStatus: async ({ ideaId, userUid, workspaceIds = [] }) => {
    if (!ideaId) return { workspaceStatuses: {}, userActivePendingRequest: null };

    const [allRequestsObj, allIdeasObj, orgsObj] = await Promise.all([
      rtdbService.getData('import_requests'),
      rtdbService.getData('ideas'),
      rtdbService.getData('organizations'),
    ]);

    const requestsList = Object.values(allRequestsObj || {}).filter(Boolean);

    // 1. Check if the current user has any active PENDING request for this idea in any workspace
    let userActivePendingRequest = null;
    if (userUid) {
      const userPending = requestsList.find(
        (r) => r.ideaId === ideaId && r.requesterUid === userUid && r.status === 'PENDING'
      );
      if (userPending) {
        userActivePendingRequest = {
          requestId: userPending.requestId,
          workspaceId: userPending.requesterWorkspaceId,
          requesterWorkspaceId: userPending.requesterWorkspaceId,
          workspaceName: userPending.requesterWorkspaceName || orgsObj?.[userPending.requesterWorkspaceId]?.name || 'Workspace',
          requesterWorkspaceName: userPending.requesterWorkspaceName || orgsObj?.[userPending.requesterWorkspaceId]?.name || 'Workspace',
          createdAt: userPending.createdAt,
          requestNote: userPending.requestNote,
        };
      }
    }

    // 2. Compute status for each requested workspace
    const workspaceStatuses = {};
    for (const wsId of workspaceIds) {
      if (!wsId) continue;

      // Check if already imported in this workspace
      const wsIdeas = allIdeasObj?.[wsId] || {};
      const importedIdea = Object.values(wsIdeas).find(
        (item) => item && !item.isDeleted && (item.importedFromPublicId === ideaId || item.origin?.publicIdeaId === ideaId)
      );

      let importedBy = null;
      if (importedIdea) {
        const importerUid = importedIdea.authorId || importedIdea.origin?.importedBy || null;
        const importerName = importedIdea.authorName || 'A team member';
        importedBy = {
          uid: importerUid,
          name: importerName,
          isSelf: userUid ? importerUid === userUid : false,
          importedIdeaId: importedIdea.ideaId,
          importedAt: importedIdea.createdAt,
        };
      }

      // Check if there is an active PENDING request for this idea in this workspace
      const pendingReq = requestsList.find(
        (r) => r.ideaId === ideaId && r.requesterWorkspaceId === wsId && r.status === 'PENDING'
      );

      let pendingInfo = null;
      if (pendingReq) {
        const isSelf = userUid ? pendingReq.requesterUid === userUid : false;
        pendingInfo = {
          requestId: pendingReq.requestId,
          requesterUid: pendingReq.requesterUid,
          requesterName: pendingReq.requesterName || 'Team Member',
          isCurrentUser: isSelf,
          isSelf,
          createdAt: pendingReq.createdAt,
          requestNote: pendingReq.requestNote,
        };
      }

      workspaceStatuses[wsId] = {
        workspaceId: wsId,
        workspaceName: orgsObj?.[wsId]?.name || 'Workspace',
        isImported: Boolean(importedIdea),
        importedIdeaId: importedIdea?.ideaId || null,
        importedBy,
        pendingRequest: pendingInfo,
      };
    }

    return {
      ideaId,
      userActivePendingRequest,
      userPendingRequest: userActivePendingRequest,
      workspaceStatuses,
    };
  },

  /**
   * Internal helper for direct creator self-import.
   */
  _executeImportCopy: async ({ publicIdea, targetWorkspaceId, requesterUid, requesterName, requestId = null }) => {
    const timestamp = Date.now();
    const newIdeaId = `idea_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;

    const importedWorkspaceIdea = {
      ideaId: newIdeaId,
      orgId: targetWorkspaceId,
      authorId: requesterUid,
      authorName: requesterName,
      title: publicIdea.title.trim(),
      description: (publicIdea.description || publicIdea.problemStatement || '').trim(),
      problemStatement: (publicIdea.problemStatement || '').trim(),
      proposedSolution: (publicIdea.proposedSolution || '').trim(),
      techStack: (publicIdea.techStack || '').trim(),
      category: publicIdea.category || 'General',
      visibility: 'private',
      status: 'active',
      projectStatus: 'Ideation',
      createdBy: requesterUid,
      createdAt: timestamp,
      updatedAt: timestamp,
      voteCount: 0,
      discussionCount: 0,
      suggestionCount: 0,
      commentCount: 0,
      isSelected: false,
      isDeleted: false,
      origin: {
        type: 'imported',
        publicIdeaId: publicIdea.ideaId,
        originalAuthorId: requesterUid,
        originalAuthorName: publicIdea.authorName || requesterName,
        originalCreatedAt: publicIdea.createdAt || timestamp,
        importedAt: timestamp,
        importedBy: requesterUid,
        importRequestId: requestId,
      },
      permissions: {
        deletionAuthority: 'workspaceOwner',
      },
      originalAuthorId: requesterUid,
      originalAuthorName: publicIdea.authorName || requesterName,
      originalCreatedAt: publicIdea.createdAt || null,
      importedFromPublicId: publicIdea.ideaId,
      importedAt: timestamp,
    };

    await rtdbService.setData(`ideas/${targetWorkspaceId}/${newIdeaId}`, importedWorkspaceIdea);
    return importedWorkspaceIdea;
  },
};
