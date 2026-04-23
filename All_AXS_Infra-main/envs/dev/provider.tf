# Auth via env var: DIGITALOCEAN_TOKEN
provider "digitalocean" {}

locals {
  name_prefix = "${var.project}-${var.env}"     # e.g., all-axs-dev
  region      = var.region                      # e.g., "nyc3"
  tags        = ["project:${var.project}", "env:${var.env}"]
}

# Helpful whoami
data "digitalocean_account" "me" {}
