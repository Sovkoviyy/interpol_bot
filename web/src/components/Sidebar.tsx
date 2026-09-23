import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  UserPlus, 
  CalendarDays, 
  ScrollText, 
  ShieldCheck, 
  BarChart3, 
  Flame, 
  Users, 
  MessageSquare, 
  Sparkles,
  GraduationCap,
  Radio,
  Coins,
  ShieldAlert,
  CalendarOff,
  IdCard,
  UserX,
  FolderTree
} from 'lucide-react';

interface SidebarProps {
  userPermissions?: {
    isAdmin: boolean;
    manageSettings: boolean;
    manageRecruiting: boolean;
    manageEvents: boolean;
    viewLogs: boolean;
    manageAcademy?: boolean;
    manageVoiceTracker?: boolean;
    antiNukeAlerts?: boolean;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({ userPermissions }) => {
  const isAdmin = userPermissions?.isAdmin;

  const categories = [
    {
      title: 'Основное',
      links: [
        { to: '/dashboard', label: 'Обзор', icon: LayoutDashboard, visible: true },
        { to: '/stats', label: 'Статистика', icon: BarChart3, visible: true },
      ],
    },
    {
      title: 'Состав & Рекрутинг',
      links: [
        { to: '/profiles', label: 'Профили & Статики', icon: IdCard, visible: true },
        { to: '/academy', label: 'Академия (1-2 ранг)', icon: GraduationCap, visible: true },
        { to: '/recruitment', label: 'Заявки в семью', icon: UserPlus, visible: isAdmin || userPermissions?.manageRecruiting },
        { to: '/leaves', label: 'Отпуска & Неактив', icon: CalendarOff, visible: true },
        { to: '/payroll', label: 'Выплаты рекрутерам', icon: Coins, visible: isAdmin || userPermissions?.manageRecruiting },
      ],
    },
    {
      title: 'Мероприятия (МП)',
      links: [
        { to: '/voice-tracker', label: 'Умный войс & МП', icon: Radio, visible: true },
        { to: '/events', label: 'Сборы на МП', icon: CalendarDays, visible: isAdmin || userPermissions?.manageEvents },
      ],
    },
    {
      title: 'Безопасность',
      links: [
        { to: '/anti-nuke', label: 'Защита сервера', icon: ShieldAlert, visible: isAdmin || userPermissions?.antiNukeAlerts },
        { to: '/blacklist', label: 'Черный список (ЧС)', icon: UserX, visible: isAdmin || userPermissions?.manageRecruiting },
        { to: '/logs', label: 'Аудит сервера', icon: ScrollText, visible: isAdmin || userPermissions?.viewLogs },
        { to: '/roles', label: 'Уровни доступа', icon: ShieldCheck, visible: isAdmin || userPermissions?.manageSettings },
      ],
    },
    {
      title: 'Настройки & Бот',
      links: [
        { to: '/setup', label: 'Каналы & Сервер', icon: FolderTree, visible: isAdmin || userPermissions?.manageSettings },
        { to: '/messages', label: 'Сообщения бота', icon: MessageSquare, visible: isAdmin || userPermissions?.manageSettings },
        { to: '/embeds', label: 'Embed Генератор', icon: Sparkles, visible: isAdmin || userPermissions?.manageSettings },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-[#0B0E14] border-r border-[#1E232F] flex flex-col justify-between flex-shrink-0 min-h-screen">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-[#1E232F] gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-600 via-rose-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-pink-500/30">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-wide bg-gradient-to-r from-white via-pink-100 to-pink-300 bg-clip-text text-transparent">
              INTERPOL BOT
            </h1>
            <p className="text-[11px] text-pink-400/80 font-medium tracking-wider uppercase">Majestic Family</p>
          </div>
        </div>

        {/* Categorized Navigation */}
        <nav className="p-3 space-y-3.5 overflow-y-auto max-h-[calc(100vh-8rem)] custom-scrollbar">
          {categories.map((category) => {
            const visibleLinks = category.links.filter((l) => l.visible);
            if (visibleLinks.length === 0) return null;

            return (
              <div key={category.title} className="space-y-1">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-1">
                  {category.title}
                </div>
                {visibleLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                          isActive
                            ? 'bg-pink-500/10 text-pink-400 border border-pink-500/30 font-semibold shadow-pink-sm'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-[#151922]'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{link.label}</span>
                    </NavLink>
                  );
                })}
              </div>
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
          <span className="text-[10px] bg-pink-500/20 text-pink-400 font-mono px-2 py-0.5 rounded border border-pink-500/30">
            v2.0.0
          </span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
