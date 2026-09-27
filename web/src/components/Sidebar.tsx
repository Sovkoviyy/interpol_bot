import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  AtSign,
  Target
} from 'lucide-react';

interface SidebarProps {
  userPermissions?: {
    isAdmin: boolean;
    manageSettings: boolean;
    manageRecruiting: boolean;
    manageEvents: boolean;
    viewLogs: boolean;
    manageAcademy?: boolean;
    manageLeaves?: boolean;
    manageProfiles?: boolean;
    manageTier?: boolean;
    managePayroll?: boolean;
    modular?: Record<string, boolean>;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({ userPermissions }) => {
  const isAdmin = Boolean(userPermissions?.isAdmin);
  const p = userPermissions;
  const mod = userPermissions?.modular || {};

  const canSettings = Boolean(isAdmin || p?.manageSettings || mod['settings.rbac'] || mod['settings.botMessages'] || mod['settings.logs']);
  const canRecruit = Boolean(isAdmin || canSettings || p?.manageRecruiting || Object.keys(mod).some(k => k.startsWith('recruitment.') && mod[k]));
  const canAcademy = Boolean(isAdmin || canSettings || p?.manageAcademy || Object.keys(mod).some(k => k.startsWith('academy.') && mod[k]));
  const canLeaves = Boolean(isAdmin || canSettings || p?.manageLeaves || Object.keys(mod).some(k => k.startsWith('leave.') && mod[k]));
  const canEvents = Boolean(isAdmin || canSettings || p?.manageEvents || Object.keys(mod).some(k => k.startsWith('events.') && mod[k]));
  const canProfiles = Boolean(isAdmin || canSettings || p?.manageProfiles || p?.manageRecruiting || Object.keys(mod).some(k => k.startsWith('profiles.') && mod[k]));
  const canPayroll = Boolean(isAdmin || canSettings || p?.managePayroll || p?.manageRecruiting || Object.keys(mod).some(k => k.startsWith('payroll.') && mod[k]));
  const canTier = Boolean(isAdmin || canSettings || p?.manageTier || canEvents || Object.keys(mod).some(k => k.startsWith('tier.') && mod[k]));
  const canLogs = Boolean(isAdmin || canSettings || p?.viewLogs || mod['settings.logs'] || mod['leave.viewLogs']);
  const canRoles = Boolean(isAdmin || p?.manageSettings || mod['settings.rbac']);
  const canBotMessages = Boolean(isAdmin || p?.manageSettings || mod['settings.botMessages']);
  const canMembers = Boolean(isAdmin || canSettings || canProfiles || canRecruit || canAcademy);

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
        { to: '/members', label: 'Участники сервера', icon: Users, visible: canMembers },
        { to: '/profiles', label: 'Профили & Статики', icon: IdCard, visible: canProfiles },
        { to: '/nicknames', label: 'Авто-Ники & Бинды', icon: AtSign, visible: canSettings },
        { to: '/academy', label: 'Академия (1-2 ранг)', icon: GraduationCap, visible: canAcademy },
        { to: '/recruitment', label: 'Заявки в семью', icon: UserPlus, visible: canRecruit },
        { to: '/leaves', label: 'Отпуска & Неактив', icon: CalendarOff, visible: canLeaves },
        { to: '/payroll', label: 'Выплаты рекрутерам', icon: Coins, visible: canPayroll },
      ],
    },
    {
      title: 'Мероприятия & Откаты',
      links: [
        { to: '/tier', label: 'Откаты с МП', icon: Target, visible: canTier },
        { to: '/events', label: 'Сборы на МП', icon: CalendarDays, visible: canEvents },
      ],
    },
    {
      title: 'Безопасность',
      links: [
        { to: '/blacklist', label: 'Черный список (ЧС)', icon: UserX, visible: canRecruit || canSettings },
        { to: '/logs', label: 'Аудит сервера', icon: ScrollText, visible: canLogs },
        { to: '/roles', label: 'Уровни доступа', icon: ShieldCheck, visible: canRoles },
      ],
    },
    {
      title: 'Настройки & Бот',
      links: [
        { to: '/setup', label: 'Каналы & Сервер', icon: FolderTree, visible: canSettings },
        { to: '/messages', label: 'Сообщения бота', icon: MessageSquare, visible: canBotMessages },
        { to: '/embeds', label: 'Embed Генератор', icon: Sparkles, visible: canBotMessages },
      ],
    },
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
                        `relative flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors duration-150 group ${
                          isActive
                            ? 'text-pink-400 font-semibold'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-[#151922]'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <motion.div
                              layoutId="activeSidebarIndicator"
                              className="absolute inset-0 bg-pink-500/10 border border-pink-500/30 rounded-xl shadow-pink-sm"
                              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                            />
                          )}
                          <Icon className={`w-4 h-4 shrink-0 relative z-10 transition-transform duration-150 group-hover:scale-110 ${isActive ? 'text-pink-400' : 'text-slate-400 group-hover:text-pink-400'}`} />
                          <span className="truncate relative z-10">{link.label}</span>
                        </>
                      )}
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
