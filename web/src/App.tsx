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
import { AntiNuke } from './pages/AntiNuke';
import { Blacklist } from './pages/Blacklist';
import { Leaves } from './pages/Leaves';
import { Profiles } from './pages/Profiles';
import { ServerSetup } from './pages/ServerSetup';
import { TestMode } from './pages/TestMode';
import { Nicknames } from './pages/Nicknames';
import { Tier } from './pages/Tier';
import { ModalProvider } from './context/ModalContext';

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
          <Route path="/anti-nuke" element={<AntiNuke />} />
          <Route path="/blacklist" element={<Blacklist />} />
          <Route path="/members" element={<Members />} />
          <Route path="/messages" element={<BotMessages />} />
          <Route path="/embeds" element={<EmbedBuilder />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/roles" element={<Roles />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/test-mode" element={<TestMode />} />
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
              ) : (
                <div className="flex h-screen w-screen overflow-hidden bg-[#060709] bg-ambient-radial text-slate-100">
                  <Sidebar userPermissions={user?.permissions} isBypass={user?.isBypass} />
                  <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                    <Navbar user={user} onLogout={() => setUser(null)} />
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
