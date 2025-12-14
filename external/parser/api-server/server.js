const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
const Redis = require('redis');
const axios = require('axios');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Подключения к БД
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: 5432,
  database: 'parser_db',
  user: 'parser',
  password: process.env.DB_PASSWORD
});

const redis = Redis.createClient({
  host: process.env.REDIS_HOST || 'localhost'
});

// Список парсер-нод
const PARSER_NODES = [
  'http://vps1.yourparser.com:3000',
  'http://vps2.yourparser.com:3000', 
  'http://vps3.yourparser.com:3000',
  'http://vps4.yourparser.com:3000',
  'http://vps5.yourparser.com:3000',
  'http://vps6.yourparser.com:3000',
  'http://vps7.yourparser.com:3000',
  'http://vps8.yourparser.com:3000'
];

// Балансировщик нагрузки для парсер-нод
class NodeBalancer {
  constructor() {
    this.currentIndex = 0;
    this.nodeHealth = new Map();
    this.initHealthCheck();
  }

  // Проверка здоровья нод
  async initHealthCheck() {
    setInterval(async () => {
      for (const node of PARSER_NODES) {
        try {
          const response = await axios.get(`${node}/health`, { timeout: 5000 });
          this.nodeHealth.set(node, response.status === 200);
        } catch (error) {
          this.nodeHealth.set(node, false);
        }
      }
    }, 30000);
  }

  // Получить следующую здоровую ноду
  getNextNode() {
    const healthyNodes = PARSER_NODES.filter(node => 
      this.nodeHealth.get(node) !== false
    );
    
    if (healthyNodes.length === 0) {
      throw new Error('Нет доступных парсер-нод');
    }

    const node = healthyNodes[this.currentIndex % healthyNodes.length];
    this.currentIndex++;
    return node;
  }

  // Получить ноду для конкретного пользователя (sticky session)
  getNodeForUser(userId) {
    const nodeIndex = userId % PARSER_NODES.length;
    const node = PARSER_NODES[nodeIndex];
    
    if (this.nodeHealth.get(node) === false) {
      return this.getNextNode();
    }
    
    return node;
  }
}

const nodeBalancer = new NodeBalancer();

// API маршруты

// Добавить задачу парсинга
app.post('/api/tasks', async (req, res) => {
  try {
    const { userId, urls, settings } = req.body;
    
    // Проверяем тариф пользователя
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const userPlan = user.rows[0].plan;
    const requestsPerSecond = userPlan === 'premium' ? 10 : 1;

    // Создаем задачу в БД
    const task = await pool.query(
      'INSERT INTO tasks (user_id, urls, settings, requests_per_second, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, JSON.stringify(urls), JSON.stringify(settings), requestsPerSecond, 'pending']
    );

    // Отправляем задачу на парсер-ноду
    const node = nodeBalancer.getNodeForUser(userId);
    
    try {
      await axios.post(`${node}/api/parse`, {
        taskId: task.rows[0].id,
        userId,
        urls,
        settings: {
          ...settings,
          requestsPerSecond
        }
      });

      await pool.query('UPDATE tasks SET status = $1, assigned_node = $2 WHERE id = $3', 
        ['running', node, task.rows[0].id]);

      res.json({ 
        success: true, 
        taskId: task.rows[0].id,
        assignedNode: node
      });
    } catch (nodeError) {
      console.error('Ошибка отправки на ноду:', nodeError);
      res.status(500).json({ error: 'Ошибка запуска парсинга' });
    }

  } catch (error) {
    console.error('Ошибка создания задачи:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получить статус задач пользователя
app.get('/api/tasks/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const tasks = await pool.query(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(tasks.rows);
  } catch (error) {
    console.error('Ошибка получения задач:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Остановить задачу
app.delete('/api/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const task = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (task.rows.length === 0) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    const assignedNode = task.rows[0].assigned_node;
    if (assignedNode) {
      try {
        await axios.delete(`${assignedNode}/api/parse/${taskId}`);
      } catch (nodeError) {
        console.error('Ошибка остановки на ноде:', nodeError);
      }
    }

    await pool.query('UPDATE tasks SET status = $1 WHERE id = $2', ['stopped', taskId]);
    res.json({ success: true });

  } catch (error) {
    console.error('Ошибка остановки задачи:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Статистика системы
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(*) FILTER (WHERE status = 'running') as running_tasks,
        COUNT(DISTINCT user_id) as active_users
      FROM tasks 
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);

    const nodeStats = [];
    for (const node of PARSER_NODES) {
      try {
        const response = await axios.get(`${node}/api/stats`, { timeout: 3000 });
        nodeStats.push({
          node,
          healthy: true,
          ...response.data
        });
      } catch (error) {
        nodeStats.push({
          node,
          healthy: false,
          error: error.message
        });
      }
    }

    res.json({
      system: stats.rows[0],
      nodes: nodeStats
    });

  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Мониторинг нагрузки и автоматическое масштабирование
cron.schedule('*/5 * * * *', async () => {
  try {
    // Проверяем нагрузку на систему
    const runningTasks = await pool.query(
      "SELECT COUNT(*) as count FROM tasks WHERE status = 'running'"
    );
    
    const taskCount = parseInt(runningTasks.rows[0].count);
    console.log(`Активных задач: ${taskCount}`);
    
    // Если нагрузка высокая - можно добавить логику масштабирования
    if (taskCount > PARSER_NODES.length * 10) {
      console.log('Высокая нагрузка! Рекомендуется добавить ноды');
    }
    
  } catch (error) {
    console.error('Ошибка мониторинга:', error);
  }
});

app.listen(PORT, () => {
  console.log(`API сервер запущен на порту ${PORT}`);
});