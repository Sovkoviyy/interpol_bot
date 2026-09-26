import { EmbedBuilder } from 'discord.js';
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
  // 1. Приветствие & Уход
  {
    key: 'welcome',
    category: 'Приветствие & Уход',
    name: 'Вход нового участника',
    description: 'Отправляется в канал приветствий при входе нового пользователя на сервер',
    defaultTitle: '👋 Добро пожаловать в семью, {user}!',
    defaultDescription: 'Рады приветствовать тебя на сервере **{guild}**!\n\nОзнакомься с правилами и подай заявку в семью в канале набора.\n\n-# Ты стал участником #{memberCount} на нашем сервере!',
    defaultColor: '#EC4899',
    defaultFooter: 'INTERPOL • Добро пожаловать',
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
    key: 'leave',
    category: 'Приветствие & Уход',
    name: 'Выход участника',
    description: 'Отправляется в канал логов/уведомлений при выходе участника с сервера',
    defaultTitle: '🚪 Участник покинул сервер',
    defaultDescription: '**{username}** покинул сервер **{guild}**.\n\nТеперь нас осталось: **{memberCount}** участников.',
    defaultColor: '#BE185D',
    defaultFooter: 'INTERPOL • Прощание',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание или тег пользователя', sample: '@Sovkoviy' },
      { tag: '{username}', description: 'Имя пользователя', sample: 'Sovkoviy' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
      { tag: '{memberCount}', description: 'Оставшееся количество участников', sample: '153' },
      { tag: '{date}', description: 'Дата и время выхода', sample: '26.09.2026 21:05' },
    ],
  },

  // 2. Заявки & Рекрутинг
  {
    key: 'recruitment_announcement',
    category: 'Заявки & Рекрутинг',
    name: 'Анонс набора в семью',
    description: 'Главное сообщение в канале набора с кнопкой «Подать заявку»',
    defaultTitle: '📋 НАБОР В СЕМЬЮ INTERPOL',
    defaultDescription: 'Семья **{guild}** открывает набор активных и амбициозных игроков!\n\n**Мы предлагаем:**\n- Регулярные мероприятия (Капты, ВЗЗ, Дропы, МЦЛ)\n- Премии и выплаты за участие\n- Дружный состав и карьерный рост\n\n**Требования:**\n- Адекватность и соблюдение правил штата\n- Наличие микрофона и Discord\n\nНажмите кнопку ниже, чтобы заполнить анкету!',
    defaultColor: '#EC4899',
    defaultFooter: 'INTERPOL • Majestic RP',
    defaultContent: '',
    placeholders: [
      { tag: '{guild}', description: 'Название семьи/сервера', sample: 'INTERPOL' },
      { tag: '{memberCount}', description: 'Количество участников', sample: '154' },
    ],
  },
  {
    key: 'ticket_welcome',
    category: 'Заявки & Рекрутинг',
    name: 'Приветствие в тикете заявки',
    description: 'Первое сообщение в созданном приватном канале тикета кандидата',
    defaultTitle: '📨 ЗАЯВКА В СЕМЬЮ • {username}',
    defaultDescription: 'Приветствуем, {user}!\n\nВаша анкета получена и передана рекрутерам семьи.\nПожалуйста, подготовьте скриншоты вашей статистики в игре.\n\nОжидайте ответа рекрутера в этом канале.',
    defaultColor: '#EC4899',
    defaultFooter: 'INTERPOL • Рекрутинг',
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
    key: 'ticket_accepted',
    category: 'Заявки & Рекрутинг',
    name: 'Одобрение заявки',
    description: 'Сообщение в тикете и ЛС при одобрении кандидата в семью',
    defaultTitle: '✅ ЗАЯВКА ОДОБРЕНА',
    defaultDescription: 'Поздравляем, {user}!\n\nВаша заявка в семью **{guild}** была успешно **одобрена** рекрутером {recruiter}.\nВам выдана роль **{role}**.\n\nДобро пожаловать в семью! Ознакомьтесь с правилами и загляните в раздел академии.',
    defaultColor: '#10B981',
    defaultFooter: 'INTERPOL • Добро пожаловать в состав',
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
    key: 'ticket_rejected',
    category: 'Заявки & Рекрутинг',
    name: 'Отказ по заявке',
    description: 'Сообщение в тикете и ЛС при отклонении заявки',
    defaultTitle: '❌ ЗАЯВКА ОТКЛОНЕНА',
    defaultDescription: 'Здравствуйте, {user}.\n\nК сожалению, ваша заявка в семью **{guild}** была **отклонена** рекрутером {recruiter}.\n\n**Причина отказа:**\n> {reason}\n\nВы можете попробовать подать заявку повторно через некоторое время.',
    defaultColor: '#BE185D',
    defaultFooter: 'INTERPOL • Рекрутинг',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание кандидата', sample: '@Candidate' },
      { tag: '{username}', description: 'Имя кандидата', sample: 'Candidate' },
      { tag: '{guild}', description: 'Название сервера', sample: 'INTERPOL' },
      { tag: '{recruiter}', description: 'Рекрутер, отклонивший заявку', sample: '@Recruiter' },
      { tag: '{reason}', description: 'Причина отказа', sample: 'Недостаточный игровой уровень' },
    ],
  },

  // 3. Академия семьи
  {
    key: 'academy_channel_welcome',
    category: 'Академия семьи',
    name: 'Создание канала академии',
    description: 'Приветственное сообщение в личном канале курсанта при поступлении в академию',
    defaultTitle: '🎓 АКАДЕМИЯ СЕМЬИ • {username}',
    defaultDescription: 'Добро пожаловать в академию семьи **{guild}**, {user}!\n\nТвой статик: `{staticId}`.\nЗдесь ты будешь проходить обучение и сдавать этапы перед переводом в основной состав.\n\nКураторы академии ответят на любые твои вопросы в этом канале.',
    defaultColor: '#EC4899',
    defaultFooter: 'INTERPOL • Академия 1-2 ранг',
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
    key: 'academy_stage_passed',
    category: 'Академия семьи',
    name: 'Сдача этапа академии',
    description: 'Сообщение об успешной сдаче этапа курсанта',
    defaultTitle: '📈 ЭТАП АКАДЕМИИ СДАН',
    defaultDescription: '{user} успешно сдал этап **«{stageName}»**!\n\n**Экзаменатор:** {mentor}\n**Прогресс академии:** {progress}',
    defaultColor: '#10B981',
    defaultFooter: 'INTERPOL • Академия',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание курсанта', sample: '@Cadet' },
      { tag: '{username}', description: 'Имя курсанта', sample: 'Cadet' },
      { tag: '{stageName}', description: 'Название сданного этапа', sample: 'Стрельбище & Правила' },
      { tag: '{mentor}', description: 'Инструктор/куратор', sample: '@Instructor' },
      { tag: '{progress}', description: 'Индикатор прогресса', sample: '2/3 (66%)' },
    ],
  },
  {
    key: 'academy_graduated',
    category: 'Академия семьи',
    name: 'Выпуск из академии',
    description: 'Торжественное поздравление с окончанием академии и повышением до 2 ранга',
    defaultTitle: '🏆 ВЫПУСК ИЗ АКАДЕМИИ!',
    defaultDescription: 'Поздравляем курсанта {user} с успешным завершением Академии!\n\nВсе этапы успешно сданы. Курсант переведен в **основной состав семьи**!\n**Новый ранг:** **{newRank}**\n**Куратор:** {mentor}',
    defaultColor: '#F59E0B',
    defaultFooter: 'INTERPOL • Выпускник академии',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание выпускника', sample: '@Cadet' },
      { tag: '{username}', description: 'Имя выпускника', sample: 'Cadet' },
      { tag: '{mentor}', description: 'Выпустивший куратор', sample: '@Instructor' },
      { tag: '{newRank}', description: 'Новый ранг участника', sample: '2 - Участник' },
    ],
  },
  {
    key: 'academy_expelled',
    category: 'Академия семьи',
    name: 'Исключение из академии',
    description: 'Сообщение об отчислении курсанта из академии',
    defaultTitle: '🚫 ОТЧИСЛЕНИЕ ИЗ АКАДЕМИИ',
    defaultDescription: 'Курсант {user} был **отчислен** из Академии семьи.\n\n**Причина:**\n> {reason}\n\n**Решение принял:** {mentor}',
    defaultColor: '#BE185D',
    defaultFooter: 'INTERPOL • Академия',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание курсанта', sample: '@Cadet' },
      { tag: '{username}', description: 'Имя курсанта', sample: 'Cadet' },
      { tag: '{mentor}', description: 'Принявший решение', sample: '@Instructor' },
      { tag: '{reason}', description: 'Причина отчисления', sample: 'Неактив более 7 дней' },
    ],
  },

  // 4. Мероприятия & Сборы
  {
    key: 'event_announcement',
    category: 'Мероприятия & Сборы',
    name: 'Анонс сбора на мероприятие',
    description: 'Публикуется при создании сбора на Капт, ВЗЗ, Дроп, МЦЛ и др.',
    defaultTitle: '⚔️ СБОР НА МЕРОПРИЯТИЕ • {eventTitle}',
    defaultDescription: 'Объявлен общий сбор семьи на **{eventTitle}** ({eventType})!\n\n**Время начала:** {eventTime}\n**Сбор в войсе:** {voiceChannel}\n**Карта / Локация:** {mapName}\n**Код группы:** `{partyCode}`\n**Лимит участников:** {limit}\n\nПодтвердите явку кнопками ниже!',
    defaultColor: '#EC4899',
    defaultFooter: 'INTERPOL • Мероприятия',
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
    ],
  },
  {
    key: 'event_ping',
    category: 'Мероприятия & Сборы',
    name: 'Напоминание о сборе (Пинг)',
    description: 'Автоматический пинг за 5, 3 или 1 минуту до начала мероприятия',
    defaultTitle: '⏰ НАПОМИНАНИЕ • До начала {minutesLeft} мин!',
    defaultDescription: 'Сбор на **{eventTitle}** начинается через **{minutesLeft} мин**!\n\nВсе подтвердившие явку ({confirmedCount} чел.), срочно заходим в голосовой канал {voiceChannel}!\n\nКод группы в игре: `{partyCode}`.',
    defaultColor: '#F59E0B',
    defaultFooter: 'INTERPOL • Скоро начало',
    defaultContent: '{role}',
    placeholders: [
      { tag: '{eventTitle}', description: 'Название мероприятия', sample: 'Капт' },
      { tag: '{minutesLeft}', description: 'Осталось минут до начала', sample: '5' },
      { tag: '{eventTime}', description: 'Время начала', sample: '21:00' },
      { tag: '{voiceChannel}', description: 'Голосовой канал сбора', sample: '#Капты-1' },
      { tag: '{partyCode}', description: 'Код группы', sample: 'INT-99' },
      { tag: '{role}', description: 'Пингуемая роль', sample: '@Капт' },
      { tag: '{confirmedCount}', description: 'Число подтвердивших явку', sample: '18' },
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
    defaultFooter: 'INTERPOL • В бой',
    defaultContent: '{role}',
    placeholders: [
      { tag: '{eventTitle}', description: 'Название мероприятия', sample: 'ВЗЗ' },
      { tag: '{voiceChannel}', description: 'Голосовой канал', sample: '#ВЗЗ' },
      { tag: '{partyCode}', description: 'Код группы', sample: 'INT-VZZ' },
      { tag: '{confirmedCount}', description: 'Число участников', sample: '20' },
      { tag: '{role}', description: 'Роль участников', sample: '@Состав' },
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
    defaultFooter: 'INTERPOL • Мероприятия',
    defaultContent: '{role}',
    placeholders: [
      { tag: '{eventTitle}', description: 'Название мероприятия', sample: 'Дроп 20:00' },
      { tag: '{reason}', description: 'Причина отмены', sample: 'Перенос времени' },
      { tag: '{author}', description: 'Организатор', sample: '@Leader' },
      { tag: '{role}', description: 'Роль участников', sample: '@Состав' },
    ],
  },

  // 5. Отпуска & Неактив
  {
    key: 'leave_request',
    category: 'Отпуска & Неактив',
    name: 'Заявка на отпуск',
    description: 'Публикуется в канал рассмотрения отпусков при подаче заявки участником',
    defaultTitle: '🌴 ЗАЯВКА НА ОТПУСК • {username}',
    defaultDescription: 'Участник {user} (статик `{staticId}`) запросил отпуск.\n\n**Длительность:** {days} дн.\n**Период:** до {untilDate}\n**Причина:**\n> {reason}\n\nРуководство может подтвердить или отклонить заявку кнопками ниже.',
    defaultColor: '#6366F1',
    defaultFooter: 'INTERPOL • Отпуска',
    defaultContent: '',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@User' },
      { tag: '{username}', description: 'Имя участника', sample: 'User' },
      { tag: '{staticId}', description: 'Статик участника', sample: '142055' },
      { tag: '{days}', description: 'Количество дней отпуска', sample: '7' },
      { tag: '{untilDate}', description: 'Дата окончания отпуска', sample: '03.10.2026' },
      { tag: '{reason}', description: 'Причина отпуска', sample: 'Сессия в университете' },
    ],
  },
  {
    key: 'leave_approved',
    category: 'Отпуска & Неактив',
    name: 'Одобрение отпуска',
    description: 'Уведомление в канале и ЛС при одобрении отпуска',
    defaultTitle: '✅ ОТПУСК ОДОБРЕН',
    defaultDescription: 'Отпуск для {user} успешно **одобрен** администратором {admin}!\n\n**Срок:** {days} дн. (до {untilDate})\nПриятного отдыха! Статус аккаунта переведен в `ON_LEAVE`.',
    defaultColor: '#10B981',
    defaultFooter: 'INTERPOL • Отпуска',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@User' },
      { tag: '{username}', description: 'Имя участника', sample: 'User' },
      { tag: '{admin}', description: 'Администратор, одобривший отпуск', sample: '@Admin' },
      { tag: '{days}', description: 'Количество дней', sample: '5' },
      { tag: '{untilDate}', description: 'Дата окончания', sample: '01.10.2026' },
    ],
  },
  {
    key: 'leave_rejected',
    category: 'Отпуска & Неактив',
    name: 'Отказ в отпуске',
    description: 'Уведомление при отклонении заявки на отпуск',
    defaultTitle: '❌ В ОТПУСКЕ ОТКАЗАНО',
    defaultDescription: 'Заявка на отпуск для {user} была **отклонена** администратором {admin}.\n\n**Причина:**\n> {reason}',
    defaultColor: '#BE185D',
    defaultFooter: 'INTERPOL • Отпуска',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@User' },
      { tag: '{username}', description: 'Имя участника', sample: 'User' },
      { tag: '{admin}', description: 'Администратор', sample: '@Admin' },
      { tag: '{reason}', description: 'Причина отказа', sample: 'Большое количество участников в отпуске' },
    ],
  },

  // 6. Тир система
  {
    key: 'tier_application',
    category: 'Тир система',
    name: 'Заявка на тир',
    description: 'Публикация заявки на тир в ветке проверки',
    defaultTitle: '🎯 ЗАЯВКА НА ТИР • {tierName}',
    defaultDescription: 'Кандидат {user} (статик `{staticId}`) подал заявку на получение **{tierName}**!\n\nЧекеры тира {checkerRole}, проверьте прикрепленные доказательства / откаты стрельбы.',
    defaultColor: '#EC4899',
    defaultFooter: 'INTERPOL • Тир система',
    defaultContent: '{user} {checkerRole}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание кандидата', sample: '@Shooter' },
      { tag: '{username}', description: 'Имя кандидата', sample: 'Shooter' },
      { tag: '{tierName}', description: 'Название тира', sample: 'Tier 1' },
      { tag: '{staticId}', description: 'Статик кандидата', sample: '142055' },
      { tag: '{checkerRole}', description: 'Роль чекеров тира', sample: '@Tier Checker' },
    ],
  },
  {
    key: 'tier_approved',
    category: 'Тир система',
    name: 'Одобрение тира',
    description: 'Сообщение при присвоении тира чекером',
    defaultTitle: '⭐ ТИР ПОДТВЕРЖДЕН • {tierName}',
    defaultDescription: 'Поздравляем, {user}!\n\nВам успешно присвоен **{tierName}**!\n**Проверил чекер:** {checker}\n**Оценка стрельбы:** {score}',
    defaultColor: '#10B981',
    defaultFooter: 'INTERPOL • Тир система',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@Shooter' },
      { tag: '{username}', description: 'Имя участника', sample: 'Shooter' },
      { tag: '{tierName}', description: 'Присвоенный тир', sample: 'Tier 1' },
      { tag: '{checker}', description: 'Чекер тира', sample: '@HeadChecker' },
      { tag: '{score}', description: 'Балл или оценка', sample: '9/10' },
    ],
  },
  {
    key: 'tier_rejected',
    category: 'Тир система',
    name: 'Отказ по тиру',
    description: 'Сообщение при отклонении заявки на тир',
    defaultTitle: '❌ ОТКАЗ ПО ТИРУ • {tierName}',
    defaultDescription: 'Заявка на {tierName} для {user} была **отклонена** чекером {checker}.\n\n**Причина / замечания:**\n> {reason}\n\nПотренируйтесь на ДМ-сервере и попробуйте сдать заново.',
    defaultColor: '#BE185D',
    defaultFooter: 'INTERPOL • Тир система',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@Shooter' },
      { tag: '{username}', description: 'Имя участника', sample: 'Shooter' },
      { tag: '{tierName}', description: 'Название тира', sample: 'Tier 2' },
      { tag: '{checker}', description: 'Чекер тира', sample: '@Checker' },
      { tag: '{reason}', description: 'Причина отказа', sample: 'Недостаточно фрагов на откате' },
    ],
  },

  // 8. Профили & Статики
  {
    key: 'static_bound',
    category: 'Профили & Статики',
    name: 'Привязка статика',
    description: 'Уведомление при успешной привязке игрового статика и имени',
    defaultTitle: '🆔 СТАТИК УСПЕШНО ПРИВЯЗАН',
    defaultDescription: 'Участник {user} успешно привязал игровой профиль Majestic RP!\n\n**Имя персонажа:** {characterName}\n**Статический ID:** `{staticId}`\n\nНикнейм на сервере автоматически синхронизирован.',
    defaultColor: '#10B981',
    defaultFooter: 'INTERPOL • Профили',
    defaultContent: '{user}',
    placeholders: [
      { tag: '{user}', description: 'Упоминание участника', sample: '@Player' },
      { tag: '{username}', description: 'Имя пользователя', sample: 'Player' },
      { tag: '{staticId}', description: 'Статический ID', sample: '142055' },
      { tag: '{characterName}', description: 'Имя в игре', sample: 'Tony Montana' },
    ],
  },
  {
    key: 'rank_up',
    category: 'Профили & Статики',
    name: 'Повышение ранга в семье',
    description: 'Поздравление участника с повышением в ранге',
    defaultTitle: '🎖️ ПОВЫШЕНИЕ В РАНГЕ!',
    defaultDescription: 'Поздравляем {user} с повышением ранга в семье **{guild}**!\n\n**Старый ранг:** {oldRank}\n**Новый ранг:** **{newRank}**\n**Сыграно МП:** {mpCount}\n\nБлагодарим за активность и преданность семье!',
    defaultColor: '#F59E0B',
    defaultFooter: 'INTERPOL • Карьера',
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

  // 9. Безопасность (Anti-Nuke)
  {
    key: 'antinuke_alert',
    category: 'Безопасность',
    name: 'Срабатывание Anti-Nuke',
    description: 'Срочное оповещение руководства о подозрительной активности на сервере',
    defaultTitle: '🚨 ТРЕВОГА ANTI-NUKE • {action}',
    defaultDescription: 'Внимание руководству сервера **{guild}**!\n\nОбнаружена подозрительная активность:\n**Инициатор:** {executor}\n**Действие:** {action}\n**Цель:** {target}\n**Принятая мера:** `{punishment}`\n\nБот мгновенно изолировал нарушителя для защиты структуры сервера.',
    defaultColor: '#EF4444',
    defaultFooter: 'INTERPOL • Защита сервера',
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
    const rawFooter = custom.footer || def?.defaultFooter || 'INTERPOL • Majestic RP';
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
}
