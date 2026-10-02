import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { validateEmail } from '../../utils/validation';
import { getErrorMessage } from '../../utils/errorMessages';
import { CheckCircle2 } from 'lucide-react';

export function ResetPasswordForm() {
  const { resetPassword } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [serverError, setServerError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    setIsSuccess(false);

    const emailVal = validateEmail(email);
    if (!emailVal.valid) {
      setError(emailVal.error);
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await resetPassword(email);
      setIsSuccess(true);
      toast.success('Password reset email sent! Please check your inbox.');
    } catch (err) {
      const msg = getErrorMessage(err.code || err.message);
      setServerError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-slate-900">Reset Password</h2>
        <p className="text-sm text-slate-500 mt-1">
          Enter your email address and we&apos;ll send you a recovery link
        </p>
      </div>

      {serverError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 font-medium">
          {serverError}
        </div>
      )}

      {isSuccess ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center space-y-2">
          <div className="flex justify-center text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h3 className="text-base font-bold text-emerald-900">Reset Link Sent!</h3>
          <p className="text-sm text-emerald-700">
            We have sent a password reset link to <strong className="font-semibold">{email}</strong>. Check your inbox.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
            required
          />

          <Button type="submit" variant="primary" fullWidth isLoading={isSubmitting} className="mt-2">
            Send Reset Link
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-slate-600 mt-6">
        <Link to="/signin" className="font-semibold text-primary-600 hover:text-primary-700">
          ← Back to Sign In
        </Link>
      </p>
    </div>
  );
}
