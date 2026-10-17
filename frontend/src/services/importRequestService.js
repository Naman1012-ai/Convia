import { apiClient } from './apiClient';

/**
 * Frontend Client Service for Public Idea Import Approvals.
 */
export const importRequestService = {
  /**
   * Submits a request to import a public idea into a workspace.
   * If requester is the author, backend directly imports and returns selfImport: true.
   */
  createImportRequest: async (ideaId, workspaceId, requestNote) => {
    const res = await apiClient.post(`/api/public-ideas/${encodeURIComponent(ideaId)}/import-requests`, {
      workspaceId,
      requestNote,
    });
    return res?.data !== undefined ? res.data : res;
  },

  /**
   * Retrieves all import requests for ideas created by the current user.
   */
  getReceivedRequests: async () => {
    const res = await apiClient.get('/api/public-ideas/import-requests/received');
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    return [];
  },

  /**
   * Retrieves all import requests submitted by the current user.
   */
  getSentRequests: async () => {
    const res = await apiClient.get('/api/public-ideas/import-requests/sent');
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    return [];
  },

  /**
   * Approves an import request (Creator only).
   */
  approveRequest: async (requestId) => {
    const res = await apiClient.post(`/api/public-ideas/import-requests/${encodeURIComponent(requestId)}/approve`);
    return res?.data !== undefined ? res.data : res;
  },

  /**
   * Rejects an import request with a required short reason (Creator only).
   */
  rejectRequest: async (requestId, rejectionReason) => {
    const res = await apiClient.post(`/api/public-ideas/import-requests/${encodeURIComponent(requestId)}/reject`, {
      rejectionReason,
    });
    return res?.data !== undefined ? res.data : res;
  },

  /**
   * Cancels a pending import request (Requester only).
   */
  cancelRequest: async (requestId) => {
    const res = await apiClient.post(`/api/public-ideas/import-requests/${encodeURIComponent(requestId)}/cancel`);
    return res?.data !== undefined ? res.data : res;
  },

  /**
   * Pre-flight query to get live import and conflict status across workspaces for an idea.
   */
  getIdeaImportStatus: async (ideaId, workspaceIds = []) => {
    const wsParam = workspaceIds.filter(Boolean).join(',');
    const res = await apiClient.get(
      `/api/public-ideas/${encodeURIComponent(ideaId)}/import-status?workspaceIds=${encodeURIComponent(wsParam)}`
    );
    return res?.data !== undefined ? res.data : res;
  },
};
