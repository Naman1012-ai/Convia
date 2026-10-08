import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/authService';
import { useToast } from '../../hooks/useToast';
import { AlertTriangle, Mail, RefreshCw, CheckCircle } from 'lucide-react';

export function EmailVerificationBanner() {
  const { user, reloadUser } = useAuth();
  const { toast } = useToast();

  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!user || user.emailVerified) return null;

  const handleSendVerification = async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      await authService.sendVerificationEmail();
      toast.success('✓ Verification email sent successfully. Please check your inbox!');
    } catch (err) {
      toast.error(err.message || 'Unable to send verification email. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const reloadedUser = await reloadUser();
      if (reloadedUser?.emailVerified) {
        toast.success('🎉 Email verified! Full workspace features unlocked.');
      } else {
        toast.info('Email status reloaded: Email is not yet verified.');
      }
    } catch (err) {
      toast.error('Failed to reload verification status.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 text-white px-4 py-3 rounded-2xl shadow-lg border border-amber-400 mb-6 transition-all">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 text-center sm:text-left">
          <AlertTriangle className="h-5 w-5 text-amber-100 shrink-0 animate-bounce" />
          <div>
            <p className="text-xs sm:text-sm font-bold tracking-tight">
              Email Verification Pending
            </p>
            <p className="text-[11px] sm:text-xs text-amber-100 font-medium">
              Please verify your email address (<strong className="text-white">{user.email}</strong>) to unlock full workspace capabilities.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSendVerification}
            disabled={isSending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-amber-900 hover:bg-amber-50 text-xs font-bold transition-all shadow-sm disabled:opacity-50"
          >
            <Mail className="h-3.5 w-3.5 text-amber-700" />
            <span>{isSending ? 'Sending...' : 'Verify Email'}</span>
          </button>

          <button
            onClick={handleRefreshStatus}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-700/60 hover:bg-amber-700 text-white text-xs font-bold transition-all border border-amber-400/40 disabled:opacity-50"
            title="Reload verification status"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>
        </div>
      </div>
    </div>
  );
}
