/**
 * Express UploadThing Router Configuration for BrainSync Backend
 * Handles server-side UploadThing file upload endpoints and callbacks.
 */

import express from 'express';
import { createUploadthing, createRouteHandler } from 'uploadthing/express';
import { UTApi } from 'uploadthing/server';

const f = createUploadthing();

// Server-side UploadThing API instance
export const utApi = new UTApi({
  token: process.env.UPLOADTHING_TOKEN,
});

// UploadThing Express Route Definitions (Standard protocol)
export const uploadRouter = {
  attachmentUploader: f({
    image: { maxFileSize: '10MB', maxFileCount: 1 },
    pdf: { maxFileSize: '25MB', maxFileCount: 1 },
    blob: { maxFileSize: '50MB', maxFileCount: 1 },
  })
    .middleware(async ({ req }) => {
      if (!req.user || !req.user.uid || !req.user.authenticated) {
        throw new Error('Authentication required for file upload.');
      }
      return { userId: req.user.uid, userEmail: req.user.email || '' };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log('📦 [UT-Step 5] UploadThing response:', file);
      console.log('☁️ [UT-Step 6] File stored in UploadThing dashboard:', file.url || file.ufsUrl);
    }),

  avatarUploader: f({
    image: { maxFileSize: '5MB', maxFileCount: 1 },
  })
    .middleware(async ({ req }) => {
      if (!req.user || !req.user.uid || !req.user.authenticated) {
        throw new Error('Authentication required for file upload.');
      }
      return { userId: req.user.uid, userEmail: req.user.email || '' };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log('👤 [UT-Avatar] Avatar uploaded to UploadThing dashboard:', file.url || file.ufsUrl);
    }),
};

// Express Route Handler Export (UploadThing standard endpoint)
export const uploadthingExpressHandler = createRouteHandler({
  router: uploadRouter,
  config: {
    token: process.env.UPLOADTHING_TOKEN,
  },
});

// Prohibited executable extensions for security
const PROHIBITED_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'vbs', 'js', 'mjs', 'jar', 'apk', 'app', 'scr', 'msi', 'com', 'pif'
]);

/**
 * Direct file upload router that streams files directly to UploadThing via UTApi.
 * Guarantees that uploaded assets appear in the user's UploadThing dashboard
 * and return official CDN URLs.
 */
export const directUploadRouter = express.Router();

directUploadRouter.post(
  '/file',
  express.raw({ type: '*/*', limit: '25mb' }),
  async (req, res) => {
    try {
      if (!req.user || !req.user.uid) {
        return res.status(401).json({
          success: false,
          error: { message: 'Authentication required to upload files.', code: 'UNAUTHORIZED' },
        });
      }

      if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'No file data received in upload request.', code: 'EMPTY_FILE' },
        });
      }

      const rawFilename = req.headers['x-filename']
        ? decodeURIComponent(req.headers['x-filename'])
        : `upload_${Date.now()}`;
      
      const cleanFilename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const ext = (cleanFilename.split('.').pop() || '').toLowerCase();

      if (PROHIBITED_EXTENSIONS.has(ext)) {
        return res.status(400).json({
          success: false,
          error: { message: `Executable files (.${ext}) are prohibited for platform security.`, code: 'PROHIBITED_FILE' },
        });
      }

      const mimeType = req.headers['content-type'] || 'application/octet-stream';

      // Create native Node File instance from raw binary Buffer
      const file = new File([req.body], cleanFilename, { type: mimeType });

      // Authoritative upload via UploadThing Server SDK
      const uploadResult = await utApi.uploadFiles(file);

      if (uploadResult?.error) {
        console.error('❌ [UploadThing] Direct upload error:', uploadResult.error);
        return res.status(500).json({
          success: false,
          error: { message: uploadResult.error.message || 'Upload to UploadThing failed.', code: 'UPLOAD_FAILED' },
        });
      }

      const fileData = uploadResult?.data;
      if (!fileData || !fileData.key) {
        throw new Error('UploadThing did not return valid file metadata.');
      }

      const cdnUrl = fileData.ufsUrl || fileData.url || fileData.appUrl;

      console.log(`☁️ [UploadThing] File stored in UploadThing dashboard: ${cdnUrl} (Key: ${fileData.key}, User: ${req.user.uid})`);

      return res.status(200).json({
        success: true,
        data: {
          fileId: fileData.key,
          fileName: cleanFilename,
          extension: ext,
          mimeType: fileData.type || mimeType,
          size: fileData.size,
          url: cdnUrl,
          uploadthingKey: fileData.key,
          uploadedAt: Date.now(),
          uploadedBy: req.user.uid,
        },
      });
    } catch (err) {
      console.error('❌ [UploadThing] Unhandled upload error:', err);
      return res.status(500).json({
        success: false,
        error: { message: err?.message || 'Internal upload error.', code: 'INTERNAL_ERROR' },
      });
    }
  }
);

/**
 * Helper to extract an UploadThing file key from a key string or full CDN URL.
 */
export function extractUploadThingKey(keyOrUrl) {
  if (!keyOrUrl || typeof keyOrUrl !== 'string') return '';
  const trimmed = keyOrUrl.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const fIndex = parts.indexOf('f');
    if (fIndex !== -1 && parts[fIndex + 1]) {
      return parts[fIndex + 1];
    }
    return parts[parts.length - 1] || '';
  } catch {
    return trimmed.split('/').pop() || '';
  }
}

/**
 * Delete a file permanently from UploadThing storage by key or URL.
 */
directUploadRouter.delete('/file/:key', async (req, res) => {
  try {
    if (!req.user || !req.user.uid) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required to delete files.', code: 'UNAUTHORIZED' },
      });
    }

    const rawKey = req.params.key;
    const key = extractUploadThingKey(decodeURIComponent(rawKey));

    if (!key) {
      return res.status(400).json({
        success: false,
        error: { message: 'Valid file key is required.', code: 'INVALID_KEY' },
      });
    }

    console.log(`🗑️ [UploadThing] Deleting file from storage: ${key} (User: ${req.user.uid})`);
    const deleteResult = await utApi.deleteFiles(key);
    console.log(`✅ [UploadThing] Deletion complete for ${key}:`, deleteResult);

    return res.status(200).json({
      success: true,
      data: {
        key,
        deleted: true,
        result: deleteResult,
      },
    });
  } catch (err) {
    console.error('❌ [UploadThing] Deletion error:', err);
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to delete file from UploadThing.', code: 'DELETE_FAILED' },
    });
  }
});

/**
 * Alternative POST endpoint for deleting files with body payload (key or url).
 */
directUploadRouter.post('/delete', express.json(), async (req, res) => {
  try {
    if (!req.user || !req.user.uid) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required to delete files.', code: 'UNAUTHORIZED' },
      });
    }

    const target = req.body?.fileKey || req.body?.url || req.body?.fileUrl;
    const key = extractUploadThingKey(target);

    if (!key) {
      return res.status(400).json({
        success: false,
        error: { message: 'Valid fileKey or url is required in request body.', code: 'INVALID_KEY' },
      });
    }

    console.log(`🗑️ [UploadThing] Deleting file via POST: ${key} (User: ${req.user.uid})`);
    const deleteResult = await utApi.deleteFiles(key);
    console.log(`✅ [UploadThing] Deletion complete for ${key}:`, deleteResult);

    return res.status(200).json({
      success: true,
      data: {
        key,
        deleted: true,
        result: deleteResult,
      },
    });
  } catch (err) {
    console.error('❌ [UploadThing] Deletion error:', err);
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to delete file from UploadThing.', code: 'DELETE_FAILED' },
    });
  }
});

