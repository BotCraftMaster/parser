const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const UserAgent = require('user-agents');
const { RateLimiterMemory } = require('rate-limiter-flexible');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ID = process.env.NODE_ID || Math.random().toString(36).substr(2, 9);

app.use(express.json());

// Активные задачи парсинга
const activeTasks = new Map();
const taskStats = new Map();

// Ограничители скорости для разных тарифов
const rateLimiters = {
  basic: new RateLimiterMemory({
    keyGenerator: (req) => req.body.userId,
    points: 1, // 1 запрос
    duration: 1, // в секунду
  }),
  premium: new RateLimiterMemory({
    keyGenerator: (req) => req.body.userId,
    points: 10, // 10 запросов
    duration: 1, // в секунду
  })
};

// Класс для парсинга Авито
class AvitoParser {
  constructor(taskId, userId, settings) {
    this.taskId = taskId;
    this.userId = userId;
    this.settings = settings;
    this.browser = null;
    this.page = null;
    this.isRunning = false;
    this.stats = {
      totalRequests: 0,
      successRequests: 0,
      errorRequests: 0,
      foundAds: 0,
      startTime: Date.now()
    };
  }

  async init() {
    try {
      // Генерируем уникальный профиль для каждой ноды
      const profile = this.generateNodeProfile();
      
      // Запускаем браузер с уникальным профилем
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          `--user-data-dir=/tmp/chrome-${NODE_ID}-${this.taskId}`,
          `--window-size=${profile.width},${profile.height}`,
          '--disable-blink-features=AutomationControlled',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      this.page = await this.browser.newPage();
      
      // Устанавливаем уникальный User-Agent
      const userAgent = new UserAgent();
      await this.page.setUserAgent(userAgent.toString());
      
      // Устанавливаем viewport
      await this.page.setViewport({
        width: profile.width,
        height: profile.height
      });

      // Эмулируем реального пользователя
      await this.page.evaluateOnNewDocument(() => {
        // Скрываем автоматизацию
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        
        // Добавляем реалистичные свойства
        Object.defineProperty(navigator, 'languages', { 
          get: () => ['ru-RU', 'ru', 'en-US', 'en'] 
        });
        
        // Эмулируем плагины
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5].map(() => ({ name: 'Chrome PDF Plugin' }))
        });
      });

      console.log(`Парсер ${this.taskId} инициализирован`);
      return true;
    } catch (error) {
      console.error(`Ошибка инициализации парсера ${this.taskId}:`, error);
      return false;
    }
  }

  async parseUrl(url) {
    try {
      this.stats.totalRequests++;
      
      // Применяем ограничение скорости
      const rateLimiter = this.settings.requestsPerSecond > 1 ? 
        rateLimiters.premium : rateLimiters.basic;
      
      await rateLimiter.consume(this.userId);

      // Переходим на страницу
      await this.page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Ждем загрузки объявлений
      await this.page.waitForSelector('[data-marker="item"]', { timeout: 10000 });

      // Извлекаем данные
      const ads = await this.page.evaluate(() => {
        const items = document.querySelectorAll('[data-marker="item"]');
        const results = [];

        items.forEach(item => {
          try {
            const titleElement = item.querySelector('[data-marker="item-title"]');
            const priceElement = item.querySelector('[data-marker="item-price"]');
            const linkElement = item.querySelector('a[href*="/items/"]');
            const imageElement = item.querySelector('img');

            if (titleElement && priceElement && linkElement) {
              results.push({
                title: titleElement.textContent.trim(),
                price: priceElement.textContent.trim(),
                url: 'https://www.avito.ru' + linkElement.getAttribute('href'),
                image: imageElement ? imageElement.src : null,
                timestamp: Date.now()
              });
            }
          } catch (error) {
            console.error('Ошибка извлечения объявления:', error);
          }
        });

        return results;
      });

      this.stats.successRequests++;
      this.stats.foundAds += ads.length;

      return ads;

    } catch (error) {
      this.stats.errorRequests++;
      console.error(`Ошибка парсинга ${url}:`, error);
      return [];
    }
  }

  async start() {
    if (!await this.init()) {
      return false;
    }

    this.isRunning = true;
    console.log(`Запуск парсинга задачи ${this.taskId}`);

    try {
      while (this.isRunning) {
        for (const url of this.settings.urls) {
          if (!this.isRunning) break;

          const ads = await this.parseUrl(url);
          
          if (ads.length > 0) {
            // Отправляем найденные объявления обратно в API
            try {
              await axios.post(`${process.env.API_SERVER}/api/results`, {
                taskId: this.taskId,
                userId: this.userId,
                ads: ads,
                nodeId: NODE_ID
              });
            } catch (apiError) {
              console.error('Ошибка отправки результатов:', apiError);
            }
          }

          // Пауза между URL
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Пауза между циклами
        await new Promise(resolve => setTimeout(resolve, this.settings.pauseGeneral * 1000));
      }
    } catch (error) {
      console.error(`Ошибка в цикле парсинга ${this.taskId}:`, error);
    } finally {
      await this.cleanup();
    }
  }

  async stop() {
    this.isRunning = false;
    await this.cleanup();
  }

  async cleanup() {
    try {
      if (this.page) {
        await this.page.close();
      }
      if (this.browser) {
        await this.browser.close();
      }
      console.log(`Парсер ${this.taskId} остановлен`);
    } catch (error) {
      console.error(`Ошибка очистки парсера ${this.taskId}:`, error);
    }
  }

  generateNodeProfile() {
    // Уникальный профиль для каждой ноды
    const profiles = [
      { width: 1920, height: 1080, os: 'Windows' },
      { width: 1366, height: 768, os: 'Windows' },
      { width: 1440, height: 900, os: 'Mac' },
      { width: 1536, height: 864, os: 'Windows' },
      { width: 1280, height: 720, os: 'Linux' }
    ];
    
    const nodeIndex = parseInt(NODE_ID.split('-').pop() || '0');
    return profiles[nodeIndex % profiles.length];
  }

  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      uptime: Date.now() - this.stats.startTime
    };
  }
}

// API маршруты ноды

// Проверка здоровья
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    nodeId: NODE_ID,
    activeTasks: activeTasks.size,
    uptime: process.uptime()
  });
});

// Запуск парсинга
app.post('/api/parse', async (req, res) => {
  try {
    const { taskId, userId, urls, settings } = req.body;

    if (activeTasks.has(taskId)) {
      return res.status(400).json({ error: 'Задача уже запущена' });
    }

    const parser = new AvitoParser(taskId, userId, { ...settings, urls });
    activeTasks.set(taskId, parser);

    // Запускаем парсинг асинхронно
    parser.start().catch(error => {
      console.error(`Ошибка парсинга задачи ${taskId}:`, error);
      activeTasks.delete(taskId);
    });

    res.json({ 
      success: true, 
      taskId,
      nodeId: NODE_ID,
      message: 'Парсинг запущен'
    });

  } catch (error) {
    console.error('Ошибка запуска парсинга:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Остановка парсинга
app.delete('/api/parse/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const parser = activeTasks.get(taskId);

    if (!parser) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    await parser.stop();
    activeTasks.delete(taskId);

    res.json({ success: true, message: 'Парсинг остановлен' });

  } catch (error) {
    console.error('Ошибка остановки парсинга:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Статистика ноды
app.get('/api/stats', (req, res) => {
  const nodeStats = {
    nodeId: NODE_ID,
    activeTasks: activeTasks.size,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    tasks: {}
  };

  // Собираем статистику по задачам
  for (const [taskId, parser] of activeTasks) {
    nodeStats.tasks[taskId] = parser.getStats();
  }

  res.json(nodeStats);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Получен сигнал SIGTERM, останавливаем все задачи...');
  
  for (const [taskId, parser] of activeTasks) {
    await parser.stop();
  }
  
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Парсер-нода ${NODE_ID} запущена на порту ${PORT}`);
});