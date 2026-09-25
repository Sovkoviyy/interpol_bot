import React, { useEffect, useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Shield, 
  Calendar, 
  Clock, 
  Link2, 
  Mic, 
  Copy, 
  Check, 
  Bot, 
  UserCheck,
  ArrowUpDown,
  ExternalLink
} from 'lucide-react';
import api from '../api/client';

export const Members: React.FC = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Sorting state
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'HUMANS' | 'BOTS' | 'VOICE'>('ALL');
  const [sortBy, setSortBy] = useState<'JOINED_DESC' | 'JOINED_ASC' | 'NAME_ASC' | 'CREATED_DESC'>('JOINED_DESC');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [membersRes, rolesRes] = await Promise.all([
        api.get('/guild/members'),
        api.get('/guild/roles'),
      ]);
      setMembers(membersRes.data.members || []);
      setRoles(rolesRes.data.roles || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Filter and sort members
  const filteredMembers = useMemo(() => {
    return members
      .filter((m) => {
        // Search text (matches tag, nickname, id, displayName, invite code)
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchTag = m.tag?.toLowerCase().includes(q);
          const matchNick = m.nickname?.toLowerCase().includes(q);
          const matchDisplay = m.displayName?.toLowerCase().includes(q);
          const matchId = m.id?.includes(q);
          const matchInvite = m.invite?.inviteCode?.toLowerCase().includes(q) || m.invite?.inviterTag?.toLowerCase().includes(q);

          if (!matchTag && !matchNick && !matchDisplay && !matchId && !matchInvite) {
            return false;
          }
        }

        // Role filter
        if (selectedRole !== 'ALL') {
          const hasRole = m.roles?.some((r: any) => r.id === selectedRole);
          if (!hasRole) return false;
        }

        // Type filter
        if (typeFilter === 'HUMANS' && m.isBot) return false;
        if (typeFilter === 'BOTS' && !m.isBot) return false;
        if (typeFilter === 'VOICE' && !m.voiceChannel) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'JOINED_DESC') {
          const tA = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
          const tB = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
          return tB - tA;
        }
        if (sortBy === 'JOINED_ASC') {
          const tA = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
          const tB = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
          return tA - tB;
        }
        if (sortBy === 'NAME_ASC') {
          const nameA = a.displayName || a.nickname || a.username || '';
          const nameB = b.displayName || b.nickname || b.username || '';
          return nameA.localeCompare(nameB);
        }
        if (sortBy === 'CREATED_DESC') {
          const tA = new Date(a.createdAt).getTime();
          const tB = new Date(b.createdAt).getTime();
          return tB - tA;
        }
        return 0;
      });
  }, [members, search, selectedRole, typeFilter, sortBy]);

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return 'Неизвестно';
    const d = new Date(isoStr);
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-pink-500" />
            Состав и участники сервера
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Полная база участников: роли, дата вступления, возраст аккаунта и история инвайт-ссылок
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-[#151921] border border-[#1E232F] text-slate-300">
            Всего: <strong className="text-white">{members.length}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-[#151921] border border-[#1E232F] text-slate-300">
            Найдено: <strong className="text-pink-400">{filteredMembers.length}</strong>
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по нику, тегу, ID (155...) или коду ссылки..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-pink-500"
            />
          </div>

          {/* Role Filter */}
          <div className="w-full md:w-56">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500"
            >
              <option value="ALL">Все роли ({roles.length})</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  @{r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Selector */}
          <div className="w-full md:w-56">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500"
            >
              <option value="JOINED_DESC">Сначала новые на сервере</option>
              <option value="JOINED_ASC">Сначала старые на сервере</option>
              <option value="NAME_ASC">По алфавиту (А-Я)</option>
              <option value="CREATED_DESC">Сначала новые аккаунты Discord</option>
            </select>
          </div>
        </div>

        {/* Type Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1E232F]/50">
          {[
            { id: 'ALL', label: 'Все участники' },
            { id: 'HUMANS', label: '👤 Только игроки' },
            { id: 'VOICE', label: '🔊 В голосовых' },
            { id: 'BOTS', label: '🤖 Только боты' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTypeFilter(t.id as any)}
              className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                typeFilter === t.id
                  ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/25'
                  : 'bg-[#0B0E14] text-slate-400 hover:text-slate-200 border border-[#1E232F]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Members List Table */}
      <div className="bg-[#151921] border border-[#1E232F] rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-slate-400">
            <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            Участники по заданным критериям не найдены
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1E232F]/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-[#1E232F]">
                <tr>
                  <th className="px-5 py-3.5">Участник</th>
                  <th className="px-5 py-3.5">Роли на сервере</th>
                  <th className="px-5 py-3.5">Вступил на сервер</th>
                  <th className="px-5 py-3.5">Возраст аккаунта</th>
                  <th className="px-5 py-3.5">Инвайт / Ссылка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E232F]">
                {filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-[#1A1F2B]/60 transition-colors">
                    {/* Member details */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <img
                            src={m.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                            alt={m.displayName}
                            className="w-10 h-10 rounded-xl object-cover border border-[#1E232F]"
                          />
                          {m.voiceChannel && (
                            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[#151921] text-[9px] text-white">
                              🔊
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">
                              {m.displayName || m.nickname || m.username}
                            </span>
                            {m.isBot && (
                              <span className="px-1.5 py-0.2 bg-[#5865F2]/20 border border-[#5865F2]/40 text-[#5865F2] text-[9px] font-bold rounded">
                                BOT
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span>@{m.tag}</span>
                            <span>•</span>
                            <button
                              onClick={() => handleCopyId(m.id)}
                              className="font-mono text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 group"
                              title="Нажмите для копирования ID"
                            >
                              <span>{m.id}</span>
                              {copiedId === m.id ? (
                                <Check className="w-2.5 h-2.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
                            </button>
                          </div>

                          {m.voiceChannel && (
                            <p className="text-[10px] text-emerald-400 mt-0.5 flex items-center gap-1">
                              <Mic className="w-3 h-3" /> В войсе: #{m.voiceChannel.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Roles */}
                    <td className="px-5 py-3.5 max-w-xs">
                      <div className="flex flex-wrap gap-1.5">
                        {m.roles.length === 0 ? (
                          <span className="text-slate-600 italic">Без ролей</span>
                        ) : (
                          m.roles.map((r: any) => (
                            <span
                              key={r.id}
                              className="px-2 py-0.5 rounded-md text-[10px] font-semibold border flex items-center gap-1"
                              style={{
                                backgroundColor: r.color !== '#000000' ? `${r.color}15` : '#1E232F',
                                borderColor: r.color !== '#000000' ? `${r.color}40` : '#2E3547',
                                color: r.color !== '#000000' ? r.color : '#CBD5E1',
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: r.color !== '#000000' ? r.color : '#94A3B8' }}
                              />
                              {r.name}
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    {/* Joined At */}
                    <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>{formatDate(m.joinedAt)}</span>
                      </div>
                    </td>

                    {/* Account Created At */}
                    <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{formatDate(m.createdAt)}</span>
                      </div>
                    </td>

                    {/* Invite info */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {m.invite ? (
                        <div className="space-y-0.5">
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[10px] inline-flex items-center gap-1">
                            <Link2 className="w-3 h-3" />
                            {m.invite.inviteCode}
                          </span>
                          {m.invite.inviterTag && (
                            <p className="text-[10px] text-slate-400">
                              От: <span className="text-slate-300 font-medium">@{m.invite.inviterTag}</span>
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600 text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Members;
