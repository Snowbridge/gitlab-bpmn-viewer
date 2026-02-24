# GitLab BPMN Viewer

Расширение для браузеров (Chrome, Firefox, Edge), интегрирующее визуализатор BPMN (bpmn-js) в GitLab для упрощения code review и навигации по .bpmn файлам.

## Требования

- Node.js 18+
- npm или pnpm

## Установка

```bash
npm install
```

После установки автоматически генерируются placeholder-иконки в `src/icons/`.

## Разработка

```bash
# Watch-режим (пересборка при изменениях)
npm run dev

# Сборка для Chrome (по умолчанию)
npm run build
npm run build:chrome

# Сборка для Firefox
npm run build:firefox
```

Артефакты: `dist/chrome/` или `dist/firefox/`.

## Установка расширения в браузере

- **Chrome / Edge**: `chrome://extensions` → «Загрузить распакованное» → указать папку `dist/chrome`
- **Firefox**: `about:debugging` → «Этот Firefox» → «Загрузить временное дополнение» → выбрать `dist/firefox/manifest.json`

## Сценарии

| Команда | Описание |
|---------|----------|
| `npm run dev` | Watch-режим сборки |
| `npm run build` | Продакшен-сборка (Chrome) |
| `npm run build:chrome` | Сборка для Chromium |
| `npm run build:firefox` | Сборка для Firefox |
| `npm run lint` | Проверка ESLint |
| `npm run test` | Запуск тестов |
| `npm run test:coverage` | Покрытие тестами |

## Структура проекта

```
src/
├── background/     # Service Worker (MV3)
├── content/        # Content script для страниц GitLab
├── popup/          # Popup при клике на иконку
├── options/        # Страница настроек (host + token)
├── lib/            # Утилиты
├── types/          # Общие типы
├── icons/          # Иконки (генерируются postinstall)
└── manifest.json   # Манифест расширения
```

## Платформа

- **Chromium**: Manifest V3
- **Firefox**: совместимость с MV3 (Firefox 109+)
