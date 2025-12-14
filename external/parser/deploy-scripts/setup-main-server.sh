#!/bin/bash

# Скрипт установки главного сервера
echo "Установка главного сервера..."

# Обновляем систему
apt update && apt upgrade -y

# Устанавливаем Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
systemctl enable docker
systemctl start docker

# Устанавливаем Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Создаем директории
mkdir -p /opt/parser-system
cd /opt/parser-system

# Копируем конфигурацию
mkdir -p traefik certs
chmod 600 certs

# Создаем базу данных
cat > init.sql << 'EOF'
CREATE DATABASE parser_db;
CREATE USER parser WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE parser_db TO parser;

\c parser_db;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    plan VARCHAR(50) DEFAULT 'basic',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    urls JSONB NOT NULL,
    settings JSONB NOT NULL,
    requests_per_second INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'pending',
    assigned_node VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE results (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id),
    user_id INTEGER REFERENCES users(id),
    ad_data JSONB NOT NULL,
    node_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_results_task_id ON results(task_id);
CREATE INDEX idx_results_created_at ON results(created_at);
EOF

echo "Главный сервер настроен. Запустите: docker-compose up -d"