import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  validateDisplayName,
  validateEmail,
  validateString,
} from '../../utils/validation';
import { getErrorMessage } from '../../utils/errorMessages';

export function SignUpForm() {
  const { signUp, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const hasPendingInvitation = Boolean(sessionStorage.getItem('pendingInvitationCode'));
  const prefillEmail = sessionStorage.getItem('prefillAuthEmail') || '';

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTarget = hasPendingInvitation
    ? '/join'
    : searchParams.get('returnUrl')
    ? decodeURIComponent(searchParams.get('returnUrl'))
    : '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    // Form Validation
    const nameVal = validateDisplayName(displayName);
    const emailVal = validateEmail(email);
    const passVal = validateString(password, 100, true, 'Password');

    if (!nameVal.valid || !emailVal.valid || !passVal.valid) {
      setErrors({
        displayName: nameVal.error,
        email: emailVal.error,
        password: passVal.error,
      });
      return;
    }

    if (password.length < 6) {
      setErrors({ password: 'Password must be at least 6 characters long.' });
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      await signUp(email, password, displayName);
      toast.success('Account created successfully! Welcome to Convia.');
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      const msg = getErrorMessage(err.code || err.message);
      setServerError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleClick = async () => {
    setServerError('');
    setIsSubmitting(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        toast.success('Signed in with Google successfully!');
        navigate(redirectTarget, { replace: true });
      }
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
        <h2 className="text-xl font-bold text-slate-900">Create your account</h2>
        <p className="text-sm text-slate-500 mt-1">Start organizing your hackathon team</p>
      </div>

      {serverError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 font-medium">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Display Name"
          placeholder="Your name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          error={errors.displayName}
          required
        />
        <Input
          label="Email Address"
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => !hasPendingInvitation && setEmail(e.target.value)}
          error={errors.email}
          disabled={Boolean(hasPendingInvitation && prefillEmail)}
          required
        />
        {hasPendingInvitation && prefillEmail && (
          <p className="text-[11px] text-amber-750 bg-amber-50 p-2 rounded border border-amber-200 font-medium">
            Email is locked to the address designated in your workspace invitation.
          </p>
        )}
        <Input
          label="Password"
          type="password"
          placeholder="Min. 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
        />

        <Button type="submit" variant="primary" fullWidth isLoading={isSubmitting} className="mt-2">
          Create Account
        </Button>
      </form>

      <div className="relative my-6 text-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <span className="relative bg-white px-3 text-xs text-slate-400 font-medium">OR</span>
      </div>

      <GoogleSignInButton onClick={handleGoogleClick} isLoading={isSubmitting} />

      <p className="text-center text-sm text-slate-600 mt-6">
        Already have an account?{' '}
        <Link to="/signin" className="font-semibold text-primary-600 hover:text-primary-700">
          Sign In
        </Link>
      </p>
    </div>
  );
}
