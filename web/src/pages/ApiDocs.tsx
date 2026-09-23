import React, { useEffect, useState } from 'react';
import { 
  Terminal, 
  Key, 
  Copy, 
  Check, 
  RefreshCw, 
  ExternalLink, 
  ShieldCheck, 
  Code2, 
  Zap, 
  Layers, 
  BookOpen, 
  Server,
  Lock,
  Globe
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

export const ApiDocs: React.FC = () => {
  const modal = useModal();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState<'curl' | 'js' | 'python'>('curl');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  useEffect(() => {
    // Fetch stats to get current API key
    api.get('/stats')
      .then((res) => {
        if (res.data?.apiKey) setApiKey(res.data.apiKey);
      })
      .catch(() => null);
  }, []);

  const handleGenerateKey = async () => {
    if (apiKey) {
      const confirmed = await modal.confirm({
        title: 'Перевыпуск API ключа',
        message: 'Старый API-ключ моментально перестанет действовать! Любые внешние сервисы, использующие его, потеряют доступ. Вы уверены?',
        confirmText: 'Да, перевыпустить',
        type: 'danger',
      });
      if (!confirmed) return;
    }

    try {
      setGeneratingKey(true);
      const res = await api.post('/stats/api-key/generate');
      if (res.data?.apiKey) {
        setApiKey(res.data.apiKey);
        modal.alert({
          title: 'Ключ сгенерирован',
          message: 'Новый X-API-Key успешно создан и сохранен в базе данных.',
          type: 'success',
        });
      }
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось сгенерировать API-ключ',
        type: 'error',
      });
    } finally {
      setGeneratingKey(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    if (id === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedSnippet(id);
      setTimeout(() => setCopiedSnippet(null), 2000);
    }
  };

  const sampleKey = apiKey || 'interpol_3f8a91b2c4d5e6f7a8b9c0d1e2f3a4b5';

  const snippets = {
    curl: `curl -X GET "${origin}/api/stats/external" \\
  -H "X-API-Key: ${sampleKey}"`,
    js: `// JavaScript (Node.js / Browser)
const response = await fetch("${origin}/api/stats/external", {
  method: "GET",
  headers: {
    "X-API-Key": "${sampleKey}"
  }
});
const { success, data } = await response.json();
console.log("Turnout:", data.events.totalTurnout);
console.log("Recruits:", data.recruitment.total);`,
    python: `# Python (requests)
import requests

url = "${origin}/api/stats/external"
headers = {
    "X-API-Key": "${sampleKey}"
}

response = requests.get(url, headers=headers)
data = response.json()
print("Total members:", data["data"]["guild"]["totalMembers"])
print("Online in voice:", data["data"]["guild"]["voiceOnline"])`
  };

  const sampleJson = `{
  "success": true,
  "data": {
    "guild": {
      "id": "123456789012345678",
      "name": "Interpol Majestic RP",
      "icon": "https://cdn.discordapp.com/icons/...",
      "totalMembers": 184,
      "onlineMembers": 92,
      "humanCount": 178,
      "botCount": 6,
      "voiceOnline": 28,
      "channelsCount": 42,
      "rolesCount": 24
    },
    "recruitment": {
      "total": 65,
      "pending": 4,
      "accepted": 48,
      "rejected": 13,
      "approvalRate": 79,
      "leaderboard": [
        {
          "tag": "Recruiter#0001",
          "accepted": 24,
          "rejected": 6,
          "total": 30
        }
      ]
    },
    "events": {
      "total": 38,
      "active": 1,
      "finished": 37,
      "totalTurnout": 412
    },
    "system": {
      "savedRolesProfiles": 115,
      "cachedAt": 1727092800000,
      "cacheExpiresInSec": 28
    }
  }
}`;

  const restEndpoints = [
    {
      group: 'Внешний API (External API)',
      items: [
        { method: 'GET', path: '/api/stats/external', desc: 'Публичная статистика семьи для сайтов и виджетов (требует X-API-Key)', auth: 'X-API-Key' },
      ]
    },
    {
      group: 'Состав & Профили',
      items: [
        { method: 'GET', path: '/api/profiles', desc: 'Список профилей участников с поиском по статику/нику/ID', auth: 'User Auth' },
        { method: 'GET', path: '/api/profiles/leaderboard', desc: 'Топ участников по сыгранным МП и часам в войсе', auth: 'User Auth' },
        { method: 'POST', path: '/api/profiles/:userId/static', desc: 'Привязка Majestic Static ID и имени персонажа', auth: 'Self / Manage' },
        { method: 'POST', path: '/api/profiles/:userId/penalty', desc: 'Выписать штрафные МП кандидату или бойцу', auth: 'manageRecruiting' },
      ]
    },
    {
      group: 'Академия (1-2 ранг)',
      items: [
        { method: 'GET', path: '/api/academy/config', desc: 'Конфигурация академии (категории, лимиты, роли)', auth: 'User Auth' },
        { method: 'POST', path: '/api/academy/config', desc: 'Сохранить настройки академии', auth: 'manageSettings' },
        { method: 'GET', path: '/api/academy/channels', desc: 'Активные персональные каналы академиков #academ-name', auth: 'User Auth' },
        { method: 'GET', path: '/api/academy/reports', desc: 'Список поданных отчетов со скриншотами с МП', auth: 'User Auth' },
        { method: 'POST', path: '/api/academy/reports/:id/review', desc: 'Одобрить или отклонить отчет по МП с причиной/штрафом', auth: 'manageRecruiting' },
        { method: 'POST', path: '/api/academy/channels/:id/promote', desc: 'Утвердить повышение на 2 ранг и отправить в архив', auth: 'manageRecruiting' },
      ]
    },
    {
      group: 'Умный войс & Мероприятия (МП)',
      items: [
        { method: 'GET', path: '/api/voice-tracker/config', desc: 'Настройки войс-трекера и список кастомных типов МП', auth: 'User Auth' },
        { method: 'POST', path: '/api/voice-tracker/config', desc: 'Сохранение настроек и типов МП (синхронизирует Discord пульт)', auth: 'manageSettings' },
        { method: 'GET', path: '/api/voice-tracker/sessions', desc: 'История прошедших сборов и списки явки участников', auth: 'User Auth' },
        { method: 'POST', path: '/api/voice-tracker/start', desc: 'Запуск сбора в войсе с динамическим переименованием', auth: 'manageEvents' },
        { method: 'POST', path: '/api/voice-tracker/end', desc: 'Завершение МП, авто-подсчет времени и начисление в профили', auth: 'manageEvents' },
        { method: 'POST', path: '/api/voice-tracker/deploy-panel', desc: 'Отправка интерактивного пульта управления МП в канал', auth: 'manageSettings' },
      ]
    },
    {
      group: 'Сборы на МП (Анонсы и пинги)',
      items: [
        { method: 'GET', path: '/api/events', desc: 'Список активных и завершенных сборов с таймерами', auth: 'User Auth' },
        { method: 'POST', path: '/api/events', desc: 'Создать новый сбор с прогрессивными напоминаниями в Discord', auth: 'manageEvents' },
        { method: 'POST', path: '/api/events/:id/close', desc: 'Закрыть сбор с авто-удалением анонса через 30 минут', auth: 'manageEvents' },
      ]
    },
    {
      group: 'Отпуска & Неактив',
      items: [
        { method: 'GET', path: '/api/leave/requests', desc: 'Список всех поданных заявок на отпуск (до 14 дней)', auth: 'User Auth' },
        { method: 'POST', path: '/api/leave/request', desc: 'Подать заявление на отпуск / неактив', auth: 'User Auth' },
        { method: 'POST', path: '/api/leave/:id/review', desc: 'Одобрить или отклонить отпуск с указанием причины', auth: 'manageRecruiting' },
      ]
    },
    {
      group: 'Выплаты рекрутерам (Зарплаты)',
      items: [
        { method: 'GET', path: '/api/payroll/config', desc: 'Тарифные ставки за анкеты, проверенные отчеты и повышения', auth: 'User Auth' },
        { method: 'POST', path: '/api/payroll/config', desc: 'Обновить ставки выплат рекрутерам', auth: 'manageSettings' },
        { method: 'GET', path: '/api/payroll/calculate', desc: 'Расчет причитающихся выплат по каждому рекрутеру', auth: 'manageRecruiting' },
        { method: 'POST', path: '/api/payroll/payout', desc: 'Зафиксировать факт выплаты зарплаты в журнале', auth: 'manageRecruiting' },
      ]
    },
    {
      group: 'Безопасность (Anti-Nuke & ЧС)',
      items: [
        { method: 'GET', path: '/api/anti-nuke/config', desc: 'Параметры защиты от сливов каналов и прав', auth: 'User Auth' },
        { method: 'POST', path: '/api/anti-nuke/config', desc: 'Сохранить настройки Anti-Nuke', auth: 'manageSettings' },
        { method: 'POST', path: '/api/anti-nuke/snapshots', desc: 'Сделать снимок структуры сервера для отката', auth: 'manageSettings' },
        { method: 'GET', path: '/api/blacklist', desc: 'База черного списка семьи с поиском', auth: 'manageRecruiting' },
        { method: 'POST', path: '/api/blacklist', desc: 'Внести нарушителя в ЧС по статику с пруфами', auth: 'manageRecruiting' },
        { method: 'DELETE', path: '/api/blacklist/:id', desc: 'Снять ЧС с игрока', auth: 'manageRecruiting' },
      ]
    },
    {
      group: 'Сервер, Каналы & Бот',
      items: [
        { method: 'GET', path: '/api/setup/guilds', desc: 'Список серверов, где присутствует бот', auth: 'User Auth' },
        { method: 'GET', path: '/api/setup/state', desc: 'Детальная карта привязок каналов и категорий', auth: 'User Auth' },
        { method: 'POST', path: '/api/setup/provision', desc: 'Создание полной структуры сервера в 1 клик', auth: 'manageSettings' },
        { method: 'POST', path: '/api/setup/deploy-panel', desc: 'Отправка любой интерактивной панели бота в канал', auth: 'manageSettings' },
        { method: 'GET', path: '/api/bot/status', desc: 'Текущий статус Discord Gateway подключения бота', auth: 'User Auth' },
        { method: 'POST', path: '/api/bot/restart', desc: 'Горячая перезагрузка Discord бота изнутри сайта', auth: 'manageSettings' },
      ]
    }
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-950/40 via-[#151921] to-[#0B0E14] border border-pink-500/30 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-pink-500/10 text-pink-400 border border-pink-500/20 mb-3">
              <Globe className="w-3.5 h-3.5" />
              Interpol Developer Platform
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              API & Документация разработчика
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
              Официальное API бота семьи Interpol. Используйте эти эндпоинты для интеграции со своими сайтами, ботами, таблицами и внешними сервисами Majestic RP.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              REST API v2 Online
            </span>
          </div>
        </div>
      </div>

      {/* API Key Management Box */}
      <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#1E232F] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Ключ доступа к внешнему API (X-API-Key)</h2>
              <p className="text-xs text-slate-400">Используется для авторизации запросов к публичным данным семьи</p>
            </div>
          </div>

          <button
            onClick={handleGenerateKey}
            disabled={generatingKey}
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-pink-500/20 text-pink-400 border border-dark-700 hover:border-pink-500/40 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generatingKey ? 'animate-spin' : ''}`} />
            {apiKey ? 'Перевыпустить ключ' : 'Создать API ключ'}
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2">Ваш секретный API ключ:</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[#0B0E14] border border-[#1E232F] rounded-xl px-4 py-2.5 font-mono text-xs text-slate-200 select-all truncate">
              {apiKey || 'Ключ еще не сгенерирован. Нажмите «Создать API ключ» справа.'}
            </div>
            {apiKey && (
              <button
                onClick={() => copyToClipboard(apiKey, 'key')}
                className="px-4 py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-pink-600/25 shrink-0"
              >
                {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedKey ? 'Скопировано!' : 'Скопировать'}
              </button>
            )}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-pink-400" />
            <span>Передавайте ключ в заголовке <code className="text-pink-400 font-mono bg-dark-900 px-1 py-0.5 rounded">X-API-Key: {apiKey ? apiKey.slice(0, 16) + '...' : 'key'}</code></span>
          </div>
        </div>
      </div>

      {/* External Stats API Section */}
      <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Публичная статистика: GET /api/stats/external</h2>
            <p className="text-xs text-slate-400">
              Сводная информация: онлайн в войсе, общее число участников, явка на МП, статистика рекрутинга и топ рекрутеров
            </p>
          </div>
        </div>

        {/* Specs Pill List */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[#0B0E14] border border-[#1E232F]">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Метод</span>
            <span className="font-mono text-emerald-400 font-bold mt-1 inline-block">GET</span>
          </div>
          <div className="p-3 rounded-xl bg-[#0B0E14] border border-[#1E232F]">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Rate Limit</span>
            <span className="font-mono text-slate-200 font-semibold mt-1 inline-block">60 req / min</span>
          </div>
          <div className="p-3 rounded-xl bg-[#0B0E14] border border-[#1E232F]">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Кэширование</span>
            <span className="font-mono text-pink-400 font-semibold mt-1 inline-block">30 секунд</span>
          </div>
          <div className="p-3 rounded-xl bg-[#0B0E14] border border-[#1E232F]">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Формат ответа</span>
            <span className="font-mono text-indigo-400 font-semibold mt-1 inline-block">JSON</span>
          </div>
        </div>

        {/* Code Snippets with Tab Switcher */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex bg-[#0B0E14] p-1 rounded-xl border border-[#1E232F] text-xs">
              <button
                onClick={() => setSelectedLang('curl')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  selectedLang === 'curl' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                cURL
              </button>
              <button
                onClick={() => setSelectedLang('js')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  selectedLang === 'js' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                JavaScript
              </button>
              <button
                onClick={() => setSelectedLang('python')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  selectedLang === 'python' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Python
              </button>
            </div>

            <button
              onClick={() => copyToClipboard(snippets[selectedLang], 'snippet')}
              className="text-xs text-pink-400 hover:text-pink-300 font-medium flex items-center gap-1.5"
            >
              {copiedSnippet === 'snippet' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSnippet === 'snippet' ? 'Скопировано!' : 'Копировать пример'}
            </button>
          </div>

          <div className="relative">
            <pre className="p-4 rounded-xl bg-[#0B0E14] border border-[#1E232F] text-xs text-slate-300 font-mono overflow-x-auto custom-scrollbar leading-relaxed">
              {snippets[selectedLang]}
            </pre>
          </div>
        </div>

        {/* Response JSON Example */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Пример ответа сервера (200 OK):</h3>
            <button
              onClick={() => copyToClipboard(sampleJson, 'json')}
              className="text-xs text-slate-400 hover:text-white font-medium flex items-center gap-1"
            >
              {copiedSnippet === 'json' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSnippet === 'json' ? 'Скопировано!' : 'Копировать JSON'}
            </button>
          </div>
          <pre className="p-4 rounded-xl bg-[#0B0E14] border border-[#1E232F] text-[11px] text-pink-300 font-mono overflow-x-auto max-h-72 custom-scrollbar leading-relaxed">
            {sampleJson}
          </pre>
        </div>
      </div>

      {/* Internal Endpoints Directory */}
      <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Полный справочник REST API системы</h2>
            <p className="text-xs text-slate-400">
              Список всех внутренних сервисов. Запросы к ним требуют заголовок авторизации <code className="text-pink-400 font-mono">Authorization: Bearer &lt;token&gt;</code>
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {restEndpoints.map((group, gIdx) => (
            <div key={gIdx} className="space-y-2">
              <h3 className="text-xs font-bold text-pink-400 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                {group.group}
              </h3>
              <div className="divide-y divide-[#1E232F] rounded-xl border border-[#1E232F] bg-[#0B0E14] overflow-hidden text-xs">
                {group.items.map((item, iIdx) => (
                  <div key={iIdx} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#151922] transition-colors">
                    <div className="flex items-center gap-2.5">
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                        item.method === 'GET' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        item.method === 'POST' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                        'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {item.method}
                      </span>
                      <code className="font-mono text-white text-xs font-semibold">{item.path}</code>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <span className="text-slate-400 text-[11px] truncate max-w-xs">{item.desc}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono shrink-0">
                        {item.auth}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ApiDocs;
