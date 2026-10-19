import test from 'node:test';
import assert from 'node:assert/strict';
import { extractUploadThingKey } from '../../../backend/src/routes/uploadthingRouter.js';

test('Avatar Permanent Deletion & Fallback Isolation Suite', async (t) => {
  await t.test('1. extractUploadThingKey correctly parses keys from URLs and strings', () => {
    assert.equal(
      extractUploadThingKey('https://utfs.io/f/file_12345.png'),
      'file_12345.png',
      'Should extract key from utfs.io/f/... URL'
    );
    assert.equal(
      extractUploadThingKey('https://my-app.ufs.sh/f/avatar_abcdef.webp'),
      'avatar_abcdef.webp',
      'Should extract key from ufs.sh/f/... URL'
    );
    assert.equal(
      extractUploadThingKey('raw_key_xyz987'),
      'raw_key_xyz987',
      'Should return raw key if no protocol is present'
    );
    assert.equal(
      extractUploadThingKey(''),
      '',
      'Should handle empty input cleanly'
    );
    assert.equal(
      extractUploadThingKey(null),
      '',
      'Should handle null cleanly'
    );
  });

  await t.test('2. useUserProfile avatar resolution contract prevents historical fallback when photo is removed', () => {
    // Replicating useUserProfile avatar logic:
    const resolveAvatar = (profile, fallbackAvatar) => {
      if (profile) {
        const photo = profile.photoURL || profile.avatar;
        if (photo && typeof photo === 'string' && photo.trim()) return photo.trim();
        return ''; // Authoritative: profile is loaded and photo was removed
      }
      return fallbackAvatar || '';
    };

    // Case A: User has an active photo
    const profileWithPhoto = { uid: 'user_1', photoURL: 'https://utfs.io/f/pic.jpg' };
    assert.equal(
      resolveAvatar(profileWithPhoto, 'https://old-message-snapshot.jpg'),
      'https://utfs.io/f/pic.jpg',
      'Should return active photoURL when set'
    );

    // Case B: User removed their profile photo (empty or null)
    const profileWithoutPhoto = { uid: 'user_1', photoURL: null };
    assert.equal(
      resolveAvatar(profileWithoutPhoto, 'https://old-message-snapshot.jpg'),
      '',
      'Should return empty string (monogram) and NEVER leak old historical message snapshot'
    );

    const profileWithEmptyString = { uid: 'user_1', photoURL: '' };
    assert.equal(
      resolveAvatar(profileWithEmptyString, 'https://old-message-snapshot.jpg'),
      '',
      'Should return empty string when photoURL is empty string'
    );

    // Case C: Profile is not yet loaded (transient loading state)
    assert.equal(
      resolveAvatar(null, 'https://old-message-snapshot.jpg'),
      'https://old-message-snapshot.jpg',
      'Should use fallbackAvatar only while profile is not loaded'
    );
  });

  await t.test('3. ChatMessageItem senderAvatar contract honors liveProfile removal', () => {
    const resolveSenderAvatar = (liveProfile, senderMember, liveAvatar, message) => {
      const isProfileLoaded = Boolean(liveProfile || senderMember);
      return isProfileLoaded
        ? (liveAvatar || (senderMember ? (senderMember.avatar || senderMember.photoURL || '') : ''))
        : (liveAvatar || message.senderAvatar || '');
    };

    const message = {
      senderId: 'user_1',
      senderAvatar: 'https://historical-strawberry-avatar.jpg',
    };

    // User removed their avatar: liveAvatar is ''
    const liveProfile = { uid: 'user_1', photoURL: null };
    const senderMember = { uid: 'user_1', photoURL: '' };

    const avatar = resolveSenderAvatar(liveProfile, senderMember, '', message);
    assert.equal(
      avatar,
      '',
      'ChatMessageItem must resolve to empty string to show monogram, ignoring message.senderAvatar'
    );

    // Profile still loading (unresolved):
    const loadingAvatar = resolveSenderAvatar(null, null, '', message);
    assert.equal(
      loadingAvatar,
      'https://historical-strawberry-avatar.jpg',
      'Initial unhydrated state can use message.senderAvatar to avoid flash'
    );
  });
});
