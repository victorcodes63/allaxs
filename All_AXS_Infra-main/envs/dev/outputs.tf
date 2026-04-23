output "docr_registry_url" {
  value = digitalocean_container_registry.this.server_url
}

output "spaces_bucket" {
  value = digitalocean_spaces_bucket.assets.name
}

output "cdn_endpoint" {
  value = digitalocean_cdn.assets.endpoint
}

output "pg_connection_info" {
  value = {
    host = digitalocean_database_cluster.pg.private_host
    port = digitalocean_database_cluster.pg.port
    db   = var.db_name
    user = var.db_user
  }
  sensitive = true
}

output "redis_endpoint" {
  value = {
    host = digitalocean_database_cluster.redis.private_host
    port = digitalocean_database_cluster.redis.port
  }
}

output "app_live_url" {
  description = "App Platform live URL (includes https:// scheme)"
  value       = digitalocean_app.platform.live_url
}

# After the first successful deploy, use this value to update the
# CNAME record (digitalocean_record.app_cname) in main.tf:
#   value = "<hostname from app_live_url, without https://>"
output "app_cname_target" {
  description = "Hostname to use as the CNAME target for the app subdomain"
  value       = replace(digitalocean_app.platform.live_url, "https://", "")
}
