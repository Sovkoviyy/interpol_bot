import React from 'react';
import { LogOut, ShieldAlert, User } from 'lucide-react';
import api from '../api/client';

interface NavbarProps {
  user: any;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    localStorage.removeItem('token');
    onLogout();
  };

  const avatarUrl = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.userId}/${user.avatar}.png`
    : null;

  return (
    <header className="h-16 bg-[#151921]/80 backdrop-blur border-b border-[#1E232F] px-8 flex items-center justify-between sticky top-0 z-30">
      <div>
        <h2 className="text-sm font-semibold text-slate-200">
          Панель управления семьи <span className="text-indigo-400">#Majestic RP</span>
        </h2>
      </div>

      <div className="flex items-center gap-4">
        {user?.permissions?.isAdmin && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <ShieldAlert className="w-3.5 h-3.5" />
            Администратор
          </span>
        )}

        <div className="flex items-center gap-3 pl-3 border-l border-[#1E232F]">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full border border-[#1E232F]" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-xs">
              <User className="w-4 h-4" />
            </div>
          )}

          <div className="text-left hidden sm:block">
            <p className="text-xs font-semibold text-slate-100">{user?.username}</p>
            <p className="text-[11px] text-slate-400">ID: {user?.userId}</p>
          </div>

          <button
            onClick={handleLogout}
            title="Выйти"
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ml-2"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
