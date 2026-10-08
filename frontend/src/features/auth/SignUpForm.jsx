import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  validateUsername,
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

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTarget = hasPendingInvitation
    ? '/join'
    : searchParams.get('returnUrl')
    ? decodeURIComponent(searchParams.get('returnUrl'))
    : '/setup-profile';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    // Form Validation
    const userVal = validateUsername(username, true);
    const emailVal = validateEmail(email);
    const passVal = validateString(password, 100, true, 'Password');

    if (!userVal.valid || !emailVal.valid || !passVal.valid) {
      setErrors({
        username: userVal.error,
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
      const cleanUsername = userVal.value || username.trim().toLowerCase().replace(/^@/, '');
      await signUp(email.trim(), password, cleanUsername);
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
        <p className="text-sm text-slate-500 mt-1">Turn ideas into projects and move them forward with Convia.</p>
      </div>

      {serverError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 font-medium">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            label="Username"
            placeholder="e.g. alexj"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            error={errors.username}
            required
            maxLength={30}
          />
          <p className="text-[11px] text-slate-500 mt-1">Your public identity on Convia.</p>
        </div>
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
