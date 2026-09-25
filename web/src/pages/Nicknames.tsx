import React, { useEffect, useState } from 'react';
import { 
  AtSign, 
  Save, 
  Plus, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Shield, 
  Zap, 
  Users, 
  Layers, 
  Edit3, 
  ExternalLink,
  Info
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

interface DiscordRole {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface RoleBinding {
  id: string;
  roleId: string;
  roleName?: string | null;
  prefix: string;
  format: string;
  priority: number;
}

interface NicknameConfig {
  enabled: boolean;
  defaultFormat: string;
  defaultPrefix: string;
  fallbackFormat: string;
}

export const Nicknames: React.FC = () => {
  const modal = useModal();
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [bindings, setBindings] = useState<RoleBinding[]>([]);
  const [config, setConfig] = useState<NicknameConfig>({
    enabled: true,
    defaultFormat: '{prefix} | {name} | {static}',
    defaultPrefix: '1',
    fallbackFormat: '{name} | {static}',
  });

  // Modal State for Add / Edit Binding
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBindingId, setEditingBindingId] = useState<string | null>(null);
  const [modalRole, setModalRole] = useState('');
  const [modalPrefix, setModalPrefix] = useState('1');
  const [modalFormat, setModalFormat] = useState('{prefix} | {name} | {static}');
  const [modalPriority, setModalPriority] = useState('10');
  const [submittingBinding, setSubmittingBinding] = useState(false);

  // Quick Single-User Tester State
  const [testUserId, setTestUserId] = useState('');
  const [manualNick, setManualNick] = useState('');
  const [testingUser, setTestingUser] = useState(false);
  const [settingManual, setSettingManual] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/nicknames/config');
      if (res.data?.config) {
        setConfig(res.data.config);
      }
      setBindings(res.data?.bindings || []);
      setRoles(res.data?.roles || []);
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка загрузки',
        message: err.response?.data?.error || 'Не удалось загрузить настройки никнеймов',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSavingConfig(true);
      await api.post('/nicknames/config', config);
      modal.alert({
        title: 'Настройки сохранены',
        message: 'Параметры авто-смены ников успешно обновлены!',
        type: 'success',
      });
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка сохранения',
        message: err.response?.data?.error || 'Не удалось сохранить настройки',
        type: 'error',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingBindingId(null);
    setModalRole(roles[0]?.id || '');
    setModalPrefix('1');
    setModalFormat(config.defaultFormat || '{prefix} | {name} | {static}');
    setModalPriority('10');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (b: RoleBinding) => {
    setEditingBindingId(b.id);
    setModalRole(b.roleId);
    setModalPrefix(b.prefix);
    setModalFormat(b.format);
    setModalPriority(String(b.priority));
    setIsModalOpen(true);
  };

  const handleSaveBinding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalRole) {
      modal.alert({ title: 'Ошибка', message: 'Выберите Discord роль', type: 'error' });
      return;
    }
    if (!modalPrefix.trim()) {
      modal.alert({ title: 'Ошибка', message: 'Укажите префикс (например: 1 или [Академик])', type: 'error' });
      return;
    }

    try {
      setSubmittingBinding(true);
      await api.post('/nicknames/bindings', {
        id: editingBindingId || undefined,
        roleId: modalRole,
        prefix: modalPrefix.trim(),
        format: modalFormat.trim(),
        priority: parseInt(modalPriority, 10) || 0,
      });

      setIsModalOpen(false);
      fetchData();
      modal.alert({
        title: 'Успешно',
        message: editingBindingId ? 'Бинд роли обновлен' : 'Новый бинд роли добавлен',
        type: 'success',
      });
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось сохранить бинд роли',
        type: 'error',
      });
    } finally {
      setSubmittingBinding(false);
    }
  };

  const handleDeleteBinding = async (b: RoleBinding) => {
    const roleName = roles.find(r => r.id === b.roleId)?.name || b.roleName || b.roleId;
    const confirmed = await modal.confirm({
      title: 'Удалить бинд роли?',
      message: `Удалить привязку префикса «${b.prefix}» для роли @${roleName}?`,
      confirmText: 'Удалить',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await api.delete(`/nicknames/bindings/${b.id}`);
      setBindings(prev => prev.filter(item => item.id !== b.id));
      modal.alert({ title: 'Удалено', message: 'Бинд роли удален', type: 'success' });
    } catch (err: any) {
      modal.alert({ title: 'Ошибка', message: err.response?.data?.error || 'Не удалось удалить бинд', type: 'error' });
    }
  };

  const handleSyncAll = async () => {
    const confirmed = await modal.confirm({
      title: 'Массовая синхронизация ников',
      message: 'Запустить проверку и автоматическую смену никнеймов для всех участников сервера по привязанным ролям и профилям?',
      confirmText: 'Запустить',
      type: 'pink',
    });
    if (!confirmed) return;

    try {
      setSyncingAll(true);
      const res = await api.post('/nicknames/sync-all');
      const stats = res.data?.stats;
      modal.alert({
        title: 'Синхронизация завершена',
        message: `Всего проверено: ${stats?.total || 0} участников.\n` +
                 `Обновлено ников: ${stats?.updated || 0}\n` +
                 `Пропущено (уже актуальны): ${stats?.skipped || 0}\n` +
                 (stats?.errors ? `Ошибок прав (выше бота): ${stats.errors}` : ''),
        type: 'success',
      });
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка синхронизации',
        message: err.response?.data?.error || 'Не удалось синхронизировать ники',
        type: 'error',
      });
    } finally {
      setSyncingAll(false);
    }
  };

  const handleSyncSingle = async () => {
    if (!testUserId.trim()) {
      modal.alert({ title: 'Укажите ID', message: 'Введите Discord ID участника', type: 'error' });
      return;
    }

    try {
      setTestingUser(true);
      const res = await api.post(`/nicknames/sync/${testUserId.trim()}`);
      const r = res.data?.result;
      if (r?.updated) {
        modal.alert({
          title: 'Никнейм обновлен!',
          message: `Старый ник: ${r.oldNick || 'Стандартный'}\nНовый ник: ${r.newNick}`,
          type: 'success',
        });
      } else {
        modal.alert({
          title: 'Синхронизация не потребовалась',
          message: r?.reason || 'Никнейм участника уже соответствует шаблону роли.',
          type: 'info',
        });
      }
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось синхронизировать ник',
        type: 'error',
      });
    } finally {
      setTestingUser(false);
    }
  };

  const handleManualSet = async () => {
    if (!testUserId.trim() || !manualNick.trim()) {
      modal.alert({ title: 'Заполните поля', message: 'Укажите Discord ID участника и желаемый ник', type: 'error' });
      return;
    }

    try {
      setSettingManual(true);
      await api.post(`/nicknames/manual/${testUserId.trim()}`, { nickname: manualNick.trim() });
      modal.alert({
        title: 'Никнейм установлен!',
        message: `Участнику ${testUserId} успешно установлен ник: «${manualNick.trim()}»`,
        type: 'success',
      });
      setManualNick('');
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка установки',
        message: err.response?.data?.error || 'Не удалось изменить ник',
        type: 'error',
      });
    } finally {
      setSettingManual(false);
    }
  };

  // Live example computation
  const previewSample = config.defaultFormat
    .replace('{prefix}', config.defaultPrefix || '1')
    .replace('{name}', 'Richard Miller')
    .replace('{static}', '12345');

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin text-pink-500 mb-2" />
        Загрузка конфигурации авто-никнеймов...
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <AtSign className="w-6 h-6 text-pink-500" />
            Авто-Никнеймы & Бинды ролей
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Автоматическая смена никнеймов в Discord в зависимости от ролей, привязка к основному игровому профилю и статикам
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSyncAll}
            disabled={syncingAll}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#151922] hover:bg-pink-500/20 text-slate-200 hover:text-pink-300 border border-[#1E232F] font-semibold text-xs transition-all disabled:opacity-50"
          >
            <Zap className={`w-4 h-4 ${syncingAll ? 'animate-spin text-pink-400' : 'text-pink-500'}`} />
            <span>{syncingAll ? 'Синхронизация...' : 'Синхронизировать всех'}</span>
          </button>

          <button
            onClick={() => handleSaveConfig()}
            disabled={savingConfig}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold text-xs shadow-lg shadow-pink-600/25 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingConfig ? 'Сохранение...' : 'Сохранить настройки'}</span>
          </button>
        </div>
      </div>

      {/* Section 1: General Auto-Nickname Switch & Format */}
      <div className="bg-[#0B0E14] border border-[#1E232F] hover:border-pink-500/30 rounded-2xl p-6 transition-all shadow-xl space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-[#1E232F]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Автоматическая смена никнеймов</h2>
              <p className="text-xs text-slate-400">
                При выдаче роли, регистрации или смене основного статика бот синхронизирует ник в Discord
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[#151922] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
          </label>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${!config.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Основной шаблон никнейма
            </label>
            <input
              type="text"
              value={config.defaultFormat}
              onChange={(e) => setConfig({ ...config, defaultFormat: e.target.value })}
              className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:border-pink-500/50"
              placeholder="{prefix} | {name} | {static}"
            />
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400">
              <Info className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
              <span>Теги: <code className="text-pink-400 bg-pink-500/10 px-1 rounded">{"{prefix}"}</code> — префикс роли/ранг, <code className="text-pink-400 bg-pink-500/10 px-1 rounded">{"{name}"}</code> — имя из профиля, <code className="text-pink-400 bg-pink-500/10 px-1 rounded">{"{static}"}</code> — основной статик.</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Префикс по умолчанию
            </label>
            <input
              type="text"
              value={config.defaultPrefix}
              onChange={(e) => setConfig({ ...config, defaultPrefix: e.target.value })}
              className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50 font-mono"
              placeholder="1"
            />
          </div>
        </div>

        {/* Live Preview Card */}
        <div className="p-4 rounded-xl bg-[#151922] border border-[#1E232F] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Пример отображения в Discord (по основному шаблону):
            </span>
            <div className="text-sm font-bold text-white mt-1 flex items-center gap-2">
              <span className="text-pink-400 font-mono">{previewSample}</span>
              <span className="text-[11px] font-normal text-slate-500">
                ({previewSample.length}/32 симв.)
              </span>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            Всегда подтягивается <span className="text-slate-200 font-semibold">основной статик</span> из профиля
          </div>
        </div>
      </div>

      {/* Section 2: Role Bindings Table */}
      <div className="bg-[#0B0E14] border border-[#1E232F] hover:border-pink-500/30 rounded-2xl p-6 transition-all shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1E232F]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Бинды ролей к префиксам (Ранги)</h2>
              <p className="text-xs text-slate-400">
                Настройте, какой префикс/ранг присваивается человеку при наличии конкретной роли в Discord
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-semibold text-xs transition-all shadow-lg shadow-pink-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить бинд роли</span>
          </button>
        </div>

        {bindings.length === 0 ? (
          <div className="py-12 text-center text-slate-500 border border-dashed border-[#1E232F] rounded-xl">
            <Layers className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
            <p className="text-xs">У вас пока нет настроенных биндов ролей.</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Нажмите «Добавить бинд роли», чтобы задать префикс для роли «Академик», «Офицер» и других.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1E232F] text-slate-400 text-[11px] uppercase tracking-wider">
                  <th className="pb-3 font-semibold">Роль в Discord</th>
                  <th className="pb-3 font-semibold">Префикс</th>
                  <th className="pb-3 font-semibold">Шаблон никнейма</th>
                  <th className="pb-3 font-semibold text-center">Приоритет</th>
                  <th className="pb-3 font-semibold text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E232F]/50">
                {bindings.map((b) => {
                  const roleObj = roles.find(r => r.id === b.roleId);
                  const roleName = roleObj?.name || b.roleName || b.roleId;
                  const roleColor = roleObj?.color && roleObj.color !== '#000000' ? roleObj.color : '#EC4899';

                  return (
                    <tr key={b.id} className="hover:bg-[#151922]/50 transition-colors">
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: roleColor }}
                          />
                          <span className="font-semibold text-white">@{roleName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({b.roleId})</span>
                        </div>
                      </td>
                      <td className="py-3.5 pr-4 font-mono font-bold text-pink-400">
                        {b.prefix}
                      </td>
                      <td className="py-3.5 pr-4 font-mono text-slate-300">
                        {b.format}
                      </td>
                      <td className="py-3.5 pr-4 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-[#151922] border border-[#1E232F] font-mono text-slate-300 text-[11px]">
                          {b.priority}
                        </span>
                      </td>
                      <td className="py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(b)}
                            className="p-1.5 rounded-lg bg-[#151922] hover:bg-pink-500/20 text-slate-400 hover:text-pink-300 transition-colors"
                            title="Редактировать"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteBinding(b)}
                            className="p-1.5 rounded-lg bg-[#151922] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Удалить"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3: Manual & Single Member Nickname Sync */}
      <div className="bg-[#0B0E14] border border-[#1E232F] hover:border-pink-500/30 rounded-2xl p-6 transition-all shadow-xl space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-[#1E232F]">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Ручная смена ника & Быстрая синхронизация</h2>
            <p className="text-xs text-slate-400">
              Проверка и смена ника для конкретного участника по его Discord ID
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Discord ID участника
            </label>
            <input
              type="text"
              value={testUserId}
              onChange={(e) => setTestUserId(e.target.value)}
              className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50 font-mono"
              placeholder="Например: 123456789012345678"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={handleSyncSingle}
              disabled={testingUser || !testUserId.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#151922] hover:bg-pink-500/20 text-slate-200 hover:text-pink-300 border border-[#1E232F] text-xs font-semibold transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingUser ? 'animate-spin' : ''}`} />
              <span>{testingUser ? 'Синхронизация...' : 'Синхронизировать по роли'}</span>
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-[#1E232F] grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Или установить произвольный ник вручную
            </label>
            <input
              type="text"
              value={manualNick}
              onChange={(e) => setManualNick(e.target.value)}
              className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50"
              placeholder="1 | Richard Miller | 12345"
              maxLength={32}
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleManualSet}
              disabled={settingManual || !testUserId.trim() || !manualNick.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold transition-all disabled:opacity-50 shadow-lg shadow-pink-600/20"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{settingManual ? 'Установка...' : 'Установить ник'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Add / Edit Binding */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0B0E14] border border-[#1E232F] rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E232F]">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-pink-400" />
                <h3 className="text-base font-bold text-white">
                  {editingBindingId ? 'Редактировать бинд роли' : 'Добавить бинд роли'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBinding} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Выберите Discord роль *
                </label>
                <select
                  value={modalRole}
                  onChange={(e) => setModalRole(e.target.value)}
                  className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50"
                  required
                >
                  <option value="">Выберите роль...</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      @{r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Префикс роли (Ранг) *
                  </label>
                  <input
                    type="text"
                    value={modalPrefix}
                    onChange={(e) => setModalPrefix(e.target.value)}
                    className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50 font-mono"
                    placeholder="1 или [Академик]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Приоритет
                  </label>
                  <input
                    type="number"
                    value={modalPriority}
                    onChange={(e) => setModalPriority(e.target.value)}
                    className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50"
                    placeholder="10"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Чем выше, тем главнее
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Шаблон никнейма для этой роли
                </label>
                <input
                  type="text"
                  value={modalFormat}
                  onChange={(e) => setModalFormat(e.target.value)}
                  className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50 font-mono"
                  placeholder="{prefix} | {name} | {static}"
                />
              </div>

              <div className="p-3 rounded-lg bg-[#151922] border border-[#1E232F] text-[11px] text-slate-300">
                <span className="text-slate-400 block mb-1">Пример для игрока Richard Miller (12345):</span>
                <span className="font-mono text-pink-400 font-bold">
                  {modalFormat.replace('{prefix}', modalPrefix).replace('{name}', 'Richard Miller').replace('{static}', '12345')}
                </span>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#1E232F]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#151922] hover:bg-[#1E232F] text-slate-300 text-xs font-semibold transition-all"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={submittingBinding}
                  className="px-5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold shadow-lg shadow-pink-600/25 transition-all disabled:opacity-50"
                >
                  {submittingBinding ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Nicknames;
