# RuTracker Parser

Приложение состоит из трёх сервисов в `docker-compose`:

- `mongo` для хранения данных.
- `api` на `Express + Node.js + Axios + MongoDB + WebSocket + Swagger`.
- `frontend` на `Node.js + Vue 2 + Vuetify`.

## Что делает приложение

- При старте backend автоматически запускает scraping `https://rutracker.org/forum/index.php`.
- Для авторизации в запросе используется cookie `bb_session`.
- Из главной страницы извлекаются категории, разделы и подразделы форума.
- Данные пишутся в одну коллекцию MongoDB `forum_nodes`.
- Повторные проходы не создают дубликаты: используется `externalId` и `upsert`.
- Frontend получает статус scraping и дерево разделов по WebSocket.
- Для подразделов и конечных разделов без дочерних узлов можно собирать топики и сохранять их в коллекцию `topics`.
- Для каждого топика дополнительно сохраняются данные из блока `Последние поблагодарившие`.
- При пустой коллекции `topics` после старта автоматически скраппится первый доступный подраздел или конечный раздел.
- История запусков topic-scrape сохраняется в коллекцию `topic_scrape_runs`.
- Загруженные топики открываются на frontend в модальном окне с пагинацией.

## Переменные окружения

Создайте файл `.env` на основе `.env.example`:

```env
RUTRACKER_BB_SESSION=your_real_bb_session
```

## Запуск

```bash
docker compose up --build
```

После запуска будут доступны:

- frontend: `http://localhost:8080`
- swagger: `http://localhost:3000/docs`
- api health: `http://localhost:3000/api/health`

## Тесты

API backend покрыт тестами на `node:test + supertest`.

Запуск:

```bash
cd backend
npm test
```

Что проверяется:

- `GET /docs/openapi.json` - доступность OpenAPI-спеки.
- `GET /api/health` - агрегированное состояние API.
- `GET /api/forum-nodes/tree` - успешный ответ и ответ `503`, если база недоступна.
- `POST /api/scrape/run` - успешный запуск и конфликт `409`, если scraping уже выполняется.
- `GET /api/topics/subforums/summary` - выдача summary по сохранённым топикам.
- `GET /api/topics` - валидация query-параметров и пагинированная выдача.
- `GET /api/topics/scrape/status` - текущий статус topic-scrape.
- `POST /api/topics/scrape` - успешный запуск, ошибки валидации и конфликт повторного запуска.
- общие обработчики `404` и `500`.

## HTTP API

- `GET /api/health` - состояние API, MongoDB и scraper.
- `GET /api/forum-nodes/tree` - текущее дерево разделов из MongoDB.
- `GET /api/scrape/status` - текущий статус scraping.
- `POST /api/scrape/run` - ручной запуск scraping в фоне.
- `GET /api/topics/subforums/summary` - список подразделов и конечных разделов, по которым уже есть сохранённые топики.
- `GET /api/topics?subforumExternalId=...&page=1&pageSize=10` - пагинированные топики выбранного подраздела или конечного раздела.
- `GET /api/topics/scrape/status` - текущий статус topic-scrape.
- `POST /api/topics/scrape` - ручной запуск topic-scrape по выбранному подразделу или конечному разделу.

## WebSocket

Подключение выполняется к:

```text
ws://localhost:8080/ws
```

Типы сообщений:

- `status` - состояние scraping.
- `tree_snapshot` - актуальное дерево разделов.
- `topic_scrape_status` - состояние topic-scrape.
- `topics_summary` - перечень подразделов и конечных разделов, по которым уже сохранены топики.
- `topic_scrape_result` - результат завершившегося topic-scrape.
