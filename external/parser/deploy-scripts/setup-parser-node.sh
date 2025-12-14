#!/bin/bash

# Скрипт установки парсер-ноды
NODE_ID=${1:-"node-$(hostname)"}
API_SERVER=${2:-"https://api.yourparser.com"}

echo "Установка парсер-ноды: $NODE_ID"

# Обновляем систему
apt update && apt upgrade -y

# Устанавливаем Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Устанавливаем зависимости для Puppeteer
apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils

# Создаем пользователя для парсера
useradd -m -s /bin/bash parser
usermod -aG sudo parser

# Создаем директорию приложения
mkdir -p /opt/parser-node
cd /opt/parser-node

# Копируем код парсер-ноды
# (предполагается, что файлы уже загружены)

# Устанавливаем зависимости
npm install

# Создаем systemd сервис
cat > /etc/systemd/system/parser-node.service << EOF
[Unit]
Description=Avito Parser Node
After=network.target

[Service]
Type=simple
User=parser
WorkingDirectory=/opt/parser-node
Environment=NODE_ENV=production
Environment=NODE_ID=$NODE_ID
Environment=API_SERVER=$API_SERVER
Environment=PORT=3000
ExecStart=/usr/bin/node parser.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=parser-node

[Install]
WantedBy=multi-user.target
EOF

# Настраиваем права
chown -R parser:parser /opt/parser-node

# Запускаем сервис
systemctl daemon-reload
systemctl enable parser-node
systemctl start parser-node

# Настраиваем файрвол
ufw allow 3000/tcp

echo "Парсер-нода $NODE_ID установлена и запущена"
echo "Статус: systemctl status parser-node"