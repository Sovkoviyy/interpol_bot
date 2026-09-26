import React, { useEffect, useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Shield, 
  Calendar, 
  Clock, 
  Link2, 
  Mic, 
  Copy, 
  Check, 
  Edit3, 
  Plus, 
  RefreshCw, 
  X, 
  Save, 
  IdCard, 
  CheckCircle2, 
  Sparkles,
  AlertTriangle,
  ChevronDown,
  User,
  ShieldCheck,
  Tag,
  Hash
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

interface DiscordRole {
  id: string;
  name: string;
  color: string;
  position: number;
  manageable?: boolean;
}

interface MemberProfile {
  id?: string;
  staticId: string | null;
  characterName: string | null;
  rank: number;
  status: string;
  mpCount: number;
  notes: string | null;
  characters?: any[];
}

interface MemberItem {
  id: string;
  username: string;
  discriminator: string;
  tag: string;
  nickname: string | null;
  displayName: string;
  avatar: string;
  joinedAt: string | null;
  createdAt: string;
  isBot: boolean;
  manageable?: boolean;
  roles: DiscordRole[];
  voiceChannel: { id: string; name: string } | null;
  invite: { inviteCode: string | null; inviterTag: string | null; inviterId: string | null } | null;
  profile: MemberProfile | null;
}

const RANK_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: '1 • Академик', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  2: { label: '2 • Участник', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  3: { label: '3 • Офицер', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  4: { label: '4 • Заместитель', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  5: { label: '5 • Лидер', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Активен', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  ON_LEAVE: { label: 'В отпуске', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  AFK: { label: 'Неактив', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  BLACKLISTED: { label: 'ЧС', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
};

export const Members: React.FC = () => {
  const modal = useModal();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'WITHOUT_STATIC' | 'WITH_STATIC' | 'HUMANS' | 'VOICE' | 'BOTS'>('ALL');
  const [sortBy, setSortBy] = useState<'JOINED_DESC' | 'JOINED_ASC' | 'NAME_ASC' | 'STATIC_ASC' | 'RANK_DESC'>('JOINED_DESC');

  // Edit Profile Modal state
  const [editingMember, setEditingMember] = useState<MemberItem | null>(null);
  const [profileForm, setProfileForm] = useState({
    characterName: '',
    staticId: '',
    rank: 1,
    status: 'ACTIVE',
    notes: '',
    discordNickname: '',
    syncNickname: true,
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Role Management Modal state
  const [roleMember, setRoleMember] = useState<MemberItem | null>(null);
  const [assignedRoleIds, setAssignedRoleIds] = useState<string[]>([]);
  const [roleSearch, setRoleSearch] = useState('');
  const [savingRoles, setSavingRoles] = useState(false);

  // Quick Nickname Modal state
  const [nickMember, setNickMember] = useState<MemberItem | null>(null);
  const [newNickValue, setNewNickValue] = useState('');
  const [savingNick, setSavingNick] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [membersRes, rolesRes] = await Promise.all([
        api.get('/guild/members'),
        api.get('/guild/roles'),
      ]);
      setMembers(membersRes.data.members || []);
      setRoles(rolesRes.data.roles || []);
    } catch (err: any) {
      modal.error(err.response?.data?.error || 'Ошибка при загрузке участников сервера');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Open Edit Profile modal
  const openEditProfile = (m: MemberItem) => {
    setEditingMember(m);
    setProfileForm({
      characterName: m.profile?.characterName || '',
      staticId: m.profile?.staticId || '',
      rank: m.profile?.rank || 1,
      status: m.profile?.status || 'ACTIVE',
      notes: m.profile?.notes || '',
      discordNickname: m.nickname || '',
      syncNickname: true,
    });
  };

  // Save Profile Changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    try {
      setSavingProfile(true);
      const res = await api.put(`/guild/members/${editingMember.id}/profile`, {
        characterName: profileForm.characterName.trim() || null,
        staticId: profileForm.staticId.trim() || null,
        rank: Number(profileForm.rank),
        status: profileForm.status,
        notes: profileForm.notes.trim() || null,
        syncNickname: profileForm.syncNickname,
      });

      // Update in local state
      setMembers((prev) =>
        prev.map((m) => {
          if (m.id === editingMember.id) {
            return {
              ...m,
              nickname: res.data.newNickname || m.nickname,
              profile: res.data.profile,
            };
          }
          return m;
        })
      );

      modal.success('Профиль участника успешно обновлен!');
      setEditingMember(null);
    } catch (err: any) {
      modal.error(err.response?.data?.error || 'Не удалось сохранить профиль');
    } finally {
      setSavingProfile(false);
    }
  };

  // Open Role Management modal
  const openRoleManagement = (m: MemberItem) => {
    setRoleMember(m);
    setAssignedRoleIds(m.roles.map((r) => r.id));
    setRoleSearch('');
  };

  // Toggle role in modal
  const toggleRole = (roleId: string) => {
    setAssignedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  // Save Roles
  const handleSaveRoles = async () => {
    if (!roleMember) return;

    try {
      setSavingRoles(true);
      const res = await api.put(`/guild/members/${roleMember.id}/roles`, {
        roleIds: assignedRoleIds,
      });

      // Update in local state
      setMembers((prev) =>
        prev.map((m) => {
          if (m.id === roleMember.id) {
            return { ...m, roles: res.data.roles };
          }
          return m;
        })
      );

      modal.success(`Роли для ${roleMember.displayName} успешно сохранены!`);
      setRoleMember(null);
    } catch (err: any) {
      modal.error(err.response?.data?.error || 'Ошибка при обновлении ролей');
    } finally {
      setSavingRoles(false);
    }
  };

  // Auto-sync Nickname in Discord
  const handleSyncNickname = async (m: MemberItem) => {
    try {
      const res = await api.post(`/guild/members/${m.id}/sync-nickname`);
      setMembers((prev) =>
        prev.map((item) => (item.id === m.id ? { ...item, nickname: res.data.nickname } : item))
      );
      modal.success(`Никнейм в Discord изменен на: ${res.data.nickname}`);
    } catch (err: any) {
      modal.error(err.response?.data?.error || 'Не удалось синхронизировать никнейм');
    }
  };

  // Save Custom Nickname
  const handleSaveCustomNick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickMember) return;

    try {
      setSavingNick(true);
      const res = await api.put(`/guild/members/${nickMember.id}/nickname`, {
        nickname: newNickValue.trim(),
      });

      setMembers((prev) =>
        prev.map((m) => (m.id === nickMember.id ? { ...m, nickname: res.data.nickname || null } : m))
      );

      modal.success('Никнейм в Discord успешно обновлен!');
      setNickMember(null);
    } catch (err: any) {
      modal.error(err.response?.data?.error || 'Не удалось изменить никнейм');
    } finally {
      setSavingNick(false);
    }
  };

  // Summary statistics
  const stats = useMemo(() => {
    const total = members.length;
    const withStatic = members.filter((m) => m.profile?.staticId).length;
    const withoutStatic = total - withStatic;
    const inVoice = members.filter((m) => m.voiceChannel).length;
    const bots = members.filter((m) => m.isBot).length;
    return { total, withStatic, withoutStatic, inVoice, bots };
  }, [members]);

  // Filter & sort
  const filteredMembers = useMemo(() => {
    return members
      .filter((m) => {
        // Search text
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchTag = m.tag?.toLowerCase().includes(q);
          const matchNick = m.nickname?.toLowerCase().includes(q);
          const matchDisplay = m.displayName?.toLowerCase().includes(q);
          const matchId = m.id?.includes(q);
          const matchChar = m.profile?.characterName?.toLowerCase().includes(q);
          const matchStatic = m.profile?.staticId?.toLowerCase().includes(q);
          const matchInvite = m.invite?.inviteCode?.toLowerCase().includes(q) || m.invite?.inviterTag?.toLowerCase().includes(q);

          if (!matchTag && !matchNick && !matchDisplay && !matchId && !matchChar && !matchStatic && !matchInvite) {
            return false;
          }
        }

        // Role filter
        if (selectedRole !== 'ALL') {
          const hasRole = m.roles?.some((r) => r.id === selectedRole);
          if (!hasRole) return false;
        }

        // Quick type filters
        if (typeFilter === 'WITHOUT_STATIC' && (m.profile?.staticId || m.isBot)) return false;
        if (typeFilter === 'WITH_STATIC' && !m.profile?.staticId) return false;
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
          const nameA = a.profile?.characterName || a.displayName || a.nickname || a.username || '';
          const nameB = b.profile?.characterName || b.displayName || b.nickname || b.username || '';
          return nameA.localeCompare(nameB);
        }
        if (sortBy === 'STATIC_ASC') {
          const sA = a.profile?.staticId ? parseInt(a.profile.staticId, 10) || 9999999 : 9999999;
          const sB = b.profile?.staticId ? parseInt(b.profile.staticId, 10) || 9999999 : 9999999;
          return sA - sB;
        }
        if (sortBy === 'RANK_DESC') {
          const rA = a.profile?.rank || 0;
          const rB = b.profile?.rank || 0;
          return rB - rA;
        }
        return 0;
      });
  }, [members, search, selectedRole, typeFilter, sortBy]);

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Users className="w-7 h-7 text-pink-500" />
            База участников сервера
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Полный список всех участников Discord с возможностью указания игровых ников, статиков Majestic RP и настройки ролей
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#151921] hover:bg-[#1E232F] text-slate-200 border border-[#1E232F] text-xs font-semibold transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-pink-500' : ''}`} />
          Обновить состав
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-white">{stats.total}</div>
            <div className="text-[11px] text-slate-400">Всего участников</div>
          </div>
        </div>

        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-emerald-400">{stats.withStatic}</div>
            <div className="text-[11px] text-slate-400">Привязали статик</div>
          </div>
        </div>

        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-rose-400">{stats.withoutStatic}</div>
            <div className="text-[11px] text-slate-400">Без статика</div>
          </div>
        </div>

        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-blue-400">{stats.inVoice}</div>
            <div className="text-[11px] text-slate-400">Сейчас в войсе</div>
          </div>
        </div>

        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-indigo-400">{roles.length}</div>
            <div className="text-[11px] text-slate-400">Ролей на сервере</div>
          </div>
        </div>
      </div>

      {/* Search & Filters Toolbar */}
      <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Main search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по нику в игре, статику (#142055), нику Discord или ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-colors"
            />
          </div>

          {/* Role Filter */}
          <div className="w-full md:w-56">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-pink-500 cursor-pointer"
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
              className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-pink-500 cursor-pointer"
            >
              <option value="JOINED_DESC">Сначала новые на сервере</option>
              <option value="JOINED_ASC">Сначала старые на сервере</option>
              <option value="NAME_ASC">По имени (А-Я)</option>
              <option value="STATIC_ASC">По номеру статика</option>
              <option value="RANK_DESC">По рангу семьи (с высших)</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1E232F]/60">
          {[
            { id: 'ALL', label: 'Все участники' },
            { id: 'WITHOUT_STATIC', label: '⚠️ Без статика' },
            { id: 'WITH_STATIC', label: '✅ Со статиком' },
            { id: 'HUMANS', label: '👤 Только игроки' },
            { id: 'VOICE', label: '🔊 В голосовых' },
            { id: 'BOTS', label: '🤖 Боты' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTypeFilter(t.id as any)}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-xl transition-all ${
                typeFilter === t.id
                  ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/25'
                  : 'bg-[#0B0E14] text-slate-400 hover:text-slate-200 border border-[#1E232F]'
              }`}
            >
              {t.label}
            </button>
          ))}
          <div className="ml-auto text-xs text-slate-400 font-medium">
            Найдено: <strong className="text-pink-400">{filteredMembers.length}</strong> из {members.length}
          </div>
        </div>
      </div>

      {/* Main Members Table */}
      <div className="bg-[#151921] border border-[#1E232F] rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 text-slate-400 space-y-3">
            <div className="w-10 h-10 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs">Загрузка базы участников и профилей...</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-16 text-center text-slate-500 text-xs space-y-2">
            <Users className="w-8 h-8 mx-auto text-slate-600 mb-2" />
            <p>Участники по заданным критериям не найдены</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1A1F2B] text-slate-400 uppercase tracking-wider font-semibold border-b border-[#1E232F]">
                <tr>
                  <th className="px-5 py-3.5">Участник Discord</th>
                  <th className="px-5 py-3.5">Имя в игре (RP)</th>
                  <th className="px-5 py-3.5">Статик Majestic</th>
                  <th className="px-5 py-3.5">Ранг / Статус</th>
                  <th className="px-5 py-3.5">Роли Discord</th>
                  <th className="px-5 py-3.5">Дата входа</th>
                  <th className="px-5 py-3.5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E232F]">
                {filteredMembers.map((m) => {
                  const rankInfo = RANK_LABELS[m.profile?.rank || 1] || RANK_LABELS[1];
                  const statusInfo = STATUS_LABELS[m.profile?.status || 'ACTIVE'] || STATUS_LABELS.ACTIVE;

                  return (
                    <tr key={m.id} className="hover:bg-[#1A1F2B]/60 transition-colors group">
                      {/* Discord Member Details */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0">
                            <img
                              src={m.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                              alt={m.displayName}
                              className="w-10 h-10 rounded-xl object-cover border border-[#1E232F]"
                            />
                            {m.voiceChannel && (
                              <span
                                className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[#151921] text-[9px] text-white shadow-sm"
                                title={`В голосовом: #${m.voiceChannel.name}`}
                              >
                                🔊
                              </span>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-xs">
                                {m.nickname || m.displayName || m.username}
                              </span>
                              {m.isBot && (
                                <span className="px-1.5 py-0.2 bg-[#5865F2]/20 border border-[#5865F2]/40 text-[#5865F2] text-[9px] font-bold rounded">
                                  BOT
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                              <span>@{m.tag}</span>
                              <span>•</span>
                              <button
                                onClick={() => handleCopy(m.id, `id_${m.id}`)}
                                className="font-mono text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
                                title="Нажмите, чтобы скопировать Discord ID"
                              >
                                <span>{m.id}</span>
                                {copiedId === `id_${m.id}` ? (
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Character Name in-game */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {m.profile?.characterName ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-200">
                              {m.profile.characterName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[11px] italic">Не указан</span>
                        )}
                      </td>

                      {/* Static ID */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {m.profile?.staticId ? (
                          <button
                            onClick={() => handleCopy(m.profile!.staticId!, `static_${m.id}`)}
                            className="px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/25 text-pink-400 font-mono text-[11px] font-bold hover:bg-pink-500/20 transition-all flex items-center gap-1.5"
                            title="Кликните для копирования статика"
                          >
                            <Hash className="w-3 h-3 text-pink-500" />
                            {m.profile.staticId}
                            {copiedId === `static_${m.id}` ? (
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                            ) : null}
                          </button>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/25 text-rose-400 text-[10px] font-semibold flex items-center gap-1 w-fit">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Нет статика
                          </span>
                        )}
                      </td>

                      {/* Rank & Status */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="space-y-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border block w-fit ${rankInfo.color}`}>
                            {rankInfo.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-semibold border block w-fit ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                      </td>

                      {/* Discord Roles */}
                      <td className="px-5 py-3.5 max-w-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {m.roles.length === 0 ? (
                            <span className="text-slate-600 italic text-[11px]">Без ролей</span>
                          ) : (
                            m.roles.slice(0, 3).map((r) => (
                              <span
                                key={r.id}
                                className="px-2 py-0.5 rounded-md text-[10px] font-medium border flex items-center gap-1"
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
                          {m.roles.length > 3 && (
                            <button
                              onClick={() => openRoleManagement(m)}
                              className="px-1.5 py-0.5 rounded bg-[#1E232F] text-slate-400 hover:text-white text-[10px] font-semibold"
                            >
                              +{m.roles.length - 3}
                            </button>
                          )}
                          <button
                            onClick={() => openRoleManagement(m)}
                            className="p-1 rounded hover:bg-[#1E232F] text-slate-500 hover:text-pink-400 transition-colors ml-1"
                            title="Настроить роли в Discord"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Joined Date */}
                      <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>{formatDate(m.joinedAt)}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick sync nickname button */}
                          {m.profile?.characterName && (
                            <button
                              onClick={() => handleSyncNickname(m)}
                              className="p-1.5 rounded-lg bg-[#0B0E14] hover:bg-[#1E232F] text-slate-400 hover:text-pink-400 border border-[#1E232F] transition-all"
                              title="Синхронизировать ник в ДС (Имя | Статик)"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Manage roles button */}
                          <button
                            onClick={() => openRoleManagement(m)}
                            className="p-1.5 rounded-lg bg-[#0B0E14] hover:bg-[#1E232F] text-slate-400 hover:text-indigo-400 border border-[#1E232F] transition-all"
                            title="Управление ролями в Discord"
                          >
                            <Shield className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit profile modal trigger */}
                          <button
                            onClick={() => openEditProfile(m)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-pink-600/20 to-rose-600/20 hover:from-pink-600/30 hover:to-rose-600/30 text-pink-400 border border-pink-500/30 text-[11px] font-semibold transition-all shadow-sm"
                          >
                            <Edit3 className="w-3 h-3" />
                            Профиль
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

      {/* ========================================================= */}
      {/* 1. Modal: Edit User Profile (Character, Static, Rank, etc.) */}
      {/* ========================================================= */}
      {editingMember && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#1E232F] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={editingMember.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                  alt=""
                  className="w-10 h-10 rounded-xl border border-[#1E232F]"
                />
                <div>
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    Редактирование профиля: {editingMember.displayName}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Discord ID: <span className="font-mono text-slate-300">{editingMember.id}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setEditingMember(null)}
                className="p-1.5 rounded-xl hover:bg-[#1E232F] text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveProfile} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Character Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                    Имя персонажа в игре (RP Nick)
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tony Montana"
                      value={profileForm.characterName}
                      onChange={(e) => setProfileForm({ ...profileForm, characterName: e.target.value })}
                      className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </div>

                {/* Static ID */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                    Статический ID (Паспорт)
                  </label>
                  <div className="relative">
                    <Hash className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="142055"
                      value={profileForm.staticId}
                      onChange={(e) => setProfileForm({ ...profileForm, staticId: e.target.value })}
                      className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-pink-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Rank */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                    Ранг в семье
                  </label>
                  <select
                    value={profileForm.rank}
                    onChange={(e) => setProfileForm({ ...profileForm, rank: Number(e.target.value) })}
                    className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                  >
                    <option value={1}>1 • Академик</option>
                    <option value={2}>2 • Участник</option>
                    <option value={3}>3 • Офицер</option>
                    <option value={4}>4 • Заместитель</option>
                    <option value={5}>5 • Лидер</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                    Статус активности
                  </label>
                  <select
                    value={profileForm.status}
                    onChange={(e) => setProfileForm({ ...profileForm, status: e.target.value })}
                    className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                  >
                    <option value="ACTIVE">Активен</option>
                    <option value="ON_LEAVE">В отпуске</option>
                    <option value="AFK">Неактив</option>
                    <option value="BLACKLISTED">Черный список (ЧС)</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                  Заметки руководства (причины, замечания, выговоры)
                </label>
                <textarea
                  rows={2}
                  placeholder="Дополнительные пометки руководства..."
                  value={profileForm.notes}
                  onChange={(e) => setProfileForm({ ...profileForm, notes: e.target.value })}
                  className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-pink-500 resize-none"
                />
              </div>

              {/* Discord Nickname Synchronization Toggle */}
              <div className="bg-[#0B0E14] border border-[#1E232F] rounded-xl p-3 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="syncNicknameCheck"
                  checked={profileForm.syncNickname}
                  onChange={(e) => setProfileForm({ ...profileForm, syncNickname: e.target.checked })}
                  className="mt-0.5 rounded border-slate-700 text-pink-500 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="syncNicknameCheck" className="text-xs text-slate-300 cursor-pointer">
                  <span className="font-semibold text-white block">
                    Автоматически изменить никнейм в Discord
                  </span>
                  Установит формат: <code className="text-pink-400 font-mono text-[11px]">
                    {profileForm.characterName || 'Имя'} {profileForm.staticId ? `| ${profileForm.staticId}` : ''}
                  </code>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1E232F]">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 rounded-xl bg-[#0B0E14] hover:bg-[#1E232F] text-slate-300 text-xs font-semibold transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white text-xs font-semibold shadow-md shadow-pink-600/25 transition-all disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingProfile ? 'Сохранение...' : 'Сохранить профиль'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. Modal: Manage Discord Roles for Member                  */}
      {/* ========================================================= */}
      {roleMember && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#1E232F] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-white text-sm">
                    Роли: {roleMember.displayName}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Выбрано ролей: <strong className="text-white">{assignedRoleIds.length}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setRoleMember(null)}
                className="p-1.5 rounded-xl hover:bg-[#1E232F] text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Role Search */}
            <div className="p-3 border-b border-[#1E232F] bg-[#0B0E14]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Поиск по названию роли..."
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  className="w-full bg-[#151921] border border-[#1E232F] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Roles List */}
            <div className="p-3 overflow-y-auto space-y-1 flex-1 custom-scrollbar">
              {roles
                .filter((r) => r.name.toLowerCase().includes(roleSearch.toLowerCase()))
                .map((r) => {
                  const isChecked = assignedRoleIds.includes(r.id);
                  const canEdit = r.manageable !== false;

                  return (
                    <div
                      key={r.id}
                      onClick={() => canEdit && toggleRole(r.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                        !canEdit
                          ? 'opacity-40 cursor-not-allowed bg-[#0B0E14] border-[#1E232F]'
                          : isChecked
                          ? 'bg-indigo-600/10 border-indigo-500/30 cursor-pointer'
                          : 'bg-[#0B0E14] hover:bg-[#1E232F] border-[#1E232F] cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: r.color !== '#000000' ? r.color : '#64748B' }}
                        />
                        <span
                          className="text-xs font-semibold"
                          style={{ color: r.color !== '#000000' ? r.color : '#E2E8F0' }}
                        >
                          @{r.name}
                        </span>
                        {!canEdit && (
                          <span className="text-[9px] text-amber-400 font-mono bg-amber-400/10 px-1.5 py-0.5 rounded">
                            Выше роли бота
                          </span>
                        )}
                      </div>

                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={!canEdit}
                        onChange={() => {}}
                        className="rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                    </div>
                  );
                })}
            </div>

            {/* Modal Actions */}
            <div className="p-3 border-t border-[#1E232F] bg-[#151921] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRoleMember(null)}
                className="px-4 py-2 rounded-xl bg-[#0B0E14] hover:bg-[#1E232F] text-slate-300 text-xs font-semibold transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveRoles}
                disabled={savingRoles}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/25 transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {savingRoles ? 'Применение в Discord...' : 'Применить роли'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Members;
