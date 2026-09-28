import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, LogIn, Shield } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-dark-950 bg-ambient-radial flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-pink-900/10 rounded-full blur-[80px] pointer-events-none"></div>

      {/* Decorative grid */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }}></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[420px] relative z-10"
      >
        {/* Card */}
        <div className="bg-dark-900/80 backdrop-blur-2xl border border-dark-700/60 rounded-3xl p-8 shadow-modal relative overflow-hidden">
          {/* Top gradient bar */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-pink-500 to-transparent opacity-60" />
          
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 via-rose-500 to-fuchsia-600 flex items-center justify-center shadow-pink-glow mb-5 animate-float ring-1 ring-white/10">
              <Flame className="w-8 h-8 text-white drop-shadow-md" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">INTERPOL BOT</h1>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Панель управления семьей Interpol
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-500/8 border border-red-500/20 text-red-400 text-xs leading-relaxed backdrop-blur-sm">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleDiscordLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] active:bg-[#3C45A5] text-white font-semibold py-3.5 px-4 rounded-2xl shadow-lg shadow-[#5865F2]/25 transition-all duration-200 disabled:opacity-50 group"
            >
              <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
              <span>{loading ? 'Подключение...' : 'Войти через Discord'}</span>
            </button>
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <Shield className="w-3 h-3" />
            <span>Доступ определяется вашими ролями в Discord</span>
          </div>
        </div>

        {/* Bottom accent */}
        <div className="mt-4 text-center text-[10px] text-slate-600 tracking-wider uppercase font-medium">
          Majestic RP • Family Management System
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
