import React from 'react';
import { resolveMemberDisplayName } from './memberIdentity.js';

/**
 * Convia Chat System Phase 7: Mentions Extraction & Formatting Engine.
 * Single source of truth for parsing, autocompleting, and safely rendering @mentions.
 */

/**
 * Extracts all valid member mentions from message text content.
 * Matches @username or @displayName against the workspace members list.
 *
 * @param {string} content - Message or reply text
 * @param {Array<Object>} [members=[]] - Workspace members list
 * @returns {Array<{ uid: string, displayName: string, username: string, token: string }>}
 */
export function extractMentions(content, members = []) {
  if (!content || typeof content !== 'string' || !Array.isArray(members) || members.length === 0) {
    return [];
  }

  // Regex to extract @mentions (alphanumeric + underscore/dot/hyphen)
  const mentionRegex = /@([a-zA-Z0-9_.-]+)/g;
  const matches = [...content.matchAll(mentionRegex)];
  if (matches.length === 0) return [];

  const foundMentions = [];
  const seenUids = new Set();

  matches.forEach((match) => {
    const rawToken = match[1].toLowerCase().trim();
    if (!rawToken) return;

    // Match against username, displayName, or name
    const matchedMember = members.find((m) => {
      if (!m) return false;
      const uName = (m.username || '').toLowerCase().trim();
      const dName = (m.displayName || '').toLowerCase().trim().replace(/\s+/g, '');
      const rawName = (m.name || '').toLowerCase().trim().replace(/\s+/g, '');

      return uName === rawToken || dName === rawToken || rawName === rawToken;
    });

    if (matchedMember && matchedMember.uid && !seenUids.has(matchedMember.uid)) {
      seenUids.add(matchedMember.uid);
      foundMentions.push({
        uid: matchedMember.uid,
        displayName: resolveMemberDisplayName(matchedMember),
        username: matchedMember.username || '',
        token: match[0],
      });
    }
  });

  return foundMentions;
}

/**
 * Filters member list for mention autocomplete dropdown based on current text query.
 *
 * @param {string} query - Text after '@'
 * @param {Array<Object>} [members=[]] - Workspace members list
 * @param {number} [limit=5] - Maximum suggestions to return
 * @returns {Array<Object>}
 */
export function getMentionSuggestions(query, members = [], limit = 5) {
  if (!Array.isArray(members)) return [];
  const cleanQuery = (query || '').toLowerCase().trim();

  const filtered = members.filter((m) => {
    if (!m) return false;
    const displayName = resolveMemberDisplayName(m).toLowerCase();
    const username = (m.username || '').toLowerCase();
    const email = (m.email || '').toLowerCase();

    return displayName.includes(cleanQuery) || username.includes(cleanQuery) || email.includes(cleanQuery);
  });

  return filtered.slice(0, limit);
}

/**
 * Safely parses and renders message text with rich interactive mention badges without XSS.
 *
 * @param {string} content - Raw message body
 * @param {Array<Object>} [members=[]] - Workspace members list
 * @param {string|null} [currentUserId=null] - Currently logged-in UID
 * @returns {Array<React.ReactNode>}
 */
export function renderFormattedContent(content, members = [], currentUserId = null, isOwnMessage = false) {
  if (!content) return null;
  if (typeof content !== 'string') return String(content);

  // Split content by @mention pattern
  const mentionRegex = /(@[a-zA-Z0-9_.-]+)/g;
  const parts = content.split(mentionRegex);

  return parts.map((part, index) => {
    if (part.startsWith('@')) {
      const rawToken = part.substring(1).toLowerCase().trim();
      const matchedMember = Array.isArray(members)
        ? members.find((m) => {
            if (!m) return false;
            const uName = (m.username || '').toLowerCase().trim();
            const dName = (m.displayName || '').toLowerCase().trim().replace(/\s+/g, '');
            const rawName = (m.name || '').toLowerCase().trim().replace(/\s+/g, '');
            return uName === rawToken || dName === rawToken || rawName === rawToken;
          })
        : null;

      if (matchedMember) {
        const displayName = resolveMemberDisplayName(matchedMember);
        const isSelfMention = Boolean(currentUserId && matchedMember.uid === currentUserId);

        return React.createElement(
          'span',
          {
            key: `mention_${index}_${matchedMember.uid}`,
            className: `inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-semibold select-none transition-all mx-0.5 ${
              isOwnMessage
                ? isSelfMention
                  ? 'bg-amber-300 text-amber-950 font-bold shadow-2xs'
                  : 'bg-white/25 text-white font-bold border border-white/30'
                : isSelfMention
                ? 'bg-amber-100/90 text-amber-900 border border-amber-300 font-bold shadow-2xs'
                : 'bg-primary-50 text-primary-700 hover:bg-primary-100/80 border border-primary-200/60'
            }`,
            title: `Mentioned: ${displayName} (@${matchedMember.username || 'member'})`,
          },
          `@${displayName}`
        );
      }
    }

    // Regular text segment
    return React.createElement('span', { key: `text_${index}` }, part);
  });
}
