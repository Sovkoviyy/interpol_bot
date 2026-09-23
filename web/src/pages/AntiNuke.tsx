import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Save, 
  Camera, 
  UserX, 
  Plus, 
  Trash2, 
  Search, 
  ExternalLink,
  Clock,
  Layers,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

export const AntiNuke: React.FC = () => {
  const modal = useModal();
  const [tab, setTab] = useState<'security' | 'snapshots' | 'blacklist'>('security');
  const [config, setConfig] = useState<any>({
    enabled: true,
    restoreDeletedChannels: true,
    stripOffenderRoles: true,
    notifyOwner: true,
    alertChannelId: '',
  });
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [blacklist, setBlacklist] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cfgRes, snapRes, blRes] = await Promise.all([
        api.get('/anti-nuke/config'),
        api.get('/anti-nuke/snapshots'),
        api.get(`/blacklist?search=${encodeURIComponent(search)}`),
      ]);
      if (cfgRes.data.config) setConfig(cfgRes.data.config);
      setSnapshots(snapRes.data.snapshots || []);
      setBlacklist(blRes.data.entries || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search]);

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      await api.post('/anti-nuke/config', config);
      modal.alert({
        title: 'Успешно',
        message: 'Настройки Anti-Nuke защиты сохранены!',
        type: 'success',
      });
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось сохранить настройки',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSnapshot = () => {
    modal.form({
      title: 'Создать снимок структуры сервера',
      message: 'Бот сохранит текущую иерархию категорий, каналов и ролей для быстрого отката в случае ЧП.',
      fields: [
        {
          name: 'name',
          label: 'Название бэкапа',
          placeholder: 'Например: Перед набором или Стабильный слепок',
          required: true,
          defaultValue: `Бэкап ${new Date().toLocaleDateString('ru-RU')}`,
        },
      ],
      submitText: 'Сделать снимок',
      onSubmit: async (values) => {
        try {
          await api.post('/anti-nuke/snapshots', { name: values.name });
          modal.alert({
            title: 'Снимок создан',
            message: 'Снимок структуры каналов и прав успешно сохранен!',
            type: 'success',
          });
          fetchData();
        } catch (err: any) {
          modal.alert({
            title: 'Ошибка создания снимка',
            message: err.response?.data?.error || 'Произошла ошибка при сканировании сервера',
            type: 'error',
          });
        }
      },
    });
  };

  const handleAddBlacklist = () => {
    modal.form({
      title: 'Внести нарушителя в ЧС',
      message: 'Заполните данные игрока. По этим данным бот сможет проверять кандидатов на наборе и блокировать вход.',
      fields: [
        {
          name: 'staticId',
          label: 'Majestic Static ID',
          placeholder: 'Например: 142055',
          required: true,
        },
        {
          name: 'discordId',
          label: 'Discord ID (если известен)',
          placeholder: 'Например: 492019482718291024',
        },
        {
          name: 'name',
          label: 'Имя / Никнейм персонажа',
          placeholder: 'Например: Tony Montana',
        },
        {
          name: 'reason',
          label: 'Причина занесения в ЧС',
          placeholder: 'Слив склада, неадекват, обман на наборе...',
          required: true,
        },
        {
          name: 'proofUrl',
          label: 'Ссылка на доказательства / откат / скрин',
          placeholder: 'https://imgur.com/... или https://youtube.com/...',
        },
      ],
      submitText: 'Внести в ЧС',
      onSubmit: async (values) => {
        try {
          await api.post('/blacklist', values);
          modal.alert({
            title: 'Внесен в ЧС',
            message: `Игрок со статиком ${values.staticId} добавлен в черный список семьи.`,
            type: 'success',
          });
          fetchData();
        } catch (err: any) {
          modal.alert({
            title: 'Ошибка',
            message: err.response?.data?.error || 'Не удалось добавить запись',
            type: 'error',
          });
        }
      },
    });
  };

  const handleDeleteBlacklist = (entry: any) => {
    modal.confirm({
      title: 'Удалить из ЧС?',
      message: `Вы уверены, что хотите снять ЧС со статика ${entry.staticId} (${entry.name || 'Без имени'})?`,
      type: 'danger',
      confirmText: 'Да, удалить из ЧС',
      onConfirm: async () => {
        try {
          await api.delete(`/blacklist/${entry.id}`);
          modal.alert({
            title: 'Удалено',
            message: 'Запись успешно удалена из черного списка.',
            type: 'success',
          });
          fetchData();
        } catch (err: any) {
          modal.alert({
            title: 'Ошибка',
            message: err.response?.data?.error || 'Не удалось удалить запись',
            type: 'error',
          });
        }
      },
    });
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-pink-500" />
            Защита сервера & Черный список (ЧС)
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Анти-краш защита каналов, автоматическое снятие прав с нарушителей, резервные копии и ЧС
          </p>
        </div>
        <div className="flex items-center gap-3">
          {tab === 'snapshots' && (
            <button
              onClick={handleCreateSnapshot}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-pink-500/20"
            >
              <Camera className="w-4 h-4" />
              Сделать снимок
            </button>
          )}
          {tab === 'blacklist' && (
            <button
              onClick={handleAddBlacklist}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-pink-500/20"
            >
              <Plus className="w-4 h-4" />
              Добавить в ЧС
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-800 gap-2">
        <button
          onClick={() => setTab('security')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
            tab === 'security'
              ? 'border-pink-500 text-pink-500'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Настройки защиты
        </button>
        <button
          onClick={() => setTab('snapshots')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
            tab === 'snapshots'
              ? 'border-pink-500 text-pink-500'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          Резервные копии ({snapshots.length})
        </button>
        <button
          onClick={() => setTab('blacklist')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
            tab === 'blacklist'
              ? 'border-pink-500 text-pink-500'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <UserX className="w-4 h-4" />
          Черный список ({blacklist.length})
        </button>
      </div>

      {/* Security Tab */}
      {tab === 'security' && (
        <div className="bg-dark-900/60 border border-dark-800 rounded-2xl p-6 backdrop-blur-sm space-y-6">
          <div className="flex items-start gap-4 p-4 bg-pink-500/10 border border-pink-500/20 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-pink-500 shrink-0 mt-0.5" />
            <div className="text-xs text-pink-200/90 leading-relaxed">
              <strong className="text-pink-400 font-semibold block mb-0.5">Как работает Anti-Nuke:</strong>
              Если любой администратор или взломанный аккаунт удаляет канал, бот мгновенно считывает аудит Discord,
              снимает абсолютно все роли с нарушителя, уведомляет владельца и автоматически пересоздает удаленный канал
              с прежним названием, категорией, позицией и правами доступа.
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-dark-800/40 rounded-xl border border-dark-800">
              <div>
                <p className="text-sm font-medium text-white">Включить общую Anti-Nuke защиту</p>
                <p className="text-xs text-gray-400">Мониторинг событий удаления и быстрый перехват</p>
              </div>
              <button
                type="button"
                onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${
                  config.enabled ? 'bg-pink-600' : 'bg-dark-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out mt-0.5 ${
                    config.enabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-dark-800/40 rounded-xl border border-dark-800">
              <div>
                <p className="text-sm font-medium text-white">Мгновенный откат (авто-восстановление) каналов</p>
                <p className="text-xs text-gray-400">Пересоздавать удаленный канал с сохранением структуры и прав</p>
              </div>
              <button
                type="button"
                onClick={() => setConfig({ ...config, restoreDeletedChannels: !config.restoreDeletedChannels })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${
                  config.restoreDeletedChannels ? 'bg-pink-600' : 'bg-dark-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out mt-0.5 ${
                    config.restoreDeletedChannels ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-dark-800/40 rounded-xl border border-dark-800">
              <div>
                <p className="text-sm font-medium text-white">Снимать все роли с нарушителя</p>
                <p className="text-xs text-gray-400">Бот полностью изолирует инициатора слива от всех прав сервера</p>
              </div>
              <button
                type="button"
                onClick={() => setConfig({ ...config, stripOffenderRoles: !config.stripOffenderRoles })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${
                  config.stripOffenderRoles ? 'bg-pink-600' : 'bg-dark-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out mt-0.5 ${
                    config.stripOffenderRoles ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-dark-800/40 rounded-xl border border-dark-800">
              <div>
                <p className="text-sm font-medium text-white">Экстренное ЛС владельцу сервера</p>
                <p className="text-xs text-gray-400">Отправка личного сообщения владельцу гильдии при атаке</p>
              </div>
              <button
                type="button"
                onClick={() => setConfig({ ...config, notifyOwner: !config.notifyOwner })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${
                  config.notifyOwner ? 'bg-pink-600' : 'bg-dark-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out mt-0.5 ${
                    config.notifyOwner ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                ID Канала тревожных оповещений
              </label>
              <input
                type="text"
                value={config.alertChannelId || ''}
                onChange={(e) => setConfig({ ...config, alertChannelId: e.target.value })}
                placeholder="Например: 123456789012345678"
                className="w-full bg-dark-800/80 border border-dark-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 transition-colors"
              />
              <p className="text-xs text-gray-500 mt-1">Куда бот отправит уведомление о перехвате удаленного канала</p>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-dark-800">
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-pink-500/20 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Сохранение...' : 'Сохранить настройки защиты'}
            </button>
          </div>
        </div>
      )}

      {/* Snapshots Tab */}
      {tab === 'snapshots' && (
        <div className="space-y-4">
          <div className="bg-dark-900/60 border border-dark-800 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">Сохраненные снимки сервера</h2>
              <span className="text-xs text-gray-400">Всего слепков: {snapshots.length}</span>
            </div>

            {loading ? (
              <div className="text-center py-10 text-gray-500 text-sm">Загрузка снимков...</div>
            ) : snapshots.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-dark-800 rounded-xl">
                <Camera className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Резервных снимков пока нет</p>
                <p className="text-xs text-gray-500 mt-1">Нажмите «Сделать снимок», чтобы зафиксировать структуру</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {snapshots.map((snap) => {
                  let payload: any = {};
                  try {
                    payload = typeof snap.payload === 'string' ? JSON.parse(snap.payload) : snap.payload;
                  } catch (e) {}

                  return (
                    <div
                      key={snap.id}
                      className="p-4 bg-dark-800/40 rounded-xl border border-dark-800 hover:border-pink-500/30 transition-colors space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-white text-sm">{snap.name}</h3>
                          <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(snap.createdAt).toLocaleString('ru-RU')}
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-pink-500/10 text-pink-400 border border-pink-500/20 rounded-lg text-xs font-medium">
                          Снимок OK
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-dark-900/50 p-2.5 rounded-lg border border-dark-800">
                        <div>
                          <span className="text-gray-500 block">Каналов в снимке:</span>
                          <span className="text-white font-medium">{payload?.channels?.length || 0}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Ролей в снимке:</span>
                          <span className="text-white font-medium">{payload?.roles?.length || 0}</span>
                        </div>
                      </div>

                      <div className="text-xs text-gray-500">
                        Создатель: <span className="text-gray-300">{snap.createdByTag}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Blacklist Tab */}
      {tab === 'blacklist' && (
        <div className="bg-dark-900/60 border border-dark-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по статику, нику или Discord ID..."
                className="w-full bg-dark-800/80 border border-dark-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 transition-colors"
              />
            </div>
            <span className="text-xs text-gray-400">Найдено записей: {blacklist.length}</span>
          </div>

          {loading ? (
            <div className="text-center py-10 text-gray-500 text-sm">Загрузка черного списка...</div>
          ) : blacklist.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-dark-800 rounded-xl">
              <UserX className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Черный список пуст</p>
              <p className="text-xs text-gray-500 mt-1">Добавьте нарушителей с помощью кнопки сверху</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-xs text-gray-400 uppercase bg-dark-800/50 border-b border-dark-800">
                  <tr>
                    <th className="px-4 py-3">Статик / Персонаж</th>
                    <th className="px-4 py-3">Discord ID</th>
                    <th className="px-4 py-3">Причина</th>
                    <th className="px-4 py-3">Док-ва</th>
                    <th className="px-4 py-3">Кем внесен</th>
                    <th className="px-4 py-3 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-800">
                  {blacklist.map((entry) => (
                    <tr key={entry.id} className="hover:bg-dark-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-pink-400 font-mono">#{entry.staticId}</div>
                        {entry.name && <div className="text-xs text-gray-400">{entry.name}</div>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">
                        {entry.discordId || '—'}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-gray-200" title={entry.reason}>
                        {entry.reason}
                      </td>
                      <td className="px-4 py-3">
                        {entry.proofUrl ? (
                          <a
                            href={entry.proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300 underline"
                          >
                            Пруф <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        <div>{entry.addedByTag}</div>
                        <div className="text-[10px] text-gray-500">
                          {new Date(entry.createdAt).toLocaleDateString('ru-RU')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteBlacklist(entry)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Снять ЧС"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AntiNuke;
