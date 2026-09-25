import React, { useEffect, useState } from 'react';
import { 
  IdCard, 
  Search, 
  Trophy, 
  Flame, 
  Clock, 
  AlertOctagon, 
  Edit3, 
  Plus, 
  UserCheck, 
  Shield, 
  Medal,
  Users,
  Send,
  Star,
  MinusCircle,
  ArrowUpDown,
  UserPlus,
  Check,
  CheckCircle2,
  CalendarOff,
  AtSign,
  Zap,
  RefreshCw
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

export const Profiles: React.FC = () => {
  const modal = useModal();
  const [tab, setTab] = useState<'profiles' | 'leaderboard'>('profiles');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    withStatics: 0,
    withoutStatics: 0,
    active: 0,
    onLeave: 0,
  });
  const [leaderboard, setLeaderboard] = useState<{ topMp: any[]; topVoice: any[] }>({
    topMp: [],
    topVoice: [],
  });
  const [channels, setChannels] = useState<any[]>([]);
  const [guildMembers, setGuildMembers] = useState<any[]>([]);
  const [deployChannelId, setDeployChannelId] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('mpCount');
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');
  const [loading, setLoading] = useState(true);

  // Manual Profile Modal State
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualForm, setManualForm] = useState({
    userId: '',
    userTag: '',
    rank: 1,
    status: 'ACTIVE',
    notes: '',
    characters: [
      { staticId: '', characterName: '', isMain: true },
      { staticId: '', characterName: '', isMain: false },
      { staticId: '', characterName: '', isMain: false },
    ],
  });

  // Nickname Modal State
  const [nickModalOpen, setNickModalOpen] = useState(false);
  const [nickTargetProfile, setNickTargetProfile] = useState<any>(null);
  const [customNickText, setCustomNickText] = useState('');
  const [nickSubmitting, setNickSubmitting] = useState(false);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const [profRes, leadRes, chRes, memRes] = await Promise.all([
        api.get(`/profiles?search=${encodeURIComponent(search)}&sortBy=${sortBy}&order=${order}`),
        api.get('/profiles/leaderboard'),
        api.get('/guild/channels').catch(() => ({ data: { channels: [] } })),
        api.get('/guild/members').catch(() => ({ data: { members: [] } })),
      ]);
      setProfiles(profRes.data.profiles || []);
      if (profRes.data.stats) {
        setStats(profRes.data.stats);
      }
      setLeaderboard(leadRes.data || { topMp: [], topVoice: [] });
      
      const textChannels = (chRes.data?.channels || []).filter(
        (c: any) => c.type === 0 || c.type === 'GUILD_TEXT'
      );
      setChannels(textChannels);
      if (textChannels.length > 0 && !deployChannelId) {
        setDeployChannelId(textChannels[0].id);
      }

      setGuildMembers(memRes.data?.members || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [search, sortBy, order]);

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setOrder(order === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setOrder('desc');
    }
  };

  const handleDeployPanel = async () => {
    if (!deployChannelId) {
      modal.alert({ title: 'Ошибка', message: 'Выберите текстовый канал для отправки панели.', type: 'warning' });
      return;
    }

    const selectedCh = channels.find(c => c.id === deployChannelId);
    const chName = selectedCh ? `#${selectedCh.name}` : deployChannelId;

    modal.confirm({
      title: 'Отправить панель привязки статика?',
      message: `Бот отправит интерактивное сообщение с кнопкой «🆔 Привязать статик» в канал ${chName}. Участники смогут нажать её и ввести свой Static ID.`,
      type: 'pink',
      confirmText: 'Отправить панель',
      onConfirm: async () => {
        try {
          setDeploying(true);
          await api.post('/profiles/deploy-panel', { channelId: deployChannelId });
          modal.alert({
            title: 'Панель успешно отправлена',
            message: `Интерактивная кнопка привязки статика успешно опубликована в канале ${chName}!`,
            type: 'success',
          });
        } catch (err: any) {
          modal.alert({
            title: 'Ошибка отправки',
            message: err.response?.data?.error || 'Не удалось отправить панель в канал',
            type: 'error',
          });
        } finally {
          setDeploying(false);
        }
      },
    });
  };

  const openManualModal = (existingProfile?: any) => {
    if (existingProfile) {
      const chars = existingProfile.characters || [];
      const charSlots = [
        chars[0] ? { staticId: chars[0].staticId, characterName: chars[0].characterName || '', isMain: chars[0].isMain } : { staticId: existingProfile.staticId || '', characterName: existingProfile.characterName || '', isMain: true },
        chars[1] ? { staticId: chars[1].staticId, characterName: chars[1].characterName || '', isMain: chars[1].isMain } : { staticId: '', characterName: '', isMain: false },
        chars[2] ? { staticId: chars[2].staticId, characterName: chars[2].characterName || '', isMain: chars[2].isMain } : { staticId: '', characterName: '', isMain: false },
      ];
      // Ensure at least one is main
      if (!charSlots.some(c => c.isMain) && charSlots[0].staticId) {
        charSlots[0].isMain = true;
      }
      setManualForm({
        userId: existingProfile.userId,
        userTag: existingProfile.userTag || '',
        rank: existingProfile.rank || 1,
        status: existingProfile.status || 'ACTIVE',
        notes: existingProfile.notes || '',
        characters: charSlots,
      });
    } else {
      setManualForm({
        userId: '',
        userTag: '',
        rank: 1,
        status: 'ACTIVE',
        notes: '',
        characters: [
          { staticId: '', characterName: '', isMain: true },
          { staticId: '', characterName: '', isMain: false },
          { staticId: '', characterName: '', isMain: false },
        ],
      });
    }
    setManualModalOpen(true);
  };

  const handleManualSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.userId) {
      modal.alert({ title: 'Ошибка', message: 'Укажите или выберите пользователя Discord', type: 'error' });
      return;
    }

    try {
      setManualSaving(true);
      const filteredChars = manualForm.characters.filter(c => c.staticId && c.staticId.trim() !== '');
      await api.post('/profiles/manual', {
        ...manualForm,
        characters: filteredChars,
      });

      modal.alert({
        title: 'Успешно!',
        message: 'Данные профиля и статики участника успешно сохранены!',
        type: 'success',
      });
      setManualModalOpen(false);
      fetchProfiles();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось сохранить профиль',
        type: 'error',
      });
    } finally {
      setManualSaving(false);
    }
  };

  const handleSelectGuildMember = (memberId: string) => {
    const mem = guildMembers.find(m => m.id === memberId);
    if (mem) {
      setManualForm(prev => ({
        ...prev,
        userId: mem.id,
        userTag: mem.user?.tag || mem.displayName || prev.userTag,
      }));
    }
  };

  const handleSetMainCharacter = async (userId: string, staticOrCharId: string) => {
    try {
      await api.post(`/profiles/${userId}/set-main`, { staticOrCharId });
      fetchProfiles();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось изменить основного персонажа',
        type: 'error',
      });
    }
  };

  const openNicknameModal = (prof: any) => {
    setNickTargetProfile(prof);
    const chars = prof.characters || [];
    const mainChar = chars.find((c: any) => c.isMain) || chars[0];
    const charName = mainChar?.characterName || prof.characterName || '';
    const staticId = mainChar?.staticId || prof.staticId || '';
    const sample = `${prof.rank || 1} | ${charName} | ${staticId}`;
    setCustomNickText(sample.trim());
    setNickModalOpen(true);
  };

  const handleSyncProfileNick = async () => {
    if (!nickTargetProfile) return;
    try {
      setNickSubmitting(true);
      const res = await api.post(`/nicknames/sync/${nickTargetProfile.userId}`);
      const r = res.data?.result;
      if (r?.updated) {
        modal.alert({
          title: 'Никнейм обновлен!',
          message: `Новый ник в Discord: «${r.newNick}»`,
          type: 'success',
        });
        setNickModalOpen(false);
      } else {
        modal.alert({
          title: 'Синхронизация не потребовалась',
          message: r?.reason || 'Никнейм участника уже соответствует шаблону.',
          type: 'info',
        });
      }
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось синхронизировать никнейм',
        type: 'error',
      });
    } finally {
      setNickSubmitting(false);
    }
  };

  const handleSetManualNick = async () => {
    if (!nickTargetProfile || !customNickText.trim()) return;
    try {
      setNickSubmitting(true);
      await api.post(`/nicknames/manual/${nickTargetProfile.userId}`, { nickname: customNickText.trim() });
      modal.alert({
        title: 'Никнейм установлен!',
        message: `Участнику ${nickTargetProfile.userTag || nickTargetProfile.userId} установлен ник: «${customNickText.trim()}»`,
        type: 'success',
      });
      setNickModalOpen(false);
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось изменить ник',
        type: 'error',
      });
    } finally {
      setNickSubmitting(false);
    }
  };

  const handleAddPenalty = (prof: any) => {
    modal.form({
      title: 'Выписать штрафные МП',
      message: `Начислить штрафные мероприятия для ${prof.userTag || prof.userId}. Чтобы повыситься на 2 ранг, бойцу потребуется отыграть эти МП дополнительно:`,
      fields: [
        {
          name: 'count',
          label: 'Количество штрафных МП',
          placeholder: 'Например: 2',
          defaultValue: '1',
          required: true,
        },
        {
          name: 'reason',
          label: 'Причина штрафа',
          placeholder: 'Опоздание на сбор, нарушение субординации...',
          required: true,
        },
      ],
      submitText: 'Выписать штраф',
      onSubmit: async (values) => {
        try {
          await api.post(`/profiles/${prof.userId}/penalty`, values);
          modal.alert({
            title: 'Штраф начислен',
            message: `Начислено +${values.count} штрафных МП для ${prof.userTag || prof.userId}.`,
            type: 'warning',
          });
          fetchProfiles();
        } catch (err: any) {
          modal.alert({
            title: 'Ошибка',
            message: err.response?.data?.error || 'Не удалось начислить штраф',
            type: 'error',
          });
        }
      },
    });
  };

  const handleRemovePenalty = (prof: any) => {
    const current = prof.penaltyMp || 0;
    if (current <= 0) {
      modal.alert({
        title: 'Штрафов нет',
        message: `У участника ${prof.userTag || prof.userId} нет активных штрафных МП.`,
        type: 'info',
      });
      return;
    }

    modal.form({
      title: 'Снять штрафные МП',
      message: `Текущий штраф: ${current} МП. Укажите, сколько штрафных МП снять:`,
      fields: [
        {
          name: 'count',
          label: 'Количество снимаемых МП',
          placeholder: '1',
          defaultValue: String(Math.min(1, current)),
          required: true,
        },
        {
          name: 'reason',
          label: 'Основание / Причина снятия',
          placeholder: 'Отработка на дропе, амнистия от лидера...',
          required: false,
        },
      ],
      submitText: 'Снять штраф',
      onSubmit: async (values) => {
        try {
          await api.post(`/profiles/${prof.userId}/penalty/remove`, values);
          modal.alert({
            title: 'Штраф снят',
            message: `Успешно списано ${values.count} штрафных МП.`,
            type: 'success',
          });
          fetchProfiles();
        } catch (err: any) {
          modal.alert({
            title: 'Ошибка',
            message: err.response?.data?.error || 'Не удалось снять штраф',
            type: 'error',
          });
        }
      },
    });
  };

  const formatVoice = (seconds?: number | null) => {
    if (!seconds || seconds <= 0) return '0 мин';
    const totalMinutes = Math.floor(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (hours === 0 && m === 0) return `${seconds} сек`;
    if (hours === 0) return `${m} мин`;
    return `${hours}ч ${m}м`;
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 5:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">👑 5 • Лидер</span>;
      case 4:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">⭐ 4 • Заместитель</span>;
      case 3:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">🎖️ 3 • Офицер</span>;
      case 2:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">⚔️ 2 • Участник</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-500/10 text-pink-400 border border-pink-500/20">🎓 1 • Академик</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ON_LEAVE':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            В отпуске
          </span>
        );
      case 'AFK':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            Неактив
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Активен
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <IdCard className="w-6 h-6 text-pink-500" />
            Профили & Статики
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            База участников семьи: статики персонажей (до 3 на человека), учет отыгранных МП, штрафов и времени в войсе
          </p>
        </div>

        <button
          onClick={() => openManualModal()}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white rounded-xl text-xs font-semibold shadow-lg shadow-pink-600/20 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Внести данные вручную
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase">Всего профилей</p>
          <p className="text-xl font-bold text-white mt-1">{stats.total || profiles.length}</p>
        </div>
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-pink-400 uppercase">С привязкой статика</p>
          <p className="text-xl font-bold text-pink-400 mt-1">{stats.withStatics}</p>
        </div>
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Без привязки</p>
          <p className="text-xl font-bold text-slate-400 mt-1">{stats.withoutStatics}</p>
        </div>
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-emerald-400 uppercase">Активных бойцов</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{stats.active}</p>
        </div>
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-amber-400 uppercase">В отпуске / неактиве</p>
          <p className="text-xl font-bold text-amber-400 mt-1">{stats.onLeave}</p>
        </div>
      </div>

      {/* Interactive Static Binding Panel Deployment Card */}
      <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Интерактивная панель привязки статика в Discord</h3>
            <p className="text-xs text-slate-400">
              Отправьте сообщение с кнопкой в канал, чтобы бойцы могли привязать свои статики прямо через Discord
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={deployChannelId}
            onChange={(e) => setDeployChannelId(e.target.value)}
            className="bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500 transition-colors w-full md:w-56"
          >
            <option value="">Выберите канал...</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                #{ch.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleDeployPanel}
            disabled={deploying || !deployChannelId}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-pink-600/20 whitespace-nowrap disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {deploying ? 'Отправка...' : 'Отправить в канал'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1E232F] gap-2">
        <button
          onClick={() => setTab('profiles')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
            tab === 'profiles'
              ? 'border-pink-500 text-pink-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          Все профили ({profiles.length})
        </button>
        <button
          onClick={() => setTab('leaderboard')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
            tab === 'leaderboard'
              ? 'border-pink-500 text-pink-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Trophy className="w-4 h-4" />
          Зал славы (Топ актива)
        </button>
      </div>

      {/* Profiles Tab */}
      {tab === 'profiles' && (
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по статику, имени, тегу или ID..."
                className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Сортировка:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-[#0B0E14] border border-[#1E232F] rounded-xl px-2.5 py-1.5 text-xs text-slate-200"
              >
                <option value="mpCount">По числу МП</option>
                <option value="voiceSeconds">По войс-активу</option>
                <option value="penaltyMp">По штрафным МП</option>
                <option value="rank">По рангу</option>
                <option value="userTag">По имени</option>
              </select>

              <button
                onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')}
                className="p-1.5 rounded-xl bg-[#0B0E14] border border-[#1E232F] hover:border-pink-500/50 text-slate-300"
                title="Переключить направление сортировки"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-10 text-slate-500 text-xs">Загрузка профилей...</div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-[#1E232F] rounded-xl">
              <IdCard className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Профили участников не найдены</p>
              <p className="text-xs text-slate-500 mt-1">Вы можете внести бойца вручную кнопкой выше</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="text-[11px] text-slate-400 uppercase bg-[#1E232F]/50 border-b border-[#1E232F]">
                  <tr>
                    <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('userTag')}>
                      Участник Discord
                    </th>
                    <th className="px-4 py-3">Статики & Персонажи (до 3)</th>
                    <th className="px-4 py-3">Ранг & Статус</th>
                    <th className="px-4 py-3 text-center cursor-pointer" onClick={() => toggleSort('mpCount')}>
                      Отыграно МП {sortBy === 'mpCount' && (order === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="px-4 py-3 text-center cursor-pointer" onClick={() => toggleSort('penaltyMp')}>
                      Штрафные МП {sortBy === 'penaltyMp' && (order === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="px-4 py-3 text-center cursor-pointer" onClick={() => toggleSort('voiceSeconds')}>
                      Войс актив {sortBy === 'voiceSeconds' && (order === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="px-4 py-3 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E232F]">
                  {profiles.map((prof) => {
                    const chars = prof.characters && prof.characters.length > 0
                      ? prof.characters
                      : (prof.staticId ? [{ staticId: prof.staticId, characterName: prof.characterName, isMain: true }] : []);

                    const mainChar = chars.find((c: any) => c.isMain) || chars[0];

                    return (
                      <tr key={prof.id} className="hover:bg-[#1E232F]/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{prof.userTag || 'Пользователь'}</div>
                          <div className="font-mono text-[10px] text-slate-500">ID: {prof.userId}</div>
                        </td>
                        <td className="px-4 py-3">
                          {chars.length > 0 ? (
                            <div className="space-y-1">
                              {chars.map((char: any, cIdx: number) => (
                                <div key={cIdx} className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`px-2 py-0.5 font-mono font-bold rounded text-[11px] inline-flex items-center gap-1 ${
                                      char.isMain
                                        ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-sm'
                                        : 'bg-[#0B0E14] text-slate-400 border border-[#1E232F]'
                                    }`}
                                  >
                                    {char.isMain && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                                    #{char.staticId}
                                  </span>
                                  {char.characterName && (
                                    <span className="text-[11px] text-slate-300">
                                      {char.characterName}
                                    </span>
                                  )}
                                  {!char.isMain && (
                                    <button
                                      onClick={() => handleSetMainCharacter(prof.userId, char.id || char.staticId)}
                                      className="text-[10px] text-slate-500 hover:text-pink-400 underline ml-1"
                                      title="Сделать основным персонажем"
                                    >
                                      Сделать осн.
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500 italic">Статики не привязаны</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div>{getRankBadge(prof.rank || 1)}</div>
                            <div>{getStatusBadge(prof.status)}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 font-bold text-pink-400 font-mono text-sm">
                            <Flame className="w-4 h-4 text-pink-500" />
                            {prof.mpCount || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          {(prof.penaltyMp || 0) > 0 ? (
                            <span className="text-amber-400 font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                              +{prof.penaltyMp}
                            </span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-mono text-slate-300">
                          {formatVoice(prof.voiceSeconds)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleAddPenalty(prof)}
                              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                              title="Выписать штрафные МП"
                            >
                              <AlertOctagon className="w-4 h-4" />
                            </button>
                            {(prof.penaltyMp || 0) > 0 && (
                              <button
                                onClick={() => handleRemovePenalty(prof)}
                                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                title="Снять штрафные МП"
                              >
                                <MinusCircle className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => openNicknameModal(prof)}
                              className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors"
                              title="Сменить / синхронизировать ник в Discord"
                            >
                              <AtSign className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openManualModal(prof)}
                              className="p-1.5 text-slate-400 hover:text-pink-400 hover:bg-pink-500/10 rounded-lg transition-colors"
                              title="Редактировать статики и персонажей"
                            >
                              <Edit3 className="w-4 h-4" />
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
      )}

      {/* Leaderboard Tab */}
      {tab === 'leaderboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top MP */}
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-pink-500" />
              Топ 10 по отыгранным МП
            </h2>
            <div className="space-y-2">
              {leaderboard.topMp.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">Нет данных об активности</div>
              ) : (
                leaderboard.topMp.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 bg-[#0B0E14] rounded-xl border border-[#1E232F] hover:border-pink-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                          idx === 0
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : idx === 1
                            ? 'bg-slate-400/20 text-slate-300 border border-slate-400/40'
                            : idx === 2
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                            : 'text-slate-500'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-semibold text-white text-xs">
                          {p.characterName || p.userTag || 'Боец'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {p.staticId ? `#${p.staticId}` : p.userId}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-pink-400 font-mono text-sm">{p.mpCount}</span>
                      <span className="text-[10px] text-slate-500 block">МП</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top Voice */}
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-pink-500" />
              Топ 10 по времени в войсе
            </h2>
            <div className="space-y-2">
              {leaderboard.topVoice.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">Нет данных об активности</div>
              ) : (
                leaderboard.topVoice.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 bg-[#0B0E14] rounded-xl border border-[#1E232F] hover:border-pink-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                          idx === 0
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : idx === 1
                            ? 'bg-slate-400/20 text-slate-300 border border-slate-400/40'
                            : idx === 2
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                            : 'text-slate-500'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-semibold text-white text-xs">
                          {p.characterName || p.userTag || 'Боец'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {p.staticId ? `#${p.staticId}` : p.userId}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-pink-400 font-mono text-xs">
                        {formatVoice(p.voiceSeconds)}
                      </span>
                      <span className="text-[10px] text-slate-500 block">в войсе</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Profile & Characters Modal (Up to 3 characters) */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#151921] border border-[#1E232F] rounded-2xl p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-[#1E232F] pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <IdCard className="w-4 h-4 text-pink-500" />
                Ручной ввод данных и статики персонажей
              </h3>
              <button
                onClick={() => setManualModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E232F]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualSave} className="space-y-4 text-xs">
              {/* Member Picker */}
              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Выбрать участника с сервера Discord (или ввести ID)
                </label>
                {guildMembers.length > 0 && (
                  <select
                    onChange={(e) => handleSelectGuildMember(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200 mb-2"
                  >
                    <option value="">Выберите из списка участников сервера...</option>
                    {guildMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        @{m.user?.username || m.displayName} (ID: {m.id})
                      </option>
                    ))}
                  </select>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Discord User ID (число)"
                    value={manualForm.userId}
                    onChange={(e) => setManualForm({ ...manualForm, userId: e.target.value })}
                    className="bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200 font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Discord Tag / Имя"
                    value={manualForm.userTag}
                    onChange={(e) => setManualForm({ ...manualForm, userTag: e.target.value })}
                    className="bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                  />
                </div>
              </div>

              {/* Characters Section (Up to 3) */}
              <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-[#1E232F] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 text-xs">
                    Персонажи (до 3-х статиков)
                  </span>
                  <span className="text-[10px] text-pink-400">
                    Отметьте точку у основного персонажа
                  </span>
                </div>

                {manualForm.characters.map((char, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-[#151921] border border-[#1E232F]">
                    <div className="w-5 text-center font-bold text-slate-500 text-[11px]">
                      #{idx + 1}
                    </div>

                    <input
                      type="text"
                      placeholder="Static ID (напр. 251156)"
                      value={char.staticId}
                      onChange={(e) => {
                        const newChars = [...manualForm.characters];
                        newChars[idx].staticId = e.target.value;
                        setManualForm({ ...manualForm, characters: newChars });
                      }}
                      className="w-36 bg-[#0B0E14] border border-[#1E232F] rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-xs"
                    />

                    <input
                      type="text"
                      placeholder="Никнейм персонажа (John Doe)"
                      value={char.characterName}
                      onChange={(e) => {
                        const newChars = [...manualForm.characters];
                        newChars[idx].characterName = e.target.value;
                        setManualForm({ ...manualForm, characters: newChars });
                      }}
                      className="flex-1 bg-[#0B0E14] border border-[#1E232F] rounded-lg px-2.5 py-1.5 text-slate-200 text-xs"
                    />

                    <label className="flex items-center gap-1 cursor-pointer shrink-0 ml-1">
                      <input
                        type="radio"
                        name="mainCharacterRadio"
                        checked={char.isMain}
                        onChange={() => {
                          const newChars = manualForm.characters.map((c, i) => ({
                            ...c,
                            isMain: i === idx,
                          }));
                          setManualForm({ ...manualForm, characters: newChars });
                        }}
                        className="text-pink-600 focus:ring-pink-500"
                      />
                      <span className="text-[10px] text-slate-400">Осн.</span>
                    </label>
                  </div>
                ))}
              </div>

              {/* Rank and Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Ранг в семье</label>
                  <select
                    value={manualForm.rank}
                    onChange={(e) => setManualForm({ ...manualForm, rank: parseInt(e.target.value, 10) || 1 })}
                    className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                  >
                    <option value={1}>1 • Академик</option>
                    <option value={2}>2 • Участник семьи (Мейн)</option>
                    <option value={3}>3 • Офицер</option>
                    <option value={4}>4 • Заместитель лидера</option>
                    <option value={5}>5 • Лидер</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Статус профиля</label>
                  <select
                    value={manualForm.status}
                    onChange={(e) => setManualForm({ ...manualForm, status: e.target.value })}
                    className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                  >
                    <option value="ACTIVE">Активен</option>
                    <option value="ON_LEAVE">В отпуске</option>
                    <option value="AFK">Неактив</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Заметки / примечания</label>
                <textarea
                  rows={2}
                  placeholder="Дополнительные сведения, история вступления..."
                  value={manualForm.notes}
                  onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                  className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl p-2.5 text-slate-200"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#1E232F]">
                <button
                  type="button"
                  onClick={() => setManualModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#0B0E14] text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={manualSaving}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white text-xs font-semibold shadow-lg shadow-pink-600/20 disabled:opacity-50"
                >
                  {manualSaving ? 'Сохранение...' : 'Сохранить профиль'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nickname Management */}
      {nickModalOpen && nickTargetProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0B0E14] border border-[#1E232F] rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E232F]">
              <div className="flex items-center gap-2.5">
                <AtSign className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  Смена никнейма в Discord
                </h3>
              </div>
              <button
                onClick={() => setNickModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-[#151922] border border-[#1E232F] rounded-xl space-y-1">
                <div className="text-slate-400">Участник: <span className="text-white font-semibold">{nickTargetProfile.userTag}</span></div>
                <div className="text-slate-500 font-mono text-[11px]">Discord ID: {nickTargetProfile.userId}</div>
              </div>

              {/* Option 1: Auto-sync by role */}
              <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-cyan-300 font-semibold">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span>Синхронизировать по шаблону роли</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Бот проверит текущие роли участника на сервере и установит ник в формате: <code className="text-cyan-400 font-mono">ранг | Имя | статик</code>
                </p>
                <button
                  type="button"
                  onClick={handleSyncProfileNick}
                  disabled={nickSubmitting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-all shadow-lg shadow-cyan-600/20 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${nickSubmitting ? 'animate-spin' : ''}`} />
                  <span>{nickSubmitting ? 'Синхронизация...' : 'Синхронизировать по роли'}</span>
                </button>
              </div>

              {/* Option 2: Custom nickname */}
              <div className="space-y-2 pt-2 border-t border-[#1E232F]">
                <label className="block font-semibold text-slate-300">
                  Или установить произвольный ник вручную
                </label>
                <input
                  type="text"
                  value={customNickText}
                  onChange={(e) => setCustomNickText(e.target.value)}
                  maxLength={32}
                  className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-cyan-500/50"
                  placeholder="1 | Richard Miller | 12345"
                />
                <div className="text-[11px] text-slate-500 text-right">
                  {customNickText.length}/32 символов
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setNickModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#0B0E14] text-slate-400 hover:text-white font-semibold"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleSetManualNick}
                    disabled={nickSubmitting || !customNickText.trim()}
                    className="px-5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-semibold transition-all disabled:opacity-50 shadow-lg shadow-pink-600/20"
                  >
                    {nickSubmitting ? 'Сохранение...' : 'Установить ник'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profiles;
