import React, { useEffect, useState } from 'react';
import { 
  Zap, 
  Rocket, 
  Trash2, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  FolderTree, 
  Users, 
  GraduationCap, 
  RotateCcw,
  Sparkles,
  Eraser
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

export const TestMode: React.FC = () => {
  const modal = useModal();
  const [channels, setChannels] = useState<any[]>([]);
  const [purgeChannelId, setPurgeChannelId] = useState('');
  const [purgeAmount, setPurgeAmount] = useState('50');
  const [loading, setLoading] = useState(false);
  const [deployResults, setDeployResults] = useState<string[]>([]);

  useEffect(() => {
    api.get('/guild/channels').then(res => {
      const textChannels = (res.data?.channels || []).filter((c: any) => c.type === 0);
      setChannels(textChannels);
      if (textChannels.length > 0) setPurgeChannelId(textChannels[0].id);
    }).catch(() => null);
  }, []);

  const handleDeployAll = async () => {
    const confirmed = await modal.confirm({
      title: 'Быстрое развертывание всех каналов?',
      message: 'Бот автоматически создаст категорию LOGS, каналы логирования, каналы академии, рекрутинга, сборов и интерактивные панели в Discord.',
      confirmText: 'Развернуть структуру',
      type: 'pink',
    });
    if (!confirmed) return;

    try {
      setLoading(true);
      const res = await api.post('/test-mode/deploy-all');
      setDeployResults(res.data.results || []);
      modal.alert({
        title: 'Развертывание завершено!',
        message: 'Категории и каналы успешно развернуты на сервере.',
        type: 'success',
      });
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось развернуть структуру',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePurge = async () => {
    if (!purgeChannelId) return;
    const selected = channels.find(c => c.id === purgeChannelId);

    const confirmed = await modal.confirm({
      title: 'Очистить сообщения?',
      message: `Удалить ${purgeAmount} сообщений в канале #${selected?.name || purgeChannelId}?`,
      confirmText: 'Очистить',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      setLoading(true);
      const res = await api.post('/test-mode/purge-messages', {
        channelId: purgeChannelId,
        amount: parseInt(purgeAmount, 10) || 50,
      });
      modal.alert({
        title: 'Очищено',
        message: `Успешно удалено сообщений: ${res.data.deletedCount}`,
        type: 'success',
      });
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось очистить сообщения',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWipeProfiles = async () => {
    const confirmed = await modal.confirm({
      title: 'Очистить все профили и статики?',
      message: 'Все привязанные статики, персонажи, связанные отчеты и профили пользователей будут безвозвратно удалены из базы данных!',
      confirmText: 'Удалить все профили',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      setLoading(true);
      const res = await api.post('/test-mode/wipe-profiles');
      modal.alert({
        title: 'Профили очищены',
        message: `Удалено профилей: ${res.data.count}`,
        type: 'success',
      });
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Ошибка очистки профилей',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWipeAcademy = async () => {
    const confirmed = await modal.confirm({
      title: 'Очистить данные академии?',
      message: 'Внимание: Все каналы академиков будут удалены из Discord и базы данных, а также будут удалены все сданные отчеты с мероприятий!',
      confirmText: 'Очистить академию и каналы',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      setLoading(true);
      const res = await api.post('/test-mode/wipe-academy');
      modal.alert({
        title: 'Академия очищена',
        message: `Удалено каналов в Discord: ${res.data.discordChannelsDeleted || 0}, записей в базе: ${res.data.channelsCount}, отчетов: ${res.data.reportsCount}`,
        type: 'success',
      });
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Ошибка очистки академии',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePurgeAllBotMessages = async () => {
    const confirmed = await modal.confirm({
      title: 'Удалить ВСЕ сообщения бота?',
      message: 'Бот просканирует все текстовые каналы сервера и удалит все свои отправленные сообщения (панели, уведомления, анонсы и ответы).',
      confirmText: 'Удалить все сообщения бота',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      setLoading(true);
      const res = await api.post('/test-mode/purge-all-bot-messages');
      modal.alert({
        title: 'Очистка сообщений завершена',
        message: `Успешно удалено сообщений бота: ${res.data.deletedCount} в ${res.data.channelsProcessed} каналах.`,
        type: 'success',
      });
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось удалить сообщения бота',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePurgeAllBotChannels = async () => {
    const confirmed = await modal.confirm({
      title: 'Удалить ВСЕ каналы и категории бота?',
      message: 'Бот удалит из Discord все созданные им категории (LOGS, Академия, Архив, Набор, МП, Инфо) и все входящие в них каналы, а также сбросит конфигурации привязок в базе данных.',
      confirmText: 'Удалить каналы и категории',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      setLoading(true);
      const res = await api.post('/test-mode/purge-all-bot-channels');
      modal.alert({
        title: 'Каналы удалены',
        message: `Успешно удалено из Discord: ${res.data.channelsCount} каналов и ${res.data.categoriesCount} категорий. Настройки каналов сброшены.`,
        type: 'success',
      });
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось удалить каналы бота',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFullWipe = async () => {
    const confirmed = await modal.confirm({
      title: '⚠️ ПОЛНЫЙ ВАЙП ОПЕРАТИВНЫХ ДАННЫХ БОТА',
      message: 'Вы уверены? Будут удалены каналы академиков и тикетов в Discord, а также ВСЕ профили, статики, академия, отчеты, заявки на рекрутинг, сборы на МП и отпуска! Настройки сервера и роли сохранятся.',
      confirmText: 'ДА, СДЕЛАТЬ ВАЙП',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      setLoading(true);
      await api.post('/test-mode/full-wipe');
      modal.alert({
        title: 'Полный вайп выполнен',
        message: 'Все оперативные данные бота и временные каналы Discord успешно очищены!',
        type: 'success',
      });
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Ошибка выполнения вайпа',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Zap className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                Тестовый режим
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30">
                  DEV BYPASS
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Инструменты быстрого развертывания, точечной и полной очистки сообщений, каналов и базы данных
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of test tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Tool 1: 1-Click Fast Deployment */}
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
                <Rocket className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Быстрое развертывание бота</h3>
                <p className="text-xs text-slate-400">Создание структуры в Discord за 1 клик</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 pt-1">
              Бот автоматически создаст категорию <strong>LOGS</strong> (8 каналов аудита), категории <strong>Академии</strong>, <strong>Рекрутинга</strong>, <strong>МП</strong> и опубликует интерактивные панели с кнопками.
            </p>

            {deployResults.length > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-[#0B0E14] border border-[#1E232F] space-y-1 text-[11px] text-emerald-400">
                {deployResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleDeployAll}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white rounded-xl text-xs font-semibold shadow-lg shadow-pink-600/25 transition-all disabled:opacity-50"
          >
            <Rocket className="w-4 h-4" />
            <span>{loading ? 'Развертывание...' : '1-Клик Развернуть структуру'}</span>
          </button>
        </div>

        {/* Tool 2: Bulk Message Purge (Selected Channel) */}
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Eraser className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Очистка сообщений в канале</h3>
                <p className="text-xs text-slate-400">Удаление сообщений в выбранном канале</p>
              </div>
            </div>

            <div className="space-y-3 pt-1 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Канал для очистки</label>
                <select
                  value={purgeChannelId}
                  onChange={(e) => setPurgeChannelId(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-500"
                >
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Количество сообщений (макс 100)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={purgeAmount}
                  onChange={(e) => setPurgeAmount(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handlePurge}
            disabled={loading || !purgeChannelId}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1E232F] hover:bg-rose-500/20 text-slate-200 hover:text-rose-300 border border-slate-700/40 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
          >
            <Eraser className="w-4 h-4" />
            <span>Очистить сообщения в канале</span>
          </button>
        </div>

        {/* Tool 3: Purge ALL Bot Messages Across ALL Channels */}
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Удалить ВСЕ сообщения бота</h3>
                <p className="text-xs text-slate-400">Массовая зачистка по всему серверу</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 pt-1">
              Сканирует все текстовые каналы сервера и удаляет абсолютно все сообщения бота (панели, ответы, логи, анонсы).
            </p>
          </div>

          <button
            onClick={handlePurgeAllBotMessages}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span>Удалить все сообщения бота</span>
          </button>
        </div>

        {/* Tool 4: Purge ALL Bot Channels & Categories */}
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <FolderTree className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Удалить каналы и категории</h3>
                <p className="text-xs text-slate-400">Полный сброс структуры в Discord</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 pt-1">
              Удаляет из Discord все созданные ботом категории (LOGS, Академия, Архив, Набор, МП) и каналы, сбрасывая привязки в БД.
            </p>
          </div>

          <button
            onClick={handlePurgeAllBotChannels}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
          >
            <FolderTree className="w-4 h-4" />
            <span>Удалить каналы и категории</span>
          </button>
        </div>

        {/* Tool 5: Wipe Profiles */}
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Очистить профили и статики</h3>
                <p className="text-xs text-slate-400">Сброс всех привязок и персонажей</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 pt-1">
              Безопасно удаляет записи профилей, персонажей и связанные с ними данные. Исключает ошибки внешних ключей (foreign keys).
            </p>
          </div>

          <button
            onClick={handleWipeProfiles}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1E232F] hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
          >
            <Users className="w-4 h-4" />
            <span>Очистить все профили</span>
          </button>
        </div>

        {/* Tool 6: Wipe Academy */}
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Очистить данные академии</h3>
                <p className="text-xs text-slate-400">Удаление каналов в Discord и записей в БД</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 pt-1">
              Удаляет каналы академиков прямо из Discord сервера, а также очищает все записи академии и сданные отчеты из базы данных.
            </p>
          </div>

          <button
            onClick={handleWipeAcademy}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1E232F] hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Очистить академию и каналы</span>
          </button>
        </div>
      </div>

      {/* Danger Zone: Full Bot Wipe */}
      <div className="bg-rose-950/20 border border-rose-500/30 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Опасная зона: Полный вайп бота</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Сброс всей оперативной базы данных (профили, отчеты, заявки, отпуска, сборы) к исходному состоянию
            </p>
          </div>
        </div>

        <button
          onClick={handleFullWipe}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/30 transition-all whitespace-nowrap disabled:opacity-50"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Полный сброс (Вайп)</span>
        </button>
      </div>
    </div>
  );
};

export default TestMode;
