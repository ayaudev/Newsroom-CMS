# Newsroom CMS

Университетский MVP на существующем React/Vite frontend и Express backend. База данных — PostgreSQL. Старые маршруты /api/news сохранены; /api/posts предоставляет тот же публичный API.

## Что было в NewsHub

- Регистрация, JWT-вход, роли пользователя и администратора, профиль и изменение пароля.
- Новости, поиск, категории, главные и популярные материалы.
- Черновики, публикация и архив; CRUD публикаций и загрузка изображений.
- Лайки, избранное, комментарии с ответами; административная статистика.
- MongoDB/Mongoose; категории были фиксированными строками. Модерации, отдельной Category, Post и /api/posts/latest не было.

## Что добавлено

- PostgreSQL: users, posts, categories, comments, post_likes, comment_likes, favorites; внешние ключи, ограничения и индексы.
- Post, Category, Comment и User repositories с параметризованными SQL-запросами.
- Публикации по умолчанию создаются черновиками; публичные маршруты показывают только published.
- GET /api/posts/latest: сортировка по publishedAt DESC, пагинация, поиск и категории; limit от 1 до 100.
- Комментарии pending / approved / rejected. На сайте видны только одобренные комментарии опубликованных материалов. Изменение текста сбрасывает статус в pending.
- Админка: статистика, публикации, категории и модерация; административные API защищены ролью admin.
- Русский интерфейс, даты, роли, статусы, сообщения, адаптивный дизайн, локальные заглушки изображений, безопасный HTML.

## Запуск с установленным PostgreSQL

Требуются Node.js 20+ и PostgreSQL. Создайте отдельную базу newsroom (через pgAdmin или psql), не используйте существующую базу с чужими таблицами.

1. Скопируйте backend/.env.example в backend/.env.
2. Укажите DATABASE_URL, собственный JWT_SECRET, ADMIN_EMAIL и ADMIN_PASSWORD. Пароль администратора — минимум 8 символов. Пример URL: postgresql://user:password@localhost:5432/newsroom. Специальные символы пароля в URL должны быть URL-кодированы.
3. В каталоге backend выполните:

~~~powershell
npm install
npm run migrate
npm run seed
npm run seed:demo
npm run dev
~~~

seed:demo необязателен. Создаёт пять опубликованных материалов и один черновик. Скрипты seed не удаляют существующих пользователей или публикации.

4. Во втором терминале, в frontend:

~~~powershell
npm install
npm run dev
~~~

Откройте http://localhost:3000. Войдите с заданными ADMIN_EMAIL и ADMIN_PASSWORD; панель управления: http://localhost:3000/admin. Vite проксирует /api и /uploads на localhost:5000. Для другого хоста API задайте VITE_API_URL в frontend/.env; сервер должен также отдавать /uploads с доступного адреса.

## PostgreSQL через Docker

Запустите Docker Desktop. Скопируйте корневой .env.example в .env, задайте POSTGRES_PASSWORD, затем из корня:

~~~powershell
docker compose up -d
~~~

В backend/.env укажите DATABASE_URL=postgresql://newsroom:YOUR_PASSWORD@localhost:5432/newsroom. Далее выполните миграцию, seed и запуск по инструкции выше. Данные сохраняются в Docker volume newsroom_pg. Порт 5432 должен быть свободен.

## Перенос существующей MongoDB

Исходная MongoDB не изменяется. Экспортируйте коллекции users, news и comments в отдельную папку, например с mongoexport --jsonArray, в файлы users.json, news.json, comments.json. Если комментариев нет, используйте comments.json с пустым массивом []. Экспорт пользователей должен содержать исходные bcrypt-хеши password.

После npm run migrate в backend:

~~~powershell
npm run import:mongo -- C:\path\to\export
~~~

Импорт выполняется одной транзакцией, сохраняет URL публикаций, хеши паролей, авторов, ответы, просмотры, лайки и избранное. MongoDB ObjectId преобразуются в стабильные UUID. Повторный импорт не перезаписывает содержимое существующих записей. Комментарии без статуса получают pending для проверки редактором. При конфликте email/slug или повреждённых ссылках весь импорт отменяется; исправьте экспорт и повторите. Копировать backend/uploads не требуется при работе в том же проекте.

## API

| Маршрут | Назначение |
|---|---|
| GET /api/posts/latest | Последние опубликованные материалы; page, limit, category, search, tag |
| GET /api/news | Совместимость с прежним frontend |
| GET /api/categories | Категории и число опубликованных материалов |
| GET /api/admin/stats | Статистика редакции |
| GET/POST /api/admin/news | Список и создание публикаций |
| GET/PUT/DELETE /api/admin/news/:id | Просмотр, изменение, удаление |
| GET/POST /api/admin/categories | Категории |
| DELETE /api/admin/categories/:id | Удаление неиспользуемой категории |
| GET /api/admin/comments?status=pending | Очередь модерации с пагинацией |
| PATCH /api/admin/comments/:id/status | JSON: {status: approved или rejected или pending} |
| POST /api/news/:id/comments | Комментарий; content, необязательный parentCommentId |
| GET /api/health | Проверка API и соединения с PostgreSQL |

Административные запросы требуют Authorization: Bearer JWT. Публичная регистрация всегда создаёт user независимо от переданного role. Администратора создаёт seed либо существующий администратор через /api/auth/register-admin.

## Проверки

~~~powershell
# backend
npm test
npm run test:integration
# frontend
npm run build
~~~

test:integration использует установленный PostgreSQL 18 в C:/Program Files/PostgreSQL/18/bin (или POSTGRES_BIN). Создаёт изолированный временный кластер на localhost:55439, проверяет жизненный цикл публикаций, права, модерацию, ответы, поиск, лайки, избранное, категории, профиль и пароль, затем останавливает кластер. Не обращается к базе из backend/.env. Тестовые файлы остаются в системном временном каталоге для диагностики.

Не публикуйте .env. Сервер не запускается без DATABASE_URL и JWT_SECRET. Перед развёртыванием настройте FRONTEND_URL, доступ к PostgreSQL, постоянное хранилище uploads и HTTPS. Файл backend/vercel.json сохранён, но существующая конфигурация serverless требует отдельной настройки: локальная загрузка файлов предполагает постоянную файловую систему.
