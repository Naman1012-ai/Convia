import { rtdbService } from './rtdbService';
import { getErrorMessage } from '../utils/errorMessages';

/**
 * Platform-level Service Layer for User Issue Reporting & Moderation System.
 */
export const reportService = {
  /**
   * Helper to convert an uploaded File to base64 data string under 5MB.
   */
  readFileAsBase64: (file) => {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      if (file.size > 5 * 1024 * 1024) {
        return reject(new Error('Attachment size exceeds the 5 MB limit.'));
      }
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        return reject(new Error('Only PNG, JPG, JPEG, and PDF files are allowed.'));
      }

      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  },

  /**
   * Create a new platform-level issue report with auto-collected context.
   */
  createReport: async ({
    user,
    title,
    description,
    category = 'Bug Report',
    affectedArea = 'Dashboard',
    severity = 'Medium',
    file = null,
    currentRoute = '',
    workspaceId = null,
    ideaId = null,
  }) => {
    if (!user || !user.uid) {
      throw new Error('Authentication is required to submit a report.');
    }
    if (!title || !title.trim()) {
      throw new Error('Issue title is required.');
    }
    if (!description || !description.trim()) {
      throw new Error('Issue description is required.');
    }

    try {
      const timestamp = Date.now();
      const randomId = Math.floor(100000 + Math.random() * 900000);
      const reportId = `BS-2026-${randomId}`;

      // 1. Process File Attachment (if any)
      let attachmentUrl = null;
      let attachmentName = null;
      if (file) {
        attachmentUrl = await reportService.readFileAsBase64(file);
        attachmentName = file.name;
      }

      // 2. Build Report Document
      const reportData = {
        reportId,
        title: title.trim().slice(0, 100),
        description: description.trim().slice(0, 3000),
        category,
        affectedArea,
        severity,
        status: 'OPEN', // 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED'
        attachmentUrl,
        attachmentName,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: {
          uid: user.uid,
          name: user.displayName || user.email?.split('@')[0] || 'Anonymous User',
          email: user.email || '',
        },
        context: {
          currentRoute: currentRoute || window.location.pathname,
          workspaceId: workspaceId || null,
          ideaId: ideaId || null,
          browser: navigator.userAgent || 'Unknown Browser',
          os: navigator.platform || 'Unknown OS',
          appVersion: '1.0.0',
        },
      };

      // 3. Save to Global Reports & User Reports Index
      await Promise.all([
        rtdbService.setData(`reports/${reportId}`, reportData),
        rtdbService.setData(`user_reports/${user.uid}/${reportId}`, reportData),
      ]);

      // 4. Create User Submission Confirmation Notification
      const notifId = `notif_${Date.now()}`;
      await rtdbService.setData(`user_notifications/${user.uid}/${notifId}`, {
        notificationId: notifId,
        recipientId: user.uid,
        type: 'ADMIN_BROADCAST',
        title: 'Issue Report Submitted',
        body: `Your issue report (${reportId}) has been received and queued for review.`,
        previewText: `Your issue report (${reportId}) has been received.`,
        senderId: user.uid,
        actorId: user.uid,
        senderName: user.displayName || 'Me',
        actorName: user.displayName || 'Me',
        resourceType: 'report',
        resourceId: reportId,
        read: false,
        createdAt: timestamp,
        actionUrl: '/dashboard',
      }).catch((e) => console.warn('[reportService] Notification delivery warning:', e.message));

      return reportData;
    } catch (error) {
      console.error('[reportService] createReport error:', error);
      throw new Error(error.message || getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Real-time subscription to a specific user's submitted reports.
   */
  subscribeToUserReports: (uid, callback) => {
    if (!uid) {
      callback([]);
      return () => {};
    }

    return rtdbService.subscribe(`user_reports/${uid}`, (reportsObj) => {
      if (!reportsObj) {
        callback([]);
        return;
      }

      const reportsList = Object.values(reportsObj)
        .filter(Boolean)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      callback(reportsList);
    });
  },

  /**
   * Delete an OPEN report submitted by the current user.
   * Disallows deletion if status is IN_REVIEW, RESOLVED, or CLOSED.
   */
  deleteReport: async (uid, reportId) => {
    if (!uid || !reportId) return;

    try {
      const existing = await rtdbService.getData(`user_reports/${uid}/${reportId}`);
      if (!existing) {
        throw new Error('Report not found.');
      }
      if (existing.status !== 'OPEN') {
        throw new Error('This report has already been reviewed by an admin and can no longer be deleted.');
      }

      await Promise.all([
        rtdbService.removeData(`reports/${reportId}`),
        rtdbService.removeData(`user_reports/${uid}/${reportId}`),
      ]);

      return true;
    } catch (error) {
      console.error('[reportService] deleteReport error:', error);
      throw new Error(error.message || getErrorMessage(error.code || 'default'));
    }
  },
};
