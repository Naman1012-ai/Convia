/**
 * Standardized Notification Messages for BrainSync
 */
export const NOTIFICATION_MESSAGES = {
  WORKSPACE: {
    CREATED: 'Workspace created successfully.',
    UPDATED: 'Workspace updated successfully.',
    DELETED: 'Workspace deleted successfully.',
    MARKED_DELETION: 'Workspace scheduled for deletion. You can restore it within 7 days from the Workspaces page.',
    RESTORED: 'Workspace restored successfully.',
    LEFT: 'You left the workspace.',
    PREFERENCES_UPDATED: 'Workspace preferences updated successfully.',
  },
  IDEA: {
    CREATED: 'Idea created successfully.',
    UPDATED: 'Idea updated successfully.',
    DELETED: 'Idea deleted successfully.',
    VOTED: 'Vote recorded.',
    IMPORT_SUCCESS: 'Ideas imported successfully.',
  },
  TASK: {
    CREATED: 'Task created successfully.',
    UPDATED: 'Task updated successfully.',
    DELETED: 'Task deleted successfully.',
    COMPLETED: 'Task completed.',
  },
  MEMBER: {
    INVITED: 'Member invited successfully.',
    REMOVED: 'Member removed from workspace.',
    ROLE_UPDATED: 'Member role updated successfully.',
    OWNERSHIP_TRANSFERRED: 'Workspace ownership transferred successfully.',
  },
  ANNOUNCEMENT: {
    PUBLISHED: 'Announcement published.',
    DELETED: 'Announcement deleted.',
  },
  FILE: {
    UPLOADED: 'File uploaded successfully.',
    DELETED: 'File deleted successfully.',
  },
  AUTH: {
    SIGNIN_SUCCESS: 'Signed in successfully.',
    SIGNUP_SUCCESS: 'Account created successfully.',
    PASSWORD_RESET: 'Password reset email sent.',
    PROFILE_UPDATED: 'Profile updated successfully.',
    ACCOUNT_DELETED: 'Account deleted successfully.',
  },
  ADMIN: {
    SETTINGS_SAVED: 'Admin settings saved successfully.',
    USER_UPDATED: 'User details updated.',
    ROLE_UPDATED: 'Role updated successfully.',
    BROADCAST_SENT: 'Broadcast notification sent to users.',
  },
  COMMON: {
    GENERIC_ERROR: 'Something went wrong. Please try again.',
    SAVING: 'Saving changes...',
    UPLOADING: 'Uploading file...',
  },
};
