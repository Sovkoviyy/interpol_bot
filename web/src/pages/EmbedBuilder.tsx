import React, { useEffect, useState } from 'react';
import { 
  Sparkles, 
  Send, 
  Save, 
  Trash2, 
  Plus, 
  Image as ImageIcon, 
  Layers, 
  Eye, 
  Hash, 
  Palette, 
  Link as LinkIcon, 
  Clock, 
  Bookmark,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

interface EmbedField {
  id: string;
  name: string;
  value: string;
  inline: boolean;
}

export const EmbedBuilder: React.FC = () => {
  const modal = useModal();
  const [channels, setChannels] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Form State
  const [targetChannelId, setTargetChannelId] = useState('');
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('Заголовок Embed Сообщения');
  const [description, setDescription] = useState('Введите текст описания сюда. Поддерживается **жирный шрифт**, *курсив*, `код` и списки.');
  const [color, setColor] = useState('#FF2A85');
  const [authorName, setAuthorName] = useState('INTERPOL FAMILY');
  const [authorIconUrl, setAuthorIconUrl] = useState('');
  const [authorUrl, setAuthorUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [footerText, setFooterText] = useState('INTERPOL BOT • Majestic RP');
  const [footerIconUrl, setFooterIconUrl] = useState('');
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  const [fields, setFields] = useState<EmbedField[]>([
    { id: '1', name: 'Правило #1', value: 'Соблюдение субординации в войсе', inline: true },
    { id: '2', name: 'Правило #2', value: 'Явка на сборы обязательна', inline: true },
  ]);

  // Color Swatches
  const colorPresets = [
    { name: 'Neon Pink', hex: '#FF2A85' },
    { name: 'Hot Pink', hex: '#EC4899' },
    { name: 'Crimson', hex: '#ED4245' },
    { name: 'Blurple', hex: '#5865F2' },
    { name: 'Emerald', hex: '#57F287' },
    { name: 'Gold', hex: '#FEE75C' },
    { name: 'Cyan', hex: '#00B0F4' },
    { name: 'Dark Slate', hex: '#2B2D31' },
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      const [chRes, tplRes] = await Promise.all([
        api.get('/guild/channels'),
        api.get('/embeds'),
      ]);
      const validChannels = chRes.data?.channels?.filter((c: any) => c.type === 0) || [];
      setChannels(validChannels);
      if (validChannels.length > 0 && !targetChannelId) {
        setTargetChannelId(validChannels[0].id);
      }
      setTemplates(tplRes.data?.templates || []);
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка загрузки',
        message: err.response?.data?.error || 'Не удалось загрузить данные каналов и шаблонов',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddField = () => {
    if (fields.length >= 25) {
      modal.alert({
        title: 'Лимит полей',
        message: 'Discord поддерживает максимум 25 полей в одном Embed сообщении!',
        type: 'error',
      });
      return;
    }
    setFields([
      ...fields,
      { id: Date.now().toString(), name: 'Новое поле', value: 'Текст поля', inline: true },
    ]);
  };

  const handleRemoveField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  const handleUpdateField = (id: string, key: keyof EmbedField, val: any) => {
    setFields(
      fields.map((f) => (f.id === id ? { ...f, [key]: val } : f))
    );
  };

  const handleLoadTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId);
    if (!tplId) return;

    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) return;

    setTemplateName(tpl.name || '');
    if (tpl.targetChannelId) setTargetChannelId(tpl.targetChannelId);
    setContent(tpl.content || '');
    setTitle(tpl.title || '');
    setDescription(tpl.description || '');
    setColor(tpl.color || '#FF2A85');
    setAuthorName(tpl.authorName || '');
    setAuthorIconUrl(tpl.authorIconUrl || '');
    setAuthorUrl(tpl.authorUrl || '');
    setThumbnailUrl(tpl.thumbnailUrl || '');
    setImageUrl(tpl.imageUrl || '');
    setFooterText(tpl.footerText || '');
    setFooterIconUrl(tpl.footerIconUrl || '');

    try {
      const parsedFields = JSON.parse(tpl.fieldsJson || '[]');
      if (Array.isArray(parsedFields)) {
        setFields(parsedFields.map((f: any, idx: number) => ({
          id: String(idx + 1),
          name: f.name || '',
          value: f.value || '',
          inline: !!f.inline,
        })));
      }
    } catch {}
  };

  const handleSaveTemplate = async () => {
    const name = templateName.trim() || title.trim() || 'Новый шаблон';
    try {
      setSavingTemplate(true);
      const payload = {
        id: selectedTemplateId || undefined,
        name,
        targetChannelId,
        content,
        title,
        description,
        color,
        authorName,
        authorIconUrl,
        authorUrl,
        thumbnailUrl,
        imageUrl,
        footerText,
        footerIconUrl,
        fields: fields.map(f => ({ name: f.name, value: f.value, inline: f.inline })),
      };

      const res = await api.post('/embeds', payload);
      setTemplateName(name);
      modal.alert({
        title: 'Шаблон сохранен',
        message: `Шаблон «${name}» успешно сохранен в базе данных!`,
        type: 'success',
      });
      fetchData();
      if (res.data?.template?.id) {
        setSelectedTemplateId(res.data.template.id);
      }
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка сохранения',
        message: err.response?.data?.error || 'Не удалось сохранить шаблон',
        type: 'error',
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplateId) return;

    const confirmed = await modal.confirm({
      title: 'Удаление шаблона',
      message: 'Вы уверены, что хотите удалить выбранный сохраненный шаблон?',
      confirmText: 'Удалить',
      type: 'danger',
    });

    if (!confirmed) return;

    try {
      await api.delete(`/embeds/${selectedTemplateId}`);
      setSelectedTemplateId('');
      setTemplateName('');
      modal.alert({
        title: 'Удалено',
        message: 'Шаблон успешно удален',
        type: 'success',
      });
      fetchData();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка удаления',
        message: err.response?.data?.error || 'Не удалось удалить шаблон',
        type: 'error',
      });
    }
  };

  const handleSendToDiscord = async () => {
    if (!targetChannelId) {
      modal.alert({
        title: 'Канал не выбран',
        message: 'Пожалуйста, выберите текстовый канал Discord для отправки сообщения!',
        type: 'error',
      });
      return;
    }

    const channelName = channels.find(c => c.id === targetChannelId)?.name || 'канал';
    const confirmed = await modal.confirm({
      title: 'Отправка Embed сообщения',
      message: `Отправить сформированное Embed сообщение в канал #${channelName}?`,
      confirmText: 'Отправить сейчас',
      type: 'pink',
    });

    if (!confirmed) return;

    try {
      setSending(true);
      const payload = {
        targetChannelId,
        content,
        title,
        description,
        color,
        authorName,
        authorIconUrl,
        authorUrl,
        thumbnailUrl,
        imageUrl,
        footerText,
        footerIconUrl,
        includeTimestamp,
        fields: fields.map(f => ({ name: f.name, value: f.value, inline: f.inline })),
        templateId: selectedTemplateId || undefined,
      };

      await api.post('/embeds/send', payload);
      modal.alert({
        title: 'Успешно отправлено!',
        message: `Embed сообщение успешно доставлено в канал #${channelName}!`,
        type: 'success',
      });
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка отправки',
        message: err.response?.data?.error || 'Не удалось отправить сообщение в Discord',
        type: 'error',
      });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin text-pink-500 mb-2" />
        Загрузка конструктора Embed...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-pink-500" />
            Embed Генератор & Live Preview
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Конструктор красивых Embed сообщений с мгновенным реалистичным предпросмотром в стиле Discord
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSaveTemplate}
            disabled={savingTemplate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#151922] hover:bg-pink-500/10 text-slate-200 hover:text-pink-300 border border-[#1E232F] hover:border-pink-500/30 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <Bookmark className="w-3.5 h-3.5 text-pink-400" />
            <span>{savingTemplate ? 'Сохранение...' : 'Сохранить шаблон'}</span>
          </button>

          <button
            onClick={handleSendToDiscord}
            disabled={sending || !targetChannelId}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold text-xs shadow-lg shadow-pink-600/30 transition-all disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{sending ? 'Отправка...' : 'Отправить в Discord'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Editor, Right Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Editor (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Target Channel & Template Header */}
          <div className="bg-[#0B0E14] border border-[#1E232F] rounded-2xl p-4.5 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-pink-500" />
                Канал отправки и шаблоны
              </span>
              {selectedTemplateId && (
                <button
                  type="button"
                  onClick={handleDeleteTemplate}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Удалить шаблон
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Канал Discord *</label>
                <select
                  value={targetChannelId}
                  onChange={(e) => setTargetChannelId(e.target.value)}
                  className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200 focus:border-pink-500/50"
                >
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Загрузить шаблон</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleLoadTemplate(e.target.value)}
                  className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200 focus:border-pink-500/50"
                >
                  <option value="">(Новое сообщение / Без шаблона)</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      📁 {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium text-xs">
                Текст / Пинг над Embed сообщением (опционально)
              </label>
              <input
                type="text"
                placeholder="например: @everyone или @here Внимание всем членам семьи!"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50 font-sans"
              />
            </div>
          </div>

          {/* Embed Core: Title, Description, Color */}
          <div className="bg-[#0B0E14] border border-[#1E232F] rounded-2xl p-4.5 space-y-3.5 shadow-xl">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-pink-500" />
              Основное содержимое
            </span>

            <div>
              <label className="block text-slate-400 mb-1 font-medium text-xs">Заголовок Embed</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Заголовок сообщения..."
                className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50 font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium text-xs">Описание (Markdown)</label>
              <textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Текст сообщения... Поддерживает разметку Discord"
                className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-pink-500/50 leading-relaxed font-sans"
              />
            </div>

            {/* Color Selection */}
            <div>
              <label className="block text-slate-400 mb-1.5 font-medium text-xs">Цвет боковой полосы</label>
              <div className="flex flex-wrap items-center gap-2">
                {colorPresets.map((p) => (
                  <button
                    key={p.hex}
                    type="button"
                    onClick={() => setColor(p.hex)}
                    style={{ backgroundColor: p.hex }}
                    title={p.name}
                    className={`w-7 h-7 rounded-lg transition-transform ${
                      color.toUpperCase() === p.hex.toUpperCase()
                        ? 'ring-2 ring-white scale-110 shadow-lg'
                        : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }`}
                  />
                ))}

                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-24 bg-[#151922] border border-[#1E232F] rounded-xl px-2.5 py-1.5 text-xs text-slate-200 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Author Block */}
          <div className="bg-[#0B0E14] border border-[#1E232F] rounded-2xl p-4.5 space-y-3 shadow-xl">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <LinkIcon className="w-4 h-4 text-pink-500" />
              Автор (Author)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Имя автора</label>
                <input
                  type="text"
                  placeholder="INTERPOL FAMILY"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200 focus:border-pink-500/50"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Иконка автора (URL)</label>
                <input
                  type="text"
                  placeholder="https://.../avatar.png"
                  value={authorIconUrl}
                  onChange={(e) => setAuthorIconUrl(e.target.value)}
                  className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200 focus:border-pink-500/50"
                />
              </div>
            </div>
          </div>

          {/* Fields (Поля) */}
          <div className="bg-[#0B0E14] border border-[#1E232F] rounded-2xl p-4.5 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-pink-500" />
                Поля Embed ({fields.length}/25)
              </span>

              <button
                type="button"
                onClick={handleAddField}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/20 text-xs font-semibold transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Добавить поле
              </button>
            </div>

            {fields.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">
                Полей нет. Нажмите «Добавить поле» для создания колонок.
              </p>
            ) : (
              <div className="space-y-3">
                {fields.map((f, idx) => (
                  <div
                    key={f.id}
                    className="p-3 rounded-xl bg-[#151922] border border-[#1E232F] space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-400">Поле #{idx + 1}</span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200">
                          <input
                            type="checkbox"
                            checked={f.inline}
                            onChange={(e) => handleUpdateField(f.id, 'inline', e.target.checked)}
                            className="rounded border-slate-700 text-pink-600 focus:ring-0"
                          />
                          <span>В одну строку (Inline)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveField(f.id)}
                          className="text-slate-500 hover:text-red-400 transition-colors p-1"
                          title="Удалить поле"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Название поля..."
                        value={f.name}
                        onChange={(e) => handleUpdateField(f.id, 'name', e.target.value)}
                        className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-lg px-2.5 py-1.5 text-slate-200 font-semibold"
                      />
                      <input
                        type="text"
                        placeholder="Значение поля..."
                        value={f.value}
                        onChange={(e) => handleUpdateField(f.id, 'value', e.target.value)}
                        className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-lg px-2.5 py-1.5 text-slate-200"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Images & Footer */}
          <div className="bg-[#0B0E14] border border-[#1E232F] rounded-2xl p-4.5 space-y-3.5 shadow-xl">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-pink-500" />
              Изображения и Нижний колонтитул
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Миниатюра Thumbnail (URL)</label>
                <input
                  type="text"
                  placeholder="https://.../thumb.png (в правом углу)"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200 focus:border-pink-500/50"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Большое изображение Image (URL)</label>
                <input
                  type="text"
                  placeholder="https://.../banner.png (в нижней части)"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200 focus:border-pink-500/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Текст подвала (Footer)</label>
                <input
                  type="text"
                  placeholder="Текст подвала..."
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200 focus:border-pink-500/50"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Иконка подвала (URL)</label>
                <input
                  type="text"
                  placeholder="https://.../icon.png"
                  value={footerIconUrl}
                  onChange={(e) => setFooterIconUrl(e.target.value)}
                  className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200 focus:border-pink-500/50"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-[#1E232F] text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={includeTimestamp}
                  onChange={(e) => setIncludeTimestamp(e.target.checked)}
                  className="rounded border-slate-700 text-pink-600 focus:ring-0"
                />
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-pink-400" />
                  Показывать отметку времени (Timestamp)
                </span>
              </label>

              <button
                type="button"
                onClick={handleSendToDiscord}
                disabled={sending}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold shadow-lg shadow-pink-600/30 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sending ? 'Отправка...' : 'Отправить в Discord'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Discord Preview (5 cols) */}
        <div className="lg:col-span-5 sticky top-6 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-pink-500" />
              Live Предпросмотр (Discord)
            </span>
            <span className="text-[11px] text-pink-400 font-medium">Обновляется в реальном времени</span>
          </div>

          {/* Discord Message Simulator Container */}
          <div className="bg-[#313338] rounded-2xl p-4 shadow-2xl border border-white/5 font-sans text-slate-100 select-none">
            {/* Discord Message Header */}
            <div className="flex items-start gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-600 to-rose-500 flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0">
                🦅
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 leading-none mb-1">
                  <span className="font-semibold text-white text-sm hover:underline cursor-pointer">
                    INTERPOL BOT
                  </span>
                  <span className="bg-[#5865F2] text-[10px] text-white font-bold px-1 py-0.5 rounded uppercase leading-none">
                    БОТ
                  </span>
                  <span className="text-[11px] text-slate-400">Сегодня, в 20:45</span>
                </div>

                {/* Plain Text Message content if present */}
                {content && (
                  <p className="text-xs text-slate-200 mb-2 leading-relaxed whitespace-pre-wrap">
                    {content}
                  </p>
                )}

                {/* Discord Embed Box */}
                <div 
                  className="bg-[#2B2D31] rounded-md p-3.5 max-w-lg shadow-sm border border-black/10 relative"
                  style={{ borderLeft: `4px solid ${color || '#FF2A85'}` }}
                >
                  {/* Top Thumbnail Image if present */}
                  {thumbnailUrl && (
                    <img
                      src={thumbnailUrl}
                      alt="Thumbnail"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      className="w-16 h-16 rounded object-cover absolute top-3.5 right-3.5 shadow"
                    />
                  )}

                  <div className={`space-y-2 ${thumbnailUrl ? 'pr-20' : ''}`}>
                    {/* Author */}
                    {authorName && (
                      <div className="flex items-center gap-2">
                        {authorIconUrl && (
                          <img
                            src={authorIconUrl}
                            alt=""
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                        )}
                        <span className="text-xs font-semibold text-white">
                          {authorName}
                        </span>
                      </div>
                    )}

                    {/* Title */}
                    {title && (
                      <h4 className="text-sm font-bold text-white hover:underline cursor-pointer leading-snug">
                        {title}
                      </h4>
                    )}

                    {/* Description */}
                    {description && (
                      <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {description}
                      </p>
                    )}

                    {/* Fields Grid */}
                    {fields.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {fields.map((f) => (
                          <div 
                            key={f.id} 
                            className={f.inline ? 'col-span-1' : 'col-span-full'}
                          >
                            <p className="text-[11px] font-bold text-white">{f.name}</p>
                            <p className="text-xs text-slate-300 whitespace-pre-wrap leading-tight">{f.value}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Large Image */}
                    {imageUrl && (
                      <div className="pt-2">
                        <img
                          src={imageUrl}
                          alt="Embed Large"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          className="w-full max-h-56 rounded-md object-cover shadow"
                        />
                      </div>
                    )}

                    {/* Footer */}
                    {(footerText || includeTimestamp) && (
                      <div className="pt-2 flex items-center gap-2 text-[10px] text-slate-400 border-t border-white/5">
                        {footerIconUrl && (
                          <img
                            src={footerIconUrl}
                            alt=""
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                            className="w-4 h-4 rounded-full object-cover"
                          />
                        )}
                        <span>{footerText}</span>
                        {footerText && includeTimestamp && <span>•</span>}
                        {includeTimestamp && <span>Сегодня, в 20:45</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmbedBuilder;
