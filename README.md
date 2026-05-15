# 👁️ Суперглазка — Интерактивный образовательный комикс

Интерактивный комикс о здоровье глаз с мини-играми для детей.

![Версия](https://img.shields.io/badge/версия-2.0-blue)
![Лицензия](https://img.shields.io/badge/лицензия-MIT-green)

## ✨ Что нового

- 🌐 **Landing page**: Современная главная страница с анимацией частиц, glassmorphism и адаптивным дизайном
- 🎨 **Современный дизайн**: Glassmorphism, neon акценты, fluid анимации
- 📱 **Улучшенная адаптивность**: Лучшая поддержка мобильных устройств
- 🎮 **Сохранённый функционал**: Все мини-игры и механики на месте
- 🎬 **Готовность к видео**: Промпты для AI-генерации видео из изображений
- ⚡ **Оптимизация**: Улучшенная производительность

## 🚀 Быстрый старт

```bash
# Открыть главную страницу (landing)
open index.html

# Открыть приложение (комикс + игры)
open app.html
```

## 📁 Структура проекта

```
├── index.html           # Главная страница (landing page)
├── app.html             # Приложение: меню + комикс + игры
├── css/
│   ├── style.css        # Стили приложения
│   └── landing.css      # Стили landing page
├── js/
│   ├── app.js           # Ядро приложения
│   ├── player.js        # Профиль игрока
│   ├── episodes/        # Данные эпизодов
│   │   ├── episode-01.js
│   │   ├── episode-02.js
│   │   └── index.js     # Реестр эпизодов
│   ├── game_runner.js   # Игра "Погоня"
│   ├── game_gymnastics.js # Игра "Гимнастика"
│   ├── game_blink.js    # Игра "Моргание"
│   └── game_tracker.js  # Игра "Трекер"
├── assets/
│   ├── shared/          # Общие ресурсы
│   │   ├── characters/  # Персонажи
│   │   └── games/       # Спрайты игр
│   └── episodes/        # Контент по эпизодам
│       ├── episode-01/
│       │   ├── cover.png
│       │   └── frames/  # Кадры с image.png, narration.mp3, video.mp4
│       ├── episode-02/
│       └── episode-03/
├── incoming/            # 📥 Новые файлы для интеграции
├── VIDEO_PROMPTS.md     # Промпты для AI-видео
└── README.md           # Этот файл
```

## 🎮 Мини-игры

### 🏃 Погоня за Пиксельком (Runner)
- Помоги Суперглазке догнать врага
- Уворачивайся от препятствий
- Собирай бонусы: жизни, щиты, замедление

### 👁️ Гимнастика для глаз (Gym)
- Упражнение «Щётка» — смахивай паутину
- Упражнение «Маятник» — следи за мячиком
- Упражнение «Бабочка» — моргай в ритм
- Победи Ленивуса и спаси Мир Глазки!

## 📥 Как добавить новый эпизод

1. Положи исходные файлы в папку `incoming/episode-XX/` (см. `incoming/README.md`)
2. Я сам рассортирую файлы по `assets/episodes/episode-XX/`
3. Создам `js/episodes/episode-XX.js` с данными кадров
4. Добавлю эпизод в `js/episodes/index.js`

## 🎨 Дизайн-система

### Цвета
- `--neon-purple: #a855f7` — Основной акцент
- `--neon-cyan: #06b6d4` — Вторичный акцент
- `--neon-amber: #f59e0b` — Предупреждения
- `--neon-pink: #ec4899` — Дополнительный

### Типографика
- **Заголовки**: Comfortaa (700)
- **Текст**: Nunito (400-900)

### Эффекты
- Glassmorphism: `backdrop-filter: blur(20px)`
- Neon glow: `box-shadow с цветными тенями`
- Spring анимации: `cubic-bezier(0.34, 1.56, 0.64, 1)`

## 🎬 Видео-версия

Смотри `VIDEO_PROMPTS.md` для генерации видео из кадров комикса.

Поддерживаемые AI-сервисы:
- Runway Gen-2
- Pika Labs
- Stable Video Diffusion
- Kling AI
- Hailuo AI

## 📱 Поддержка браузеров

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ iOS Safari 14+
- ✅ Chrome Android 90+

## 🔧 Разработка

### Требования
- Современный браузер с поддержкой:
  - CSS Grid & Flexbox
  - CSS Custom Properties
  - Web Audio API
  - Intersection Observer

### Локальный сервер
```bash
# Python 3
python -m http.server 8000

# Node.js
npx serve

# PHP
php -S localhost:8000
```

## 📝 Лицензия

MIT License — свободное использование с указанием авторства.

## 🙏 Благодарности

- Шрифты: Google Fonts (Nunito, Comfortaa)
- Иконки: Emoji и собственная графика
- Вдохновение: Классические комиксы Marvel и DC

---

**Сделано с ❤️ для защиты зрения детей**
