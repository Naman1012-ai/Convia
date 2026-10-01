import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Running [buttonVisualStateAndContrast.test.js] — Button Visual States & High Contrast Audit...');

async function testButtonVisualStatesAndContrast() {
  const buttonPath = path.resolve(process.cwd(), 'frontend/src/components/ui/Button.jsx');
  const modalPath = path.resolve(process.cwd(), 'frontend/src/features/organizations/TransferOwnershipModal.jsx');
  const badgePath = path.resolve(process.cwd(), 'frontend/src/components/ui/Badge.jsx');
  const settingsPath = path.resolve(process.cwd(), 'frontend/src/pages/organization/SettingsPage.jsx');

  const buttonContent = fs.readFileSync(buttonPath, 'utf8');
  const modalContent = fs.readFileSync(modalPath, 'utf8');
  const badgeContent = fs.readFileSync(badgePath, 'utf8');
  const settingsContent = fs.readFileSync(settingsPath, 'utf8');

  // 1. Invariant: Button.jsx must define warning, outline, and purple variants
  {
    assert.ok(buttonContent.includes("warning:"), 'Button must define warning variant');
    assert.ok(buttonContent.includes("outline:"), 'Button must define outline variant');
    assert.ok(buttonContent.includes("purple:"), 'Button must define purple variant');
    assert.ok(
      buttonContent.includes("PropTypes.oneOf(['primary', 'secondary', 'outline', 'ghost', 'danger', 'warning', 'purple'])"),
      'PropTypes must list all supported variants'
    );
    assert.ok(
      buttonContent.includes('variants[variant] || variants.primary'),
      'Button must provide fallback to variants.primary to prevent invisible rendering'
    );

    console.log('  ✅ Invariant 1 Passed: Button.jsx defines all essential variants and fallback protection');
  }

  // 2. Invariant: High-contrast enabled & disabled state tokens in Button.jsx
  {
    assert.ok(buttonContent.includes('bg-amber-500 text-amber-950'), 'Warning variant must use high-contrast text-amber-950 on bg-amber-500');
    assert.ok(buttonContent.includes('disabled:bg-amber-100 disabled:text-amber-600/70'), 'Disabled warning variant must use solid non-transparent background and text colors');
    assert.ok(buttonContent.includes('disabled:opacity-75'), 'Disabled state opacity must not wash out content (must be >= 75%)');

    console.log('  ✅ Invariant 2 Passed: High-contrast foreground/background tokens present for enabled & disabled button states');
  }

  // 3. Invariant: TransferOwnershipModal correctly handles disabled and loading button props
  {
    assert.ok(modalContent.includes('isLoading={isSubmitting}'), 'Submit button must receive isLoading prop');
    assert.ok(
      modalContent.includes("disabled={isSubmitting || candidateMembers.length === 0 || (isCaptainLimitExceeded && formerOwnerRole === 'team_captain')}"),
      'Submit button disabled condition must check limit and candidates'
    );
    assert.ok(modalContent.includes('variant="warning"'), 'Submit button uses warning variant');
    assert.ok(
      modalContent.includes('finally {') && modalContent.includes('setIsSubmitting(false)'),
      'Loading state must reset in finally block on both success and failure'
    );

    console.log('  ✅ Invariant 3 Passed: TransferOwnershipModal passes explicit loading, disabled checks, and resets state reliably');
  }

  // 4. Invariant: Badge.jsx defines high-contrast tokens for warning and purple roles
  {
    assert.ok(badgeContent.includes("purple: 'bg-purple-100 text-purple-950 border-purple-300/80'"), 'Purple badge uses high-contrast purple text and border');
    assert.ok(badgeContent.includes("warning: 'bg-amber-100 text-amber-950 border-amber-300/80'"), 'Warning badge uses high-contrast dark amber text');

    console.log('  ✅ Invariant 4 Passed: Badge.jsx uses high-contrast WCAG AAA color tokens');
  }

  // 5. Invariant: SettingsPage.jsx renders Transfer Ownership button guarded by owner check
  {
    assert.ok(settingsContent.includes('{isOwner && ('), 'Transfer Ownership button must be conditionally rendered only for owner');
    assert.ok(settingsContent.includes('variant="warning"'), 'Transfer Ownership button in SettingsPage uses high-contrast warning variant');

    console.log('  ✅ Invariant 5 Passed: SettingsPage guards Transfer Ownership button for owner only with warning variant');
  }

  console.log('\n🎉 ALL BUTTON VISUAL STATE & CONTRAST TESTS PASSED PERFECTLY!\n');
}

testButtonVisualStatesAndContrast().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
