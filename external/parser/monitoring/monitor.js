const axios = require('axios');
const cron = require('node-cron');

// Конфигурация мониторинга
const CONFIG = {
  mainServer: 'https://api.yourparser.com',
  nodes: [
    'http://vps1:3000',
    'http://vps2:3000',
    'http://vps3:3000',
    'http://vps4:3000',
    'http://vps5:3000',
    'http://vps6:3000',
    'http://vps7:3000',
    'http://vps8:3000'
  ],
  telegram: {
    botToken: 'your-bot-token',
    chatId: 'your-chat-id'
  }
};

class SystemMonitor {
  constructor() {
    this.nodeStatus = new Map();
    this.alerts = new Set();
  }

  async checkNodeHealth(nodeUrl) {
    try {
      const response = await axios.get(`${nodeUrl}/health`, { timeout: 5000 });
      return {
        url: nodeUrl,
        healthy: true,
        data: response.data,
        responseTime: Date.now()
      };
    } catch (error) {
      return {
        url: nodeUrl,
        healthy: false,
        error: error.message,
        responseTime: Date.now()
      };
    }
  }

  async checkMainServer() {
    try {
      const response = await axios.get(`${CONFIG.mainServer}/api/stats`, { timeout: 10000 });
      return {
        healthy: true,
        data: response.data,
        responseTime: Date.now()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        responseTime: Date.now()
      };
    }
  }

  async sendAlert(message) {
    if (!CONFIG.telegram.botToken) return;

    try {
      await axios.post(`https://api.telegram.org/bot${CONFIG.telegram.botToken}/sendMessage`, {
        chat_id: CONFIG.telegram.chatId,
        text: `🚨 ALERT: ${message}`,
        parse_mode: 'HTML'
      });
    } catch (error) {
      console.error('Ошибка отправки алерта:', error);
    }
  }

  async monitorSystem() {
    console.log(`[${new Date().toISOString()}] Проверка системы...`);

    // Проверяем главный сервер
    const mainServerStatus = await this.checkMainServer();
    if (!mainServerStatus.healthy) {
      const alertKey = 'main-server-down';
      if (!this.alerts.has(alertKey)) {
        await this.sendAlert(`Главный сервер недоступен: ${mainServerStatus.error}`);
        this.alerts.add(alertKey);
      }
    } else {
      this.alerts.delete('main-server-down');
    }

    // Проверяем парсер-ноды
    const nodeChecks = await Promise.all(
      CONFIG.nodes.map(node => this.checkNodeHealth(node))
    );

    let healthyNodes = 0;
    let totalNodes = nodeChecks.length;

    for (const nodeStatus of nodeChecks) {
      const nodeKey = `node-${nodeStatus.url}`;
      
      if (nodeStatus.healthy) {
        healthyNodes++;
        this.alerts.delete(nodeKey);
        this.nodeStatus.set(nodeStatus.url, nodeStatus);
      } else {
        if (!this.alerts.has(nodeKey)) {
          await this.sendAlert(`Нода недоступна: ${nodeStatus.url} - ${nodeStatus.error}`);
          this.alerts.add(nodeKey);
        }
      }
    }

    // Проверяем общее состояние системы
    const healthyPercentage = (healthyNodes / totalNodes) * 100;
    
    if (healthyPercentage < 50) {
      const alertKey = 'system-critical';
      if (!this.alerts.has(alertKey)) {
        await this.sendAlert(`КРИТИЧЕСКОЕ СОСТОЯНИЕ: Работает только ${healthyNodes}/${totalNodes} нод (${healthyPercentage.toFixed(1)}%)`);
        this.alerts.add(alertKey);
      }
    } else if (healthyPercentage < 80) {
      const alertKey = 'system-degraded';
      if (!this.alerts.has(alertKey)) {
        await this.sendAlert(`Деградация системы: Работает ${healthyNodes}/${totalNodes} нод (${healthyPercentage.toFixed(1)}%)`);
        this.alerts.add(alertKey);
      }
    } else {
      this.alerts.delete('system-critical');
      this.alerts.delete('system-degraded');
    }

    console.log(`Статус: ${healthyNodes}/${totalNodes} нод здоровы (${healthyPercentage.toFixed(1)}%)`);

    // Выводим детальную статистику
    if (mainServerStatus.healthy && mainServerStatus.data) {
      const stats = mainServerStatus.data.system;
      console.log(`Активных задач: ${stats.running_tasks}, Пользователей: ${stats.active_users}`);
    }
  }

  async generateReport() {
    console.log('\n=== ОТЧЕТ О СОСТОЯНИИ СИСТЕМЫ ===');
    
    const mainServerStatus = await this.checkMainServer();
    console.log(`Главный сервер: ${mainServerStatus.healthy ? '✅ OK' : '❌ DOWN'}`);
    
    if (mainServerStatus.healthy && mainServerStatus.data) {
      const stats = mainServerStatus.data;
      console.log(`  - Всего задач за 24ч: ${stats.system.total_tasks}`);
      console.log(`  - Активных задач: ${stats.system.running_tasks}`);
      console.log(`  - Активных пользователей: ${stats.system.active_users}`);
    }

    console.log('\nПарсер-ноды:');
    for (const nodeUrl of CONFIG.nodes) {
      const status = this.nodeStatus.get(nodeUrl);
      if (status && status.healthy) {
        console.log(`  ${nodeUrl}: ✅ OK (${status.data.activeTasks} задач)`);
      } else {
        console.log(`  ${nodeUrl}: ❌ DOWN`);
      }
    }

    const healthyCount = Array.from(this.nodeStatus.values()).filter(s => s.healthy).length;
    console.log(`\nИтого: ${healthyCount}/${CONFIG.nodes.length} нод работают`);
    console.log('=====================================\n');
  }

  start() {
    console.log('Запуск системы мониторинга...');

    // Проверка каждые 2 минуты
    cron.schedule('*/2 * * * *', () => {
      this.monitorSystem();
    });

    // Отчет каждые 30 минут
    cron.schedule('*/30 * * * *', () => {
      this.generateReport();
    });

    // Первоначальная проверка
    this.monitorSystem();
  }
}

// Запуск мониторинга
const monitor = new SystemMonitor();
monitor.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Остановка мониторинга...');
  process.exit(0);
});