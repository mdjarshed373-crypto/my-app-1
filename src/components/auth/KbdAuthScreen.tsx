import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Lock,
  User,
  Mail,
  Phone,
  KeyRound,
} from 'lucide-react';
import { TXLogo } from '../common/TXLogo';
import {
  isValidBDPhoneNumber,
  isValidEmailFormat,
  normalizeUsername,
} from '../../services/playerAuthService';
import {
  getPendingReferCode,
  normalizeReferCode,
} from '../../services/referralService';

interface KbdAuthScreenProps {
  externalError?: string | null;
  onClearExternalError?: () => void;
  onLoginSuccess?: () => void;
  onSecretAdminEntry?: () => void;
}

export const KbdAuthScreen: React.FC<KbdAuthScreenProps> = ({
  externalError,
  onClearExternalError,
  onLoginSuccess,
  onSecretAdminEntry,
}) => {
  const {
    loginWithEmail,
    registerNewPlayer,
    resetPlayerPassword,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Login fields
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register fields
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Forgot password fields
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    if (externalError) {
      setError(externalError);
    }
  }, [externalError]);

  const resetMessages = () => {
    setError(null);
    setSuccess(null);
    onClearExternalError?.();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || loading) return;
    resetMessages();

    const ident = loginUsername.trim();
    if (!ident) {
      setError('Please enter your Username.');
      return;
    }
    if (!loginPassword) {
      setError('Please enter your Password.');
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      // Always persist session in localStorage so returning users go straight to lobby
      await loginWithEmail(ident, loginPassword, true);
      onLoginSuccess?.();
    } catch (err: unknown) {
      submittingRef.current = false;
      setLoading(false);
      if (err instanceof Error) {
        setError(err.message || 'Invalid Username or Password.');
      } else {
        setError('Login failed. Please check your Username and Password.');
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || loading) return;
    resetMessages();

    const cleanUser = normalizeUsername(regUsername);
    const cleanEmail = regEmail.trim().toLowerCase();
    const cleanPhone = regPhone.trim();

    if (cleanUser.length < 4) {
      setError('UserName must be at least 4 characters (letters, numbers, underscore only).');
      return;
    }
    if (!isValidEmailFormat(cleanEmail)) {
      setError('Please enter a valid Email Address.');
      return;
    }
    if (!isValidBDPhoneNumber(cleanPhone)) {
      setError('Please enter a valid 11-digit Mobile Number (017XXXXXXXX).');
      return;
    }
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    const pendingRef = getPendingReferCode();

    submittingRef.current = true;
    setLoading(true);
    try {
      await registerNewPlayer(
        cleanUser,
        cleanEmail,
        cleanPhone,
        regPassword,
        true,
        pendingRef ? normalizeReferCode(pendingRef) : undefined
      );
      onLoginSuccess?.();
    } catch (err: unknown) {
      submittingRef.current = false;
      setLoading(false);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Registration failed. Please try again.');
      }
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || loading) return;
    resetMessages();

    const ident = forgotIdentifier.trim();
    if (!ident) {
      setError('Please enter your Username, Email, or Mobile Number.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPlayerPassword(ident, newPassword);
      if (res.success) {
        setSuccess(res.message);
        setTimeout(() => {
          setMode('login');
          setLoginUsername(ident);
          setLoginPassword('');
          resetMessages();
        }, 1400);
      } else {
        setError(res.message);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Password reset failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="keep-dark-surface min-h-[100dvh] w-full overflow-y-auto flex flex-col items-center justify-center px-4 py-8"
      style={{ backgroundColor: '#F3F4F6', color: '#0F172A' }}
    >
      {/* Clean White KBD Esports Style Card */}
      <div
        className="w-full max-w-[400px] rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-[0_18px_45px_rgba(15,23,42,0.08)]"
        style={{ backgroundColor: '#FFFFFF', color: '#0F172A' }}
      >
        {/* Top Back Button for Register / Forgot views */}
        {mode !== 'login' && (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                resetMessages();
              }}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-2.5 -ml-2 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
              style={{ color: '#334155' }}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Sign In</span>
            </button>
          </div>
        )}

        {/* Brand Mark (preserves 5-tap secret Admin entry) */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center justify-center px-4 py-2 rounded-2xl bg-[#070B18] shadow-sm">
            <TXLogo
              size="md"
              showSubtitle={false}
              onSecretAdminEntry={onSecretAdminEntry}
            />
          </div>
        </div>

        {/* Page Heading */}
        <div className="text-center mb-6">
          {mode === 'login' && (
            <>
              <h1
                className="text-2xl font-extrabold tracking-tight"
                style={{ color: '#0F172A' }}
              >
                Welcome Back
              </h1>
              <p className="text-sm mt-1" style={{ color: '#64748B' }}>
                Sign in to your account
              </p>
            </>
          )}

          {mode === 'register' && (
            <>
              <h1
                className="text-2xl font-extrabold tracking-tight"
                style={{ color: '#0F172A' }}
              >
                Let&apos;s Start
              </h1>
              <p className="text-sm mt-1" style={{ color: '#64748B' }}>
                Create your account to continue
              </p>
            </>
          )}

          {mode === 'forgot' && (
            <>
              <h1
                className="text-2xl font-extrabold tracking-tight"
                style={{ color: '#0F172A' }}
              >
                Forgot Password
              </h1>
              <p className="text-sm mt-1" style={{ color: '#64748B' }}>
                Reset your password to regain access
              </p>
            </>
          )}
        </div>

        {/* Error / Success Alerts */}
        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs font-medium"
            style={{ color: '#B91C1C' }}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#DC2626' }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs font-medium"
            style={{ color: '#047857' }}
          >
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#059669' }} />
            <span>{success}</span>
          </div>
        )}

        {/* SCREEN 1: SIGN IN */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="kbd-login-username"
                className="block text-xs font-semibold mb-1.5"
                style={{ color: '#334155' }}
              >
                Username
              </label>
              <div className="relative">
                <User
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: '#94A3B8' }}
                />
                <input
                  id="kbd-login-username"
                  type="text"
                  required
                  autoComplete="username"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full h-12 pl-10 pr-3.5 rounded-xl border border-slate-200 focus:border-black text-sm focus:outline-none transition-colors"
                  style={{ backgroundColor: '#F8FAFC', color: '#0F172A' }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="kbd-login-password"
                  className="block text-xs font-semibold"
                  style={{ color: '#334155' }}
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setForgotIdentifier(loginUsername);
                    resetMessages();
                  }}
                  className="text-xs font-semibold hover:underline cursor-pointer"
                  style={{ color: '#475569' }}
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: '#94A3B8' }}
                />
                <input
                  id="kbd-login-password"
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full h-12 pl-10 pr-11 rounded-xl border border-slate-200 focus:border-black text-sm focus:outline-none transition-colors"
                  style={{ backgroundColor: '#F8FAFC', color: '#0F172A' }}
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer"
                  style={{ color: '#64748B' }}
                >
                  {showLoginPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl font-bold text-sm tracking-wide shadow-md shadow-black/15 hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 mt-2"
              style={{ backgroundColor: '#000000', color: '#FFFFFF' }}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>

            <div className="text-center pt-3">
              <span className="text-xs sm:text-sm" style={{ color: '#64748B' }}>
                I&apos;m a new user.{' '}
              </span>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  resetMessages();
                }}
                className="text-xs sm:text-sm font-bold hover:underline cursor-pointer"
                style={{ color: '#000000' }}
              >
                Register
              </button>
            </div>
          </form>
        )}

        {/* SCREEN 2: REGISTER ("Let's Start") */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label
                htmlFor="kbd-reg-username"
                className="block text-xs font-semibold mb-1.5"
                style={{ color: '#334155' }}
              >
                UserName
              </label>
              <div className="relative">
                <User
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: '#94A3B8' }}
                />
                <input
                  id="kbd-reg-username"
                  type="text"
                  required
                  autoComplete="username"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="Enter username (min 4 characters)"
                  className="w-full h-12 pl-10 pr-3.5 rounded-xl border border-slate-200 focus:border-black text-sm focus:outline-none transition-colors"
                  style={{ backgroundColor: '#F8FAFC', color: '#0F172A' }}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="kbd-reg-email"
                className="block text-xs font-semibold mb-1.5"
                style={{ color: '#334155' }}
              >
                Email Address
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: '#94A3B8' }}
                />
                <input
                  id="kbd-reg-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="w-full h-12 pl-10 pr-3.5 rounded-xl border border-slate-200 focus:border-black text-sm focus:outline-none transition-colors"
                  style={{ backgroundColor: '#F8FAFC', color: '#0F172A' }}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="kbd-reg-phone"
                className="block text-xs font-semibold mb-1.5"
                style={{ color: '#334155' }}
              >
                Mobile Number
              </label>
              <div className="relative">
                <Phone
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: '#94A3B8' }}
                />
                <input
                  id="kbd-reg-phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full h-12 pl-10 pr-3.5 rounded-xl border border-slate-200 focus:border-black text-sm focus:outline-none transition-colors"
                  style={{ backgroundColor: '#F8FAFC', color: '#0F172A' }}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="kbd-reg-password"
                className="block text-xs font-semibold mb-1.5"
                style={{ color: '#334155' }}
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: '#94A3B8' }}
                />
                <input
                  id="kbd-reg-password"
                  type={showRegPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full h-12 pl-10 pr-11 rounded-xl border border-slate-200 focus:border-black text-sm focus:outline-none transition-colors"
                  style={{ backgroundColor: '#F8FAFC', color: '#0F172A' }}
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword((prev) => !prev)}
                  aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer"
                  style={{ color: '#64748B' }}
                >
                  {showRegPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl font-bold text-sm tracking-wide shadow-md shadow-black/15 hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 mt-2"
              style={{ backgroundColor: '#000000', color: '#FFFFFF' }}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>

            <div className="text-center pt-2">
              <span className="text-xs sm:text-sm" style={{ color: '#64748B' }}>
                Already have an account?{' '}
              </span>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  resetMessages();
                }}
                className="text-xs sm:text-sm font-bold hover:underline cursor-pointer"
                style={{ color: '#000000' }}
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* SCREEN 3: FORGOT PASSWORD */}
        {mode === 'forgot' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label
                htmlFor="kbd-forgot-ident"
                className="block text-xs font-semibold mb-1.5"
                style={{ color: '#334155' }}
              >
                Username, Email, or Mobile Number
              </label>
              <div className="relative">
                <User
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: '#94A3B8' }}
                />
                <input
                  id="kbd-forgot-ident"
                  type="text"
                  required
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  placeholder="Enter registered username, email or mobile"
                  className="w-full h-12 pl-10 pr-3.5 rounded-xl border border-slate-200 focus:border-black text-sm focus:outline-none transition-colors"
                  style={{ backgroundColor: '#F8FAFC', color: '#0F172A' }}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="kbd-forgot-newpass"
                className="block text-xs font-semibold mb-1.5"
                style={{ color: '#334155' }}
              >
                New Password
              </label>
              <div className="relative">
                <KeyRound
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: '#94A3B8' }}
                />
                <input
                  id="kbd-forgot-newpass"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full h-12 pl-10 pr-11 rounded-xl border border-slate-200 focus:border-black text-sm focus:outline-none transition-colors"
                  style={{ backgroundColor: '#F8FAFC', color: '#0F172A' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer"
                  style={{ color: '#64748B' }}
                >
                  {showNewPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="kbd-forgot-confirm"
                className="block text-xs font-semibold mb-1.5"
                style={{ color: '#334155' }}
              >
                Confirm New Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: '#94A3B8' }}
                />
                <input
                  id="kbd-forgot-confirm"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full h-12 pl-10 pr-3.5 rounded-xl border border-slate-200 focus:border-black text-sm focus:outline-none transition-colors"
                  style={{ backgroundColor: '#F8FAFC', color: '#0F172A' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl font-bold text-sm tracking-wide shadow-md shadow-black/15 hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 mt-2"
              style={{ backgroundColor: '#000000', color: '#FFFFFF' }}
            >
              {loading ? 'Updating Password...' : 'Set New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
