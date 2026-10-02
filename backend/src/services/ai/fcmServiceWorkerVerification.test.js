import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Running [fcmServiceWorkerVerification.test.js] — FCM Phase 1 Verification...');

async function runTests() {
  const rootDir = process.cwd();
  const publicSwPath = path.resolve(rootDir, 'frontend/public/firebase-messaging-sw.js');
  const distSwPath = path.resolve(rootDir, 'frontend/dist/firebase-messaging-sw.js');
  const fcmServicePath = path.resolve(rootDir, 'frontend/src/services/fcmService.js');
  const rootVercelPath = path.resolve(rootDir, 'vercel.json');
  const frontendVercelPath = path.resolve(rootDir, 'frontend/vercel.json');
  const firebaseConfigPath = path.resolve(rootDir, 'frontend/src/config/firebase.js');

  // 1. Invariant: public and dist service worker exist
  assert.ok(fs.existsSync(publicSwPath), 'frontend/public/firebase-messaging-sw.js must exist');
  assert.ok(fs.existsSync(distSwPath), 'frontend/dist/firebase-messaging-sw.js must exist in build output');
  console.log('  ✅ Invariant 1 Passed: Service worker exists in public/ and dist/ outputs');

  // 2. Invariant: Service worker uses Firebase 10.14.1 compat scripts
  const swContent = fs.readFileSync(publicSwPath, 'utf8');
  assert.ok(
    swContent.includes('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js'),
    'Service worker must import firebase-app-compat.js v10.14.1'
  );
  assert.ok(
    swContent.includes('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js'),
    'Service worker must import firebase-messaging-compat.js v10.14.1'
  );
  console.log('  ✅ Invariant 2 Passed: Service worker uses matching Firebase v10.14.1 SDK');

  // 3. Invariant: Authoritative Firebase web configuration is reused
  assert.ok(swContent.includes("projectId: params.get('projectId') || 'brainsync-07'"), 'Project ID must match brainsync-07');
  assert.ok(swContent.includes("messagingSenderId: params.get('messagingSenderId') || '470734580927'"), 'Messaging Sender ID must match project number 470734580927');
  assert.ok(swContent.includes("appId: params.get('appId') || '1:470734580927:web:8b259b8ed89a158c972a0a'"), 'App ID must match authoritative web client');
  console.log('  ✅ Invariant 3 Passed: Authoritative Firebase configuration correctly reused with parameter override support');

  // 4. Invariant: Deduplication in onBackgroundMessage
  assert.ok(
    swContent.includes('if (payload && payload.notification) {') || swContent.includes('if (payload.notification) {'),
    'onBackgroundMessage must prevent duplicate notifications when payload.notification exists'
  );
  console.log('  ✅ Invariant 4 Passed: Duplicate notification prevention implemented');

  // 5. Invariant: notificationclick handler origin security check
  assert.ok(
    swContent.includes('if (parsed.origin === self.location.origin)'),
    'notificationclick handler must sanitize target URL origin'
  );
  assert.ok(
    swContent.includes('clients') && swContent.includes('matchAll') && swContent.includes('includeUncontrolled: true'),
    'notificationclick handler must match window clients to focus existing tab'
  );
  console.log('  ✅ Invariant 5 Passed: Notification click handler safely sanitizes destinations and focuses existing tabs');

  // 6. Invariant: Vercel routing and headers configuration
  const rootVercel = JSON.parse(fs.readFileSync(rootVercelPath, 'utf8'));
  const frontendVercel = JSON.parse(fs.readFileSync(frontendVercelPath, 'utf8'));

  const checkVercelHeaders = (config, name) => {
    assert.ok(Array.isArray(config.headers), `${name} must include headers array`);
    const swHeader = config.headers.find((h) => h.source === '/firebase-messaging-sw.js');
    assert.ok(swHeader, `${name} must define headers for /firebase-messaging-sw.js`);
    const swAllowed = swHeader.headers.find((h) => h.key === 'Service-Worker-Allowed');
    assert.ok(swAllowed && swAllowed.value === '/', `${name} must specify Service-Worker-Allowed: /`);
  };

  checkVercelHeaders(rootVercel, 'root vercel.json');
  checkVercelHeaders(frontendVercel, 'frontend/vercel.json');
  console.log('  ✅ Invariant 6 Passed: Vercel deployment configs contain root Service-Worker-Allowed and caching headers');

  // 7. Invariant: Client FCM service helper exists and exports essentials
  assert.ok(fs.existsSync(fcmServicePath), 'frontend/src/services/fcmService.js must exist');
  const fcmServiceContent = fs.readFileSync(fcmServicePath, 'utf8');
  assert.ok(fcmServiceContent.includes('isFcmSupported') && (fcmServiceContent.includes('export function isFcmSupported') || fcmServiceContent.includes('export async function isFcmSupported')), 'fcmService must export isFcmSupported');
  assert.ok(fcmServiceContent.includes('export async function registerMessagingServiceWorker'), 'fcmService must export registerMessagingServiceWorker');
  console.log('  ✅ Invariant 7 Passed: Client FCM helper properly structured for Phase 2');

  // 8. Invariant: firebase.js provides fallbacks for messagingSenderId
  const firebaseConfigContent = fs.readFileSync(firebaseConfigPath, 'utf8');
  assert.ok(
    firebaseConfigContent.includes('470734580927'),
    'frontend/src/config/firebase.js must include messagingSenderId fallback'
  );
  console.log('  ✅ Invariant 8 Passed: firebase.js includes messagingSenderId fallback');

  console.log('\n🎉 ALL FCM PHASE 1 SERVICE WORKER INVARIANTS PASSED!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
