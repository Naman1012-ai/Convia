import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { invitationService } from '../../services/invitationService';
import {
  formatInvitationCodeInput,
  normalizeInvitationCode,
  isValidInvitationCodeFormat,
  formatInvitationExpiry,
  isInvitationExpired,
} from '../../utils/invitationCodeHelper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { NotificationService } from '../../services/notificationService';
import {
  Users,
  Shield,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  LogOut,
  UserCheck,
  Building2,
  Clock,
  Copy,
  Check,
} from 'lucide-react';

export default function JoinWorkspacePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [alreadyMemberOrgId, setAlreadyMemberOrgId] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [copied, setCopied] = useState(false);

  // Countdown timer for previewed invitation
  useEffect(() => {
    if (!lookupResult?.expiresAt) return;
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [lookupResult]);

  // Check for prefilled or stored code from signup/signin redirect
  useEffect(() => {
    const queryCode = new URLSearchParams(location.search).get('code');
    const storedCode = sessionStorage.getItem('pendingInvitationCode');
    const initialCode = queryCode || storedCode || '';

    if (initialCode) {
      const clean = formatInvitationCodeInput(initialCode);
      setCode(clean);
      handleLookup(clean);
    }
  }, [location.search]);

  // Lookup invitation details
  const handleLookup = async (codeToLookup = code) => {
    const cleanCode = normalizeInvitationCode(codeToLookup);
    if (!cleanCode) {
      setErrorMessage('Please enter an invitation code.');
      return;
    }

    if (!isValidInvitationCodeFormat(cleanCode)) {
      setErrorMessage('Enter a valid invitation code in the format CNV-XXXX-XXXX.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setAlreadyMemberOrgId(null);

    try {
      const res = await invitationService.lookupInvitationByCode(cleanCode);
      setLookupResult(res);
      sessionStorage.setItem('pendingInvitationCode', cleanCode);
    } catch (err) {
      setLookupResult(null);
      const msg = err.message || '';
      if (err.code === 'ENDPOINT_NOT_FOUND' || err.code === 'BACKEND_UNAVAILABLE' || msg.includes('endpoint') || msg.includes('<!DOCTYPE')) {
        setErrorMessage('The invitation service is temporarily unavailable. Please try again in a moment.');
      } else {
        setErrorMessage(msg || 'Invalid or expired invitation code.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Accept Invitation
  const handleAccept = async () => {
    if (!lookupResult) return;
    setAccepting(true);
    setErrorMessage('');

    try {
      const res = await invitationService.acceptInvitation(code);
      sessionStorage.removeItem('pendingInvitationCode');

      if (res.alreadyMember) {
        NotificationService.info("You're already a member of this workspace.");
        setAlreadyMemberOrgId(res.workspaceId);
      } else {
        NotificationService.success(res.message || 'Joined workspace successfully!');
        navigate(`/workspaces/${res.workspaceId}`);
      }
    } catch (err) {
      if (err.code === 'WRONG_ACCOUNT') {
        setErrorMessage(
          'This invitation is assigned to a different Convia account. Please sign in with the invited Convia account.'
        );
      } else if (err.code === 'WORKSPACE_FULL') {
        setErrorMessage('This workspace has reached its member limit.');
      } else if (err.code === 'ENDPOINT_NOT_FOUND' || err.code === 'BACKEND_UNAVAILABLE') {
        setErrorMessage('Unable to connect to the server. Please try again in a moment.');
      } else {
        setErrorMessage(err.message || 'Failed to accept invitation.');
      }
    } finally {
      setAccepting(false);
    }
  };

  // Decline Invitation
  const handleDecline = async () => {
    if (!lookupResult) return;
    setDeclining(true);
    try {
      await invitationService.declineInvitation(code);
      sessionStorage.removeItem('pendingInvitationCode');
      NotificationService.info('Invitation declined.');
      setLookupResult(null);
      setCode('');
    } catch (err) {
      NotificationService.error(err.message || 'Failed to decline invitation.');
    } finally {
      setDeclining(false);
    }
  };

  // Switch Account handler (Section 16 & 44)
  const handleSwitchAccount = async () => {
    try {
      sessionStorage.setItem('pendingInvitationCode', normalizeInvitationCode(code));
      sessionStorage.removeItem('prefillAuthEmail');
      await signOut();
      navigate('/signin');
    } catch (err) {
      console.error('Failed to sign out:', err);
    }
  };

  // Compute state
  const isExpired = isInvitationExpired(lookupResult, currentTime);
  const isEmailMatch =
    user && lookupResult && user.email?.toLowerCase().trim() === lookupResult.invitedEmail?.toLowerCase().trim();
  const isEmailMismatch =
    user && lookupResult && user.email?.toLowerCase().trim() !== lookupResult.invitedEmail?.toLowerCase().trim();

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8 bg-slate-50">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-100 mb-3">
            <Users className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Join a Workspace</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            Enter the unique invitation code received from your workspace owner or administrator.
          </p>
        </div>

        {/* Card */}
        <Card className="shadow-lg border-slate-200/80">
          {!lookupResult ? (
            /* Step 1: Code Input */
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLookup();
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="invitation-code" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 text-center">
                  Invitation Code
                </label>
                <Input
                  id="invitation-code"
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(formatInvitationCodeInput(e.target.value));
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="CNV-8K4P-X7QM"
                  className="text-center font-mono font-bold tracking-widest text-lg h-12"
                  autoFocus
                  maxLength={13}
                />
                <p className="mt-1.5 text-[11px] text-slate-400 text-center">
                  Format: CNV-XXXX-XXXX • Case insensitive
                </p>
              </div>

              {errorMessage && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full h-11 text-sm font-semibold flex items-center justify-center gap-2"
                disabled={loading || !code.trim()}
              >
                {loading ? 'Verifying Code...' : 'Continue'}
                <ArrowRight className="h-4 w-4" />
              </Button>

              <div className="pt-2 text-center text-xs text-slate-500 border-t border-slate-100">
                Need to create a new workspace instead?{' '}
                <Link to="/workspaces" className="font-semibold text-indigo-600 hover:text-indigo-700">
                  Go to Workspaces
                </Link>
              </div>
            </form>
          ) : (
            /* Step 2: Invitation Preview & Account Resolution */
            <div className="space-y-5">
              {/* Workspace Snapshot */}
              <div className="text-center pb-4 border-b border-slate-100">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 mb-2">
                  <Building2 className="h-3.5 w-3.5" /> Team Invitation
                </span>
                <h2 className="text-xl font-bold text-slate-900">{lookupResult.workspaceName}</h2>
                <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                  {/* Role Badge */}
                  <Badge
                    variant={lookupResult.role === 'admin' ? 'purple' : 'blue'}
                    className="px-3 py-1 text-xs"
                  >
                    <span className="text-slate-500 font-normal mr-1.5">Role:</span>
                    <span className="font-bold text-slate-900">
                      {lookupResult.role === 'admin' ? 'Admin' : 'Member'}
                    </span>
                  </Badge>

                  {/* Expiration / Status Badge */}
                  {lookupResult.status === 'accepted' ? (
                    <Badge variant="success" className="px-3 py-1 text-xs font-semibold">
                      Status: Accepted
                    </Badge>
                  ) : lookupResult.status === 'revoked' ? (
                    <Badge variant="danger" className="px-3 py-1 text-xs font-semibold">
                      Status: Revoked
                    </Badge>
                  ) : lookupResult.expiresAt ? (
                    <Badge
                      variant={isExpired ? 'danger' : 'warning'}
                      className="px-3 py-1 text-xs font-semibold flex items-center gap-1"
                    >
                      <Clock className="h-3 w-3 inline-block shrink-0" />
                      {isExpired ? 'Expired' : formatInvitationExpiry(lookupResult.expiresAt, currentTime)}
                    </Badge>
                  ) : null}

                  {/* Highly Readable Invitation Code Chip */}
                  <div className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full text-xs font-mono font-bold text-indigo-700">
                    <span className="text-slate-500 font-sans font-medium text-[11px]">Code:</span>
                    <span>{code}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(code);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="text-slate-400 hover:text-indigo-600 focus:outline-hidden focus:text-indigo-600 p-0.5 rounded transition-colors"
                      title="Copy code"
                      aria-label="Copy invitation code"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expired Warning Banner */}
              {isExpired && !alreadyMemberOrgId && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-center space-y-1">
                  <div className="flex items-center justify-center gap-2 text-rose-800 font-bold text-sm">
                    <AlertTriangle className="h-5 w-5 text-rose-600" />
                    This invitation code has expired.
                  </div>
                  <p className="text-xs text-rose-600">
                    Invitation codes are valid for 5 minutes. Please contact the workspace owner to request a new code.
                  </p>
                </div>
              )}

              {/* Already a Member Banner */}
              {alreadyMemberOrgId && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-emerald-800 font-bold text-sm">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    You're already a member of this workspace.
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    className="w-full"
                    onClick={() => navigate(`/workspaces/${alreadyMemberOrgId}`)}
                  >
                    Open Workspace
                  </Button>
                </div>
              )}

              {/* Unauthenticated User Flow (Privacy-Safe: Zero Leaked Email) */}
              {!user && !alreadyMemberOrgId && !isExpired && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-3.5 text-xs text-indigo-950 space-y-1">
                    <p className="font-bold text-slate-900">Sign in to join this workspace</p>
                    <p className="text-[11px] text-slate-600 pt-0.5 leading-relaxed">
                      This invitation is bound to the Convia account that received the invitation code. Please sign in or create an account with your invited email address to continue.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="primary"
                      className="w-full h-10 text-xs font-semibold"
                      onClick={() => {
                        sessionStorage.setItem('pendingInvitationCode', normalizeInvitationCode(code));
                        navigate('/signin');
                      }}
                    >
                      Sign In to Accept
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-10 text-xs font-semibold"
                      onClick={() => {
                        sessionStorage.setItem('pendingInvitationCode', normalizeInvitationCode(code));
                        navigate('/signup');
                      }}
                    >
                      Create an Account
                    </Button>
                  </div>
                </div>
              )}

              {/* Authenticated User: Email MATCH (Section 15, 20) */}
              {user && isEmailMatch && !alreadyMemberOrgId && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-700 space-y-1 text-center">
                    <p className="text-slate-500">Accepting invitation as:</p>
                    <p className="font-bold text-slate-900 font-mono text-sm">{user.email}</p>
                  </div>

                  {errorMessage && (
                    <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
                      {errorMessage}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      className="flex-1 h-11 text-sm font-semibold flex items-center justify-center gap-1.5"
                      onClick={handleAccept}
                      disabled={accepting || isExpired}
                    >
                      <UserCheck className="h-4 w-4" />
                      {accepting ? 'Joining...' : isExpired ? 'Invitation Expired' : 'Accept Invitation'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-11 text-xs text-slate-500 hover:text-rose-600"
                      onClick={handleDecline}
                      disabled={declining || accepting}
                    >
                      {declining ? 'Declining...' : 'Decline'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Authenticated User: Email MISMATCH / WRONG ACCOUNT (Privacy-Safe: Zero Leaked Email) */}
              {user && isEmailMismatch && !alreadyMemberOrgId && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                      <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                      Wrong Account
                    </div>
                    <p className="text-xs text-rose-700 leading-relaxed font-medium">
                      This invitation is assigned to a different Convia account.
                    </p>
                    <p className="text-xs text-rose-600 leading-relaxed">
                      Please sign in with the Convia account that was invited to this workspace.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="danger"
                    className="w-full h-11 text-xs font-semibold flex items-center justify-center gap-2"
                    onClick={handleSwitchAccount}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign In with Different Account
                  </Button>
                </div>
              )}

              {/* Reset code lookup option */}
              <div className="text-center pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setLookupResult(null);
                    setErrorMessage('');
                    sessionStorage.removeItem('pendingInvitationCode');
                  }}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                >
                  Enter a different code
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
