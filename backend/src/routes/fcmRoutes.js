import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { fcmPushService } from '../services/fcmPushService.js';

export const fcmRouter = express.Router();

// Strict route-level authentication guard
fcmRouter.use(requireAuth);

/**
 * POST /api/notifications/fcm/register
 * Registers or refreshes a browser FCM push token for the authenticated user.
 * Derived strictly from verified auth token (req.user.uid).
 */
fcmRouter.post('/register', async (req, res) => {
  try {
    const uid = req.user.uid;
    const { token, deviceId, userAgent, platform } = req.body || {};

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'An FCM registration token string is required.',
        },
      });
    }

    const result = await fcmPushService.registerToken(uid, {
      token,
      deviceId,
      userAgent,
      platform,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('[fcmRoutes] /register error:', err.message);
    return res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: err.message || 'Failed to register push notification token.',
      },
    });
  }
});

/**
 * POST /api/notifications/fcm/unregister
 * Unregisters a specific device FCM push token for the authenticated user.
 */
fcmRouter.post('/unregister', async (req, res) => {
  try {
    const uid = req.user.uid;
    const { token } = req.body || {};

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'An FCM token is required to unregister.',
        },
      });
    }

    const result = await fcmPushService.unregisterToken(uid, token);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('[fcmRoutes] /unregister error:', err.message);
    return res.status(500).json({
      success: false,
      error: {
        code: 'UNREGISTRATION_FAILED',
        message: err.message || 'Failed to unregister push notification token.',
      },
    });
  }
});

/**
 * GET /api/notifications/fcm/status
 * Returns current device token status and registration count for the authenticated user.
 */
fcmRouter.get('/status', async (req, res) => {
  try {
    const uid = req.user.uid;
    const tokens = await fcmPushService.getUserTokens(uid);

    return res.status(200).json({
      success: true,
      data: {
        enabled: tokens.length > 0,
        tokenCount: tokens.length,
      },
    });
  } catch (err) {
    console.error('[fcmRoutes] /status error:', err.message);
    return res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_CHECK_FAILED',
        message: 'Failed to retrieve notification status.',
      },
    });
  }
});

/**
 * POST /api/notifications/fcm/send-push
 * Internal authorized endpoint to dispatch server-side push notifications.
 */
fcmRouter.post('/send-push', async (req, res) => {
  try {
    const { recipientUids, notification } = req.body || {};

    if (!Array.isArray(recipientUids) || recipientUids.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RECIPIENTS',
          message: 'recipientUids must be a non-empty array of user IDs.',
        },
      });
    }

    if (!notification || typeof notification !== 'object' || (!notification.id && !notification.notificationId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_NOTIFICATION',
          message: 'A valid notification object with notificationId is required.',
        },
      });
    }

    const result = await fcmPushService.sendPushToRecipients(recipientUids, notification);
    console.log(`📨 [fcmRoutes] /send-push result: type=${notification.type || 'UNKNOWN'}, delivered=${result.delivered || 0}, reason=${result.reason || 'OK'}`);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('[fcmRoutes] /send-push error:', err.message);
    return res.status(500).json({
      success: false,
      error: {
        code: 'PUSH_DISPATCH_FAILED',
        message: err.message || 'Failed to dispatch push notification.',
      },
    });
  }
});
