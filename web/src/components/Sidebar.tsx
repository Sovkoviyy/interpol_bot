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
  Coins,
  ShieldAlert,
  CalendarOff,
  IdCard,
  UserX,
  FolderTree,
  Zap,
  AtSign,
  Target
} from 'lucide-react';

interface SidebarProps {
  isBypass?: boolean;
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

export const Sidebar: React.FC<SidebarProps> = ({ userPermissions, isBypass }) => {
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
        { to: '/nicknames', label: 'Авто-Ники & Бинды', icon: AtSign, visible: true },
        { to: '/academy', label: 'Академия (1-2 ранг)', icon: GraduationCap, visible: true },
        { to: '/recruitment', label: 'Заявки в семью', icon: UserPlus, visible: isAdmin || userPermissions?.manageRecruiting },
        { to: '/leaves', label: 'Отпуска & Неактив', icon: CalendarOff, visible: true },
        { to: '/payroll', label: 'Выплаты рекрутерам', icon: Coins, visible: isAdmin || userPermissions?.manageRecruiting },
      ],
    },
    {
      title: 'Мероприятия (МП)',
      links: [
        { to: '/events', label: 'Сборы на МП', icon: CalendarDays, visible: true },
        { to: '/tier', label: 'Тир система', icon: Target, visible: true },
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
    ...(isBypass ? [{
      title: 'Разработчик',
      links: [
        { to: '/test-mode', label: 'Тестовый режим & Вайп', icon: Zap, visible: true },
      ],
    }] : []),
  ];

  return (
    <aside className="w-64 bg-[#0B0E14] border-r border-[#1E232F] flex flex-col justify-between flex-shrink-0 h-screen sticky top-0 z-30 select-none overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-[#1E232F] gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-600 via-rose-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-pink-500/30">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-wide bg-gradient-to-r from-white via-pink-100 to-pink-300 bg-clip-text text-transparent">
              INTERPOL BOT
            </h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide">Панель управления</p>
          </div>
        </div>

        {/* Categorized Navigation */}
        <nav className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
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
      <div className="p-3 border-t border-[#1E232F] text-xs text-slate-400 shrink-0 space-y-2">
        {isBypass && (
          <NavLink
            to="/test-mode"
            className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-[11px] shadow-lg shadow-amber-500/10 hover:bg-amber-500/20 transition-all"
          >
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              Тестовый режим
            </span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </NavLink>
        )}

        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px]">
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
