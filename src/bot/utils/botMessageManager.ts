import { 
  EmbedBuilder, 
  GuildMember, 
  User, 
  TextChannel, 
  Message 
} from 'discord.js';
import bot from '../client';
import prisma from '../../database/client';
import { THEME, createThemedEmbed } from './theme';

export interface PlaceholderDefinition {
  tag: string;
  description: string;
  sample: string;
}

export interface MessageTemplateDefinition {
  key: string;
  category: string;
  name: string;
  description: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultColor: string;
  defaultFooter: string;
  defaultContent?: string;
  placeholders: PlaceholderDefinition[];
}

export interface CustomMessageSettings {
  enabled?: boolean;
  title?: string;
  description?: string;
  color?: string;
  footer?: string;
  content?: string;
}

/**
 * Universal Catalog of all bot messages and their placeholders
 */
export const BOT_MESSAGE_CATALOG: MessageTemplateDefinition[] = [
  // ==========================================
  // 1. Панели & Каналы (Начальные сообщения)
  // ==========================================
  {
    key: 'recruitment_announcement',
    category: 'Панели & Каналы',
    name: 'Панель набора в семью',
    description: 'Главное закрепленное сообщение в канале набора с кнопкой «Подать заявку»',
    defaultTitle: '📋 НАБОР В СЕМЬЮ {guild}',
    defaultDescription: 'Семья **{guild}** открывает набор активных и амбициозных игроков!\n\n**Мы предлагаем:**\n- Регулярные мероприятия (Капты, ВЗЗ, Дропы, МЦЛ)\n- Премии и выплаты за участие\n- Дружный состав и карьерный рост\n\n**Требования:**\n- Адекватность и соблюдение правил штата\n- Наличие микрофона и Discord\n\nНажмите кнопку ниже, чтобы заполнить анкету!',
    defaultColor: '#EC4899',
    defaultFooter: '{guild} • Majestic RP',
    defaultContent: '',
    placeholders: [
      { tag: '{guild}', description: 'Название семьи/сервера', sample: 'INTERPOL' },
      { tag: '{memberCount}', description: 'Количество участников', sample: '154' },
    ],
  },
  {
    key: 'static_binding_panel',
    category: 'Панели & Каналы',
    name: 'Панель привязки статика',
    description: 'Закрепленная панель в канале привязки статика с интерактивной кнопкой',
    defaultTitle: '🆔 СИНХРОНИЗАЦИЯ ПРОФИЛЯ • MAJESTIC RP',
    defaultDescription: 'Обязательная привязка игрового Static ID и имени персонажа семьи **{guild}**.\n\n**Для чего необходима привязка:**\n- Автоматический учет посещения мероприятий (дропы, цеха, ВЗМ, капты)\n- Сдача отчетов в академии и отслеживание нормы повышения\n- Синхронизация роли и авто-форматирование никнейма в Discord\n- Личная статистика и отображение в рейтинге состава семьи\n\n-# Нажмите кнопку ниже для ввода или обновления своего Static ID.',
    defaultColor: '#EC4899',
    defaultFooter: '{guild} • База данных состава',
    defaultContent: '',
    placeholders: [
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'leave_request_panel',
    category: 'Панели & Каналы',
    name: 'Панель оформления отпуска и неактива',
    description: 'Закрепленное сообщение в канале отпусков с кнопками подачи заявления',
    defaultTitle: '🌴 ОФОРМЛЕНИЕ ОТПУСКА И НЕАКТИВА',
    defaultDescription: 'Официальная подача заявлений на временное освобождение от обязательных мероприятий семьи **{guild}**.\n\n**Регламент отпусков и отгулов:**\n- **Отпуск:** оформляется на срок от 1 до 14 календарных дней.\n- **Отгул:** оформляется на короткий срок от 5 минут до 24 часов.\n- Во время активного отпуска штрафы за пропуск МП не начисляются.\n\n-# Выберите формат заявления с помощью кнопок ниже.',
    defaultColor: '#6366F1',
    defaultFooter: '{guild} • Регламент отпусков',
    defaultContent: '',
    placeholders: [
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'tier_apply_panel',
    category: 'Панели & Каналы',
    name: 'Панель заявок на тир',
    description: 'Закрепленное сообщение в канале заявок на тир с кнопкой создания ветки',
    defaultTitle: '🎯 ЗАЯВКИ НА ТИР • ОЦЕНКА СТРЕЛЬБЫ',
    defaultDescription: 'Добро пожаловать в систему подачи заявок на получение тира семьи **{guild}**!\n\n**Порядок подачи:**\n1. Нажмите на кнопку **«Подать заявку на тир»** ниже.\n2. Бот создаст для вас персональный закрытый канал с ветками мероприятий (Капт, MCL, ВЗЗ, РП).\n3. Отправьте откаты в соответствующие ветки с помощью встроенной формы.\n4. Тир-чекеры оценят стрельбу и присвоят заслуженный тир.\n\n-# Нажмите кнопку ниже для создания личного канала заявки.',
    defaultColor: '#EC4899',
    defaultFooter: '{guild} • Tier System',
    defaultContent: '',
    placeholders: [
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'welcome_channel_info',
    category: 'Панели & Каналы',
    name: 'Информационная панель сервера',
    description: 'Главное навигационное сообщение в канале добро пожаловать / информации',
    defaultTitle: 'ℹ️ СЕРВЕР СЕМЬИ {guild} • НАВИГАЦИЯ',
    defaultDescription: 'Добро пожаловать в официальное сообщество семьи **{guild}** на Majestic RP!\n\n**Навигация и полезные разделы:**\n- Обязательно привяжите свой игровой Static ID в канале привязки\n- В канале набора открыта подача электронных анкет\n- Отслеживайте сборы на семейные мероприятия в соответствующем разделе\n- Подать заявление на отпуск или отгул можно в разделе отпусков\n\nПриятной игры и продуктивного времяпрепровождения!',
    defaultColor: '#EC4899',
    defaultFooter: '{guild} • Информационный портал',
    defaultContent: '',
    placeholders: [
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
      { tag: '{memberCount}', description: 'Число участников сервера', sample: '154' },
    ],
  },
  {
    key: 'academy_status_panel',
    category: 'Панели & Каналы',
    name: 'Стартовая карточка в канале академии',
    defaultTitle: '🎓 ЛИЧНЫЙ КАНАЛ АКАДЕМИИ • {username}',
    description: 'Закрепленное стартовое сообщение в личном канале курсанта с кнопками сдачи отчета',
    defaultDescription: 'Личное дело академика семьи **{guild}**.\n\n**Кандидат:** {user}\n**Статик:** `#{staticId}`\n**Критерий повышения:** Подтвердить {totalNeeded} МП для перевода на 2 ранг\n\n**Регламент:**\nПосле участия в дропе, цехе, ВЗМ, МЦЛ или капте нажмите кнопку **«Сдать отчет по МП»** и прикрепите ссылку на скриншот.',
    defaultColor: '#EC4899',
    defaultFooter: '{guild} Academy • Актуализация статуса',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание курсанта', sample: '@Cadet' },
      { tag: '{username}', description: 'Имя курсанта', sample: 'Cadet' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
      { tag: '{staticId}', description: 'Игровой статик', sample: '142055' },
      { tag: '{totalNeeded}', description: 'Необходимое количество МП', sample: '10' },
    ],
  },
  {
    key: 'tier_ticket_intro',
    category: 'Панели & Каналы',
    name: 'Стартовое сообщение тикета тира',
    description: 'Сообщение в приватном канале кандидата на тир с инструкцией по откатам',
    defaultTitle: '🎯 КАНАЛ СДАЧИ ОТКАТОВ НА ТИР',
    defaultDescription: 'Канал создан для кандидата {user}.\n\n**Инструкция по отправке откатов:**\nНиже опубликованы ветки по категориям мероприятий (Капт, MCL, ВЗЗ, РП).\n\nПерейдите в нужную ветку, нажмите кнопку **«Сдать откат»** и укажите ссылку на видео.\nТир-чекеры проверят ваши записи и вынесут вердикт.',
    defaultColor: '#EC4899',
    defaultFooter: '{guild} • Tier Verification',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание кандидата', sample: '@Shooter' },
      { tag: '{username}', description: 'Имя кандидата', sample: 'Shooter' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'tier_ticket_mp_section',
    category: 'Панели & Каналы',
    name: 'Шапка категории МП в тикете тира',
    description: 'Сообщение в канале тикета перед веткой сдачи видео по конкретному МП',
    defaultTitle: '📹 ОТКАТЫ • {mpType}',
    defaultDescription: 'Раздел для сдачи видеозаписей с мероприятий **{mpType}**.\n\nДля отправки отката перейдите в прикрепленную ветку ниже и нажмите кнопку встроенной формы.',
    defaultColor: '#6366F1',
    defaultFooter: '{guild} • Tier Clips',
    defaultContent: '',
    placeholders: [
      { tag: '{mpType}', description: 'Тип мероприятия (Капт, MCL, ВЗЗ, РП)', sample: 'Капт' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },

  // ==========================================
  // 2. Приветствие & Уход
  // ==========================================
  {
    key: 'welcome',
    category: 'Приветствие & Уход',
    name: 'Вход нового участника (в канал)',
    description: 'Отправляется в канал приветствий при входе нового пользователя на сервер',
    defaultTitle: '👋 Добро пожаловать в семью, {user}!',
    defaultDescription: 'Рады приветствовать тебя на сервере **{guild}**!\n\nОзнакомься с правилами и подай заявку в семью в канале набора.\n\n-# Ты стал участником #{memberCount} на нашем сервере!',
    defaultColor: '#EC4899',
    defaultFooter: '{guild} • Добро пожаловать',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание пользователя (<@id>)', sample: '@Sovkoviy' },
      { tag: '{username}', description: 'Имя пользователя без тега', sample: 'Sovkoviy' },
      { tag: '{guild}', description: 'Название сервера Discord', sample: 'INTERPOL' },
      { tag: '{memberCount}', description: 'Общее число участников на сервере', sample: '154' },
      { tag: '{date}', description: 'Текущая дата и время', sample: '26.09.2026 21:00' },
    ],
  },
  {
    key: 'welcome_dm',
    category: 'Приветствие & Уход',
    name: 'Личное приветствие в ЛС (DM)',
    description: 'Отправляется ботом в личные сообщения пользователю сразу при вступлении на сервер',
    defaultTitle: '👋 Приветствуем на сервере {guild}!',
    defaultDescription: 'Привет, {username}!\nДобро пожаловать в сообщество семьи **{guild}**.\n\nОбязательно ознакомься с правилами сервера и привяжи свой игровой статик в канале привязки, чтобы получить доступ к функционалу семьи.\n\nЕсли ты хочешь вступить в наши ряды — подай заявку в канале набора!',
    defaultColor: '#EC4899',
    defaultFooter: '{guild} • Личное приветствие',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание пользователя', sample: '@User' },
      { tag: '{username}', description: 'Имя пользователя', sample: 'User' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
      { tag: '{memberCount}', description: 'Количество участников', sample: '154' },
    ],
  },
  {
    key: 'leave',
    category: 'Приветствие & Уход',
    name: 'Выход участника (в канал)',
    description: 'Отправляется в канал логов/уведомлений при выходе участника с сервера',
    defaultTitle: '🚪 Участник покинул сервер',
    defaultDescription: '**{username}** покинул сервер **{guild}**.\n\nТеперь нас осталось: **{memberCount}** участников.',
    defaultColor: '#BE185D',
    defaultFooter: '{guild} • Прощание',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание или тег пользователя', sample: '@Sovkoviy' },
      { tag: '{username}', description: 'Имя пользователя', sample: 'Sovkoviy' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
      { tag: '{memberCount}', description: 'Оставшееся количество участников', sample: '153' },
      { tag: '{date}', description: 'Дата и время выхода', sample: '26.09.2026 21:05' },
    ],
  },

  // ==========================================
  // 3. Заявки & Рекрутинг
  // ==========================================
  {
    key: 'ticket_welcome',
    category: 'Заявки & Рекрутинг',
    name: 'Приветствие в тикете заявки',
    description: 'Первое сообщение в созданном приватном канале тикета кандидата',
    defaultTitle: '📨 ЗАЯВКА В СЕМЬЮ • {username}',
    defaultDescription: 'Приветствуем, {user}!\n\nВаша анкета получена и передана рекрутерам семьи.\nПожалуйста, подготовьте скриншоты вашей статистики в игре.\n\nОжидайте ответа рекрутера в этом канале.',
    defaultColor: '#EC4899',
    defaultFooter: '{guild} • Рекрутинг',
    defaultContent: '{user} {recruiterRole}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание кандидата', sample: '@Candidate' },
      { tag: '{username}', description: 'Имя кандидата', sample: 'Candidate' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
      { tag: '{recruiterRole}', description: 'Упоминание роли рекрутеров', sample: '@Recruiter' },
      { tag: '{staticId}', description: 'Указанный статический ID', sample: '142055' },
    ],
  },
  {
    key: 'recruitment_dm_submitted',
    category: 'Заявки & Рекрутинг',
    name: 'ЛС кандидату: Заявка подана',
    description: 'Отправляется кандидату в ЛС при успешном заполнении и отправке анкеты в семью',
    defaultTitle: '📨 Ваша заявка в семью {guild} принята',
    defaultDescription: 'Здравствуйте, {username}!\n\nВаша анкета в семью **{guild}** (статик: `{staticId}`) успешно зарегистрирована и создана в закрытом тикете.\nРекрутеры семьи уже оповещены и свяжутся с вами в ближайшее время.',
    defaultColor: '#EC4899',
    defaultFooter: '{guild} • Рекрутинг',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание кандидата', sample: '@Candidate' },
      { tag: '{username}', description: 'Имя кандидата', sample: 'Candidate' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
      { tag: '{staticId}', description: 'Статик кандидата', sample: '142055' },
    ],
  },
  {
    key: 'recruitment_interview_alert',
    category: 'Заявки & Рекрутинг',
    name: 'Вызов на обзвон (в тикете)',
    description: 'Сообщение в тикете при вызове кандидата рекрутером в голосовой канал',
    defaultTitle: '🎙️ ВЫЗОВ НА СОБЕСЕДОВАНИЕ',
    defaultDescription: '{user}, вас ожидает рекрутер {recruiter} в закрытом голосовом канале {voiceChannel}!\n\nПожалуйста, подключитесь к войсу для прохождения обзвона.',
    defaultColor: '#F59E0B',
    defaultFooter: '{guild} • Собеседование',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание кандидата', sample: '@Candidate' },
      { tag: '{username}', description: 'Имя кандидата', sample: 'Candidate' },
      { tag: '{recruiter}', description: 'Рекрутер, создавший войс', sample: '@Recruiter' },
      { tag: '{voiceChannel}', description: 'Ссылка на голосовой канал', sample: '#Обзвон-1' },
      { tag: '{guild}', description: 'Название семьи', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'recruitment_dm_interview',
    category: 'Заявки & Рекрутинг',
    name: 'ЛС кандидату: Приглашение на обзвон',
    description: 'Отправляется кандидату в ЛС при вызове на собеседование в голосовой канал',
    defaultTitle: '🎙️ Вас приглашают на собеседование • {guild}',
    defaultDescription: 'Здравствуйте, {username}!\n\nРекрутер семьи {recruiter} на сервере **{guild}** ожидает вас в закрытом голосовом канале {voiceChannel}.\n\nПожалуйста, включите микрофон и зайдите в канал для прохождения обзвона.',
    defaultColor: '#F59E0B',
    defaultFooter: '{guild} • Собеседование',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание кандидата', sample: '@Candidate' },
      { tag: '{username}', description: 'Имя кандидата', sample: 'Candidate' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
      { tag: '{recruiter}', description: 'Рекрутер', sample: '@Recruiter' },
      { tag: '{voiceChannel}', description: 'Голосовой канал', sample: '#Обзвон' },
    ],
  },
  {
    key: 'ticket_accepted',
    category: 'Заявки & Рекрутинг',
    name: 'Одобрение заявки (в тикете)',
    description: 'Сообщение в тикете при одобрении кандидата в семью',
    defaultTitle: '✅ ЗАЯВКА ОДОБРЕНА',
    defaultDescription: 'Поздравляем, {user}!\n\nВаша заявка в семью **{guild}** была успешно **одобрена** рекрутером {recruiter}.\nВам выдана роль **{role}**.\n\nДобро пожаловать в состав! Ознакомьтесь с академией и правилами семьи.',
    defaultColor: '#10B981',
    defaultFooter: '{guild} • Добро пожаловать',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание кандидата', sample: '@Candidate' },
      { tag: '{username}', description: 'Имя кандидата', sample: 'Candidate' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
      { tag: '{recruiter}', description: 'Рекрутер, принявший решение', sample: '@Recruiter' },
      { tag: '{role}', description: 'Выданная роль', sample: '@Академик' },
    ],
  },
  {
    key: 'recruitment_dm_accepted',
    category: 'Заявки & Рекрутинг',
    name: 'ЛС кандидату: Одобрение заявки',
    description: 'Отправляется кандидату в ЛС при одобрении заявки в семью',
    defaultTitle: '🎉 Ваша заявка в семью {guild} одобрена!',
    defaultDescription: 'Поздравляем, {username}!\n\nВаша анкета в семью **{guild}** была успешно **одобрена** рекрутером {recruiter}!\nВам присвоена роль **{role}**.\n\nЗайдите в персональный канал обучения и ознакомьтесь с регламентом сдачи отчетов.',
    defaultColor: '#10B981',
    defaultFooter: '{guild} • Добро пожаловать в семью',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание кандидата', sample: '@Candidate' },
      { tag: '{username}', description: 'Имя кандидата', sample: 'Candidate' },
      { tag: '{guild}', description: 'Название семьи', sample: 'INTERPOL' },
      { tag: '{recruiter}', description: 'Рекрутер', sample: '@Recruiter' },
      { tag: '{role}', description: 'Выданная роль', sample: '@Академик' },
    ],
  },
  {
    key: 'ticket_rejected',
    category: 'Заявки & Рекрутинг',
    name: 'Отказ по заявке (в тикете)',
    description: 'Сообщение в тикете при отклонении заявки',
    defaultTitle: '❌ ЗАЯВКА ОТКЛОНЕНА',
    defaultDescription: 'Здравствуйте, {user}.\n\nК сожалению, ваша заявка в семью **{guild}** была **отклонена** рекрутером {recruiter}.\n\n**Причина отказа:**\n> {reason}\n\nВы можете попробовать подать заявку повторно через некоторое время.',
    defaultColor: '#BE185D',
    defaultFooter: '{guild} • Рекрутинг',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание кандидата', sample: '@Candidate' },
      { tag: '{username}', description: 'Имя кандидата', sample: 'Candidate' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
      { tag: '{recruiter}', description: 'Рекрутер, отклонивший заявку', sample: '@Recruiter' },
      { tag: '{reason}', description: 'Причина отказа', sample: 'Недостаточный игровой уровень' },
    ],
  },
  {
    key: 'recruitment_dm_rejected',
    category: 'Заявки & Рекрутинг',
    name: 'ЛС кандидату: Отказ по заявке',
    description: 'Отправляется кандидату в ЛС при отклонении заявки в семью',
    defaultTitle: '❌ Результат рассмотрения заявки • {guild}',
    defaultDescription: 'Здравствуйте, {username}.\n\nК сожалению, ваша заявка на вступление в семью **{guild}** была **отклонена** рекрутером {recruiter}.\n\n**Причина отказа:**\n> {reason}',
    defaultColor: '#BE185D',
    defaultFooter: '{guild} • Рекрутинг',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание кандидата', sample: '@Candidate' },
      { tag: '{username}', description: 'Имя кандидата', sample: 'Candidate' },
      { tag: '{guild}', description: 'Название семьи', sample: 'INTERPOL' },
      { tag: '{recruiter}', description: 'Рекрутер', sample: '@Recruiter' },
      { tag: '{reason}', description: 'Причина отказа', sample: 'Недостаточный игровой стаж' },
    ],
  },

  // ==========================================
  // 4. Академия семьи
  // ==========================================
  {
    key: 'academy_channel_welcome',
    category: 'Академия семьи',
    name: 'Создание канала академии',
    description: 'Приветственное сообщение в личном канале курсанта при поступлении в академию',
    defaultTitle: '🎓 АКАДЕМИЯ СЕМЬИ • {username}',
    defaultDescription: 'Добро пожаловать в академию семьи **{guild}**, {user}!\n\nТвой статик: `{staticId}`.\nЗдесь ты будешь проходить обучение и сдавать этапы перед переводом в основной состав.\n\nКураторы академии ответят на любые твои вопросы в этом канале.',
    defaultColor: '#EC4899',
    defaultFooter: '{guild} • Академия 1-2 ранг',
    defaultContent: '{user} {mentorRole}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание курсанта', sample: '@Cadet' },
      { tag: '{username}', description: 'Имя курсанта', sample: 'Cadet' },
      { tag: '{guild}', description: 'Название семьи', sample: 'INTERPOL' },
      { tag: '{staticId}', description: 'Статик курсанта', sample: '142055' },
      { tag: '{mentorRole}', description: 'Упоминание кураторов академии', sample: '@Инструктор' },
    ],
  },
  {
    key: 'academy_dm_enrolled',
    category: 'Академия семьи',
    name: 'ЛС курсанту: Зачисление в академию',
    description: 'Отправляется в ЛС новому курсанту при открытии его персонального канала',
    defaultTitle: '🎓 Вы зачислены в Академию {guild}!',
    defaultDescription: 'Поздравляем, {username}!\n\nВам открыт персональный канал обучения на сервере семьи **{guild}**.\nВаш игровой статик: `{staticId}`.\n\nЗаходите в свой канал, участвуйте в мероприятиях и сдавайте отчеты для повышения на 2 ранг!',
    defaultColor: '#EC4899',
    defaultFooter: '{guild} • Академия',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание курсанта', sample: '@Cadet' },
      { tag: '{username}', description: 'Имя курсанта', sample: 'Cadet' },
      { tag: '{guild}', description: 'Название семьи', sample: 'INTERPOL' },
      { tag: '{staticId}', description: 'Статик курсанта', sample: '142055' },
    ],
  },
  {
    key: 'academy_stage_passed',
    category: 'Академия семьи',
    name: 'Одобрение отчета по МП (в канале)',
    description: 'Сообщение в канале курсанта об успешной сдаче отчета по мероприятию',
    defaultTitle: '📈 ОТЧЕТ ПО МЕРОПРИЯТИЮ ОДОБРЕН',
    defaultDescription: '{user} успешно подтвердил участие в **«{stageName}»**!\n\n**Экзаменатор:** {mentor}\n**Прогресс академии:** {progress}',
    defaultColor: '#10B981',
    defaultFooter: '{guild} • Академия',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание курсанта', sample: '@Cadet' },
      { tag: '{username}', description: 'Имя курсанта', sample: 'Cadet' },
      { tag: '{stageName}', description: 'Категория сданного МП', sample: 'Дроп / ВЗЗ' },
      { tag: '{mentor}', description: 'Инструктор/куратор', sample: '@Instructor' },
      { tag: '{progress}', description: 'Индикатор прогресса', sample: '6 / 10 МП' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'academy_dm_report_approved',
    category: 'Академия семьи',
    name: 'ЛС курсанту: Отчет по МП одобрен',
    description: 'Отправляется курсанту в ЛС при одобрении его отчета куратором',
    defaultTitle: '✅ Отчет по мероприятию одобрен!',
    defaultDescription: '{username}, ваш отчет по участию в **{stageName}** успешно принят куратором {mentor}!\n\n**Ваш прогресс в Академии:** {progress}.\nПродолжайте в том же духе!',
    defaultColor: '#10B981',
    defaultFooter: '{guild} • Академия',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание курсанта', sample: '@Cadet' },
      { tag: '{username}', description: 'Имя курсанта', sample: 'Cadet' },
      { tag: '{stageName}', description: 'Тип МП', sample: 'ВЗЗ' },
      { tag: '{mentor}', description: 'Куратор', sample: '@Instructor' },
      { tag: '{progress}', description: 'Прогресс МП', sample: '7 / 10 МП' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'academy_report_rejected',
    category: 'Академия семьи',
    name: 'Отклонение отчета по МП (в канале)',
    description: 'Сообщение в канале курсанта при отклонении отчета куратором',
    defaultTitle: '❌ ОТЧЕТ ПО МЕРОПРИЯТИЮ ОТКЛОНЕН',
    defaultDescription: 'Отчет курсанта {user} по **{stageName}** был отклонен.\n\n**Куратор:** {mentor}\n**Причина:**\n> {reason}',
    defaultColor: '#BE185D',
    defaultFooter: '{guild} • Академия',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание курсанта', sample: '@Cadet' },
      { tag: '{username}', description: 'Имя курсанта', sample: 'Cadet' },
      { tag: '{stageName}', description: 'Тип МП', sample: 'Капт' },
      { tag: '{mentor}', description: 'Куратор', sample: '@Instructor' },
      { tag: '{reason}', description: 'Причина отклонения', sample: 'Нет фиксации времени на скриншоте' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'academy_dm_report_rejected',
    category: 'Академия семьи',
    name: 'ЛС курсанту: Отчет по МП отклонен',
    description: 'Отправляется курсанту в ЛС при отклонении отчета куратором',
    defaultTitle: '❌ Отчет по МП отклонен • {guild}',
    defaultDescription: '{username}, ваш отчет по мероприятию **{stageName}** был **отклонен** куратором {mentor}.\n\n**Причина:**\n> {reason}\n\nПожалуйста, устраните замечания и пересдайте отчет.',
    defaultColor: '#BE185D',
    defaultFooter: '{guild} • Академия',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание курсанта', sample: '@Cadet' },
      { tag: '{username}', description: 'Имя курсанта', sample: 'Cadet' },
      { tag: '{stageName}', description: 'Тип МП', sample: 'Дроп' },
      { tag: '{mentor}', description: 'Куратор', sample: '@Instructor' },
      { tag: '{reason}', description: 'Причина отклонения', sample: 'Скриншот поврежден или не читается' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'academy_graduated',
    category: 'Академия семьи',
    name: 'Выпуск из академии (в канале)',
    description: 'Торжественное поздравление с окончанием академии и повышением до 2 ранга',
    defaultTitle: '🏆 ВЫПУСК ИЗ АКАДЕМИИ!',
    defaultDescription: 'Поздравляем курсанта {user} с успешным завершением Академии!\n\nВсе нормы выполнены. Курсант переведен в **основной состав семьи**!\n**Новый ранг:** **{newRank}**\n**Куратор:** {mentor}',
    defaultColor: '#F59E0B',
    defaultFooter: '{guild} • Выпускник академии',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание выпускника', sample: '@Cadet' },
      { tag: '{username}', description: 'Имя выпускника', sample: 'Cadet' },
      { tag: '{mentor}', description: 'Выпустивший куратор', sample: '@Instructor' },
      { tag: '{newRank}', description: 'Новый ранг участника', sample: '2 - Участник' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'academy_dm_graduated',
    category: 'Академия семьи',
    name: 'ЛС курсанту: Выпуск и 2 ранг',
    description: 'Отправляется курсанту в ЛС при успешном выпуске и переводе в основной состав',
    defaultTitle: '🏆 Поздравляем с выпуском из Академии {guild}!',
    defaultDescription: '{username}, вы успешно сдали все нормативы Академии семьи **{guild}**!\n\nВам присвоен **{newRank}** (Основной состав) куратором {mentor}.\nСпасибо за активное участие в жизни семьи!',
    defaultColor: '#F59E0B',
    defaultFooter: '{guild} • Выпускник академии',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание выпускника', sample: '@Cadet' },
      { tag: '{username}', description: 'Имя выпускника', sample: 'Cadet' },
      { tag: '{newRank}', description: 'Присвоенный ранг', sample: '2 ранг' },
      { tag: '{mentor}', description: 'Куратор', sample: '@Instructor' },
      { tag: '{guild}', description: 'Название семьи', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'academy_expelled',
    category: 'Академия семьи',
    name: 'Исключение из академии (в канале)',
    description: 'Сообщение в канале об отчислении курсанта из академии',
    defaultTitle: '🚫 ОТЧИСЛЕНИЕ ИЗ АКАДЕМИИ',
    defaultDescription: 'Курсант {user} был **отчислен** из Академии семьи.\n\n**Причина:**\n> {reason}\n\n**Решение принял:** {mentor}',
    defaultColor: '#BE185D',
    defaultFooter: '{guild} • Академия',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание курсанта', sample: '@Cadet' },
      { tag: '{username}', description: 'Имя курсанта', sample: 'Cadet' },
      { tag: '{mentor}', description: 'Принявший решение', sample: '@Instructor' },
      { tag: '{reason}', description: 'Причина отчисления', sample: 'Неактив более 7 дней' },
      { tag: '{guild}', description: 'Название семьи', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'academy_dm_expelled',
    category: 'Академия семьи',
    name: 'ЛС курсанту: Отчисление из академии',
    description: 'Отправляется курсанту в ЛС при его отчислении из Академии',
    defaultTitle: '🚫 Отчисление из Академии • {guild}',
    defaultDescription: '{username}, вы были **отчислены** из Академии семьи **{guild}** куратором {mentor}.\n\n**Причина отчисления:**\n> {reason}',
    defaultColor: '#BE185D',
    defaultFooter: '{guild} • Академия',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание курсанта', sample: '@Cadet' },
      { tag: '{username}', description: 'Имя курсанта', sample: 'Cadet' },
      { tag: '{mentor}', description: 'Куратор', sample: '@Instructor' },
      { tag: '{reason}', description: 'Причина отчисления', sample: 'Невыполнение учебного плана' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },

  // ==========================================
  // 5. Мероприятия & Сборы
  // ==========================================
  {
    key: 'event_announcement',
    category: 'Мероприятия & Сборы',
    name: 'Анонс сбора на мероприятие',
    description: 'Публикуется при создании сбора на Капт, ВЗЗ, Дроп, МЦЛ и др.',
    defaultTitle: '⚔️ СБОР НА МЕРОПРИЯТИЕ • {eventTitle}',
    defaultDescription: 'Объявлен общий сбор семьи на **{eventTitle}** ({eventType})!\n\n**Время начала:** {eventTime}\n**Сбор в войсе:** {voiceChannel}\n**Карта / Локация:** {mapName}\n**Код группы:** `{partyCode}`\n**Лимит участников:** {limit}\n\nПодтвердите явку кнопками ниже!',
    defaultColor: '#EC4899',
    defaultFooter: '{guild} • Мероприятия',
    defaultContent: '{role}',
    placeholders: [
      { tag: '{eventTitle}', description: 'Название мероприятия', sample: 'Война за завод (ВЗЗ)' },
      { tag: '{eventType}', description: 'Тип (LIMITED / UNLIMITED)', sample: 'LIMITED' },
      { tag: '{mapName}', description: 'Карта или локация', sample: 'Завод' },
      { tag: '{eventTime}', description: 'Время начала мероприятия', sample: '20:00' },
      { tag: '{checkInTime}', description: 'Время переклички / сбора', sample: '19:45' },
      { tag: '{voiceChannel}', description: 'Канал для сбора', sample: '#Сбор-1' },
      { tag: '{partyCode}', description: 'Код пати в игре', sample: 'INTERPOL-1' },
      { tag: '{role}', description: 'Пингуемая роль', sample: '@Капт-состав' },
      { tag: '{limit}', description: 'Лимит участников', sample: '25' },
      { tag: '{author}', description: 'Организатор сбора', sample: '@Leader' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'event_ping',
    category: 'Мероприятия & Сборы',
    name: 'Напоминание о сборе (в канал)',
    description: 'Автоматический пинг за 15, 10, 5, 3 или 1 минуту до начала мероприятия',
    defaultTitle: '⏰ НАПОМИНАНИЕ • До начала {minutesLeft} мин!',
    defaultDescription: 'Сбор на **{eventTitle}** начинается через **{minutesLeft} мин**!\n\nВсе подтвердившие явку ({confirmedCount} чел.), срочно заходим в голосовой канал {voiceChannel}!\n\nКод группы в игре: `{partyCode}`.',
    defaultColor: '#F59E0B',
    defaultFooter: '{guild} • Скоро начало',
    defaultContent: '{role}',
    placeholders: [
      { tag: '{eventTitle}', description: 'Название мероприятия', sample: 'Капт' },
      { tag: '{minutesLeft}', description: 'Осталось минут до начала', sample: '5' },
      { tag: '{eventTime}', description: 'Время начала', sample: '21:00' },
      { tag: '{voiceChannel}', description: 'Голосовой канал сбора', sample: '#Капты-1' },
      { tag: '{partyCode}', description: 'Код группы', sample: 'INT-99' },
      { tag: '{role}', description: 'Пингуемая роль', sample: '@Капт' },
      { tag: '{confirmedCount}', description: 'Число подтвердивших явку', sample: '18' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'event_dm_ping',
    category: 'Мероприятия & Сборы',
    name: 'ЛС участнику: Напоминание о сборе',
    description: 'Отправляется участнику в ЛС за несколько минут до начала мероприятия',
    defaultTitle: '⏰ Напоминание о мероприятии • {eventTitle}',
    defaultDescription: '{username}, мероприятие **{eventTitle}** начнется через **{minutesLeft} мин**!\n\nПожалуйста, заходите в голосовой канал {voiceChannel}.\nКод группы в игре: `{partyCode}`.',
    defaultColor: '#F59E0B',
    defaultFooter: '{guild} • Напоминание',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@Member' },
      { tag: '{username}', description: 'Имя участника', sample: 'Member' },
      { tag: '{eventTitle}', description: 'Название мероприятия', sample: 'Капт' },
      { tag: '{minutesLeft}', description: 'Минут до начала', sample: '5' },
      { tag: '{voiceChannel}', description: 'Канал войса', sample: '#Капты' },
      { tag: '{partyCode}', description: 'Код пати', sample: 'INT-01' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'event_dm_promoted',
    category: 'Мероприятия & Сборы',
    name: 'ЛС участнику: Перевод из резерва в основу',
    description: 'Отправляется участнику из резерва в ЛС, когда освобождается место в основном составе',
    defaultTitle: '🔔 Место освободилось! Вы в основном составе',
    defaultDescription: '{username}, на мероприятие **{eventTitle}** освободилось место!\n\nВы были автоматически переведены из **резерва в основной состав**.\nСбор в канале {voiceChannel}. Код пати: `{partyCode}`.',
    defaultColor: '#10B981',
    defaultFooter: '{guild} • Мероприятия',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@Member' },
      { tag: '{username}', description: 'Имя участника', sample: 'Member' },
      { tag: '{eventTitle}', description: 'Название мероприятия', sample: 'ВЗЗ' },
      { tag: '{voiceChannel}', description: 'Канал сбора', sample: '#ВЗЗ' },
      { tag: '{partyCode}', description: 'Код группы', sample: 'INT-99' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'event_started',
    category: 'Мероприятия & Сборы',
    name: 'Старт мероприятия',
    description: 'Сообщение в момент наступления времени мероприятия',
    defaultTitle: '🔥 МЕРОПРИЯТИЕ НАЧАЛОСЬ!',
    defaultDescription: 'Время сбора на **{eventTitle}** наступило!\n\nВсе участники в канале {voiceChannel}.\nПодтвердили явку: **{confirmedCount}** чел.\n\nУдачи в бою!',
    defaultColor: '#10B981',
    defaultFooter: '{guild} • В бой',
    defaultContent: '{role}',
    placeholders: [
      { tag: '{eventTitle}', description: 'Название мероприятия', sample: 'ВЗЗ' },
      { tag: '{voiceChannel}', description: 'Голосовой канал', sample: '#ВЗЗ' },
      { tag: '{partyCode}', description: 'Код группы', sample: 'INT-VZZ' },
      { tag: '{confirmedCount}', description: 'Число участников', sample: '20' },
      { tag: '{role}', description: 'Роль участников', sample: '@Состав' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'event_cancelled',
    category: 'Мероприятия & Сборы',
    name: 'Отмена мероприятия',
    description: 'Сообщение при отмене сбора организатором',
    defaultTitle: '❌ МЕРОПРИЯТИЕ ОТМЕНЕНО',
    defaultDescription: 'Сбор на **{eventTitle}** был **отменен** организатором {author}.\n\n**Причина отмены:**\n> {reason}',
    defaultColor: '#BE185D',
    defaultFooter: '{guild} • Мероприятия',
    defaultContent: '{role}',
    placeholders: [
      { tag: '{eventTitle}', description: 'Название мероприятия', sample: 'Дроп 20:00' },
      { tag: '{reason}', description: 'Причина отмены', sample: 'Перенос времени' },
      { tag: '{author}', description: 'Организатор', sample: '@Leader' },
      { tag: '{role}', description: 'Роль участников', sample: '@Состав' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },

  // ==========================================
  // 6. Отпуска & Неактив
  // ==========================================
  {
    key: 'leave_request',
    category: 'Отпуска & Неактив',
    name: 'Заявка на отпуск (в канал)',
    description: 'Публикуется в канал рассмотрения отпусков при подаче заявки участником',
    defaultTitle: '🌴 ЗАЯВКА НА {leaveType} • {username}',
    defaultDescription: 'Участник {user} (статик `{staticId}`) запросил {leaveType}.\n\n**Срок:** {days}\n**Период:** с {startDate} по {endDate}\n**Причина:**\n> {reason}\n\nРуководство может подтвердить или отклонить заявку кнопками ниже.',
    defaultColor: '#6366F1',
    defaultFooter: '{guild} • Отпуска',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@User' },
      { tag: '{username}', description: 'Имя участника', sample: 'User' },
      { tag: '{staticId}', description: 'Статик участника', sample: '142055' },
      { tag: '{leaveType}', description: 'Тип (Отпуск / Отгул)', sample: 'Отпуск' },
      { tag: '{days}', description: 'Длительность', sample: '7 дн.' },
      { tag: '{startDate}', description: 'Дата начала', sample: '26.09.2026' },
      { tag: '{endDate}', description: 'Дата окончания', sample: '03.10.2026' },
      { tag: '{reason}', description: 'Причина отпуска', sample: 'Сессия в университете' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'leave_dm_submitted',
    category: 'Отпуска & Неактив',
    name: 'ЛС участнику: Заявка на отпуск отправлена',
    description: 'Отправляется участнику в ЛС сразу после отправки заявки на отпуск/отгул',
    defaultTitle: '🌴 Ваше заявление на {leaveType} отправлено',
    defaultDescription: '{username}, ваше заявление на **{leaveType}** с {startDate} по {endDate} успешно передано руководству семьи **{guild}** на рассмотрение.\n\nОжидайте уведомления о решении.',
    defaultColor: '#6366F1',
    defaultFooter: '{guild} • Отпуска',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@User' },
      { tag: '{username}', description: 'Имя участника', sample: 'User' },
      { tag: '{leaveType}', description: 'Тип заявления', sample: 'Отпуск' },
      { tag: '{startDate}', description: 'Дата начала', sample: '27.09.2026' },
      { tag: '{endDate}', description: 'Дата окончания', sample: '05.10.2026' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'leave_approved',
    category: 'Отпуска & Неактив',
    name: 'Одобрение отпуска (в канал)',
    description: 'Уведомление в канале при одобрении отпуска администратором',
    defaultTitle: '✅ {leaveType} ОДОБРЕН',
    defaultDescription: '{leaveType} для {user} успешно **одобрен** администратором {admin}!\n\n**Срок:** {days} (с {startDate} по {endDate})\nПриятного отдыха! Статус аккаунта переведен в `ON_LEAVE`.',
    defaultColor: '#10B981',
    defaultFooter: '{guild} • Отпуска',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@User' },
      { tag: '{username}', description: 'Имя участника', sample: 'User' },
      { tag: '{admin}', description: 'Администратор, одобривший отпуск', sample: '@Admin' },
      { tag: '{leaveType}', description: 'Тип заявления', sample: 'Отпуск' },
      { tag: '{days}', description: 'Количество дней/часов', sample: '5 дн.' },
      { tag: '{startDate}', description: 'Дата начала', sample: '27.09.2026' },
      { tag: '{endDate}', description: 'Дата окончания', sample: '02.10.2026' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'leave_dm_approved',
    category: 'Отпуска & Неактив',
    name: 'ЛС участнику: Отпуск одобрен',
    description: 'Отправляется участнику в ЛС при одобрении его заявления на отпуск/отгул',
    defaultTitle: '✅ Ваш {leaveType} одобрен • {guild}',
    defaultDescription: '{username}, ваше заявление на **{leaveType}** с {startDate} по {endDate} успешно **одобрено** администратором {admin}!\n\nПриятного отдыха! На время отпуска штрафы за пропуск МП не начисляются.',
    defaultColor: '#10B981',
    defaultFooter: '{guild} • Отпуска',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@User' },
      { tag: '{username}', description: 'Имя участника', sample: 'User' },
      { tag: '{leaveType}', description: 'Тип (Отпуск / Отгул)', sample: 'Отпуск' },
      { tag: '{startDate}', description: 'Дата начала', sample: '27.09.2026' },
      { tag: '{endDate}', description: 'Дата окончания', sample: '03.10.2026' },
      { tag: '{admin}', description: 'Администратор', sample: '@Admin' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'leave_rejected',
    category: 'Отпуска & Неактив',
    name: 'Отказ в отпуске (в канал)',
    description: 'Уведомление при отклонении заявки на отпуск',
    defaultTitle: '❌ В {leaveType} ОТКАЗАНО',
    defaultDescription: 'Заявка на {leaveType} для {user} была **отклонена** администратором {admin}.\n\n**Причина:**\n> {reason}',
    defaultColor: '#BE185D',
    defaultFooter: '{guild} • Отпуска',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@User' },
      { tag: '{username}', description: 'Имя участника', sample: 'User' },
      { tag: '{admin}', description: 'Администратор', sample: '@Admin' },
      { tag: '{leaveType}', description: 'Тип заявления', sample: 'Отпуск' },
      { tag: '{reason}', description: 'Причина отказа', sample: 'Большое количество участников в отпуске' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'leave_dm_rejected',
    category: 'Отпуска & Неактив',
    name: 'ЛС участнику: Отказ в отпуске',
    description: 'Отправляется участнику в ЛС при отклонении его заявления на отпуск',
    defaultTitle: '❌ В заявке на {leaveType} отказано • {guild}',
    defaultDescription: '{username}, ваше заявление на **{leaveType}** было **отклонено** администратором {admin}.\n\n**Причина отказа:**\n> {reason}',
    defaultColor: '#BE185D',
    defaultFooter: '{guild} • Отпуска',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@User' },
      { tag: '{username}', description: 'Имя участника', sample: 'User' },
      { tag: '{leaveType}', description: 'Тип', sample: 'Отпуск' },
      { tag: '{admin}', description: 'Администратор', sample: '@Admin' },
      { tag: '{reason}', description: 'Причина отказа', sample: 'Критическое количество людей в отпуске' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },

  // ==========================================
  // 7. Тир система
  // ==========================================
  {
    key: 'tier_dm_created',
    category: 'Тир система',
    name: 'ЛС кандидату: Канал тира создан',
    description: 'Отправляется кандидату в ЛС после нажатия на кнопку создания персонального тир-тикета',
    defaultTitle: '🎯 Персональный канал проверки тира создан!',
    defaultDescription: '{username}, для вас открыт закрытый канал проверки тира на сервере семьи **{guild}**.\n\nЗайдите в канал, выберите соответствующую категорию мероприятия и отправьте ссылки на свои откаты!',
    defaultColor: '#EC4899',
    defaultFooter: '{guild} • Tier System',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание кандидата', sample: '@Shooter' },
      { tag: '{username}', description: 'Имя кандидата', sample: 'Shooter' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'tier_application',
    category: 'Тир система',
    name: 'Заявка на тир (в канал чекеров)',
    description: 'Публикация заявки на тир в закрытом канале проверки',
    defaultTitle: '🎯 ЗАЯВКА НА ТИР • {tierName}',
    defaultDescription: 'Кандидат {user} (статик `{staticId}`) подал откат на **{tierName}** ({mpType})!\n\nЧекеры тира {checkerRole}, проверьте прикрепленное видео.',
    defaultColor: '#EC4899',
    defaultFooter: '{guild} • Тир система',
    defaultContent: '{user} {checkerRole}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание кандидата', sample: '@Shooter' },
      { tag: '{username}', description: 'Имя кандидата', sample: 'Shooter' },
      { tag: '{tierName}', description: 'Название тира', sample: 'Tier 1' },
      { tag: '{mpType}', description: 'Категория МП', sample: 'Капт' },
      { tag: '{staticId}', description: 'Статик кандидата', sample: '142055' },
      { tag: '{checkerRole}', description: 'Роль чекеров тира', sample: '@Tier Checker' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'tier_approved',
    category: 'Тир система',
    name: 'Одобрение тира (в тикете)',
    description: 'Сообщение в тикете при присвоении тира чекером',
    defaultTitle: '⭐ ТИР ПОДТВЕРЖДЕН • {tierName}',
    defaultDescription: 'Поздравляем, {user}!\n\nВам успешно присвоен **{tierName}** по категории **{mpType}**!\n**Проверил чекер:** {checker}\n**Комментарий:** {comment}',
    defaultColor: '#10B981',
    defaultFooter: '{guild} • Тир система',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@Shooter' },
      { tag: '{username}', description: 'Имя участника', sample: 'Shooter' },
      { tag: '{tierName}', description: 'Присвоенный тир', sample: 'Tier 1' },
      { tag: '{mpType}', description: 'Категория МП', sample: 'Капт' },
      { tag: '{checker}', description: 'Чекер тира', sample: '@HeadChecker' },
      { tag: '{comment}', description: 'Комментарий чекера', sample: 'Отличная стрельба, тир подтвержден' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'tier_dm_approved',
    category: 'Тир система',
    name: 'ЛС кандидату: Тир присвоен',
    description: 'Отправляется кандидату в ЛС при присвоении или подтверждении тира',
    defaultTitle: '⭐ Вам присвоен {tierName} • {guild}',
    defaultDescription: 'Поздравляем, {username}!\n\nЧекер {checker} проверил ваш откат по направлению **{mpType}** и присвоил вам **{tierName}**!\n\n**Комментарий проверяющего:**\n> {comment}',
    defaultColor: '#10B981',
    defaultFooter: '{guild} • Tier System',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@Shooter' },
      { tag: '{username}', description: 'Имя участника', sample: 'Shooter' },
      { tag: '{tierName}', description: 'Присвоенный тир', sample: 'Tier 1' },
      { tag: '{mpType}', description: 'Тип МП', sample: 'Капт' },
      { tag: '{checker}', description: 'Чекер', sample: '@Checker' },
      { tag: '{comment}', description: 'Комментарий', sample: 'Хороший позицион и аим' },
      { tag: '{guild}', description: 'Название семьи', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'tier_rejected',
    category: 'Тир система',
    name: 'Отказ по тиру (в тикете)',
    description: 'Сообщение в тикете при отклонении отката на тир',
    defaultTitle: '❌ ОТКАЗ ПО ТИРУ • {mpType}',
    defaultDescription: 'Откат с **{mpType}** для {user} был отклонен чекером {checker}.\n\n**Замечания:**\n> {reason}\n\nПотренируйтесь и попробуйте сдать откат заново.',
    defaultColor: '#BE185D',
    defaultFooter: '{guild} • Тир система',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@Shooter' },
      { tag: '{username}', description: 'Имя участника', sample: 'Shooter' },
      { tag: '{mpType}', description: 'Категория МП', sample: 'Капт' },
      { tag: '{checker}', description: 'Чекер тира', sample: '@Checker' },
      { tag: '{reason}', description: 'Причина отказа', sample: 'Недостаточно фрагов на откате' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'tier_dm_rejected',
    category: 'Тир система',
    name: 'ЛС кандидату: Отказ по тиру',
    description: 'Отправляется кандидату в ЛС при отклонении отката чекером',
    defaultTitle: '🎯 Замечания по откату на тир • {guild}',
    defaultDescription: '{username}, ваш откат по категории **{mpType}** был проверен чекером {checker}.\n\n**Замечания проверяющего:**\n> {reason}\n\nПожалуйста, запишите новый откат с учетом комментариев.',
    defaultColor: '#BE185D',
    defaultFooter: '{guild} • Tier System',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание кандидата', sample: '@Shooter' },
      { tag: '{username}', description: 'Имя кандидата', sample: 'Shooter' },
      { tag: '{mpType}', description: 'Категория МП', sample: 'Капт' },
      { tag: '{checker}', description: 'Чекер', sample: '@Checker' },
      { tag: '{reason}', description: 'Замечания', sample: 'Недостаточно стрельбы в упоре' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },

  // ==========================================
  // 8. Профили & Статики
  // ==========================================
  {
    key: 'static_bound',
    category: 'Профили & Статики',
    name: 'Привязка статика (в канал)',
    description: 'Уведомление в канале логов/привязки при успешном сохранении статика',
    defaultTitle: '🆔 СТАТИК УСПЕШНО ПРИВЯЗАН',
    defaultDescription: 'Участник {user} успешно привязал игровой профиль Majestic RP!\n\n**Имя персонажа:** {characterName}\n**Статический ID:** `{staticId}`\n\nНикнейм на сервере автоматически синхронизирован.',
    defaultColor: '#10B981',
    defaultFooter: '{guild} • Профили',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@Player' },
      { tag: '{username}', description: 'Имя пользователя', sample: 'Player' },
      { tag: '{staticId}', description: 'Статический ID', sample: '142055' },
      { tag: '{characterName}', description: 'Имя в игре', sample: 'Tony Montana' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'static_bound_dm',
    category: 'Профили & Статики',
    name: 'ЛС участнику: Статик привязан',
    description: 'Отправляется участнику в ЛС при успешном вводе/синхронизации статика',
    defaultTitle: '🆔 Профиль Majestic RP синхронизирован!',
    defaultDescription: '{username}, ваши игровые данные успешно сохранены на сервере семьи **{guild}**:\n\n**Имя персонажа:** {characterName}\n**Статический ID:** `{staticId}`\n\nТеперь ваше посещение мероприятий будет учитываться автоматически!',
    defaultColor: '#10B981',
    defaultFooter: '{guild} • Профили',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@Player' },
      { tag: '{username}', description: 'Имя участника', sample: 'Player' },
      { tag: '{staticId}', description: 'Статик', sample: '142055' },
      { tag: '{characterName}', description: 'Имя персонажа', sample: 'Tony Montana' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'rank_up',
    category: 'Профили & Статики',
    name: 'Повышение ранга (в канал)',
    description: 'Публичное поздравление участника с повышением в ранге',
    defaultTitle: '🎖️ ПОВЫШЕНИЕ В РАНГЕ!',
    defaultDescription: 'Поздравляем {user} с повышением ранга в семье **{guild}**!\n\n**Старый ранг:** {oldRank}\n**Новый ранг:** **{newRank}**\n**Сыграно МП:** {mpCount}\n\nБлагодарим за активность и преданность семье!',
    defaultColor: '#F59E0B',
    defaultFooter: '{guild} • Карьера',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@Member' },
      { tag: '{username}', description: 'Имя участника', sample: 'Member' },
      { tag: '{guild}', description: 'Название семьи', sample: 'INTERPOL' },
      { tag: '{oldRank}', description: 'Предыдущий ранг', sample: '1 - Академик' },
      { tag: '{newRank}', description: 'Новый ранг', sample: '2 - Участник' },
      { tag: '{mpCount}', description: 'Количество МП', sample: '15' },
    ],
  },
  {
    key: 'rank_up_dm',
    category: 'Профили & Статики',
    name: 'ЛС участнику: Повышение ранга',
    description: 'Отправляется участнику в ЛС при повышении его ранга в семье',
    defaultTitle: '🎖️ Поздравляем с повышением ранга • {guild}!',
    defaultDescription: '{username}, руководство семьи **{guild}** повысило вас до ранга **{newRank}**!\n\nСпасибо за ваш вклад и активное участие в жизни состава!',
    defaultColor: '#F59E0B',
    defaultFooter: '{guild} • Карьера',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@Member' },
      { tag: '{username}', description: 'Имя участника', sample: 'Member' },
      { tag: '{oldRank}', description: 'Прежний ранг', sample: '1 ранг' },
      { tag: '{newRank}', description: 'Новый ранг', sample: '2 ранг' },
      { tag: '{guild}', description: 'Название семьи', sample: 'INTERPOL' },
    ],
  },

  // ==========================================
  // 9. Санкции & Модерация
  // ==========================================
  {
    key: 'sanction_warn_channel',
    category: 'Санкции & Модерация',
    name: 'Выдача предупреждения (в канал)',
    description: 'Публикуется в канал модерации/логов при выдаче выговора (варна)',
    defaultTitle: '⚠️ ВЫДАНО ПРЕДУПРЕЖДЕНИЕ (ВАРН)',
    defaultDescription: 'Участнику {user} вынесено предупреждение (**{warnCount} / {maxWarns}**).\n\n**Модератор:** {moderator}\n**Причина:**\n> {reason}',
    defaultColor: '#F59E0B',
    defaultFooter: '{guild} • Дисциплина',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание нарушителя', sample: '@User' },
      { tag: '{username}', description: 'Имя пользователя', sample: 'User' },
      { tag: '{moderator}', description: 'Модератор/администратор', sample: '@Moderator' },
      { tag: '{reason}', description: 'Причина выговора', sample: 'Неявка на обязательный сбор' },
      { tag: '{warnCount}', description: 'Текущее количество варнов', sample: '1' },
      { tag: '{maxWarns}', description: 'Лимит предупреждений', sample: '3' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'sanction_dm_warn',
    category: 'Санкции & Модерация',
    name: 'ЛС нарушителю: Предупреждение (Варн)',
    description: 'Отправляется нарушителю в ЛС при выдаче предупреждения',
    defaultTitle: '⚠️ Вам вынесено предупреждение на сервере {guild}',
    defaultDescription: '{username}, вам вынесено предупреждение (**{warnCount} из {maxWarns}**) администратором {moderator}.\n\n**Причина выговора:**\n> {reason}\n\nПожалуйста, соблюдайте правила семьи. При достижении {maxWarns} предупреждений последует исключение из состава.',
    defaultColor: '#F59E0B',
    defaultFooter: '{guild} • Дисциплина',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@User' },
      { tag: '{username}', description: 'Имя участника', sample: 'User' },
      { tag: '{moderator}', description: 'Модератор', sample: '@Moderator' },
      { tag: '{reason}', description: 'Причина', sample: 'Опоздание на сбор' },
      { tag: '{warnCount}', description: 'Текущее кол-во', sample: '1' },
      { tag: '{maxWarns}', description: 'Лимит', sample: '3' },
      { tag: '{guild}', description: 'Название семьи', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'sanction_dm_unwarn',
    category: 'Санкции & Модерация',
    name: 'ЛС нарушителю: Снятие предупреждения',
    description: 'Отправляется нарушителю в ЛС при аннулировании варна',
    defaultTitle: '🛡️ Предупреждение снято • {guild}',
    defaultDescription: '{username}, с вас было снято предупреждение администратором {moderator}.\n\nТекущее количество активных варнов: **{warnCount} из {maxWarns}**.',
    defaultColor: '#10B981',
    defaultFooter: '{guild} • Дисциплина',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@User' },
      { tag: '{username}', description: 'Имя участника', sample: 'User' },
      { tag: '{moderator}', description: 'Модератор', sample: '@Moderator' },
      { tag: '{warnCount}', description: 'Остаток варнов', sample: '0' },
      { tag: '{maxWarns}', description: 'Максимум', sample: '3' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'sanction_dm_kick',
    category: 'Санкции & Модерация',
    name: 'ЛС участнику: Исключение (Кик)',
    description: 'Отправляется участнику в ЛС перед его исключением с сервера Discord',
    defaultTitle: '🚪 Вы были исключены с сервера {guild}',
    defaultDescription: '{username}, вы были **исключены** с сервера семьи **{guild}** модератором {moderator}.\n\n**Причина исключения:**\n> {reason}',
    defaultColor: '#BE185D',
    defaultFooter: '{guild} • Модерация',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание пользователя', sample: '@User' },
      { tag: '{username}', description: 'Имя пользователя', sample: 'User' },
      { tag: '{moderator}', description: 'Модератор/администратор', sample: '@Moderator' },
      { tag: '{reason}', description: 'Причина кика', sample: 'Нарушение регламента семьи' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
  {
    key: 'sanction_dm_ban',
    category: 'Санкции & Модерация',
    name: 'ЛС участнику: Блокировка (Бан)',
    description: 'Отправляется нарушителю в ЛС перед его блокировкой на сервере Discord',
    defaultTitle: '⛔ Ваш аккаунт заблокирован на сервере {guild}',
    defaultDescription: '{username}, доступ к серверу семьи **{guild}** был **заблокирован** администратором {moderator}.\n\n**Причина блокировки:**\n> {reason}',
    defaultColor: '#EF4444',
    defaultFooter: '{guild} • Блокировка',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание пользователя', sample: '@User' },
      { tag: '{username}', description: 'Имя пользователя', sample: 'User' },
      { tag: '{moderator}', description: 'Администратор', sample: '@Admin' },
      { tag: '{reason}', description: 'Причина бана', sample: 'Слив информации / неадекватное поведение' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },

  // ==========================================
  // 10. Безопасность (Anti-Nuke)
  // ==========================================
  {
    key: 'antinuke_alert',
    category: 'Безопасность',
    name: 'Срабатывание Anti-Nuke',
    description: 'Срочное оповещение руководства о подозрительной активности на сервере',
    defaultTitle: '🚨 ТРЕВОГА ANTI-NUKE • {action}',
    defaultDescription: 'Внимание руководству сервера **{guild}**!\n\nОбнаружена подозрительная активность:\n**Инициатор:** {executor}\n**Действие:** {action}\n**Цель:** {target}\n**Принятая мера:** `{punishment}`\n\nБот мгновенно изолировал нарушителя для защиты структуры сервера.',
    defaultColor: '#EF4444',
    defaultFooter: '{guild} • Защита сервера',
    defaultContent: '@everyone',
    placeholders: [
      { tag: '{executor}', description: 'Нарушитель (<@id>)', sample: '@Attacker' },
      { tag: '{action}', description: 'Попытка действия', sample: 'Массовое удаление ролей' },
      { tag: '{target}', description: 'Затронутый объект', sample: 'Роль @Лидер' },
      { tag: '{punishment}', description: 'Наказание (Снятие ролей / Бан)', sample: 'Снятие всех ролей' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
    ],
  },
];

/**
 * Cache for guild custom messages
 */
const customMessagesCache = new Map<string, { data: Record<string, CustomMessageSettings>; timestamp: number }>();
const CACHE_TTL_MS = 30000;

export class BotMessageManager {
  /**
   * Replace placeholders in text
   */
  public static replacePlaceholders(
    text: string | undefined | null,
    variables: Record<string, string | number | undefined>
  ): string {
    if (!text) return '';
    let result = text;
    for (const [key, val] of Object.entries(variables)) {
      const stringVal = val !== undefined && val !== null ? String(val) : '';
      const regex = new RegExp(`{${key}}`, 'g');
      result = result.replace(regex, stringVal);
    }
    return result;
  }

  /**
   * Get all message definitions
   */
  public static getCatalog(): MessageTemplateDefinition[] {
    return BOT_MESSAGE_CATALOG;
  }

  /**
   * Get definition by key
   */
  public static getDefinition(key: string): MessageTemplateDefinition | undefined {
    return BOT_MESSAGE_CATALOG.find(d => d.key === key);
  }

  /**
   * Invalidate cache for a guild
   */
  public static invalidateCache(guildId: string): void {
    customMessagesCache.delete(guildId);
  }

  /**
   * Get all custom message configurations for a guild
   */
  public static async getGuildCustomMessages(guildId: string): Promise<Record<string, CustomMessageSettings>> {
    const cached = customMessagesCache.get(guildId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      const cfg = await prisma.botMessagesConfig.findUnique({
        where: { guildId },
      });

      let parsed: Record<string, CustomMessageSettings> = {};
      if (cfg?.customMessagesJson) {
        try {
          parsed = JSON.parse(cfg.customMessagesJson);
        } catch {
          parsed = {};
        }
      }

      // Sync legacy welcome/leave fields if custom not yet set
      if (cfg) {
        if (!parsed.welcome) {
          parsed.welcome = {
            enabled: cfg.welcomeEnabled,
            title: cfg.welcomeTitle,
            description: cfg.welcomeMessage,
            color: cfg.welcomeEmbedColor,
          };
        }
        if (!parsed.leave) {
          parsed.leave = {
            enabled: cfg.leaveEnabled,
            description: cfg.leaveMessage,
            color: '#BE185D',
          };
        }
        if (!parsed.ticket_welcome && cfg.ticketGreetingTitle) {
          parsed.ticket_welcome = {
            title: cfg.ticketGreetingTitle,
            description: cfg.ticketGreetingDesc,
          };
        }
      }

      customMessagesCache.set(guildId, { data: parsed, timestamp: Date.now() });
      return parsed;
    } catch (e) {
      console.warn('[BotMessageManager] Error fetching custom messages:', e);
      return {};
    }
  }

  /**
   * Save custom message settings for a guild
   */
  public static async saveGuildCustomMessages(
    guildId: string,
    customMessages: Record<string, CustomMessageSettings>
  ): Promise<void> {
    const jsonStr = JSON.stringify(customMessages);

    // Also mirror welcome / leave into top-level columns for backward compatibility
    const welcome = customMessages.welcome;
    const leave = customMessages.leave;
    const ticket = customMessages.ticket_welcome;

    await prisma.botMessagesConfig.upsert({
      where: { guildId },
      update: {
        customMessagesJson: jsonStr,
        ...(welcome?.enabled !== undefined ? { welcomeEnabled: welcome.enabled } : {}),
        ...(welcome?.title ? { welcomeTitle: welcome.title } : {}),
        ...(welcome?.description ? { welcomeMessage: welcome.description } : {}),
        ...(welcome?.color ? { welcomeEmbedColor: welcome.color } : {}),
        ...(leave?.enabled !== undefined ? { leaveEnabled: leave.enabled } : {}),
        ...(leave?.description ? { leaveMessage: leave.description } : {}),
        ...(ticket?.title ? { ticketGreetingTitle: ticket.title } : {}),
        ...(ticket?.description ? { ticketGreetingDesc: ticket.description } : {}),
      },
      create: {
        guildId,
        customMessagesJson: jsonStr,
        welcomeEnabled: welcome?.enabled ?? false,
        welcomeTitle: welcome?.title ?? 'Добро пожаловать в семью, {user}!',
        welcomeMessage: welcome?.description ?? 'Рады приветствовать тебя на нашем сервере {guild}!',
        welcomeEmbedColor: welcome?.color ?? '#EC4899',
        leaveEnabled: leave?.enabled ?? false,
        leaveMessage: leave?.description ?? '{user} покинул наш сервер.',
        ticketGreetingTitle: ticket?.title ?? 'Заявка в семью INTERPOL',
        ticketGreetingDesc: ticket?.description ?? 'Приветствуем, {user}!\nВаша анкета получена.',
      },
    });

    customMessagesCache.set(guildId, { data: customMessages, timestamp: Date.now() });
  }

  /**
   * Render a bot message by key, with full fallback to catalog defaults
   */
  public static async renderMessage(
    guildId: string,
    key: string,
    variables: Record<string, string | number | undefined> = {}
  ): Promise<{
    content?: string;
    embed: EmbedBuilder;
    enabled: boolean;
    title: string;
    description: string;
    color: string;
  }> {
    const def = this.getDefinition(key);
    const customMap = await this.getGuildCustomMessages(guildId);
    const custom = customMap[key] || {};

    const isEnabled = custom.enabled !== undefined ? custom.enabled : true;

    const rawTitle = custom.title !== undefined && custom.title !== '' ? custom.title : (def?.defaultTitle || '');
    const rawDesc = custom.description !== undefined && custom.description !== '' ? custom.description : (def?.defaultDescription || '');
    const rawColor = custom.color || def?.defaultColor || '#EC4899';
    const rawFooter = custom.footer || def?.defaultFooter || '{guild} • Majestic RP';
    const rawContent = custom.content !== undefined ? custom.content : (def?.defaultContent || '');

    const title = this.replacePlaceholders(rawTitle, variables);
    const description = this.replacePlaceholders(rawDesc, variables);
    const footer = this.replacePlaceholders(rawFooter, variables);
    const content = this.replacePlaceholders(rawContent, variables);

    const cleanHex = rawColor.replace('#', '');
    const colorInt = parseInt(cleanHex, 16) || THEME.COLORS.PRIMARY;

    const embed = createThemedEmbed({
      title: title || undefined,
      description: description || undefined,
      color: colorInt,
      footerText: footer || undefined,
    });

    return {
      content: content.trim() ? content.trim() : undefined,
      embed,
      enabled: isEnabled,
      title,
      description,
      color: rawColor,
    };
  }

  /**
   * Safely dispatch a customized direct message (DM) to a member or user
   */
  public static async sendDM(
    guildId: string,
    target: GuildMember | User | any,
    key: string,
    variables: Record<string, string | number | undefined> = {}
  ): Promise<boolean> {
    try {
      const rendered = await this.renderMessage(guildId, key, variables);
      if (!rendered.enabled) return false;

      let recipient = target;
      if (typeof target === 'string') {
        const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
        recipient = guild ? await guild.members.fetch(target).catch(() => null) : await bot.users.fetch(target).catch(() => null);
      }

      if (!recipient || typeof recipient.send !== 'function') return false;

      await recipient.send({
        content: rendered.content,
        embeds: [rendered.embed],
      });
      return true;
    } catch {
      // Direct messages closed or blocked by user
      return false;
    }
  }

  /**
   * Send a customized message to a text channel
   */
  public static async sendChannelMessage(
    channel: TextChannel,
    key: string,
    variables: Record<string, string | number | undefined> = {},
    extraOptions: { components?: any[]; files?: any[] } = {}
  ): Promise<Message | null> {
    try {
      const rendered = await this.renderMessage(channel.guild.id, key, variables);
      if (!rendered.enabled) return null;

      return await channel.send({
        content: rendered.content,
        embeds: [rendered.embed],
        components: extraOptions.components,
        files: extraOptions.files,
      });
    } catch (e: any) {
      console.warn(`[BotMessageManager] Failed to send channel message ${key}:`, e.message);
      return null;
    }
  }
}
