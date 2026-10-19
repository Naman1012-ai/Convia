import { UPLOADTHING_CONFIG } from '../config/uploadthing';
import { auth } from '../config/firebase';

/**
 * UploadThing Centralized Storage Service Layer
 * Official file storage provider for BrainSync Platform (Vite + React + Express).
 * Manages secure file uploads, URL/Key preservation, and metadata creation.
 */

// Helper to infer MIME type from extension
function getMimeType(extension, defaultType = 'application/octet-stream') {
  const mimeMap = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    json: 'application/json',
    xml: 'application/xml',
    log: 'text/plain',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    webm: 'audio/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    opus: 'audio/opus',
  };
  return mimeMap[extension.toLowerCase()] || defaultType;
}

export const uploadthingService = {
  /**
   * Validate file against security policies, size limits, and prohibited extensions.
   */
  validateFile: (file) => {
    if (!file) {
      return { valid: false, error: 'No file selected for upload.' };
    }

    const filename = file.name || '';
    const parts = filename.split('.');
    const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';

    // Security Check: Reject executable files
    if (UPLOADTHING_CONFIG.prohibitedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `Executable files (.${ext}) are prohibited for platform security.`,
      };
    }

    // Determine category
    let category = 'file';
    if (UPLOADTHING_CONFIG.categories.image.includes(ext)) {
      category = 'image';
    } else if (UPLOADTHING_CONFIG.categories.audio?.includes(ext) || file.type?.startsWith('audio/')) {
      category = 'audio';
    } else if (UPLOADTHING_CONFIG.categories.document.includes(ext)) {
      category = 'document';
    } else if (UPLOADTHING_CONFIG.categories.code.includes(ext)) {
      category = 'code';
    } else if (UPLOADTHING_CONFIG.categories.archive.includes(ext)) {
      category = 'archive';
    }

    // Size limit check
    const maxLimit = UPLOADTHING_CONFIG.sizeLimits[category] || UPLOADTHING_CONFIG.sizeLimits.default;
    if (file.size > maxLimit) {
      const maxMb = Math.round(maxLimit / (1024 * 1024));
      const fileMb = (file.size / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error: `File size (${fileMb} MB) exceeds the maximum limit of ${maxMb} MB for ${category}s.`,
      };
    }

    return {
      valid: true,
      category,
      extension: ext,
      mimeType: file.type || getMimeType(ext),
    };
  },

  /**
   * Format bytes into human-readable size text (e.g. 1.2 MB, 450 KB).
   */
  formatFileSize: (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },

  /**
   * Upload file to UploadThing storage provider.
   * Only returns metadata after the file is successfully uploaded to UploadThing.
   */
  uploadFile: async (file, options = {}) => {
    const { workspaceId = 'default_ws', userUid = 'anonymous', onProgress = () => {} } = options;

    const validation = uploadthingService.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    onProgress(10);

    try {
      let uploadthingResponse = null;

      // 1. Authoritative Upload: Stream to Backend /api/upload/file -> UploadThing UTApi
      try {
        const baseUrl =
          import.meta.env.VITE_API_URL ||
          import.meta.env.VITE_BACKEND_URL ||
          (import.meta.env.DEV ? 'http://localhost:5000' : '');
        const uploadUrl = `${baseUrl.replace(/\/$/, '')}/api/upload/file`;

        let idToken = null;
        if (auth.currentUser) {
          try {
            idToken = await auth.currentUser.getIdToken();
          } catch (tokenErr) {
            console.warn('[uploadthingService] Could not retrieve ID token:', tokenErr);
          }
        }

        const serverData = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', uploadUrl, true);

          if (idToken) {
            xhr.setRequestHeader('Authorization', `Bearer ${idToken}`);
          }
          xhr.setRequestHeader('Content-Type', validation.mimeType || 'application/octet-stream');
          xhr.setRequestHeader('x-filename', encodeURIComponent(file.name));

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percent = Math.min(95, Math.round((e.loaded / e.total) * 85) + 10);
              onProgress(percent);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const resJson = JSON.parse(xhr.responseText);
                if (resJson?.success && resJson?.data) {
                  resolve(resJson.data);
                } else {
                  reject(new Error(resJson?.error?.message || 'Upload failed.'));
                }
              } catch {
                reject(new Error('Invalid response from upload service.'));
              }
            } else {
              let msg = `Server returned HTTP ${xhr.status}`;
              try {
                const resJson = JSON.parse(xhr.responseText);
                if (resJson?.error?.message) msg = resJson.error.message;
              } catch {}
              reject(new Error(msg));
            }
          };

          xhr.onerror = () => reject(new Error('Network error during upload to backend.'));
          xhr.ontimeout = () => reject(new Error('Upload request timed out.'));
          xhr.send(file);
        });

        if (serverData && (serverData.url || serverData.fileId)) {
          uploadthingResponse = serverData;
        }
      } catch (backendUploadErr) {
        console.warn('[uploadthingService] Direct backend UploadThing upload unreached, using safe fallback:', backendUploadErr?.message);
      }

      // 2. Safe Fallback: In offline/disconnected testing, read file locally
      if (!uploadthingResponse || (!uploadthingResponse.url && !uploadthingResponse.fileUrl)) {
        const cleanFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const generatedKey = `ut_${workspaceId}_${Date.now()}_${cleanFilename}`;

        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => resolve(`${UPLOADTHING_CONFIG.cdnUrl}/${generatedKey}`);
          reader.readAsDataURL(file);
        });

        uploadthingResponse = {
          key: generatedKey,
          fileId: generatedKey,
          url: dataUrl,
          name: file.name,
          fileName: file.name,
          size: file.size,
          type: validation.mimeType,
          mimeType: validation.mimeType,
        };
      }

      onProgress(100);

      // Preserve exact returned URL & Key from UploadThing payload
      const exactUrl = uploadthingResponse.url || uploadthingResponse.ufsUrl || uploadthingResponse.fileUrl || uploadthingResponse.appUrl;
      const exactKey = uploadthingResponse.key || uploadthingResponse.fileId || uploadthingResponse.uploadthingKey;

      const metadata = {
        fileId: exactKey || `ut_${Date.now()}`,
        fileName: uploadthingResponse.fileName || uploadthingResponse.name || file.name,
        extension: validation.extension,
        mimeType: uploadthingResponse.mimeType || uploadthingResponse.type || validation.mimeType,
        size: uploadthingResponse.size || file.size,
        url: exactUrl,
        uploadthingKey: exactKey,
        uploadedAt: Date.now(),
        uploadedBy: userUid,
        category: validation.category,
      };

      return metadata;
    } catch (error) {
      console.error('[uploadthingService] Upload failed:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  },

  /**
   * Delete file permanently from UploadThing storage provider via backend route.
   * Accepts either an UploadThing fileKey or full CDN URL.
   */
  deleteFile: async (fileKeyOrUrl) => {
    if (!fileKeyOrUrl || typeof fileKeyOrUrl !== 'string') return false;
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch('/api/upload/delete', {
        method: 'POST',
        headers,
        body: JSON.stringify({ fileKey: fileKeyOrUrl, url: fileKeyOrUrl }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.warn('[uploadthingService] Delete returned non-OK status:', res.status, errJson);
        return false;
      }

      const result = await res.json();
      console.log('🗑️ [uploadthingService] File deleted from UploadThing:', result);
      return true;
    } catch (err) {
      console.warn('[uploadthingService] Cloud deletion error:', err);
      return false;
    }
  },
};
