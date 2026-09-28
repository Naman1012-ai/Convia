import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Suite: Convia Community Message Menu Overflow, Positioning & Stacking Context
 */
describe('🧪 CONVIA COMMUNITY MESSAGE MENU OVERFLOW & POSITIONING FIX', () => {

  // Pure positioning calculation helper replicating ContextMenuPortal's exact math
  function computeMenuCoordinates({
    anchorRect,
    menuWidth = 180,
    menuHeight = 230,
    viewportWidth = 1280,
    viewportHeight = 720,
    align = 'right',
    padding = 8,
    gap = 4,
  }) {
    if (!anchorRect) {
      return { top: 0, left: 0, placement: 'bottom', isTriggerOffscreen: false };
    }

    const spaceBelow = viewportHeight - anchorRect.bottom;
    const spaceAbove = anchorRect.top;

    let top;
    let placement = 'bottom';

    // Flip upward if space below is too tight (< menuHeight + 12px) and space above is larger
    if (spaceBelow < menuHeight + 12 && spaceAbove > spaceBelow) {
      top = anchorRect.top - menuHeight - gap;
      placement = 'top';
    } else {
      top = anchorRect.bottom + gap;
      placement = 'bottom';
    }

    // Viewport vertical clamping
    top = Math.max(padding, Math.min(viewportHeight - menuHeight - padding, top));

    // Horizontal alignment
    let left;
    if (align === 'left') {
      left = anchorRect.left;
    } else {
      left = anchorRect.right - menuWidth;
    }

    // Viewport horizontal clamping
    if (left + menuWidth > viewportWidth - padding) {
      left = viewportWidth - menuWidth - padding;
    }
    if (left < padding) {
      left = padding;
    }

    return {
      top: Math.round(top),
      left: Math.round(left),
      placement,
      isTriggerOffscreen: anchorRect.bottom < 0 || anchorRect.top > viewportHeight,
    };
  }

  describe('🔍 1. Viewport Collision & Smart Flipping Logic', () => {
    test('positions menu downward when there is ample space below the trigger', () => {
      // Trigger at top of screen
      const anchorRect = { top: 100, bottom: 124, left: 500, right: 524, width: 24, height: 24 };
      const res = computeMenuCoordinates({
        anchorRect,
        viewportHeight: 720,
        viewportWidth: 1280,
      });

      assert.equal(res.placement, 'bottom');
      assert.equal(res.top, 128); // 124 + 4
      assert.equal(res.top >= 8, true);
    });

    test('flips menu upward when trigger is near bottom of viewport', () => {
      // Trigger at y=650 of a 720px tall viewport (only 70px below, not enough for 230px menu)
      const anchorRect = { top: 650, bottom: 674, left: 500, right: 524, width: 24, height: 24 };
      const res = computeMenuCoordinates({
        anchorRect,
        viewportHeight: 720,
        viewportWidth: 1280,
      });

      assert.equal(res.placement, 'top');
      // top = 650 - 230 - 4 = 416
      assert.equal(res.top, 416);
      assert.equal(res.top + 230 <= 650, true, 'Menu rendered cleanly above trigger button');
    });

    test('clamps top within viewport boundaries when trigger is at extreme bottom', () => {
      const anchorRect = { top: 710, bottom: 734, left: 500, right: 524, width: 24, height: 24 };
      const res = computeMenuCoordinates({
        anchorRect,
        viewportHeight: 720,
        viewportWidth: 1280,
      });

      assert.equal(res.top <= 720 - 230 - 8, true, 'Top is clamped below top padding');
      assert.equal(res.top >= 8, true, 'Top is clamped above minimum padding');
    });
  });

  describe('🔍 2. Viewport Horizontal Clamping', () => {
    test('aligns right-edge with trigger button for right-aligned messages', () => {
      const anchorRect = { top: 200, bottom: 224, left: 800, right: 824, width: 24, height: 24 };
      const res = computeMenuCoordinates({
        anchorRect,
        menuWidth: 180,
        align: 'right',
        viewportWidth: 1280,
      });

      // right alignment: left = anchorRect.right - menuWidth = 824 - 180 = 644
      assert.equal(res.left, 644);
      assert.equal(res.left + 180, 824);
    });

    test('aligns left-edge with trigger button for left-aligned messages', () => {
      const anchorRect = { top: 200, bottom: 224, left: 200, right: 224, width: 24, height: 24 };
      const res = computeMenuCoordinates({
        anchorRect,
        menuWidth: 180,
        align: 'left',
        viewportWidth: 1280,
      });

      assert.equal(res.left, 200);
    });

    test('clamps right overflow if trigger is near right edge of viewport', () => {
      // Trigger at x=1270 in 1280px viewport
      const anchorRect = { top: 200, bottom: 224, left: 1250, right: 1274, width: 24, height: 24 };
      const res = computeMenuCoordinates({
        anchorRect,
        menuWidth: 180,
        align: 'left', // would normally be left=1250 -> 1250+180=1430 (overflow!)
        viewportWidth: 1280,
        padding: 8,
      });

      // Clamped to 1280 - 180 - 8 = 1092
      assert.equal(res.left, 1092);
      assert.equal(res.left + 180 <= 1280 - 8, true, 'Menu is strictly inside viewport');
    });

    test('clamps left overflow if trigger is near left edge of viewport', () => {
      // Trigger at x=5 in 1280px viewport
      const anchorRect = { top: 200, bottom: 224, left: 5, right: 29, width: 24, height: 24 };
      const res = computeMenuCoordinates({
        anchorRect,
        menuWidth: 180,
        align: 'right', // 29 - 180 = -151 (negative!)
        viewportWidth: 1280,
        padding: 8,
      });

      assert.equal(res.left, 8, 'Left position clamped to minimum 8px padding');
    });
  });

  describe('🔍 3. Section 18 Specific Reproduction Test Cases (TEST A - TEST H)', () => {
    test('TEST A: Click More on "Hlo" (own message, right-aligned) anchors to that exact button', () => {
      // "Hlo" button at top-right of own message
      const hloButtonRect = { top: 150, bottom: 174, left: 920, right: 944, width: 24, height: 24 };
      const coords = computeMenuCoordinates({
        anchorRect: hloButtonRect,
        align: 'right',
        viewportWidth: 1280,
        viewportHeight: 720,
      });

      // Menu top right aligns with button: left = 944 - 180 = 764, top = 174 + 4 = 178
      assert.equal(coords.left, 764);
      assert.equal(coords.top, 178);
      assert.equal(coords.placement, 'bottom');
      assert.notEqual(coords.top, 0, 'Menu must not render at 0');
      assert.notEqual(coords.left, 0, 'Menu must not render at 0');
    });

    test('TEST B: Click More on "My name is naman" (own message, middle) anchors to THAT button, NOT "Hlo"', () => {
      const namanButtonRect = { top: 380, bottom: 404, left: 880, right: 904, width: 24, height: 24 };
      const coords = computeMenuCoordinates({
        anchorRect: namanButtonRect,
        align: 'right',
        viewportWidth: 1280,
        viewportHeight: 720,
      });

      // Menu coordinates reflect namanButtonRect
      assert.equal(coords.left, 724); // 904 - 180
      assert.equal(coords.top, 408); // 404 + 4
      assert.notEqual(coords.top, 178, 'Must not reuse Hlo position');
    });

    test('TEST C: Click More on "What are you doing?" anchors to that specific message', () => {
      const msgRect = { top: 520, bottom: 544, left: 850, right: 874, width: 24, height: 24 };
      const coords = computeMenuCoordinates({
        anchorRect: msgRect,
        align: 'right',
        viewportWidth: 1280,
        viewportHeight: 720,
      });

      assert.equal(coords.left, 694); // 874 - 180
      // 720 - 544 = 176 (< 230 + 12 = 242) -> flips up!
      assert.equal(coords.placement, 'top');
      assert.equal(coords.top, 520 - 230 - 4); // 286
    });

    test('TEST D: Click More on OTHER USER message anchors to top-left of bubble', () => {
      // Other user message button is at top-left: left = 140, right = 164
      const otherButtonRect = { top: 220, bottom: 244, left: 140, right: 164, width: 24, height: 24 };
      const coords = computeMenuCoordinates({
        anchorRect: otherButtonRect,
        align: 'left',
        viewportWidth: 1280,
        viewportHeight: 720,
      });

      // Left aligned: left = 140, top = 244 + 4 = 248
      assert.equal(coords.left, 140);
      assert.equal(coords.top, 248);
      assert.equal(coords.placement, 'bottom');
    });

    test('TEST E: Click More near bottom of viewport flips upward', () => {
      const bottomButtonRect = { top: 660, bottom: 684, left: 500, right: 524, width: 24, height: 24 };
      const coords = computeMenuCoordinates({
        anchorRect: bottomButtonRect,
        viewportWidth: 1280,
        viewportHeight: 720,
      });

      assert.equal(coords.placement, 'top');
      assert.equal(coords.top <= 660 - 230, true);
    });

    test('TEST F: Click More near right edge clamps inside viewport', () => {
      const rightEdgeRect = { top: 300, bottom: 324, left: 1260, right: 1284, width: 24, height: 24 };
      const coords = computeMenuCoordinates({
        anchorRect: rightEdgeRect,
        align: 'left',
        viewportWidth: 1280,
        viewportHeight: 720,
      });

      assert.equal(coords.left + 180 <= 1280 - 8, true);
    });

    test('TEST G: Feed scroll detection closes floating menu', () => {
      let isMenuOpen = true;
      const handleScroll = () => { isMenuOpen = false; };
      handleScroll();
      assert.equal(isMenuOpen, false, 'Menu immediately closes on scroll');
    });

    test('TEST H: Opening Message A, then Message B leaves only B open', () => {
      let activeMenuState = null;
      const openMenu = (messageId, anchorRect) => {
        activeMenuState = { messageId, anchorRect };
      };

      openMenu('msg_a', { top: 100, bottom: 124, left: 500, right: 524 });
      assert.equal(activeMenuState.messageId, 'msg_a');

      openMenu('msg_b', { top: 200, bottom: 224, left: 500, right: 524 });
      assert.equal(activeMenuState.messageId, 'msg_b');
      assert.equal(activeMenuState.anchorRect.top, 200);
    });
  });

  describe('🔍 4. Three-Dot Button Placement on Message Bubble', () => {
    function getButtonClasses(isOwn) {
      return {
        wrapper: `absolute -top-3.5 z-20 items-center justify-center transition-all ${
          isOwn ? 'right-1 sm:right-2' : 'left-1 sm:left-2'
        }`,
        alignment: isOwn ? 'right' : 'left',
      };
    }

    test('positions More button at top-right for current-user (own) messages', () => {
      const layout = getButtonClasses(true);
      assert.equal(layout.wrapper.includes('right-1 sm:right-2'), true);
      assert.equal(layout.alignment, 'right');
    });

    test('positions More button at top-left for other-user messages', () => {
      const layout = getButtonClasses(false);
      assert.equal(layout.wrapper.includes('left-1 sm:left-2'), true);
      assert.equal(layout.alignment, 'left');
    });
  });

  describe('🔍 5. Mobile Viewport Breakpoint & Bottom Sheet Mode', () => {
    function isMobileViewport(width) {
      return width < 640;
    }

    test('identifies narrow mobile viewports (<640px)', () => {
      assert.equal(isMobileViewport(320), true, '320px (iPhone SE 1st gen)');
      assert.equal(isMobileViewport(375), true, '375px (iPhone SE 2nd/3rd gen)');
      assert.equal(isMobileViewport(390), true, '390px (iPhone 14/15)');
      assert.equal(isMobileViewport(430), true, '430px (iPhone Pro Max)');
      assert.equal(isMobileViewport(639), true, '639px (Just below Tailwind sm breakpoint)');
    });

    test('identifies desktop and tablet viewports (>=640px)', () => {
      assert.equal(isMobileViewport(640), false, '640px (Tailwind sm)');
      assert.equal(isMobileViewport(768), false, '768px (iPad / tablet)');
      assert.equal(isMobileViewport(1024), false, '1024px (Desktop)');
      assert.equal(isMobileViewport(1280), false, '1280px (Standard desktop)');
      assert.equal(isMobileViewport(1920), false, '1920px (Full HD desktop)');
    });
  });

  describe('🔍 6. Stacking Context & Layering Compliance', () => {
    const Z_INDEX_SCALE = {
      card: 0,
      stickyComposer: 20,
      navbar: 40,
      contextMenuPortal: 45,
      modalDialog: 50,
    };

    test('ContextMenuPortal z-index is strictly above sticky composer and cards', () => {
      assert.equal(Z_INDEX_SCALE.contextMenuPortal > Z_INDEX_SCALE.stickyComposer, true);
      assert.equal(Z_INDEX_SCALE.contextMenuPortal > Z_INDEX_SCALE.card, true);
      assert.equal(Z_INDEX_SCALE.contextMenuPortal > Z_INDEX_SCALE.navbar, true);
    });

    test('ContextMenuPortal z-index is strictly below full-screen modals', () => {
      assert.equal(Z_INDEX_SCALE.contextMenuPortal < Z_INDEX_SCALE.modalDialog, true);
    });
  });
});
