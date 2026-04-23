output "bucket_name" {
  description = "Name of the Spaces bucket for Terraform state"
  value       = digitalocean_spaces_bucket.tfstate.name
}

output "region" {
  description = "Region of the Spaces bucket"
  value       = digitalocean_spaces_bucket.tfstate.region
}

output "endpoint" {
  description = "S3-compatible endpoint for use in backend config"
  value       = "${digitalocean_spaces_bucket.tfstate.region}.digitaloceanspaces.com"
}
