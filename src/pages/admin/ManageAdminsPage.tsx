import React from 'react';
import { ManageAdminsSection } from '../../components/admin/ManageAdminsSection';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangle } from 'lucide-react';

interface ManageAdminsPageProps {
  onNavigate?: (page: string, params?: any) => void;
}

export const ManageAdminsPage: React.FC<ManageAdminsPageProps> = ({ onNavigate }) => {
  const { isAdmin, isSuperAdmin } = useAuth();

  if (!isAdmin || !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-[#070B18] py-12 px-4 sm:px-6 lg:px-8 max-w-xl mx-auto">
        <div className="p-8 rounded-3xl bg-[#0D1428] border border-red-500/30 shadow-2xl text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black font-gaming text-white">
            Main Admin Access Only
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Only Main Admin can view the Admin List and manage administrators.
          </p>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate(isAdmin ? 'admin' : 'home')}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold font-gaming text-xs cursor-pointer"
            >
              {isAdmin ? 'Back to Admin Dashboard' : 'Back to Home'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070B18] py-6 sm:py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      <ManageAdminsSection onNavigate={onNavigate} showBackButton={true} />
    </div>
  );
};
