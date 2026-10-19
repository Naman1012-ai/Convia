import React, { useState } from 'react';
import { resolveMemberDisplayName } from './memberIdentity.js';

/**
 * Discord Markdown AST Engine for Convia.
 * Safely parses Discord-flavored markdown into React elements with zero XSS vulnerabilities.
 */

// Interactive Code Block Component with Copy Action
export function DiscordCodeBlock({ language = '', code = '' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e?.stopPropagation?.();
    if (code) {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(code);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return React.createElement(
    'div',
    { className: 'my-2 rounded-lg border border-slate-700/60 bg-[#1e1f22] overflow-hidden shadow-xs text-xs' },
    React.createElement(
      'div',
      { className: 'flex items-center justify-between px-3 py-1.5 bg-[#2b2d31] border-b border-slate-700/50 text-[11px] font-mono text-slate-400' },
      React.createElement('span', { className: 'font-semibold uppercase tracking-wider text-slate-300' }, language || 'text'),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: handleCopy,
          className: 'text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1 font-sans text-[11px]',
        },
        copied ? '✓ Copied' : 'Copy'
      )
    ),
    React.createElement(
      'pre',
      { className: 'p-3 font-mono text-[12px] leading-relaxed text-slate-200 overflow-x-auto whitespace-pre' },
      React.createElement('code', null, code)
    )
  );
}

// Interactive Discord Spoiler Pill
export function DiscordSpoiler({ children }) {
  const [revealed, setRevealed] = useState(false);

  return React.createElement(
    'span',
    {
      onClick: (e) => {
        e?.stopPropagation?.();
        setRevealed(!revealed);
      },
      title: revealed ? 'Click to hide spoiler' : 'Click to reveal spoiler',
      className: `inline-block rounded px-1.5 py-0.5 cursor-pointer transition-all select-none ${
        revealed
          ? 'bg-slate-200/90 text-slate-900 border border-slate-300'
          : 'bg-[#2b2d31] text-transparent hover:bg-[#313338] border border-[#1e1f22]'
      }`,
    },
    children
  );
}

/**
 * Parses inline formatting tokens (bold, italic, underline, strikethrough, inline code, spoiler, url, mentions, channels).
 */
export function parseInlineTokens(text, options = {}, keyPrefix = 'inline') {
  if (!text || typeof text !== 'string') return [text];

  const { members = [], currentUserId = null, onSelectChannel = null } = options;

  // Regex splitting on code, spoilers, bold, underline, strike, italic, mentions, channels, urls
  const tokenRegex = /(```[\s\S]*?```|`[^`\n]+`|\|\|[\s\S]+?\|\||\*\*[\s\S]+?\*\*|__[\s\S]+?__|~~[\s\S]+?~~|\*[^*\n]+?\*|_[^_\n]+?_|https?:\/\/[^\s]+|@[a-zA-Z0-9_.-]+|#[a-zA-Z0-9_-]+)/g;

  const parts = text.split(tokenRegex);
  const elements = [];

  parts.forEach((part, index) => {
    if (!part) return;
    const key = `${keyPrefix}_${index}`;

    // 1. Multi-line code block: ```lang\ncode\n```
    if (part.startsWith('```') && part.endsWith('```') && part.length >= 6) {
      const inner = part.slice(3, -3);
      const firstNewline = inner.indexOf('\n');
      let lang = '';
      let code = inner;
      if (firstNewline !== -1) {
        lang = inner.slice(0, firstNewline).trim();
        code = inner.slice(firstNewline + 1);
      }
      elements.push(
        React.createElement(DiscordCodeBlock, {
          key,
          language: lang,
          code: code.replace(/\r\n/g, '\n'),
        })
      );
      return;
    }

    // 2. Inline code: `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const codeContent = part.slice(1, -1);
      elements.push(
        React.createElement(
          'code',
          {
            key,
            className:
              'px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#2b2d31] text-slate-800 dark:text-slate-200 font-mono text-[12px] border border-slate-200 dark:border-slate-700/60',
          },
          codeContent
        )
      );
      return;
    }

    // 3. Spoiler: ||spoiler||
    if (part.startsWith('||') && part.endsWith('||') && part.length >= 4) {
      const spoilerContent = part.slice(2, -2);
      elements.push(
        React.createElement(
          DiscordSpoiler,
          { key },
          parseInlineTokens(spoilerContent, options, `${key}_sp`)
        )
      );
      return;
    }

    // 4. Bold: **text**
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const boldContent = part.slice(2, -2);
      elements.push(
        React.createElement(
          'strong',
          { key, className: 'font-bold text-slate-900 dark:text-slate-100' },
          parseInlineTokens(boldContent, options, `${key}_b`)
        )
      );
      return;
    }

    // 5. Underline: __text__
    if (part.startsWith('__') && part.endsWith('__') && part.length >= 4) {
      const underlineContent = part.slice(2, -2);
      elements.push(
        React.createElement(
          'ins',
          { key, className: 'underline underline-offset-2 decoration-1' },
          parseInlineTokens(underlineContent, options, `${key}_u`)
        )
      );
      return;
    }

    // 6. Strikethrough: ~~text~~
    if (part.startsWith('~~') && part.endsWith('~~') && part.length >= 4) {
      const strikeContent = part.slice(2, -2);
      elements.push(
        React.createElement(
          'del',
          { key, className: 'line-through opacity-70' },
          parseInlineTokens(strikeContent, options, `${key}_s`)
        )
      );
      return;
    }

    // 7. Italic: *text* or _text_
    if (
      ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) &&
      part.length >= 2
    ) {
      const italicContent = part.slice(1, -1);
      elements.push(
        React.createElement(
          'em',
          { key, className: 'italic' },
          parseInlineTokens(italicContent, options, `${key}_i`)
        )
      );
      return;
    }

    // 8. Mentions: @username
    if (part.startsWith('@')) {
      const rawToken = part.slice(1).toLowerCase().trim();
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

        elements.push(
          React.createElement(
            'span',
            {
              key,
              className: `inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-semibold select-none transition-all mx-0.5 ${
                isSelfMention
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold shadow-2xs'
                  : 'bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200/60'
              }`,
              title: `Mentioned: ${displayName} (@${matchedMember.username || 'member'})`,
            },
            `@${displayName}`
          )
        );
        return;
      }
    }

    // 9. Channel links: #channel-name
    if (part.startsWith('#') && part.length > 1) {
      const channelSlug = part.slice(1).toLowerCase().trim();
      elements.push(
        React.createElement(
          'button',
          {
            key,
            type: 'button',
            onClick: (e) => {
              e?.stopPropagation?.();
              if (typeof onSelectChannel === 'function') {
                onSelectChannel(channelSlug);
              }
            },
            className:
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary-50 text-primary-600 hover:bg-primary-100 hover:text-primary-800 font-medium text-xs border border-primary-200/50 cursor-pointer select-none transition-colors mx-0.5',
            title: `Jump to #${channelSlug}`,
          },
          `#${channelSlug}`
        )
      );
      return;
    }

    // 10. URL auto-linking: https://...
    if (part.startsWith('http://') || part.startsWith('https://')) {
      elements.push(
        React.createElement(
          'a',
          {
            key,
            href: part,
            target: '_blank',
            rel: 'noopener noreferrer',
            className:
              'text-primary-600 hover:text-primary-700 underline decoration-primary-400 hover:decoration-primary-600 transition-colors break-all',
          },
          part
        )
      );
      return;
    }

    // Raw plain text segment
    elements.push(React.createElement('span', { key }, part));
  });

  return elements;
}

/**
 * Main Discord Markdown renderer entry point.
 * Handles top-level block elements (blockquotes, multi-line code blocks) and delegates inline tokens.
 *
 * @param {string} content - Raw message body
 * @param {Object} [options={}]
 * @param {Array<Object>} [options.members=[]]
 * @param {string|null} [options.currentUserId=null]
 * @param {Function|null} [options.onSelectChannel=null]
 * @returns {React.ReactNode}
 */
export function renderDiscordMarkdown(content, options = {}) {
  if (!content) return null;
  if (typeof content !== 'string') return String(content);

  const lines = content.split(/\r?\n/);
  const blockElements = [];
  let inCodeBlock = false;
  let codeBuffer = [];
  let codeLang = '';
  let inBlockquote = false;
  let quoteBuffer = [];

  const flushQuote = (index) => {
    if (quoteBuffer.length > 0) {
      const quoteText = quoteBuffer.join('\n');
      blockElements.push(
        React.createElement(
          'blockquote',
          {
            key: `quote_${index}`,
            className:
              'border-l-4 border-slate-300 dark:border-slate-600 pl-3 py-0.5 my-1.5 text-slate-600 dark:text-slate-400 italic text-[13px] bg-slate-50/50 dark:bg-slate-800/20 rounded-r',
          },
          parseInlineTokens(quoteText, options, `quote_inner_${index}`)
        )
      );
      quoteBuffer = [];
      inBlockquote = false;
    }
  };

  lines.forEach((line, lineIndex) => {
    // Check code block fence
    if (line.trim().startsWith('```')) {
      flushQuote(lineIndex);

      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
        codeBuffer = [];
      } else {
        inCodeBlock = false;
        blockElements.push(
          React.createElement(DiscordCodeBlock, {
            key: `code_block_${lineIndex}`,
            language: codeLang,
            code: codeBuffer.join('\n'),
          })
        );
        codeBuffer = [];
        codeLang = '';
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    // Check blockquote
    if (line.startsWith('> ') || line === '>') {
      inBlockquote = true;
      quoteBuffer.push(line.startsWith('> ') ? line.slice(2) : '');
      return;
    } else if (inBlockquote) {
      flushQuote(lineIndex);
    }

    // Normal line
    blockElements.push(
      React.createElement(
        'div',
        { key: `line_${lineIndex}`, className: 'min-h-[1.25rem]' },
        line ? parseInlineTokens(line, options, `line_${lineIndex}`) : React.createElement('br')
      )
    );
  });

  // Flush remaining buffers
  if (inBlockquote) {
    flushQuote(lines.length);
  }
  if (inCodeBlock && codeBuffer.length > 0) {
    blockElements.push(
      React.createElement(DiscordCodeBlock, {
        key: `code_block_end`,
        language: codeLang,
        code: codeBuffer.join('\n'),
      })
    );
  }

  return React.createElement('div', { className: 'space-y-0.5 leading-relaxed break-words' }, blockElements);
}
