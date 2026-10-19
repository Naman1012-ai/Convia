/**
 * UploadThing Client Configuration for BrainSync Platform
 * Official file storage provider configuration for Workspace Attachments,
 * Blueprints, Tasks, and User Assets.
 */

export const UPLOADTHING_CONFIG = {
  appId: import.meta.env.VITE_UPLOADTHING_APP_ID || 'brainsync-app',
  cdnUrl: 'https://utfs.io/f',

  // Configurable size limits in bytes
  sizeLimits: {
    image: 10 * 1024 * 1024,    // 10 MB
    audio: 25 * 1024 * 1024,    // 25 MB
    document: 25 * 1024 * 1024, // 25 MB
    code: 25 * 1024 * 1024,     // 25 MB
    archive: 50 * 1024 * 1024,  // 50 MB
    default: 25 * 1024 * 1024,  // 25 MB
  },

  // Allowed categories and extensions
  categories: {
    image: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
    audio: ['webm', 'mp3', 'wav', 'ogg', 'm4a', 'aac', 'opus', 'mp4'],
    document: ['pdf', 'doc', 'docx', 'txt', 'md', 'csv', 'json'],
    code: ['json', 'csv', 'xml', 'log'],
    archive: ['zip', 'rar', '7z', 'tar', 'gz'],
  },

  // Strictly prohibited executable extensions
  prohibitedExtensions: [
    'exe', 'bat', 'cmd', 'sh', 'vbs', 'js', 'mjs', 'jar', 'apk', 'app', 'scr', 'msi', 'com', 'pif'
  ],
};
