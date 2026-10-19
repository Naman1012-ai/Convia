import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import {
  parseInlineTokens,
  renderDiscordMarkdown,
} from '../utils/discordMarkdown.js';

describe('Discord Phase 2 — Markdown AST & Tokenizer Suite', () => {
  const membersFixture = [
    { uid: 'u_alice', username: 'alice', displayName: 'Alice Engineer' },
    { uid: 'u_bob', username: 'bob', displayName: 'Bob Architect' },
  ];

  it('1. Parses bold, italic, underline, and strikethrough tokens', () => {
    const text = 'Hello **bold world** and *italic spark* plus __underline__ and ~~strikethrough~~';
    const tokens = parseInlineTokens(text);

    // Verify token elements
    const boldEl = tokens.find((t) => t?.type === 'strong');
    assert.ok(boldEl, 'Must contain a strong element for bold');

    const italicEl = tokens.find((t) => t?.type === 'em');
    assert.ok(italicEl, 'Must contain an em element for italic');

    const underlineEl = tokens.find((t) => t?.type === 'ins');
    assert.ok(underlineEl, 'Must contain an ins element for underline');

    const strikeEl = tokens.find((t) => t?.type === 'del');
    assert.ok(strikeEl, 'Must contain a del element for strikethrough');
  });

  it('2. Parses inline code with monospaced styling', () => {
    const text = 'Run `npm run build` to verify';
    const tokens = parseInlineTokens(text);

    const codeEl = tokens.find((t) => t?.type === 'code');
    assert.ok(codeEl, 'Must contain a code element');
    assert.strictEqual(codeEl.props.children, 'npm run build');
  });

  it('3. Parses multi-line code block with language identifier', () => {
    const content = 'Check this snippet:\n```javascript\nconst x = 42;\nconsole.log(x);\n```';
    const rendered = renderDiscordMarkdown(content);

    assert.ok(rendered, 'Rendered tree must exist');
    // Verify tree contains DiscordCodeBlock
    const treeJson = JSON.stringify(rendered);
    assert.ok(treeJson.includes('javascript'), 'Code block must contain specified language');
    assert.ok(treeJson.includes('const x = 42;'), 'Code block must contain exact code content');
  });

  it('4. Parses blockquote with Discord quote styling', () => {
    const content = '> This is a quoted team announcement\nNormal reply below';
    const rendered = renderDiscordMarkdown(content);

    const treeJson = JSON.stringify(rendered);
    assert.ok(treeJson.includes('blockquote'), 'Must render a blockquote element');
    assert.ok(treeJson.includes('This is a quoted team announcement'));
  });

  it('5. Parses spoiler tags with interactive toggle', () => {
    const text = 'The secret plan is ||launch on Monday|| for sure.';
    const tokens = parseInlineTokens(text);

    const spoilerEl = tokens.find((t) => typeof t?.type === 'function' && t.type.name === 'DiscordSpoiler');
    assert.ok(spoilerEl, 'Must render DiscordSpoiler component');
  });

  it('6. Resolves @mentions against workspace member directory', () => {
    const text = 'Paging @alice and @bob to the meeting';
    const tokens = parseInlineTokens(text, {
      members: membersFixture,
      currentUserId: 'u_alice',
    });

    const mentionSpans = tokens.filter(
      (t) => t?.type === 'span' && t.props?.className?.includes('font-semibold')
    );
    assert.strictEqual(mentionSpans.length, 2);

    // Alice is currentUserId -> self mention styling
    assert.ok(
      mentionSpans[0].props.className.includes('bg-amber-100'),
      'Self mention must have amber highlight'
    );
  });

  it('7. Resolves #channel links and attaches navigation callback', () => {
    let jumpedChannel = null;
    const text = 'Please discuss in #sprint-planning channel';
    const tokens = parseInlineTokens(text, {
      onSelectChannel: (slug) => {
        jumpedChannel = slug;
      },
    });

    const channelBtn = tokens.find((t) => t?.type === 'button');
    assert.ok(channelBtn, 'Must render interactive button for channel');
    assert.strictEqual(channelBtn.props.children, '#sprint-planning');

    // Simulate click
    channelBtn.props.onClick({ stopPropagation: () => {} });
    assert.strictEqual(jumpedChannel, 'sprint-planning');
  });

  it('8. XSS Security: Blocks script injection and escapes raw HTML safely', () => {
    const maliciousInput = '<script>alert("hacked")</script><img src="x" onerror="alert(1)">';
    const rendered = renderDiscordMarkdown(maliciousInput);

    // Verify tree does NOT execute script and does not use dangerouslySetInnerHTML
    const treeJson = JSON.stringify(rendered);
    assert.strictEqual(treeJson.includes('dangerouslySetInnerHTML'), false);
    // Elements should be plain spans/divs containing string literals
    assert.ok(treeJson.includes('<script>alert('));
  });
});
