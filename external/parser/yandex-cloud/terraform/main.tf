# Автоматическое развертывание инфраструктуры в Яндекс.Облаке

terraform {
  required_providers {
    yandex = {
      source = "yandex-cloud/yandex"
      version = "~> 0.100"
    }
  }
}

provider "yandex" {
  token     = var.yandex_token
  cloud_id  = var.cloud_id
  folder_id = var.folder_id
  zone      = "ru-central1-a"
}

# Сеть
resource "yandex_vpc_network" "parser_network" {
  name = "parser-network"
}

resource "yandex_vpc_subnet" "parser_subnet" {
  name           = "parser-subnet"
  zone           = "ru-central1-a"
  network_id     = yandex_vpc_network.parser_network.id
  v4_cidr_blocks = ["10.128.0.0/24"]
}

# Главный сервер
resource "yandex_compute_instance" "main_server" {
  name        = "parser-main-server"
  platform_id = "standard-v3"
  zone        = "ru-central1-a"

  resources {
    cores  = 2
    memory = 4
  }

  boot_disk {
    initialize_params {
      image_id = "fd8kdq6d0p8sij7h5qe3" # Ubuntu 22.04
      size     = 20
    }
  }

  network_interface {
    subnet_id = yandex_vpc_subnet.parser_subnet.id
    nat       = true
  }

  metadata = {
    ssh-keys = "ubuntu:${file("~/.ssh/id_rsa.pub")}"
    user-data = templatefile("${path.module}/cloud-init-main.yaml", {
      docker_compose = file("${path.module}/../../docker-compose.yml")
    })
  }
}

# Парсер-ноды (8 штук)
resource "yandex_compute_instance" "parser_nodes" {
  count       = 8
  name        = "parser-node-${count.index + 1}"
  platform_id = "standard-v3"
  zone        = "ru-central1-a"

  resources {
    cores  = 2
    memory = 2
  }

  boot_disk {
    initialize_params {
      image_id = "fd8kdq6d0p8sij7h5qe3" # Ubuntu 22.04
      size     = 10
    }
  }

  network_interface {
    subnet_id = yandex_vpc_subnet.parser_subnet.id
    nat       = true
  }

  metadata = {
    ssh-keys = "ubuntu:${file("~/.ssh/id_rsa.pub")}"
    user-data = templatefile("${path.module}/cloud-init-node.yaml", {
      node_id = "parser-node-${count.index + 1}"
      api_server = yandex_compute_instance.main_server.network_interface.0.nat_ip_address
    })
  }

  depends_on = [yandex_compute_instance.main_server]
}

# Outputs
output "main_server_ip" {
  value = yandex_compute_instance.main_server.network_interface.0.nat_ip_address
}

output "parser_nodes_ips" {
  value = [for node in yandex_compute_instance.parser_nodes : node.network_interface.0.nat_ip_address]
}

output "total_monthly_cost" {
  value = "~11,208 RUB"
}