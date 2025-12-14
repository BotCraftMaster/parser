variable "yandex_token" {
  description = "OAuth токен Яндекс.Облака"
  type        = string
  sensitive   = true
}

variable "cloud_id" {
  description = "ID облака"
  type        = string
}

variable "folder_id" {
  description = "ID каталога"
  type        = string
}

variable "parser_nodes_count" {
  description = "Количество парсер-нод"
  type        = number
  default     = 8
}