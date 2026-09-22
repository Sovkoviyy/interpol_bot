import React, { useState } from 'react';
import { Flame, LogIn, Sparkles, Terminal } from 'lucide-react';
import api from '../api/client';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDiscordLogin = async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/login');
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      setError('Не удалось подключиться к Discord OAuth2. Проверьте настройки .env (CLIENT_ID, DISCORD_REDIRECT_URI).');
      setLoading(false);
    }
  };

  const handleDevLogin = async () => {
    try {
      setLoading(true);
      const res = await api.post('/auth/dev-login');
      if (res.data?.token) {
        localStorage.setItem('token', res.data.token);
        onLoginSuccess(res.data.user);
      }
    } catch (err: any) {
      setError('Ошибка тестового входа.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060709] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-[#151921] border border-[#1E232F] rounded-2xl p-8 shadow-2xl relative z-10">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-600 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-600/30 mb-4">
            <Flame className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">INTERPOL BOT</h1>
          <p className="text-sm text-slate-400 mt-1">Панель управления семьей на Majestic RP</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs leading-relaxed">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleDiscordLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-[#5865F2]/20 transition-all duration-200 disabled:opacity-50"
          >
            <LogIn className="w-5 h-5" />
            <span>Войти через Discord</span>
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-[#1E232F]"></div>
            <span className="flex-shrink mx-4 text-xs text-slate-400 uppercase tracking-wider">или</span>
            <div className="flex-grow border-t border-[#1E232F]"></div>
          </div>

          <button
            onClick={handleDevLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#1E232F] hover:bg-[#2A303F] text-slate-200 font-medium py-3 px-4 rounded-xl border border-slate-700/50 transition-all duration-200 text-sm"
          >
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Локальный вход (Dev / Тест без Discord OAuth)</span>
          </button>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          Доступ к разделам настраивается в соответствии с вашими ролями в Discord
        </p>
      </div>
    </div>
  );
};

export default Login;
