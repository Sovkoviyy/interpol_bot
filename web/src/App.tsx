import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import api from './api/client';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Recruitment } from './pages/Recruitment';
import { Events } from './pages/Events';
import { Logs } from './pages/Logs';
import { Roles } from './pages/Roles';
import { Stats } from './pages/Stats';
import { Members } from './pages/Members';
import { BotMessages } from './pages/BotMessages';
import { EmbedBuilder } from './pages/EmbedBuilder';
import { Academy } from './pages/Academy';
import { RecruiterPayroll } from './pages/RecruiterPayroll';
import { Blacklist } from './pages/Blacklist';
import { Leaves } from './pages/Leaves';
import { Profiles } from './pages/Profiles';
import { ServerSetup } from './pages/ServerSetup';
import { Nicknames } from './pages/Nicknames';
import { Tier } from './pages/Tier';
import { ModalProvider } from './context/ModalContext';
import { ShieldAlert } from 'lucide-react';

const AnimatedPageRoutes: React.FC = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 12, filter: 'blur(5px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="w-full"
      >
        <Routes location={location}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/setup" element={<ServerSetup />} />
          <Route path="/profiles" element={<Profiles />} />
          <Route path="/nicknames" element={<Nicknames />} />
          <Route path="/academy" element={<Academy />} />
          <Route path="/recruitment" element={<Recruitment />} />
          <Route path="/events" element={<Events />} />
          <Route path="/tier" element={<Tier />} />
          <Route path="/leaves" element={<Leaves />} />
          <Route path="/payroll" element={<RecruiterPayroll />} />
          <Route path="/blacklist" element={<Blacklist />} />
          <Route path="/members" element={<Members />} />
          <Route path="/messages" element={<BotMessages />} />
          <Route path="/embeds" element={<EmbedBuilder />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/roles" element={<Roles />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
};

export const App: React.FC = () => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    // Check if token in URL query (after Discord OAuth redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      localStorage.setItem('token', urlToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060709] bg-ambient-radial flex flex-col items-center justify-center gap-4">
        <div className="relative flex items-center justify-center">
          <div className="w-12 h-12 border-2 border-pink-500/20 border-t-pink-500 rounded-full animate-spin"></div>
          <div className="w-6 h-6 border-2 border-rose-400/30 border-b-rose-400 rounded-full animate-spin absolute" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
        </div>
        <p className="text-xs font-medium text-slate-400 tracking-wide animate-pulse">Загрузка панели управления...</p>
      </div>
    );
  }

  const hasAccess = Boolean(
    user?.permissions?.isAdmin ||
    user?.permissions?.manageSettings ||
    user?.permissions?.manageRecruiting ||
    user?.permissions?.manageEvents ||
    user?.permissions?.viewLogs
  );

  return (
    <ModalProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              user ? <Navigate to="/dashboard" replace /> : <Login onLoginSuccess={(u) => setUser(u)} />
            }
          />

          <Route
            path="/*"
            element={
              !user ? (
                <Navigate to="/login" replace />
              ) : !hasAccess ? (
                <div className="min-h-screen bg-[#060709] bg-ambient-radial flex flex-col justify-center items-center p-4 relative overflow-hidden">
                  <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="w-full max-w-md bg-[#151921] border border-red-500/30 rounded-2xl p-8 shadow-2xl shadow-black/80 relative z-10 text-center"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-5 text-red-400">
                      <ShieldAlert className="w-8 h-8" />
                    </div>

                    <h2 className="text-xl font-bold text-white mb-2">Доступ ограничен</h2>
                    <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                      Ваш Discord-аккаунт <span className="text-white font-medium">@{user?.username}</span> не имеет прав Администратора и не обладает настроенными ролями доступа в системе INTERPOL BOT.
                    </p>

                    <div className="bg-[#0B0E14] border border-[#1E232F] rounded-xl p-4 text-xs text-slate-400 mb-6 text-left space-y-2">
                      <div className="flex items-center justify-between text-slate-300 font-semibold border-b border-[#1E232F] pb-2">
                        <span>Статус доступа</span>
                        <span className="text-amber-400">Роли не назначены</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Для получения доступа обратитесь к руководству семьи или администратору Discord-сервера с просьбой выдать вам соответствующую роль в разделе «Уровни доступа».
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={checkAuth}
                        className="flex-1 py-2.5 px-4 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-semibold transition shadow-lg shadow-pink-600/20"
                      >
                        Обновить статус
                      </button>
                      <button
                        onClick={handleLogout}
                        className="py-2.5 px-4 bg-[#1E232F] hover:bg-[#2A303F] text-slate-300 rounded-xl text-xs font-medium transition border border-slate-700/50"
                      >
                        Выйти
                      </button>
                    </div>
                  </motion.div>
                </div>
              ) : (
                <div className="flex h-screen w-screen overflow-hidden bg-[#060709] bg-ambient-radial text-slate-100">
                  <Sidebar userPermissions={user?.permissions} />
                  <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                    <Navbar user={user} onLogout={handleLogout} />
                    <main className="flex-1 px-4 py-6 md:px-8 md:py-8 overflow-y-auto custom-scrollbar">
                      <div className="w-full max-w-7xl mx-auto">
                        <AnimatedPageRoutes />
                      </div>
                    </main>
                  </div>
                </div>
              )
            }
          />
        </Routes>
      </BrowserRouter>
    </ModalProvider>
  );
};

export default App;
