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

## HTTP API

- `GET /api/health` - состояние API, MongoDB и scraper.
- `GET /api/forum-nodes/tree` - текущее дерево разделов из MongoDB.
- `GET /api/scrape/status` - текущий статус scraping.
- `POST /api/scrape/run` - ручной запуск scraping в фоне.

## WebSocket

Подключение выполняется к:

```text
ws://localhost:8080/ws
```

Типы сообщений:

- `status` - состояние scraping.
- `tree_snapshot` - актуальное дерево разделов.
