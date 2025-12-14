#!/bin/bash

# Массовое развертывание системы
MAIN_SERVER_IP="your-main-server-ip"
PARSER_NODES=(
    "vps1-ip"
    "vps2-ip" 
    "vps3-ip"
    "vps4-ip"
    "vps5-ip"
    "vps6-ip"
    "vps7-ip"
    "vps8-ip"
)

echo "Развертывание системы парсинга Авито..."

# Функция для выполнения команд на удаленном сервере
run_remote() {
    local server_ip=$1
    local command=$2
    ssh -o StrictHostKeyChecking=no root@$server_ip "$command"
}

# Функция для копирования файлов
copy_files() {
    local server_ip=$1
    local local_path=$2
    local remote_path=$3
    scp -r -o StrictHostKeyChecking=no $local_path root@$server_ip:$remote_path
}

# Развертывание главного сервера
echo "Настройка главного сервера: $MAIN_SERVER_IP"
copy_files $MAIN_SERVER_IP "." "/opt/parser-system/"
copy_files $MAIN_SERVER_IP "deploy-scripts/setup-main-server.sh" "/tmp/"
run_remote $MAIN_SERVER_IP "chmod +x /tmp/setup-main-server.sh && /tmp/setup-main-server.sh"

# Развертывание парсер-нод
for i in "${!PARSER_NODES[@]}"; do
    node_ip=${PARSER_NODES[$i]}
    node_id="parser-node-$((i+1))"
    
    echo "Настройка парсер-ноды: $node_id ($node_ip)"
    
    # Копируем файлы ноды
    copy_files $node_ip "parser-node/" "/opt/parser-node/"
    copy_files $node_ip "deploy-scripts/setup-parser-node.sh" "/tmp/"
    
    # Запускаем установку
    run_remote $node_ip "chmod +x /tmp/setup-parser-node.sh && /tmp/setup-parser-node.sh $node_id https://$MAIN_SERVER_IP"
    
    echo "Нода $node_id настроена"
done

# Запуск главного сервера
echo "Запуск главного сервера..."
run_remote $MAIN_SERVER_IP "cd /opt/parser-system && docker-compose up -d"

# Проверка статуса всех нод
echo "Проверка статуса системы..."
sleep 30

echo "Главный сервер:"
curl -s http://$MAIN_SERVER_IP/api/stats | jq .

echo "Парсер-ноды:"
for i in "${!PARSER_NODES[@]}"; do
    node_ip=${PARSER_NODES[$i]}
    echo "Нода $((i+1)) ($node_ip):"
    curl -s http://$node_ip:3000/health | jq .
done

echo "Развертывание завершено!"
echo "Админка: https://admin.$MAIN_SERVER_IP"
echo "API: https://api.$MAIN_SERVER_IP"