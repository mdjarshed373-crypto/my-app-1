import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { TXLogo } from '../../components/common/TXLogo';
import {
  Shield,
  Crown,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  LogOut,
} from 'lucide-react';

interface AdminLoginPageProps {
  onSuccess: () => void;
  onBack: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onSuccess,
  onBack,
}) => {
  const {
    currentUser,
    userProfile,
    isAdmin,
    loginAsAdmin,
    loginMainAdminWithGoogle,
    logout,
  } = useAuth();

  const [adminNumber, setAdminNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginAsAdmin(adminNumber, password);
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (
          err.message.includes('user-not-found') ||
          err.message.includes('wrong-password') ||
          err.message.includes('invalid-credential') ||
          err.message.includes('invalid-email') ||
          err.message.includes('operation-not-allowed')
        ) {
          setError('Invalid Admin Number or Password!');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to sign in. Check your Admin Number and Password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMainAdminGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginMainAdminWithGoogle();
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Google sign-in failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070B18] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0D1428] hover:bg-[#111D35] border border-slate-800 text-xs font-bold text-sky-400 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </button>

        <div className="relative bg-[#0D1428] border border-sky-500/30 rounded-2xl shadow-2xl shadow-sky-500/15 overflow-hidden p-6 sm:p-8 space-y-6">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-600 via-sky-400 to-indigo-600" />

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <TXLogo size="md" showSubtitle={false} disableSecretTap={true} />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-300 text-[11px] font-bold font-gaming uppercase tracking-wider">
              <Shield className="w-3.5 h-3.5 text-sky-400" />
              <span>Admin Portal</span>
            </div>
            <h1 className="text-2xl font-black font-gaming tracking-wide text-white">
              Admin Login
            </h1>
            <p className="text-xs text-slate-400">
              Sign in with your Admin Phone Number &amp; Password to open the Admin Dashboard
            </p>
          </div>

          {currentUser && isAdmin && userProfile ? (
            /* Already Logged In as Admin Quick Redirect */
            <div className="p-4 rounded-xl bg-[#111D35] border border-emerald-500/35 space-y-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-white">
                    Logged in as {userProfile.displayName}
                  </p>
                  <p className="text-slate-400 mt-0.5">
                    Your Admin session is active and ready.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onSuccess}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white font-bold font-gaming text-xs tracking-wider shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Open Admin Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => logout()}
                className="w-full py-2 rounded-xl bg-[#0D1428] hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign in with different Admin Number</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/50 flex items-start gap-2 text-red-200 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                  Admin Number *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 w-4 h-4 text-sky-400" />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={adminNumber}
                    onChange={(e) => setAdminNumber(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#111D35] border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-sky-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-[#111D35] border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-sky-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? (
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
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white font-bold rounded-xl shadow-lg shadow-sky-500/20 transition-all font-gaming text-sm tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{loading ? 'Verifying...' : 'Login to Admin Dashboard'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleMainAdminGoogleLogin}
                  className="w-full py-2.5 rounded-xl bg-[#111D35] hover:bg-slate-800 border border-amber-500/35 text-amber-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>Main Admin Sign-In (Google)</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
