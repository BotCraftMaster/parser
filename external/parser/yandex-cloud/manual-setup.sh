#!/bin/bash

# Ручная настройка через Yandex Cloud CLI (без Terraform)

echo "🚀 Ручное развертывание на Яндекс.Облаке"
echo ""

# Создание сети
echo "📡 Создание сети..."
NETWORK_ID=$(yc vpc network create --name parser-network --format json | jq -r '.id')
echo "✅ Сеть создана: $NETWORK_ID"

# Создание подсети
echo "📡 Создание подсети..."
SUBNET_ID=$(yc vpc subnet create \
  --name parser-subnet \
  --network-id $NETWORK_ID \
  --zone ru-central1-a \
  --range 10.128.0.0/24 \
  --format json | jq -r '.id')
echo "✅ Подсеть создана: $SUBNET_ID"

# Создание главного сервера
echo "🖥️  Создание главного сервера..."
MAIN_SERVER_ID=$(yc compute instance create \
  --name parser-main-server \
  --zone ru-central1-a \
  --network-interface subnet-id=$SUBNET_ID,nat-ip-version=ipv4 \
  --create-boot-disk image-folder-id=standard-images,image-family=ubuntu-2204-lts,size=20 \
  --cores 2 \
  --memory 4 \
  --ssh-key ~/.ssh/id_rsa.pub \
  --format json | jq -r '.id')

MAIN_IP=$(yc compute instance get $MAIN_SERVER_ID --format json | jq -r '.network_interfaces[0].primary_v4_address.one_to_one_nat.address')
echo "✅ Главный сервер создан: $MAIN_IP"

# Создание парсер-нод
echo "🔧 Создание парсер-нод..."
PARSER_IPS=()

for i in {1..8}; do
  echo "  Создание ноды #$i..."
  
  NODE_ID=$(yc compute instance create \
    --name parser-node-$i \
    --zone ru-central1-a \
    --network-interface subnet-id=$SUBNET_ID,nat-ip-version=ipv4 \
    --create-boot-disk image-folder-id=standard-images,image-family=ubuntu-2204-lts,size=10 \
    --cores 2 \
    --memory 2 \
    --ssh-key ~/.ssh/id_rsa.pub \
    --format json | jq -r '.id')
  
  NODE_IP=$(yc compute instance get $NODE_ID --format json | jq -r '.network_interfaces[0].primary_v4_address.one_to_one_nat.address')
  PARSER_IPS+=($NODE_IP)
  
  echo "  ✅ Нода #$i создана: $NODE_IP"
done

echo ""
echo "✅ Инфраструктура создана!"
echo ""
echo "🖥️  Главный сервер: $MAIN_IP"
echo "🔧 Парсер-ноды:"
for i in "${!PARSER_IPS[@]}"; do
  echo "  Нода #$((i+1)): ${PARSER_IPS[$i]}"
done

echo ""
echo "📦 Настройка главного сервера..."
ssh -o StrictHostKeyChecking=no ubuntu@$MAIN_IP << 'EOF'
  sudo apt update
  sudo apt install -y docker.io docker-compose git
  sudo systemctl enable docker
  sudo systemctl start docker
  sudo usermod -aG docker ubuntu
  
  mkdir -p /opt/parser-system
  cd /opt/parser-system
  
  # Здесь нужно скопировать ваши файлы
  echo "Главный сервер настроен"
EOF

echo ""
echo "📦 Настройка парсер-нод..."
for i in "${!PARSER_IPS[@]}"; do
  NODE_IP=${PARSER_IPS[$i]}
  NODE_NUM=$((i+1))
  
  echo "  Настройка ноды #$NODE_NUM ($NODE_IP)..."
  
  ssh -o StrictHostKeyChecking=no ubuntu@$NODE_IP << EOF
    sudo apt update
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs git chromium-browser
    
    mkdir -p /opt/parser-node
    cd /opt/parser-node
    
    # Здесь нужно скопировать код парсера
    echo "Нода #$NODE_NUM настроена"
EOF
done

echo ""
echo "✅ Все готово!"
echo ""
echo "💰 Стоимость инфраструктуры:"
echo "  - Главный сервер: ~2,000₽/месяц"
echo "  - 8 парсер-нод: ~9,208₽/месяц"
echo "  - Итого: ~11,208₽/месяц"
echo ""
echo "📝 Для удаления всего:"
echo "  yc compute instance delete parser-main-server"
echo "  yc compute instance delete parser-node-{1..8}"
echo "  yc vpc subnet delete $SUBNET_ID"
echo "  yc vpc network delete $NETWORK_ID"