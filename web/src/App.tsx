import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { ModalProvider } from './context/ModalContext';

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
      <div className="min-h-screen bg-[#060709] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
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
                <div className="flex min-h-screen bg-[#060709] text-slate-100">
                  <Sidebar userPermissions={user?.permissions} />
                  <div className="flex-1 flex flex-col min-w-0">
                    <Navbar user={user} onLogout={() => setUser(null)} />
                    <main className="flex-1 p-8 overflow-y-auto">
                      <Routes>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/members" element={<Members />} />
                        <Route path="/recruitment" element={<Recruitment />} />
                        <Route path="/events" element={<Events />} />
                        <Route path="/messages" element={<BotMessages />} />
                        <Route path="/embeds" element={<EmbedBuilder />} />
                        <Route path="/logs" element={<Logs />} />
                        <Route path="/roles" element={<Roles />} />
                        <Route path="/stats" element={<Stats />} />
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                      </Routes>
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
