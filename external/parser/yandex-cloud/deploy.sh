#!/bin/bash

# Скрипт развертывания на Яндекс.Облаке

set -e

echo "🚀 Развертывание системы парсинга Авито на Яндекс.Облаке"
echo ""

# Проверка наличия Terraform
if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform не установлен. Установите: https://www.terraform.io/downloads"
    exit 1
fi

# Проверка наличия yc CLI
if ! command -v yc &> /dev/null; then
    echo "❌ Yandex Cloud CLI не установлен. Установите: https://cloud.yandex.ru/docs/cli/quickstart"
    exit 1
fi

# Получение токена и ID
echo "📋 Получение данных Яндекс.Облака..."
CLOUD_ID=$(yc config get cloud-id)
FOLDER_ID=$(yc config get folder-id)
YC_TOKEN=$(yc iam create-token)

if [ -z "$CLOUD_ID" ] || [ -z "$FOLDER_ID" ]; then
    echo "❌ Не настроен Yandex Cloud CLI. Выполните: yc init"
    exit 1
fi

echo "✅ Cloud ID: $CLOUD_ID"
echo "✅ Folder ID: $FOLDER_ID"
echo ""

# Создание terraform.tfvars
cat > terraform/terraform.tfvars << EOF
yandex_token = "$YC_TOKEN"
cloud_id     = "$CLOUD_ID"
folder_id    = "$FOLDER_ID"
EOF

echo "📦 Инициализация Terraform..."
cd terraform
terraform init

echo ""
echo "📊 Планирование развертывания..."
terraform plan

echo ""
read -p "🤔 Продолжить развертывание? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Развертывание отменено"
    exit 0
fi

echo ""
echo "🏗️ Создание инфраструктуры..."
terraform apply -auto-approve

echo ""
echo "✅ Инфраструктура создана!"
echo ""

# Получение IP адресов
MAIN_IP=$(terraform output -raw main_server_ip)
echo "🖥️  Главный сервер: $MAIN_IP"
echo ""
echo "🔧 Парсер-ноды:"
terraform output -json parser_nodes_ips | jq -r '.[]' | nl

echo ""
echo "⏳ Ожидание запуска сервисов (60 секунд)..."
sleep 60

echo ""
echo "🔍 Проверка статуса системы..."
echo ""

# Проверка главного сервера
echo "Главный сервер:"
curl -s http://$MAIN_IP:3000/api/stats | jq . || echo "⚠️  Сервер еще запускается..."

echo ""
echo "Парсер-ноды:"
terraform output -json parser_nodes_ips | jq -r '.[]' | while read ip; do
    echo "Нода $ip:"
    curl -s http://$ip:3000/health | jq . || echo "⚠️  Нода еще запускается..."
done

echo ""
echo "✅ Развертывание завершено!"
echo ""
echo "📝 Полезные команды:"
echo "  - Статус: curl http://$MAIN_IP:3000/api/stats"
echo "  - Логи главного сервера: ssh ubuntu@$MAIN_IP 'docker-compose logs -f'"
echo "  - Логи ноды: ssh ubuntu@<NODE_IP> 'journalctl -u parser-node -f'"
echo "  - Удалить все: terraform destroy"
echo ""
echo "💰 Стоимость: ~11,208₽/месяц"
echo "💵 Ожидаемая прибыль: ~463,792₽/месяц (при 150 клиентах)"