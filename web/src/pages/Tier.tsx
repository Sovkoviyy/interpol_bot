import React, { useEffect, useState } from 'react';
import { 
  Target, 
  Video, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Shield, 
  FolderTree, 
  Send,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

export const Tier: React.FC = () => {
  const modal = useModal();
  const [config, setConfig] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'REVIEWED'>('ALL');
  const [mpFilter, setMpFilter] = useState<string>('ALL');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cfgRes, subRes] = await Promise.all([
        api.get('/tier/config'),
        api.get('/tier/submissions'),
      ]);
      setConfig(cfgRes.data.config);
      setSubmissions(subRes.data.submissions || []);
    } catch (err: any) {
      console.error('Failed to fetch tier data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSetup = async () => {
    const confirmed = await modal.confirm({
      title: 'Развернуть структуру Тир-системы?',
      message: 'Бот автоматически создаст категорию «ЗАЯВКИ НА ТИР», канал «заявки-на-тир» с интерактивной кнопкой подачи, закрытый канал «проверка-тир» и роль «Тир чекер».',
      confirmText: 'Развернуть структуру',
      type: 'pink',
    });
    if (!confirmed) return;

    try {
      setLoading(true);
      await api.post('/tier/setup');
      modal.alert({
        title: 'Успешно!',
        message: 'Категория, каналы и роль тир-чекеров успешно созданы в Discord!',
        type: 'success',
      });
      fetchData();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось развернуть структуру',
        type: 'error',
      });
      setLoading(false);
    }
  };

  const filteredSubmissions = submissions.filter((sub) => {
    if (filter === 'PENDING' && sub.status !== 'PENDING') return false;
    if (filter === 'REVIEWED' && sub.status !== 'REVIEWED') return false;
    if (mpFilter !== 'ALL' && sub.mpType !== mpFilter) return false;
    return true;
  });

  const pendingCount = submissions.filter((s) => s.status === 'PENDING').length;
  const reviewedCount = submissions.filter((s) => s.status === 'REVIEWED').length;

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                Тир система
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-mono font-bold border border-pink-500/30">
                  TIER
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Заявки на получение тира, сдача откатов (Капт, MCL, ВЗЗ, РП) и проверка тир-чекерами
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSetup}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-pink-600/25 transition-all whitespace-nowrap disabled:opacity-50"
        >
          <FolderTree className="w-4 h-4" />
          <span>Развернуть структуру в Discord</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-pink-500/10 text-pink-400">
            <Video className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{submissions.length}</div>
            <div className="text-xs text-slate-400 font-medium">Всего сдано откатов</div>
          </div>
        </div>

        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-300">{pendingCount}</div>
            <div className="text-xs text-slate-400 font-medium">Ожидают проверки</div>
          </div>
        </div>

        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-300">{reviewedCount}</div>
            <div className="text-xs text-slate-400 font-medium">Проверено чекерами</div>
          </div>
        </div>
      </div>

      {/* Submissions Section */}
      <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Video className="w-4 h-4 text-pink-400" />
              Откаты участников
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Все видеозаписи, отправленные в ветки мероприятий
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-[#0B0E14] border border-[#1E232F] rounded-xl p-1 text-xs">
              <button
                onClick={() => setFilter('ALL')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  filter === 'ALL' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Все ({submissions.length})
              </button>
              <button
                onClick={() => setFilter('PENDING')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  filter === 'PENDING' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Ожидают ({pendingCount})
              </button>
              <button
                onClick={() => setFilter('REVIEWED')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  filter === 'REVIEWED' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Проверены ({reviewedCount})
              </button>
            </div>

            <select
              value={mpFilter}
              onChange={(e) => setMpFilter(e.target.value)}
              className="bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-pink-500"
            >
              <option value="ALL">Все МП</option>
              <option value="Капт">Капт</option>
              <option value="MCL">MCL</option>
              <option value="ВЗЗ">ВЗЗ</option>
              <option value="РП">РП</option>
            </select>
          </div>
        </div>

        {/* List of Submissions */}
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs">Загрузка данных...</div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs bg-[#0B0E14] rounded-xl border border-[#1E232F]">
            Откатов в данной категории пока нет
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSubmissions.map((sub) => (
              <div
                key={sub.id}
                className="bg-[#0B0E14] border border-[#1E232F] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-700/60 transition-all"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-pink-500/10 text-pink-400 font-bold border border-pink-500/20">
                      {sub.mpType}
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {sub.userTag || sub.userId}
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                        sub.status === 'REVIEWED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {sub.status === 'REVIEWED' ? 'Просмотрен' : 'Ожидает проверки'}
                    </span>
                  </div>

                  {sub.comment && (
                    <p className="text-xs text-slate-300 italic">
                      «{sub.comment}»
                    </p>
                  )}

                  {sub.status === 'REVIEWED' && sub.reviewerComment && (
                    <div className="text-xs text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 mt-1">
                      <strong>Вердикт тир-чекера ({sub.reviewerTag || 'Чекер'}):</strong>{' '}
                      {sub.reviewerComment}
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500">
                    Отправлено: {new Date(sub.createdAt).toLocaleString('ru-RU')}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                  <a
                    href={sub.clipUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E232F] hover:bg-slate-700/60 text-slate-200 rounded-lg text-xs font-medium transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-pink-400" />
                    <span>Смотреть откат</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Tier;
