import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  MessageSquare, 
  Send, 
  Save, 
  Sparkles, 
  Gamepad2, 
  UserCheck, 
  UserX, 
  Ticket, 
  Info,
  CheckCircle2,
  RefreshCw,
  Layers,
  ExternalLink
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

interface CustomTemplate {
  id: string;
  name: string;
  title?: string | null;
  description?: string | null;
  color?: string;
}

interface BotMessagesForm {
  welcomeEnabled: boolean;
  welcomeChannelId: string;
  welcomeTitle: string;
  welcomeMessage: string;
  welcomeEmbedColor: string;
  welcomeTemplateId: string;

  leaveEnabled: boolean;
  leaveChannelId: string;
  leaveMessage: string;
  leaveTemplateId: string;

  ticketGreetingTitle: string;
  ticketGreetingDesc: string;
  ticketTemplateId: string;

  botStatusText: string;
  botStatusActivity: string;
}

export const BotMessages: React.FC = () => {
  const modal = useModal();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [templates, setTemplates] = useState<CustomTemplate[]>([]);

  const [form, setForm] = useState<BotMessagesForm>({
    welcomeEnabled: false,
    welcomeChannelId: '',
    welcomeTitle: 'Добро пожаловать в семью, {user}!',
    welcomeMessage: 'Рады приветствовать тебя на нашем сервере {guild}! Ознакомься с правилами и подай заявку в семью.',
    welcomeEmbedColor: '#EC4899',
    welcomeTemplateId: '',

    leaveEnabled: false,
    leaveChannelId: '',
    leaveMessage: '{user} покинул наш сервер.',
    leaveTemplateId: '',

    ticketGreetingTitle: 'Заявка в семью INTERPOL',
    ticketGreetingDesc: 'Приветствуем, {user}!\nВаша анкета получена. Ожидайте рассмотрения рекрутерами семьи.\nНе забудьте подготовить скриншоты статистики.',
    ticketTemplateId: '',

    botStatusText: 'Interpol • /event',
    botStatusActivity: 'PLAYING',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cfgRes, chRes] = await Promise.all([
        api.get('/bot-messages'),
        api.get('/guild/channels'),
      ]);
      if (cfgRes.data?.config) {
        setForm((prev: BotMessagesForm) => ({
          ...prev,
          ...cfgRes.data.config,
          welcomeTemplateId: cfgRes.data.config.welcomeTemplateId || '',
          leaveTemplateId: cfgRes.data.config.leaveTemplateId || '',
          ticketTemplateId: cfgRes.data.config.ticketTemplateId || '',
        }));
      }
      setTemplates(cfgRes.data?.templates || []);
      setChannels(chRes.data?.channels || []);
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка загрузки',
        message: err.response?.data?.error || 'Не удалось загрузить настройки сообщений',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post('/bot-messages', form);
      modal.alert({
        title: 'Успешно сохранено',
        message: 'Настройки сообщений и статус бота в Discord успешно обновлены!',
        type: 'success',
      });
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка сохранения',
        message: err.response?.data?.error || 'Не удалось сохранить настройки',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async (type: 'welcome' | 'leave') => {
    const targetChannelId = type === 'welcome' ? form.welcomeChannelId : form.leaveChannelId;
    if (!targetChannelId) {
      modal.alert({
        title: 'Канал не выбран',
        message: `Пожалуйста, выберите канал для отправки сообщения в блоке «${type === 'welcome' ? 'Приветствие' : 'Прощание'}»!`,
        type: 'error',
      });
      return;
    }

    const confirmed = await modal.confirm({
      title: 'Тестовая отправка',
      message: `Отправить тестовый образец в выбранный канал Discord?`,
      confirmText: 'Отправить',
      type: 'pink',
    });

    if (!confirmed) return;

    try {
      setTesting(true);
      await api.post('/bot-messages/test', { type, channelId: targetChannelId });
      modal.alert({
        title: 'Отправлено!',
        message: 'Тестовое сообщение успешно отправлено в Discord.',
        type: 'success',
      });
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка отправки',
        message: err.response?.data?.error || 'Не удалось отправить сообщение',
        type: 'error',
      });
    } finally {
      setTesting(false);
    }
  };

  const textChannels = channels.filter((c) => c.type === 0);

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin text-pink-500 mb-2" />
        Загрузка параметров сообщений...
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <MessageSquare className="w-6 h-6 text-pink-500" />
            Сообщения бота & Статус
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Настройка автоматических приветствий, прощаний, сообщений в тикетах и активности Discord
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold text-xs shadow-lg shadow-pink-600/25 transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Сохранение...' : 'Сохранить всё'}</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Welcome message */}
        <div className="bg-[#0B0E14] border border-[#1E232F] hover:border-pink-500/30 rounded-2xl p-6 transition-all shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-[#1E232F] mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-pink-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Приветствие новых участников (Welcome)</h2>
                <p className="text-xs text-slate-400">Бот отправляет красивый Embed при входе игрока на сервер</p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.welcomeEnabled}
                onChange={(e) => setForm({ ...form, welcomeEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#151922] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
            </label>
          </div>

          <div className={`space-y-4 ${!form.welcomeEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Канал для приветствий *
                </label>
                <select
                  value={form.welcomeChannelId || ''}
                  onChange={(e) => setForm({ ...form, welcomeChannelId: e.target.value })}
                  className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50"
                >
                  <option value="">Выберите канал...</option>
                  {textChannels.map((c) => (
                    <option key={c.id} value={c.id}>#{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Шаблон из Конструктора Embed
                </label>
                <select
                  value={form.welcomeTemplateId || ''}
                  onChange={(e) => setForm({ ...form, welcomeTemplateId: e.target.value })}
                  className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50"
                >
                  <option value="">Не использовать (стандартный текст)</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} {tpl.title ? `— ${tpl.title}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {form.welcomeTemplateId ? (
              <div className="p-3.5 bg-pink-500/10 border border-pink-500/20 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-2.5 h-9 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: templates.find(t => t.id === form.welcomeTemplateId)?.color || '#EC4899' }} 
                  />
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                      Активный Embed: <span className="text-pink-300">{templates.find(t => t.id === form.welcomeTemplateId)?.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                      {templates.find(t => t.id === form.welcomeTemplateId)?.title || 'Без заголовка'} • Переменные {'{user}'}, {'{guild}'}, {'{memberCount}'} поддерживаются автоматически
                    </p>
                  </div>
                </div>
                <Link
                  to="/embeds"
                  className="flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300 font-semibold px-3 py-1.5 bg-[#0B0E14] border border-pink-500/30 rounded-lg transition-all flex-shrink-0"
                >
                  <span>Генератор Embed</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Заголовок Embed карточки
                    </label>
                    <input
                      type="text"
                      value={form.welcomeTitle}
                      onChange={(e) => setForm({ ...form, welcomeTitle: e.target.value })}
                      className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50"
                      placeholder="Добро пожаловать в семью, {user}!"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Цвет полоски
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.welcomeEmbedColor || '#EC4899'}
                        onChange={(e) => setForm({ ...form, welcomeEmbedColor: e.target.value })}
                        className="w-10 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                      <input
                        type="text"
                        value={form.welcomeEmbedColor || '#EC4899'}
                        onChange={(e) => setForm({ ...form, welcomeEmbedColor: e.target.value })}
                        className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Текст сообщения
                  </label>
                  <textarea
                    rows={3}
                    value={form.welcomeMessage}
                    onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
                    className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50 leading-relaxed"
                  />
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                    <Info className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
                    <span>Доступные теги: <code className="text-pink-400 bg-pink-500/10 px-1 rounded">{"{user}"}</code> — участник, <code className="text-pink-400 bg-pink-500/10 px-1 rounded">{"{guild}"}</code> — название сервера, <code className="text-pink-400 bg-pink-500/10 px-1 rounded">{"{memberCount}"}</code> — число участников.</span>
                  </div>
                </div>
              </>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => handleTestSend('welcome')}
                disabled={testing || !form.welcomeChannelId}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#151922] hover:bg-pink-500/20 text-slate-300 hover:text-pink-300 border border-[#1E232F] text-xs font-medium transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{testing ? 'Отправка...' : 'Отправить тестовое приветствие'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Leave message */}
        <div className="bg-[#0B0E14] border border-[#1E232F] hover:border-pink-500/30 rounded-2xl p-6 transition-all shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-[#1E232F] mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <UserX className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Прощание с участниками (Leave)</h2>
                <p className="text-xs text-slate-400">Оповещение о выходе человека с Discord-сервера</p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.leaveEnabled}
                onChange={(e) => setForm({ ...form, leaveEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#151922] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
            </label>
          </div>

          <div className={`space-y-4 ${!form.leaveEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Канал для сообщений о выходе *
                </label>
                <select
                  value={form.leaveChannelId || ''}
                  onChange={(e) => setForm({ ...form, leaveChannelId: e.target.value })}
                  className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50"
                >
                  <option value="">Выберите канал...</option>
                  {textChannels.map((c) => (
                    <option key={c.id} value={c.id}>#{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Шаблон из Конструктора Embed
                </label>
                <select
                  value={form.leaveTemplateId || ''}
                  onChange={(e) => setForm({ ...form, leaveTemplateId: e.target.value })}
                  className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50"
                >
                  <option value="">Не использовать (стандартный текст)</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} {tpl.title ? `— ${tpl.title}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {form.leaveTemplateId ? (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-2.5 h-9 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: templates.find(t => t.id === form.leaveTemplateId)?.color || '#F43F5E' }} 
                  />
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                      Активный Embed: <span className="text-rose-300">{templates.find(t => t.id === form.leaveTemplateId)?.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                      {templates.find(t => t.id === form.leaveTemplateId)?.title || 'Без заголовка'} • Оформление из Конструктора
                    </p>
                  </div>
                </div>
                <Link
                  to="/embeds"
                  className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 font-semibold px-3 py-1.5 bg-[#0B0E14] border border-rose-500/30 rounded-lg transition-all flex-shrink-0"
                >
                  <span>Генератор Embed</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Текст прощания
                </label>
                <input
                  type="text"
                  value={form.leaveMessage}
                  onChange={(e) => setForm({ ...form, leaveMessage: e.target.value })}
                  className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50"
                  placeholder="{user} покинул наш сервер."
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Поддерживает теги: <code className="text-pink-400 bg-pink-500/10 px-1 rounded">{"{user}"}</code>, <code className="text-pink-400 bg-pink-500/10 px-1 rounded">{"{guild}"}</code>, <code className="text-pink-400 bg-pink-500/10 px-1 rounded">{"{memberCount}"}</code>.
                </span>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => handleTestSend('leave')}
                disabled={testing || !form.leaveChannelId}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#151922] hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-[#1E232F] text-xs font-medium transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{testing ? 'Отправка...' : 'Отправить тестовое прощание'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section 3: Ticket instructions */}
        <div className="bg-[#0B0E14] border border-[#1E232F] hover:border-pink-500/30 rounded-2xl p-6 transition-all shadow-xl">
          <div className="flex items-center gap-3 pb-4 border-b border-[#1E232F] mb-5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Ticket className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Инструкция кандидату в тикете заявки</h2>
              <p className="text-xs text-slate-400">Сообщение-памятка, отправляемое в приватный канал тикета при создании</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Шаблон из Конструктора Embed
              </label>
              <select
                value={form.ticketTemplateId || ''}
                onChange={(e) => setForm({ ...form, ticketTemplateId: e.target.value })}
                className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50"
              >
                <option value="">Не использовать (стандартный текст)</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} {tpl.title ? `— ${tpl.title}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {form.ticketTemplateId ? (
              <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-2.5 h-9 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: templates.find(t => t.id === form.ticketTemplateId)?.color || '#A855F7' }} 
                  />
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      Активный Embed: <span className="text-purple-300">{templates.find(t => t.id === form.ticketTemplateId)?.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                      {templates.find(t => t.id === form.ticketTemplateId)?.title || 'Без заголовка'} • Оформление из Конструктора
                    </p>
                  </div>
                </div>
                <Link
                  to="/embeds"
                  className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 font-semibold px-3 py-1.5 bg-[#0B0E14] border border-purple-500/30 rounded-lg transition-all flex-shrink-0"
                >
                  <span>Генератор Embed</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Заголовок памятки
                  </label>
                  <input
                    type="text"
                    value={form.ticketGreetingTitle}
                    onChange={(e) => setForm({ ...form, ticketGreetingTitle: e.target.value })}
                    className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Текст инструкции для кандидата
                  </label>
                  <textarea
                    rows={4}
                    value={form.ticketGreetingDesc}
                    onChange={(e) => setForm({ ...form, ticketGreetingDesc: e.target.value })}
                    className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50 leading-relaxed font-sans"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Поддерживает теги: <code className="text-pink-400 bg-pink-500/10 px-1 rounded">{"{user}"}</code>, <code className="text-pink-400 bg-pink-500/10 px-1 rounded">{"{guild}"}</code>.
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Section 4: Bot status & presence */}
        <div className="bg-[#0B0E14] border border-[#1E232F] hover:border-pink-500/30 rounded-2xl p-6 transition-all shadow-xl">
          <div className="flex items-center gap-3 pb-4 border-b border-[#1E232F] mb-5">
            <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
              <Gamepad2 className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Статус и активность бота в Discord</h2>
              <p className="text-xs text-slate-400">Текст под ником бота в профиле Discord («Играет в ...»)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Тип активности
              </label>
              <select
                value={form.botStatusActivity}
                onChange={(e) => setForm({ ...form, botStatusActivity: e.target.value })}
                className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50"
              >
                <option value="PLAYING">🎮 Играет в</option>
                <option value="WATCHING">👁️ Смотрит</option>
                <option value="LISTENING">🎧 Слушает</option>
                <option value="COMPETING">🏆 Соревнуется в</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Текст активности
              </label>
              <input
                type="text"
                value={form.botStatusText}
                onChange={(e) => setForm({ ...form, botStatusText: e.target.value })}
                className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50"
                placeholder="Interpol • /event"
              />
            </div>
          </div>
        </div>

        {/* Bottom Save Action */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold text-xs shadow-lg shadow-pink-600/30 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Сохранение параметров...' : 'Сохранить все настройки'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default BotMessages;
