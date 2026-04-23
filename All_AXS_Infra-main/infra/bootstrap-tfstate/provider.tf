# API token: auto-discovered from DIGITALOCEAN_TOKEN or DIGITALOCEAN_ACCESS_TOKEN env var.
# Spaces keys: auto-discovered from SPACES_ACCESS_KEY_ID / SPACES_SECRET_ACCESS_KEY,
#              or pass via -var / tfvars to override.
provider "digitalocean" {
  spaces_access_id  = var.spaces_access_id
  spaces_secret_key = var.spaces_secret_key
}
