import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';
import { orgService } from '../../services/orgService';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { LogIn } from 'lucide-react';
import {
  formatInvitationCodeInput,
  normalizeInvitationCode,
  isValidInvitationCodeFormat,
} from '../../utils/invitationCodeHelper';

export function JoinOrgForm({ initialCode = '', onSuccess = null }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { canJoinWorkspace } = usePlatformSettings();
  const navigate = useNavigate();

  const [inviteCode, setInviteCode] = useState(initialCode);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const check = canJoinWorkspace();
    if (!check.allowed) {
      setError(check.reason);
      toast.error(check.reason);
      return;
    }

    const raw = inviteCode.trim();
    if (!raw) {
      const msg = 'Please enter an invitation code.';
      setError(msg);
      toast.warning(msg);
      return;
    }

    const cleanAlphanumeric = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Explicit rejection of legacy 8-character workspace join codes
    if (cleanAlphanumeric.length === 8 && !raw.toUpperCase().startsWith('CNV')) {
      const msg = 'Legacy 8-character workspace invite codes have been retired. Please use an email-bound invitation code (format: CNV-XXXX-XXXX).';
      setError(msg);
      toast.error(msg);
      return;
    }

    const normalized = normalizeInvitationCode(raw);

    if (!isValidInvitationCodeFormat(normalized)) {
      const msg = 'Enter a valid invitation code in the format CNV-XXXX-XXXX.';
      setError(msg);
      toast.warning(msg);
      return;
    }

    // Direct routing to the canonical email-bound invitation verification workflow
    navigate(`/join?code=${encodeURIComponent(normalized)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 font-medium">
          {error}
        </div>
      )}

      <div>
        <Input
          label="Invitation Code"
          placeholder="CNV-8K4P-X7QM"
          value={inviteCode}
          onChange={(e) => {
            const val = formatInvitationCodeInput(e.target.value);
            setInviteCode(val);
            if (error) setError('');
          }}
          maxLength={13}
          className="font-mono uppercase tracking-widest text-center text-lg"
          required
          autoFocus
        />
        <p className="mt-1.5 text-[11px] text-slate-400 text-center">
          Format: CNV-XXXX-XXXX • Email-bound invitation code
        </p>
      </div>

      <Button
        type="submit"
        variant="secondary"
        fullWidth
        isLoading={isSubmitting}
        icon={<LogIn className="h-4 w-4" />}
      >
        Continue to Join
      </Button>
    </form>
  );
}

JoinOrgForm.propTypes = {
  initialCode: PropTypes.string,
  onSuccess: PropTypes.func,
};
