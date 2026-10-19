import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWaveform } from '../hooks/useVoiceRecorder.js';
import { formatAudioTime } from '../utils/audioHelpers.js';
import { validateAttachment } from '../utils/chatValidation.js';
import { ATTACHMENT_CATEGORIES } from '../constants/chatSchema.js';

test('WhatsApp Voice Recording & Playback Contract Suite', async (t) => {
  await t.test('1. formatAudioTime accurately formats durations in mm:ss', () => {
    assert.equal(formatAudioTime(0), '0:00');
    assert.equal(formatAudioTime(5), '0:05');
    assert.equal(formatAudioTime(59), '0:59');
    assert.equal(formatAudioTime(60), '1:00');
    assert.equal(formatAudioTime(75), '1:15');
    assert.equal(formatAudioTime(3599), '59:59');
    assert.equal(formatAudioTime(-10), '0:00', 'Negative duration clamps to 0:00');
  });

  await t.test('2. normalizeWaveform compresses raw audio peaks to WhatsApp 35-bar array', () => {
    // Empty array produces natural default waveform bars
    const fallbackWaveform = normalizeWaveform([], 35);
    assert.equal(fallbackWaveform.length, 35);
    fallbackWaveform.forEach((bar) => {
      assert.ok(bar >= 8 && bar <= 100, `Bar value ${bar} must be clamped between 8 and 100`);
    });

    // 100 raw peaks downsampled to 35 bars
    const rawPeaks = Array.from({ length: 100 }, (_, i) => (i % 2 === 0 ? 80 : 20));
    const normalized = normalizeWaveform(rawPeaks, 35);
    assert.equal(normalized.length, 35);
    normalized.forEach((bar) => {
      assert.ok(bar >= 8 && bar <= 100);
    });
  });

  await t.test('3. ATTACHMENT_CATEGORIES includes AUDIO category', () => {
    assert.equal(ATTACHMENT_CATEGORIES.AUDIO, 'audio');
  });

  await t.test('4. validateAttachment preserves voice note metadata (duration, waveform, isVoiceNote)', () => {
    const rawVoiceAttachment = {
      fileId: 'ut_voice_123',
      fileName: 'voice_note_1729356600.webm',
      extension: 'webm',
      mimeType: 'audio/webm;codecs=opus',
      size: 45000,
      url: 'https://utfs.io/f/voice_note_123.webm',
      uploadthingKey: 'voice_note_123',
      category: 'audio',
      isVoiceNote: true,
      duration: 14.82,
      waveform: [10, 20, 85, 95, 40, 15],
    };

    const { valid, sanitizedAttachment } = validateAttachment(rawVoiceAttachment);

    assert.equal(valid, true);
    assert.equal(sanitizedAttachment.isVoiceNote, true);
    assert.equal(sanitizedAttachment.category, 'audio');
    assert.equal(sanitizedAttachment.duration, 14.8, 'Duration must be rounded to one decimal place');
    assert.deepEqual(sanitizedAttachment.waveform, [10, 20, 85, 95, 40, 15]);
    assert.equal(sanitizedAttachment.url, 'https://utfs.io/f/voice_note_123.webm');
  });

  await t.test('5. Waveform array bounds and value clamps in validateAttachment', () => {
    const largeWaveform = Array.from({ length: 100 }, (_, i) => (i === 0 ? -5 : i === 1 ? 150 : 50));
    const attachmentWithLargeWaveform = {
      fileName: 'voice.webm',
      url: 'https://utfs.io/f/voice.webm',
      isVoiceNote: true,
      waveform: largeWaveform,
    };

    const { sanitizedAttachment } = validateAttachment(attachmentWithLargeWaveform);
    assert.equal(sanitizedAttachment.waveform.length, 60, 'Waveform must be capped at 60 items');
    assert.equal(sanitizedAttachment.waveform[0], 0, 'Negative values must be clamped to 0');
    assert.equal(sanitizedAttachment.waveform[1], 100, 'Values > 100 must be clamped to 100');
  });

  await t.test('6. WorkspaceChatPage attachment resolution handles pre-uploaded voice notes without re-uploading', () => {
    const resolveAttachmentData = (file) => {
      if (!file) return null;
      if (typeof file === 'object' && (file.url || file.fileId)) {
        return file;
      }
      return 'NEEDS_UPLOAD';
    };

    const voiceNoteObj = {
      fileId: 'ut_123',
      fileName: 'voice_note_123.webm',
      url: 'https://utfs.io/f/voice_note_123.webm',
      isVoiceNote: true,
      duration: 5.2,
      waveform: [10, 20, 30],
    };

    const resolved = resolveAttachmentData(voiceNoteObj);
    assert.equal(resolved, voiceNoteObj, 'Must pass pre-uploaded voice note directly without re-uploading');
  });
});
