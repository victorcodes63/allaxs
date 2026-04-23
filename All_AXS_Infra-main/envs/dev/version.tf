terraform {
  required_version = ">= 1.6.0"

  # Remote state can be added later (S3-compatible Spaces) once the bucket exists.
  # backend "s3" {
  #   endpoint                    = "nyc3.digitaloceanspaces.com"
  #   bucket                      = "all-axs-tfstate"
  #   key                         = "envs/dev/terraform.tfstate"
  #   region                      = "us-east-1"
  #   skip_credentials_validation = true
  #   skip_region_validation      = true
  #   skip_requesting_account_id  = true
  # }

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
