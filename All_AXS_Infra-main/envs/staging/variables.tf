variable "project" {
  description = "Project slug"
  type        = string
  default     = "all-axs"
}

variable "env" {
  description = "Environment name"
  type        = string
  default     = "staging"
}

variable "region" {
  description = "Primary DO region (nyc3, sfo3, ams3, …)"
  type        = string
  default     = "ams3"
}

variable "docr_name" {
  description = "Container registry name"
  type        = string
  default     = "all-axs-registry"
}

variable "db_pg_size" {
  description = "Managed PG node size"
  type        = string
  default     = "db-s-1vcpu-2gb"
}

variable "db_pg_version" {
  description = "Postgres version"
  type        = string
  default     = "15"
}

variable "db_pg_nodes" {
  description = "Node count (1 for staging)"
  type        = number
  default     = 1
}

variable "db_name" {
  type        = string
  default     = "allaxs"
}

variable "db_user" {
  type        = string
  default     = "allaxs_app"
}

variable "db_password" {
  description = "Postgres application password (no default -- supply via tfvars or TF_VAR_db_password)"
  type        = string
  sensitive   = true
}

variable "redis_size" {
  description = "Managed Redis size"
  type        = string
  default     = "db-s-1vcpu-1gb"
}

variable "redis_version" {
  description = "Redis version"
  type        = string
  default     = "7"
}

variable "spaces_bucket_suffix" {
  description = "Suffix for Spaces bucket"
  type        = string
  default     = "assets"
}

variable "domain" {
  description = "Root domain managed on DO (must exist/transfered)"
  type        = string
  default     = "example.com"
}

variable "subdomain" {
  description = "Subdomain for the app (e.g., staging)"
  type        = string
  default     = "staging"
}

variable "docr_subscription_tier" {
  description = "DOCR subscription tier (basic, professional)"
  type        = string
  default     = "basic"
}

variable "admin_ip" {
  description = "Optional admin IP (CIDR) allowed to reach managed databases directly. Leave empty to restrict access to App Platform only."
  type        = string
  default     = ""
}

variable "app_platform_stub_images" {
  description = "Initial images for App Platform services (use DOCR later)"
  type        = map(string)
  default = {
    web    = "nginx:stable-alpine"
    api    = "nginxdemos/hello:plain-text"
    worker = "bash:latest"
  }
}
