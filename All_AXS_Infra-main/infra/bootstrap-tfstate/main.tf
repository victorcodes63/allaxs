############################
# Terraform State Bucket
############################
# A dedicated Spaces bucket used exclusively for Terraform remote state.
# This must be created BEFORE enabling backend "s3" blocks in envs/*.

locals {
  bucket_name = var.bucket_name != "" ? var.bucket_name : "${var.project}-tfstate"
}

resource "digitalocean_spaces_bucket" "tfstate" {
  name   = local.bucket_name
  region = var.region
  acl    = "private"

  versioning {
    enabled = true
  }

  lifecycle {
    prevent_destroy = true
  }
}
