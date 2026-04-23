terraform {
  required_version = ">= 1.6.0"

  backend "s3" {
    endpoint                    = "ams3.digitaloceanspaces.com"
    bucket                      = "all-axs-tfstate"
    key                         = "envs/prod/terraform.tfstate"
    region                      = "us-east-1"
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
  }

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.41"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}
