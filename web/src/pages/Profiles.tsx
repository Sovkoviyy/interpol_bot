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
  Users
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

export const Profiles: React.FC = () => {
  const modal = useModal();
  const [tab, setTab] = useState<'profiles' | 'leaderboard'>('profiles');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<{ topMp: any[]; topVoice: any[] }>({
    topMp: [],
    topVoice: [],
  });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const [profRes, leadRes] = await Promise.all([
        api.get(`/profiles?search=${encodeURIComponent(search)}`),
        api.get('/profiles/leaderboard'),
      ]);
      setProfiles(profRes.data.profiles || []);
      setLeaderboard(leadRes.data || { topMp: [], topVoice: [] });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [search]);

  const handleEditStatic = (prof: any) => {
    modal.form({
      title: 'Привязать Majestic Static ID',
      message: `Укажите Static ID и имя персонажа для ${prof.discordTag || prof.userId}:`,
      fields: [
        {
          name: 'staticId',
          label: 'Static ID игрока',
          placeholder: 'Например: 142055',
          defaultValue: prof.staticId || '',
          required: true,
        },
        {
          name: 'characterName',
          label: 'Имя Фамилия (ник персонажа)',
          placeholder: 'Например: Tony Montana',
          defaultValue: prof.characterName || '',
        },
      ],
      submitText: 'Сохранить данные',
      onSubmit: async (values) => {
        try {
          await api.post(`/profiles/${prof.userId}/static`, values);
          modal.alert({
            title: 'Данные обновлены',
            message: `Static ID #${values.staticId} успешно привязан к профилю.`,
            type: 'success',
          });
          fetchProfiles();
        } catch (err: any) {
          modal.alert({
            title: 'Ошибка',
            message: err.response?.data?.error || 'Не удалось обновить статик',
            type: 'error',
          });
        }
      },
    });
  };

  const handleAddPenalty = (prof: any) => {
    modal.form({
      title: 'Выписать штрафные МП',
      message: `Добавить штрафные мероприятия для ${prof.discordTag || prof.userId}. Чтобы повыситься на 2 ранг или закрыть дисциплинарку, бойцу потребуется отыграть эти МП дополнительно:`,
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
            message: `Начислено ${values.count} штрафных МП для ${prof.discordTag || prof.userId}.`,
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

  const formatVoice = (mins: number) => {
    const hours = Math.floor(mins / 60);
    const m = mins % 60;
    if (hours === 0) return `${m} мин`;
    return `${hours}ч ${m}м`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ON_LEAVE':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            В отпуске
          </span>
        );
      case 'ACADEMY':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-500/10 text-pink-400 border border-pink-500/20">
            Академия (1 ранг)
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Активен
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <IdCard className="w-6 h-6 text-pink-500" />
            Профили бойцов & Статики Majestic RP
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Привязка статик ID к Discord аккаунтам, учет отыгранных МП, штрафов и часов в войсе
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-800 gap-2">
        <button
          onClick={() => setTab('profiles')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
            tab === 'profiles'
              ? 'border-pink-500 text-pink-500'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          Все профили ({profiles.length})
        </button>
        <button
          onClick={() => setTab('leaderboard')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
            tab === 'leaderboard'
              ? 'border-pink-500 text-pink-500'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Trophy className="w-4 h-4" />
          Зал славы (Топ актива)
        </button>
      </div>

      {/* Profiles Tab */}
      {tab === 'profiles' && (
        <div className="bg-dark-900/60 border border-dark-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по статику, имени, тегу или ID..."
                className="w-full bg-dark-800/80 border border-dark-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 transition-colors"
              />
            </div>
            <span className="text-xs text-gray-400">Найдено бойцов: {profiles.length}</span>
          </div>

          {loading ? (
            <div className="text-center py-10 text-gray-500 text-sm">Загрузка профилей...</div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-dark-800 rounded-xl">
              <IdCard className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Профили участников не найдены</p>
              <p className="text-xs text-gray-500 mt-1">Бойцы могут привязать статик через команду /set-static в Discord</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-xs text-gray-400 uppercase bg-dark-800/50 border-b border-dark-800">
                  <tr>
                    <th className="px-4 py-3">Участник</th>
                    <th className="px-4 py-3">Статик & Персонаж</th>
                    <th className="px-4 py-3">Статус</th>
                    <th className="px-4 py-3 text-center">Отыграно МП</th>
                    <th className="px-4 py-3 text-center">Штрафные МП</th>
                    <th className="px-4 py-3 text-center">Войс актив</th>
                    <th className="px-4 py-3 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-800">
                  {profiles.map((prof) => (
                    <tr key={prof.id} className="hover:bg-dark-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{prof.discordTag || 'Пользователь'}</div>
                        <div className="font-mono text-xs text-gray-500">ID: {prof.userId}</div>
                      </td>
                      <td className="px-4 py-3">
                        {prof.staticId ? (
                          <div>
                            <span className="px-2 py-0.5 bg-pink-500/10 text-pink-400 font-mono font-bold rounded border border-pink-500/20 text-xs">
                              #{prof.staticId}
                            </span>
                            {prof.characterName && (
                              <span className="text-xs text-gray-300 block mt-1">{prof.characterName}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500 italic">Не привязан</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(prof.status)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 font-bold text-pink-400 font-mono">
                          <Flame className="w-4 h-4 text-pink-500" />
                          {prof.mpCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono">
                        {prof.penaltyMps > 0 ? (
                          <span className="text-amber-400 font-bold">+{prof.penaltyMps}</span>
                        ) : (
                          <span className="text-gray-500">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-mono text-gray-300">
                        {formatVoice(prof.voiceMinutes)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleAddPenalty(prof)}
                            className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                            title="Выписать штрафные МП"
                          >
                            <AlertOctagon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditStatic(prof)}
                            className="p-1.5 text-gray-400 hover:text-pink-400 hover:bg-pink-500/10 rounded-lg transition-colors"
                            title="Изменить Static ID"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
          <div className="bg-dark-900/60 border border-dark-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-pink-500" />
              Топ 10 по числу МП
            </h2>
            <div className="space-y-2">
              {leaderboard.topMp.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">Нет данных об активности</div>
              ) : (
                leaderboard.topMp.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 bg-dark-800/40 rounded-xl border border-dark-800 hover:border-pink-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                          idx === 0
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : idx === 1
                            ? 'bg-gray-400/20 text-gray-300 border border-gray-400/40'
                            : idx === 2
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                            : 'text-gray-500'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-semibold text-white text-sm">
                          {p.characterName || p.discordTag || 'Боец'}
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          {p.staticId ? `#${p.staticId}` : p.userId}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-pink-400 font-mono text-base">{p.mpCount}</span>
                      <span className="text-[11px] text-gray-500 block">МП</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top Voice */}
          <div className="bg-dark-900/60 border border-dark-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-pink-500" />
              Топ 10 по времени в войсе
            </h2>
            <div className="space-y-2">
              {leaderboard.topVoice.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">Нет данных об активности</div>
              ) : (
                leaderboard.topVoice.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 bg-dark-800/40 rounded-xl border border-dark-800 hover:border-pink-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                          idx === 0
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : idx === 1
                            ? 'bg-gray-400/20 text-gray-300 border border-gray-400/40'
                            : idx === 2
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                            : 'text-gray-500'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-semibold text-white text-sm">
                          {p.characterName || p.discordTag || 'Боец'}
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          {p.staticId ? `#${p.staticId}` : p.userId}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-pink-400 font-mono text-sm">
                        {formatVoice(p.voiceMinutes)}
                      </span>
                      <span className="text-[11px] text-gray-500 block">онлайн</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profiles;
