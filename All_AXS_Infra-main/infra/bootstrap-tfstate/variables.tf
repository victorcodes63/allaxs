variable "project" {
  description = "Project slug (used to build default bucket name)"
  type        = string
  default     = "all-axs"
}

variable "bucket_name" {
  description = "Spaces bucket name for Terraform state. Must be globally unique. Defaults to <project>-tfstate."
  type        = string
  default     = ""
}

variable "region" {
  description = "DO region for the Spaces bucket (ams3, nyc3, sfo3, ...)"
  type        = string
  default     = "ams3"
}

variable "spaces_access_id" {
  description = "DigitalOcean Spaces access key ID. Leave unset to use SPACES_ACCESS_KEY_ID env var."
  type        = string
  sensitive   = true
  default     = null
}

variable "spaces_secret_key" {
  description = "DigitalOcean Spaces secret key. Leave unset to use SPACES_SECRET_ACCESS_KEY env var."
  type        = string
  sensitive   = true
  default     = null
}
