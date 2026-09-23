import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Save, 
  Camera, 
  Clock, 
  Layers, 
  AlertTriangle 
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

export const AntiNuke: React.FC = () => {
  const modal = useModal();
  const [tab, setTab] = useState<'security' | 'snapshots'>('security');
  const [config, setConfig] = useState<any>({
    enabled: true,
    restoreDeletedChannels: true,
    stripOffenderRoles: true,
    notifyOwner: true,
    alertChannelId: '',
  });
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cfgRes, snapRes] = await Promise.all([
        api.get('/anti-nuke/config'),
        api.get('/anti-nuke/snapshots'),
      ]);
      if (cfgRes.data.config) setConfig(cfgRes.data.config);
      setSnapshots(snapRes.data.snapshots || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-pink-500" />
            Защита сервера (Anti-Nuke)
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Анти-краш защита каналов, автоматическое снятие прав с нарушителей и резервные снимки структуры сервера
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
    </div>
  );
};

export default AntiNuke;
