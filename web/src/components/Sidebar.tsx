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
  CalendarOff,
  IdCard,
  UserX,
  FolderTree,
  AtSign,
  Target,
  Gamepad2,
  ShieldAlert
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
        { to: '/honeypot', label: 'Канал-ловушка', icon: ShieldAlert, visible: canSettings },
        { to: '/blacklist', label: 'Черный список (ЧС)', icon: UserX, visible: canRecruit || canSettings },
        { to: '/logs', label: 'Аудит сервера', icon: ScrollText, visible: canLogs },
        { to: '/roles', label: 'Уровни доступа', icon: ShieldCheck, visible: canRoles },
      ],
    },
    {
      title: 'Настройки & Бот',
      links: [
        { to: '/setup', label: 'Каналы & Сервер', icon: FolderTree, visible: canSettings },
        { to: '/activity', label: 'Активность бота', icon: Gamepad2, visible: canSettings || canBotMessages },
        { to: '/messages', label: 'Сообщения бота', icon: MessageSquare, visible: canBotMessages },
        { to: '/embeds', label: 'Embed Генератор', icon: Sparkles, visible: canBotMessages },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-dark-900/95 backdrop-blur-xl border-r border-dark-700/60 flex flex-col justify-between flex-shrink-0 h-screen sticky top-0 z-30 select-none overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-5 border-b border-dark-700/60 gap-3 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 via-rose-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-pink-500/25 ring-1 ring-white/10">
            <Flame className="w-5 h-5 text-white drop-shadow-sm" />
          </div>
          <div>
            <h1 className="font-bold text-[15px] tracking-wide bg-gradient-to-r from-white via-pink-100 to-pink-300 bg-clip-text text-transparent leading-tight">
              INTERPOL
            </h1>
            <p className="text-[10px] text-slate-500 font-medium tracking-widest uppercase">Панель управления</p>
          </div>
        </div>

        {/* Categorized Navigation */}
        <nav className="px-3 py-4 space-y-5 overflow-y-auto flex-1">
          {categories.map((category) => {
            const visibleLinks = category.links.filter((l) => l.visible);
            if (visibleLinks.length === 0) return null;

            return (
              <div key={category.title}>
                <div className="text-[10px] font-bold text-slate-500/80 uppercase tracking-[0.12em] px-3 mb-2">
                  {category.title}
                </div>
                <div className="space-y-0.5">
                  {visibleLinks.map((link) => {
                    const Icon = link.icon;
                    return (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        className={({ isActive }) =>
                          `relative flex items-center gap-2.5 px-3 py-[7px] rounded-xl text-[13px] font-medium transition-all duration-150 group ${
                            isActive
                              ? 'text-white font-semibold'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-dark-800/70'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <motion.div
                                layoutId="activeSidebarIndicator"
                                className="absolute inset-0 bg-gradient-to-r from-pink-500/15 to-pink-500/5 border border-pink-500/25 rounded-xl"
                                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                              />
                            )}
                            <Icon className={`w-[16px] h-[16px] shrink-0 relative z-10 transition-all duration-150 ${
                              isActive 
                                ? 'text-pink-400 drop-shadow-[0_0_6px_rgba(236,72,153,0.4)]' 
                                : 'text-slate-500 group-hover:text-pink-400/80'
                            }`} />
                            <span className="truncate relative z-10">{link.label}</span>
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-dark-700/60 shrink-0">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-[11px] text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Бот онлайн
          </span>
          <span className="text-[10px] bg-gradient-to-r from-pink-500/15 to-rose-500/15 text-pink-400 font-mono px-2.5 py-0.5 rounded-lg border border-pink-500/20 font-semibold tracking-wide">
            v3.0
          </span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
