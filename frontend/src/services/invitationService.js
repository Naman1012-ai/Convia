import { apiClient } from './apiClient';
import { normalizeInvitationCode, normalizeEmail } from '../utils/invitationCodeHelper';

export const invitationService = {
  /**
   * Generates a new unique invitation code bound to the recipient email and workspace.
   */
  createInvitation: async (workspaceId, email, role = 'member') => {
    return await apiClient.post(`/api/invitations/workspace/${workspaceId}`, {
      email: normalizeEmail(email),
      role,
    });
  },

  /**
   * Fetches all pending and historical invitations for a workspace. Owner/Admin only.
   */
  getWorkspaceInvitations: async (workspaceId) => {
    const data = await apiClient.get(`/api/invitations/workspace/${workspaceId}`);
    return data?.invitations || [];
  },

  /**
   * Regenerates a pending invitation code (invalidates previous code and issues new one).
   */
  regenerateInvitation: async (workspaceId, invitationId) => {
    return await apiClient.post(`/api/invitations/workspace/${workspaceId}/${invitationId}/regenerate`);
  },

  /**
   * Revokes an active pending invitation code.
   */
  revokeInvitation: async (workspaceId, invitationId) => {
    return await apiClient.post(`/api/invitations/workspace/${workspaceId}/${invitationId}/revoke`);
  },

  /**
   * Looks up invitation preview metadata using the invitation code.
   * Works for both authenticated and unauthenticated users before signing in.
   */
  lookupInvitationByCode: async (code) => {
    const cleanCode = normalizeInvitationCode(code);
    return await apiClient.post('/api/invitations/lookup', { code: cleanCode });
  },

  /**
   * Accepts an invitation code. Authenticated user's email MUST match invitedEmail.
   */
  acceptInvitation: async (code) => {
    const cleanCode = normalizeInvitationCode(code);
    return await apiClient.post('/api/invitations/accept', { code: cleanCode });
  },

  /**
   * Declines an invitation code.
   */
  declineInvitation: async (code) => {
    const cleanCode = normalizeInvitationCode(code);
    return await apiClient.post('/api/invitations/decline', { code: cleanCode });
  },
};
