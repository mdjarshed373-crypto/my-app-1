import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  X,
  Lock,
  Mail,
  User,
  Phone,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  Gift,
} from 'lucide-react';
import { TXLogo } from './TXLogo';
import { useLockBodyScroll } from '../../utils/scrollLock';
import {
  isValidBDPhoneNumber,
  isValidEmailFormat,
  normalizeUsername,
} from '../../services/playerAuthService';
import {
  getPendingReferCode,
  normalizeReferCode,
} from '../../services/referralService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onLoginSuccess?: () => void;
  onSecretAdminEntry?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onLoginSuccess,
  onSecretAdminEntry,
}) => {
  const {
    loginWithEmail,
    registerNewPlayer,
    resetPlayerPassword,
  } = useAuth();
  const { language } = useLanguage();

  useLockBodyScroll(isOpen);

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  // Login
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Sign Up
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regReferCode, setRegReferCode] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Forgot Password
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      submittingRef.current = false;
      setLoading(false);
      setMode(initialMode);
      setError(null);
      setSuccess(null);
      const pendingRef = getPendingReferCode();
      if (pendingRef) {
        setRegReferCode(pendingRef);
      }
    } else {
      submittingRef.current = false;
      setLoading(false);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const resetMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // 1. SIGN IN (Instant Login with synchronous double-click guard)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || loading) return;
    resetMessages();

    const ident = loginIdentifier.trim();
    if (!ident) {
      setError('Please enter your Username or Email.');
      return;
    }
    if (!loginPassword) {
      setError('Please enter your Password.');
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      await loginWithEmail(ident, loginPassword, rememberMe);
      onClose();
      onLoginSuccess?.();
    } catch (err: unknown) {
      submittingRef.current = false;
      setLoading(false);
      if (err instanceof Error) {
        setError(err.message || 'Invalid Username/Email or Password!');
      } else {
        setError('Login failed. Please check your credentials.');
      }
    }
  };

  // 2. CREATE ACCOUNT (Instant Registration with synchronous double-click guard)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || loading) return;
    resetMessages();

    const cleanUser = normalizeUsername(regUsername);
    const cleanEmail = regEmail.trim().toLowerCase();
    const cleanPhone = regPhone.trim();

    if (cleanUser.length < 4) {
      setError('Username must be at least 4 letters long (letters, numbers, underscore only).');
      return;
    }
    if (!isValidEmailFormat(cleanEmail)) {
      setError('Please enter a valid email address (e.g. name@example.com).');
      return;
    }
    if (!isValidBDPhoneNumber(cleanPhone)) {
      setError('Please enter a valid 11-digit Bangladeshi mobile number (017xxxxxxxx).');
      return;
    }
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (!agreeTerms) {
      setError('Please agree to Terms & Conditions to create an account.');
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      await registerNewPlayer(
        cleanUser,
        cleanEmail,
        cleanPhone,
        regPassword,
        true,
        regReferCode.trim() ? normalizeReferCode(regReferCode) : undefined
      );
      onClose();
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

  // 3. RESET PASSWORD (Forgot Password)
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    const ident = forgotIdentifier.trim();
    if (!ident) {
      setError('Please enter your registered Username, Email, or Mobile Number.');
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
          setLoginIdentifier(ident);
          setLoginPassword('');
          resetMessages();
        }, 1500);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      {/* Outer Card with Golden Black theme */}
      <div className="relative w-full max-w-sm sm:max-w-md bg-[#0A0A0A] border border-[#CFA84B]/40 rounded-2xl shadow-2xl shadow-[#CFA84B]/15 overflow-hidden">
        {/* Top gold metallic accent gradient line */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#8A6A24] via-[#F4D77A] to-[#8A6A24]"></div>

        {/* Top Header Actions (Back button or Close button) */}
        <div className="absolute top-3.5 inset-x-4 flex items-center justify-between z-10 pointer-events-auto">
          {mode !== 'login' ? (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                resetMessages();
              }}
              className="p-1.5 text-[#CFA84B] hover:text-[#F4D77A] hover:bg-[#1E190E]/60 rounded-full transition-colors flex items-center gap-1 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div></div>
          )}

          <button
            onClick={onClose}
            className="p-1.5 text-[#B8A06A] hover:text-[#F4D77A] hover:bg-[#1E190E]/60 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Container */}
        <div className="p-6 pt-9 max-h-[85vh] overflow-y-auto">
          {/* Top Logo and Title */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <TXLogo
                size="md"
                showSubtitle={false}
                onSecretAdminEntry={() => {
                  onClose();
                  onSecretAdminEntry?.();
                }}
              />
            </div>

            {mode === 'login' && (
              <>
                <h2 className="text-2xl font-bold font-gaming tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-[#F4D77A] via-[#E2B755] to-[#CFA84B]">
                  Welcome Back
                </h2>
                <p className="text-xs text-[#B8A06A] mt-1">
                  Sign in to continue to TX TOUR BD
                </p>
              </>
            )}

            {mode === 'register' && (
              <>
                <h2 className="text-2xl font-bold font-gaming tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-[#F4D77A] via-[#E2B755] to-[#CFA84B]">
                  Let's Start
                </h2>
                <p className="text-xs text-[#B8A06A] mt-1">
                  Create an account to continue
                </p>
              </>
            )}

            {mode === 'forgot' && (
              <>
                <h2 className="text-2xl font-bold font-gaming tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-[#F4D77A] via-[#E2B755] to-[#CFA84B]">
                  Forgot Password
                </h2>
                <p className="text-xs text-[#B8A06A] mt-1">
                  Reset your password to regain account access
                </p>
              </>
            )}
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-[#2A1010] border border-red-500/50 flex items-start gap-2 text-red-200 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 rounded-lg bg-[#142A16] border border-emerald-500/50 flex items-start gap-2 text-emerald-200 text-xs animate-in fade-in">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* =========================================================================
              SCREEN 1: LOGIN (Matching 1st image)
             ========================================================================= */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Field 1: Username / Email */}
              <div>
                <label className="block text-xs font-semibold text-[#E2B755] mb-1.5">
                  Username / Email
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-[#B8A06A]" />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="Enter username or email"
                    className="w-full pl-10 pr-3 py-2.5 bg-[#0D1428]/80 border border-[#CFA84B]/40 focus:border-[#F4D77A] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Field 2: Password with Eye Icon */}
              <div>
                <label className="block text-xs font-semibold text-[#E2B755] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-[#B8A06A]" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-10 pr-10 py-2.5 bg-[#0D1428]/80 border border-[#CFA84B]/40 focus:border-[#F4D77A] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    className="absolute right-3 top-3 text-[#B8A06A] hover:text-[#F4D77A] transition-colors p-0.5"
                  >
                    {showLoginPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Row: Remember me checkbox + Forgot Password link */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-[#CFA84B]/60 text-[#CFA84B] focus:ring-0 focus:ring-offset-0 bg-[#0D1428] accent-[#CFA84B] cursor-pointer"
                  />
                  <span className="text-xs text-[#B8A06A] font-medium">Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setForgotIdentifier(loginIdentifier);
                    resetMessages();
                  }}
                  className="text-xs text-[#E2B755] hover:text-[#F4D77A] font-semibold transition-colors"
                >
                  Forgot Password?
                </button>
              </div>

              {/* Button: SIGN IN (Golden Black gradient, bold text) */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 active:scale-[0.99] text-black font-extrabold rounded-xl shadow-lg shadow-[#CFA84B]/20 transition-all font-gaming tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2 border border-[#F4D77A]/60"
              >
                {loading ? 'SIGNING IN...' : 'SIGN IN'}
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>

              {/* Bottom link: New User? Register Now */}
              <div className="text-center pt-4">
                <span className="text-xs text-[#B8A06A]">New User? </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    resetMessages();
                  }}
                  className="text-xs font-bold text-[#F4D77A] hover:underline transition-colors"
                >
                  Register Now
                </button>
              </div>
            </form>
          )}

          {/* =========================================================================
              SCREEN 2: SIGN UP / REGISTER (Matching 2nd image)
             ========================================================================= */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              {/* Field 1: Username */}
              <div>
                <label className="block text-xs font-semibold text-[#E2B755] mb-1">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-[#B8A06A]" />
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="Min 4 letters (e.g. rahim_99)"
                    className="w-full pl-10 pr-3 py-2.5 bg-[#0D1428]/80 border border-[#CFA84B]/40 focus:border-[#F4D77A] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Field 2: Email Address */}
              <div>
                <label className="block text-xs font-semibold text-[#E2B755] mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-[#B8A06A]" />
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="player@example.com"
                    className="w-full pl-10 pr-3 py-2.5 bg-[#0D1428]/80 border border-[#CFA84B]/40 focus:border-[#F4D77A] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Field 3: Mobile Number (11-digit BD) */}
              <div>
                <label className="block text-xs font-semibold text-[#E2B755] mb-1">
                  Mobile Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 w-4 h-4 text-[#B8A06A]" />
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="017XXXXXXXX (11 digits)"
                    className="w-full pl-10 pr-3 py-2.5 bg-[#0D1428]/80 border border-[#CFA84B]/40 focus:border-[#F4D77A] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Field 4: Password with Eye Icon */}
              <div>
                <label className="block text-xs font-semibold text-[#E2B755] mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-[#B8A06A]" />
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-10 pr-10 py-2.5 bg-[#0D1428]/80 border border-[#CFA84B]/40 focus:border-[#F4D77A] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword((prev) => !prev)}
                    className="absolute right-3 top-3 text-[#B8A06A] hover:text-[#F4D77A] transition-colors p-0.5"
                  >
                    {showRegPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Field 5: Refer Code (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-[#E2B755] mb-1">
                  Refer Code <span className="text-[10px] text-[#B8A06A] font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Gift className="absolute left-3.5 top-3 w-4 h-4 text-[#B8A06A]" />
                  <input
                    type="text"
                    value={regReferCode}
                    onChange={(e) => setRegReferCode(e.target.value.toUpperCase())}
                    placeholder="e.g. TX1234 (Friend's Code)"
                    className="w-full pl-10 pr-3 py-2.5 bg-[#0D1428]/80 border border-[#CFA84B]/40 focus:border-[#F4D77A] rounded-xl text-white text-sm font-mono uppercase placeholder-slate-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Mandatory Checkbox: I agree to Terms & Conditions */}
              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="agreeTerms"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-[#CFA84B]/60 text-[#CFA84B] focus:ring-0 bg-[#0D1428] accent-[#CFA84B] cursor-pointer"
                />
                <label htmlFor="agreeTerms" className="text-xs text-[#B8A06A] cursor-pointer select-none leading-relaxed">
                  I agree to the <span className="text-[#F4D77A] font-semibold underline">Terms & Conditions</span> and tournament rules.
                </label>
              </div>

              {/* Button: CREATE ACCOUNT */}
              <button
                type="submit"
                disabled={loading || !agreeTerms}
                className="w-full py-3.5 bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 active:scale-[0.99] text-black font-extrabold rounded-xl shadow-lg shadow-[#CFA84B]/20 transition-all font-gaming tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed mt-2 border border-[#F4D77A]/60"
              >
                {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
                <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
              </button>

              {/* Bottom link: Already have an account? Sign In */}
              <div className="text-center pt-3">
                <span className="text-xs text-[#B8A06A]">Already have an account? </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    resetMessages();
                  }}
                  className="text-xs font-bold text-[#F4D77A] hover:underline transition-colors"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* =========================================================================
              SCREEN 3: FORGOT PASSWORD
             ========================================================================= */}
          {mode === 'forgot' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#E2B755] mb-1.5">
                  Username, Email, or Mobile
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-[#B8A06A]" />
                  <input
                    type="text"
                    required
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="Enter your registered account identifier"
                    className="w-full pl-10 pr-3 py-2.5 bg-[#0D1428]/80 border border-[#CFA84B]/40 focus:border-[#F4D77A] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#E2B755] mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-[#B8A06A]" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-10 pr-10 py-2.5 bg-[#0D1428]/80 border border-[#CFA84B]/40 focus:border-[#F4D77A] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-3 top-3 text-[#B8A06A] hover:text-[#F4D77A] transition-colors p-0.5"
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
                <label className="block text-xs font-semibold text-[#E2B755] mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-[#B8A06A]" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full pl-10 pr-3 py-2.5 bg-[#0D1428]/80 border border-[#CFA84B]/40 focus:border-[#F4D77A] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 active:scale-[0.99] text-black font-extrabold rounded-xl shadow-lg shadow-[#CFA84B]/20 transition-all font-gaming tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2 border border-[#F4D77A]/60"
              >
                {loading ? 'UPDATING PASSWORD...' : 'SET NEW PASSWORD'}
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    resetMessages();
                  }}
                  className="text-xs font-semibold text-[#B8A06A] hover:text-[#F4D77A] transition-colors"
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
