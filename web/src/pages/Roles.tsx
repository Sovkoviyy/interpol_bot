import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, 
  Save, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  UserPlus,
  GraduationCap,
  CalendarOff,
  Swords,
  Users,
  Coins,
  Settings2,
  CheckCircle2,
  Shield
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

export interface PermFunction {
  key: string;
  name: string;
  desc: string;
}

export interface PermModule {
  id: string;
  name: string;
  icon: any;
  description: string;
  functions: PermFunction[];
}

export const PERMISSION_MODULES: PermModule[] = [
  {
    id: 'recruiting',
    name: 'Рекрутинг и Набор',
    icon: UserPlus,
    description: 'Обработка заявок кандидатов, обзвоны и прием в семью',
    functions: [
      { key: 'recruitment.claim', name: 'Взятие тикетов на рассмотрение', desc: 'Назначение себя ответственным за тикет кандидата' },
      { key: 'recruitment.interview', name: 'Вызов на голосовой обзвон', desc: 'Создание приватного голосового канала для собеседования' },
      { key: 'recruitment.approve', name: 'Одобрение кандидатов', desc: 'Прием в семью, выдача роли академика, авто-привязка статика' },
      { key: 'recruitment.reject', name: 'Отклонение кандидатов', desc: 'Закрытие тикета с причиной отказа' },
      { key: 'recruitment.deploy', name: 'Публикация панели подачи', desc: 'Отправка кнопки «Подать заявку» в канал Discord' },
    ],
  },
  {
    id: 'academy',
    name: 'Академия и Повышения (1 ➔ 2 ранг)',
    icon: GraduationCap,
    description: 'Проверка отчетов с мероприятий, штрафы и перевод в основу',
    functions: [
      { key: 'academy.reviewReports', name: 'Проверка отчетов по МП', desc: 'Одобрение и отклонение скриншотов академиков' },
      { key: 'academy.addPenalty', name: 'Начисление штрафных МП', desc: 'Добавление штрафов за нарушения правил' },
      { key: 'academy.removePenalty', name: 'Снятие штрафных МП', desc: 'Списание штрафных мероприятий' },
      { key: 'academy.promote', name: 'Повышение на 2 ранг', desc: 'Перевод в основной состав и архивация канала' },
      { key: 'academy.config', name: 'Настройки академии', desc: 'Изменение нормы МП, префиксов и категорий' },
    ],
  },
  {
    id: 'leaves',
    name: 'Отпуска и Отгулы',
    icon: CalendarOff,
    description: 'Рассмотрение уважительных причин отсутствия состава',
    functions: [
      { key: 'leave.approve', name: 'Одобрение отпусков и отгулов', desc: 'Перевод профиля бойца в статус «В отпуске»' },
      { key: 'leave.reject', name: 'Отклонение заявок', desc: 'Отказ с указанием причины' },
      { key: 'leave.deploy', name: 'Публикация кнопок в Discord', desc: 'Отправка интерактивной панели отпусков/отгулов в канал' },
      { key: 'leave.viewLogs', name: 'Просмотр журнала решений', desc: 'Доступ к истории одобрений и отказов' },
    ],
  },
  {
    id: 'events',
    name: 'Сборы на мероприятия (Капты, ВЗЗ, МЦЛ)',
    icon: Swords,
    description: 'Создание лимитированных сборов и управление составом',
    functions: [
      { key: 'events.create', name: 'Создание сборов', desc: 'Анонс сборов на Капт, ВЗЗ, МЦЛ с таймерами' },
      { key: 'events.kick', name: 'Исключение участников', desc: 'Удаление бойца из основы или резерва' },
      { key: 'events.finish', name: 'Завершение сборов', desc: 'Закрытие регистрации и архивация сбора' },
      { key: 'events.priorityConfig', name: 'Управление приоритетами', desc: 'Настройка приоритетной роли и минимального ранга' },
    ],
  },
  {
    id: 'profiles',
    name: 'Профили и Статики',
    icon: Users,
    description: 'Управление профилями (до 3 персонажей) и штрафами',
    functions: [
      { key: 'profiles.editManual', name: 'Ввод статиков вручную', desc: 'Привязка до 3 статиков и ников участникам Discord' },
      { key: 'profiles.setMain', name: 'Смена основного персонажа', desc: 'Выбор основного статика для зарплат и учета' },
      { key: 'profiles.managePenalties', name: 'Управление штрафными МП', desc: 'Списание и начисление штрафов бойцам' },
    ],
  },
  {
    id: 'payroll',
    name: 'Зарплаты и Премии рекрутерам',
    icon: Coins,
    description: 'Ведомости выплат и массовый вывод для выдачи',
    functions: [
      { key: 'payroll.calculate', name: 'Просмотр ведомостей', desc: 'Доступ к финансовой активности рекрутеров' },
      { key: 'payroll.export', name: 'Массовый экспорт (.txt)', desc: 'Генерация формата статик;сумма;коммент' },
      { key: 'payroll.configRates', name: 'Настройка тарифов', desc: 'Изменение ставок выплат за каждое действие' },
    ],
  },
  {
    id: 'system',
    name: 'Система и Администрирование',
    icon: Settings2,
    description: 'Глобальные параметры семьи, аудит логи и безопасность',
    functions: [
      { key: 'settings.logs', name: 'Управление логами', desc: 'Авто-создание категории LOGS и привязка каналов' },
      { key: 'settings.botMessages', name: 'Системные сообщения и Embed', desc: 'Кастомизация текста и шаблонов генератора Embed' },
      { key: 'settings.rbac', name: 'Управление уровнями доступа', desc: 'Настройка модульных прав для других ролей' },
    ],
  },
];

export const Roles: React.FC = () => {
  const modal = useModal();
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [selectedRoleToAdd, setSelectedRoleToAdd] = useState('');
  const [activeRoleTab, setActiveRoleTab] = useState<string>('');
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
    recruiting: true,
    academy: true,
    leaves: true,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rolesRes, permsRes] = await Promise.all([
        api.get('/guild/roles'),
        api.get('/rbac'),
      ]);
      const r = rolesRes.data.roles || [];
      const p = permsRes.data.permissions || [];
      setRoles(r);
      setPermissions(p);
      if (p.length > 0 && !activeRoleTab) {
        setActiveRoleTab(p[0].roleId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleModuleAccordion = (modId: string) => {
    setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
  };

  const handleToggleFunction = (roleId: string, funcKey: string) => {
    setPermissions(prev => prev.map(p => {
      if (p.roleId !== roleId) return p;
      const mod = { ...(p.modular || {}) };
      mod[funcKey] = !mod[funcKey];
      return { ...p, modular: mod };
    }));
  };

  const handleToggleAllInModule = (roleId: string, mod: PermModule, enable: boolean) => {
    setPermissions(prev => prev.map(p => {
      if (p.roleId !== roleId) return p;
      const m = { ...(p.modular || {}) };
      for (const fn of mod.functions) {
        m[fn.key] = enable;
      }
      return { ...p, modular: m };
    }));
  };

  const handleSaveRole = async (permRecord: any) => {
    try {
      setSavingRoleId(permRecord.roleId);
      const roleObj = roles.find(r => r.id === permRecord.roleId);

      // Map coarse permissions for backwards compatibility
      const mod = permRecord.modular || {};
      const hasRecruit = Boolean(mod['recruitment.claim'] || mod['recruitment.approve']);
      const hasEvents = Boolean(mod['events.create'] || mod['events.kick']);
      const hasSettings = Boolean(mod['settings.rbac'] || mod['settings.logs']);

      await api.post('/rbac', {
        roleId: permRecord.roleId,
        roleName: roleObj?.name || permRecord.roleName || 'Role',
        manageSettings: hasSettings,
        manageRecruiting: hasRecruit,
        manageEvents: hasEvents,
        modular: mod,
      });

      modal.alert({
        title: 'Успешно сохранено',
        message: `Модульные права для роли @${roleObj?.name || permRecord.roleName} успешно обновлены!`,
        type: 'success',
      });
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось сохранить права роли',
        type: 'error',
      });
    } finally {
      setSavingRoleId(null);
    }
  };

  const handleAddRole = async () => {
    if (!selectedRoleToAdd) return;
    const roleObj = roles.find((r) => r.id === selectedRoleToAdd);

    try {
      const defaultModular: Record<string, boolean> = {
        'recruitment.claim': true,
        'recruitment.interview': true,
        'recruitment.approve': true,
        'academy.reviewReports': true,
        'events.create': true,
      };

      await api.post('/rbac', {
        roleId: selectedRoleToAdd,
        roleName: roleObj?.name || 'Unknown',
        manageSettings: false,
        manageRecruiting: true,
        manageEvents: true,
        modular: defaultModular,
      });

      setSelectedRoleToAdd('');
      await fetchData();
      setActiveRoleTab(selectedRoleToAdd);
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Ошибка добавления роли',
        type: 'error',
      });
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    const confirmed = await modal.confirm({
      title: 'Удаление прав роли',
      message: 'Удалить права доступа для этой роли из панели управления?',
      confirmText: 'Удалить',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await api.delete(`/rbac/${roleId}`);
      await fetchData();
      if (activeRoleTab === roleId) {
        setActiveRoleTab('');
      }
    } catch (err) {
      modal.alert({
        title: 'Ошибка',
        message: 'Не удалось удалить роль',
        type: 'error',
      });
    }
  };

  const activePerm = permissions.find(p => p.roleId === activeRoleTab);
  const activeRoleObj = roles.find(r => r.id === activeRoleTab);

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-pink-500" />
            Модульные уровни доступа ролей
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Детальная настройка прав для каждой роли Discord по отдельным разделам и функциям бота
          </p>
        </div>

        {/* Add Role Control */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedRoleToAdd}
            onChange={(e) => setSelectedRoleToAdd(e.target.value)}
            className="bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
          >
            <option value="">Выберите роль Discord для добавления...</option>
            {roles
              .filter(r => !permissions.some(p => p.roleId === r.id))
              .map((r) => (
                <option key={r.id} value={r.id}>
                  @{r.name}
                </option>
              ))}
          </select>
          <button
            onClick={handleAddRole}
            disabled={!selectedRoleToAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white rounded-xl text-xs font-semibold shadow-md shadow-pink-600/20 transition-all disabled:opacity-50 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить роль</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-500 text-xs">Загрузка ролей и уровней доступа...</div>
      ) : permissions.length === 0 ? (
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-12 text-center">
          <ShieldAlert className="w-12 h-12 text-pink-500/40 mx-auto mb-3" />
          <h3 className="text-white font-semibold text-sm">Нет настроенных ролей доступа</h3>
          <p className="text-slate-400 text-xs mt-1">
            Выберите роль Discord в меню сверху и добавьте её, чтобы настроить индивидуальные модульные права.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Roles Selector Sidebar */}
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-3 space-y-1.5 lg:col-span-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3 py-2 block">
              Настроенные роли ({permissions.length})
            </span>

            {permissions.map((p) => {
              const rObj = roles.find(r => r.id === p.roleId);
              const isActive = activeRoleTab === p.roleId;
              const activeCount = Object.values(p.modular || {}).filter(Boolean).length;

              return (
                <button
                  key={p.roleId}
                  onClick={() => setActiveRoleTab(p.roleId)}
                  className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between border ${
                    isActive
                      ? 'bg-gradient-to-r from-pink-600/20 to-rose-500/20 border-pink-500/50 text-white shadow-sm'
                      : 'bg-[#0B0E14]/60 border-[#1E232F] text-slate-300 hover:bg-[#1A1F2B]'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-semibold text-xs truncate block">
                      @{rObj?.name || p.roleName}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {activeCount} функций активно
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-pink-400 translate-x-0.5' : 'text-slate-500'}`} />
                </button>
              );
            })}
          </div>

          {/* Active Role Permissions Editor */}
          {activePerm && (
            <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 lg:col-span-3 space-y-6">
              {/* Role Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-[#1E232F]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 font-bold shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      @{activeRoleObj?.name || activePerm.roleName}
                    </h2>
                    <p className="text-xs text-slate-400">
                      ID: <span className="font-mono text-slate-300">{activePerm.roleId}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteRole(activePerm.roleId)}
                    className="p-2 rounded-xl bg-[#1E232F] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                    title="Удалить роль из RBAC"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleSaveRole(activePerm)}
                    disabled={savingRoleId === activePerm.roleId}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold text-xs shadow-lg shadow-pink-600/25 transition-all disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingRoleId === activePerm.roleId ? 'Сохранение...' : 'Сохранить права роли'}</span>
                  </button>
                </div>
              </div>

              {/* Modules Matrix */}
              <div className="space-y-4">
                {PERMISSION_MODULES.map((mod) => {
                  const Icon = mod.icon;
                  const isExpanded = expandedModules[mod.id] ?? false;
                  const modFuncKeys = mod.functions.map(f => f.key);
                  const activeInModCount = modFuncKeys.filter(k => activePerm.modular?.[k]).length;
                  const isAllActive = activeInModCount === mod.functions.length;

                  return (
                    <div
                      key={mod.id}
                      className="border border-[#1E232F] bg-[#0B0E14] rounded-2xl overflow-hidden transition-all"
                    >
                      {/* Module Bar */}
                      <div className="p-4 flex items-center justify-between gap-3 bg-[#131720]/60">
                        <button
                          type="button"
                          onClick={() => handleToggleModuleAccordion(mod.id)}
                          className="flex items-center gap-3 text-left flex-1 min-w-0"
                        >
                          <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="font-bold text-white text-xs flex items-center gap-2">
                              {mod.name}
                              <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                                activeInModCount > 0 ? 'bg-pink-500/20 text-pink-300' : 'bg-slate-800 text-slate-400'
                              }`}>
                                {activeInModCount} / {mod.functions.length}
                              </span>
                            </h3>
                            <p className="text-[11px] text-slate-400 truncate">{mod.description}</p>
                          </div>
                        </button>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleAllInModule(activePerm.roleId, mod, !isAllActive)}
                            className="px-2.5 py-1 rounded-lg bg-[#1A1F2B] hover:bg-slate-700/50 text-[10px] text-slate-300 font-semibold border border-slate-700/40 transition-colors"
                          >
                            {isAllActive ? 'Снять все' : 'Выбрать все'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleModuleAccordion(mod.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Functions List */}
                      {isExpanded && (
                        <div className="p-4 pt-2 border-t border-[#1E232F] divide-y divide-[#1E232F]/60">
                          {mod.functions.map((fn) => {
                            const isChecked = Boolean(activePerm.modular?.[fn.key]);

                            return (
                              <label
                                key={fn.key}
                                className="py-2.5 flex items-start justify-between gap-3 cursor-pointer hover:bg-white/[0.02] px-2 rounded-lg transition-colors"
                              >
                                <div className="space-y-0.5">
                                  <span className="text-xs font-semibold text-slate-200 block">
                                    {fn.name}
                                  </span>
                                  <span className="text-[11px] text-slate-400 block">
                                    {fn.desc}
                                  </span>
                                </div>

                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleFunction(activePerm.roleId, fn.key)}
                                  className="w-4 h-4 rounded border-slate-700 bg-[#151921] text-pink-500 focus:ring-pink-500 focus:ring-offset-0 mt-1 cursor-pointer shrink-0"
                                />
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Roles;
