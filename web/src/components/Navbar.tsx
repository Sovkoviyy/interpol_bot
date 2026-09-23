import React, { useState } from 'react';
import { LogOut, ShieldAlert, User, RefreshCw } from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

interface NavbarProps {
  user: any;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const modal = useModal();
  const [restarting, setRestarting] = useState(false);

  const handleRestartBot = () => {
    modal.confirm({
      title: 'Перезапустить Discord бота?',
      message: 'Бот переподключится к Discord Gateway, синхронизирует слеш-команды и применит настройки без прерывания работы веб-сервера.',
      type: 'warning',
      confirmText: 'Перезапустить',
      onConfirm: async () => {
        try {
          setRestarting(true);
          await api.post('/bot/restart');
          modal.alert({
            title: 'Бот перезапущен',
            message: 'Discord бот успешно переподключен и находится онлайн!',
            type: 'success',
          });
        } catch (err: any) {
          modal.alert({
            title: 'Ошибка перезапуска',
            message: err.response?.data?.error || 'Не удалось перезапустить бота',
            type: 'error',
          });
        } finally {
          setRestarting(false);
        }
      },
    });
  };

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
    <header className="h-16 bg-[#0B0E14]/80 backdrop-blur-md border-b border-[#1E232F] px-8 flex items-center justify-between sticky top-0 z-30">
      <div>
        <h2 className="text-sm font-semibold text-slate-200">
          Панель управления семьи <span className="text-pink-400 font-bold">#Majestic RP</span>
        </h2>
      </div>

      <div className="flex items-center gap-4">
        {user?.permissions?.isAdmin && (
          <button
            onClick={handleRestartBot}
            disabled={restarting}
            title="Перезагрузить Discord бота"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-dark-800 hover:bg-dark-700 text-slate-300 hover:text-pink-400 border border-dark-700 hover:border-pink-500/40 transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${restarting ? 'animate-spin text-pink-400' : ''}`} />
            {restarting ? 'Перезапуск...' : 'Перезапустить бота'}
          </button>
        )}

        {user?.permissions?.isAdmin && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-pink-500/10 text-pink-400 border border-pink-500/20">
            <ShieldAlert className="w-3.5 h-3.5" />
            Администратор
          </span>
        )}

        <div className="flex items-center gap-3 pl-3 border-l border-[#1E232F]">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full border border-pink-500/30" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-pink-600/20 text-pink-400 border border-pink-500/30 flex items-center justify-center font-bold text-xs">
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
