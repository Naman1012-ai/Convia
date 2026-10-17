import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { GoogleSignInButton } from './GoogleSignInButton';
import { validateEmail, validateString } from '../../utils/validation';
import { getErrorMessage } from '../../utils/errorMessages';

export function SignInForm() {
  const { signIn, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const hasPendingInvitation = Boolean(sessionStorage.getItem('pendingInvitationCode'));
  const prefillEmail = sessionStorage.getItem('prefillAuthEmail') || '';

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

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (serverError) setServerError('');
    if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (serverError) setServerError('');
    if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    const emailVal = validateEmail(email);
    const passVal = validateString(password, 100, true, 'Password');

    if (!emailVal.valid || !passVal.valid) {
      setErrors({
        email: emailVal.error,
        password: passVal.error,
      });
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const signedUser = await signIn(email, password);
      const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || 'admin@convia.dev').toLowerCase().trim();
      const signedInEmail = (signedUser?.email || email).toLowerCase().trim();
      const isAdminLogin = Boolean(adminEmail && signedInEmail === adminEmail);

      const targetUrl = isAdminLogin
        ? '/admin/dashboard'
        : hasPendingInvitation
        ? '/join'
        : searchParams.get('returnUrl')
        ? decodeURIComponent(searchParams.get('returnUrl'))
        : '/dashboard';

      toast.success(isAdminLogin ? 'Welcome Super Admin! Opening Admin Portal...' : 'Signed in successfully!');
      navigate(targetUrl, { replace: true });
    } catch (err) {
      const msg = err.message || getErrorMessage(err, { provider: 'password', context: 'signin' });
      setServerError(msg);
      // NOTE: Expected authentication failures are displayed inline only; no global error toast.
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
        const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || 'admin@convia.dev').toLowerCase().trim();
        const signedInEmail = (user.email || '').toLowerCase().trim();
        const isAdminLogin = Boolean(adminEmail && signedInEmail === adminEmail);

        const targetUrl = isAdminLogin
          ? '/admin/dashboard'
          : searchParams.get('returnUrl')
          ? decodeURIComponent(searchParams.get('returnUrl'))
          : '/dashboard';

        toast.success(isAdminLogin ? 'Welcome Super Admin! Opening Admin Portal...' : 'Signed in with Google successfully!');
        navigate(targetUrl, { replace: true });
      }
    } catch (err) {
      const msg = err.message || getErrorMessage(err, { provider: 'google', context: 'signin' });
      setServerError(msg);
      // NOTE: Displayed inline only; no duplicate global error toast.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-slate-900">Welcome back</h2>
        <p className="text-sm text-slate-500 mt-1">Sign in to your Convia workspace</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email Address"
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={handleEmailChange}
          error={errors.email}
          required
        />
        <div>
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={handlePasswordChange}
            error={errors.password}
            required
          />
          <div className="mt-1.5 text-right">
            <Link to="/reset-password" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
              Forgot password?
            </Link>
          </div>
        </div>

        {serverError && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 font-medium flex items-start gap-2.5 transition-all duration-150"
          >
            <svg
              className="w-4 h-4 text-rose-500 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            <span className="flex-1 leading-snug">{serverError}</span>
          </div>
        )}

        <Button type="submit" variant="primary" fullWidth isLoading={isSubmitting} className="mt-2">
          Sign In
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
        Don&apos;t have an account?{' '}
        <Link to="/signup" className="font-semibold text-primary-600 hover:text-primary-700">
          Sign Up
        </Link>
      </p>
    </div>
  );
}
