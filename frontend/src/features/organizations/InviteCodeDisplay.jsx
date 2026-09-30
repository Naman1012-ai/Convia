import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Button } from '../../components/ui/Button';
import { Copy, Check } from 'lucide-react';

export function InviteCodeDisplay({ inviteCode = '' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 space-y-1">
      <p className="font-semibold text-slate-700">Legacy Workspace Join Code (Retired)</p>
      <p>
        Common 8-character workspace invite codes ({inviteCode || 'N/A'}) have been retired and cannot be used to join workspaces.
        Please use individual email-bound invitation codes (format: CNV-XXXX-XXXX).
      </p>
    </div>
  );
}

InviteCodeDisplay.propTypes = {
  inviteCode: PropTypes.string,
};
