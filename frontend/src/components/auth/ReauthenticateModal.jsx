import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { authService } from '../../services/authService';
import { Lock, ShieldAlert } from 'lucide-react';

export function ReauthenticateModal({ isOpen, onClose, onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      setError('Password is required.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await authService.reauthenticateUser(password);
      setPassword('');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Incorrect password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Security Reauthentication Required" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
          <span>For your security, please confirm your password before continuing this sensitive action.</span>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-bold">
            {error}
          </div>
        )}

        <Input
          type="password"
          label="Current Password *"
          placeholder="Enter your current password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            icon={<Lock className="h-4 w-4" />}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold"
          >
            Confirm & Continue
          </Button>
        </div>
      </form>
    </Modal>
  );
}

ReauthenticateModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
};
