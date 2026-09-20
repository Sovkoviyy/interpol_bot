import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  UserPlus, 
  CalendarDays, 
  ScrollText, 
  ShieldCheck, 
  BarChart3, 
  Settings,
  Flame
} from 'lucide-react';

interface SidebarProps {
  userPermissions?: {
    isAdmin: boolean;
    manageSettings: boolean;
    manageRecruiting: boolean;
    manageEvents: boolean;
    viewLogs: boolean;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({ userPermissions }) => {
  const isAdmin = userPermissions?.isAdmin;

  const links = [
    { to: '/dashboard', label: 'Обзор', icon: LayoutDashboard, visible: true },
    { to: '/recruitment', label: 'Заявки в семью', icon: UserPlus, visible: isAdmin || userPermissions?.manageRecruiting },
    { to: '/events', label: 'Сборы на МП', icon: CalendarDays, visible: isAdmin || userPermissions?.manageEvents },
    { to: '/logs', label: 'Аудит сервера', icon: ScrollText, visible: isAdmin || userPermissions?.viewLogs },
    { to: '/roles', label: 'Уровни доступа', icon: ShieldCheck, visible: isAdmin || userPermissions?.manageSettings },
    { to: '/stats', label: 'Статистика', icon: BarChart3, visible: true },
  ];

  return (
    <aside className="w-64 bg-[#151921] border-r border-[#1E232F] flex flex-col justify-between flex-shrink-0 min-h-screen">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-[#1E232F] gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-wide bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              INTERPOL BOT
            </h1>
            <p className="text-[11px] text-slate-400 font-medium tracking-wider uppercase">Majestic Family</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
            Модули
          </div>
          {links.filter(l => l.visible).map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold shadow-inner'
                      : 'text-slate-300 hover:text-white hover:bg-[#1E232F]'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{link.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-[#1E232F] text-xs text-slate-400">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Бот онлайн
          </span>
          <span className="text-[10px] bg-[#1E232F] px-2 py-0.5 rounded text-slate-300">v1.0.0</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
