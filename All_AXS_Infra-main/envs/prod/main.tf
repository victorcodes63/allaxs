############################
# Container Registry (DOCR)
############################
resource "digitalocean_container_registry" "this" {
  name                   = var.docr_name
  subscription_tier_slug = var.docr_subscription_tier
  region                 = local.region
}

############################
# Spaces (S3-compatible) + CDN
############################
# Bucket name: <project>-<env>-assets
resource "digitalocean_spaces_bucket" "assets" {
  name   = "${local.name_prefix}-${var.spaces_bucket_suffix}"
  region = local.region
  acl    = "private"
}

# CDN in front of the bucket (can add custom domain later)
resource "digitalocean_cdn" "assets" {
  origin = "${digitalocean_spaces_bucket.assets.name}.${local.region}.digitaloceanspaces.com"
}

############################
# Managed PostgreSQL
############################
resource "digitalocean_database_cluster" "pg" {
  name       = "${local.name_prefix}-pg"
  engine     = "pg"
  version    = var.db_pg_version
  region     = local.region
  size       = var.db_pg_size
  node_count = var.db_pg_nodes
  tags       = local.tags
}

# Database + user
resource "digitalocean_database_db" "pgdb" {
  cluster_id = digitalocean_database_cluster.pg.id
  name       = var.db_name
}

resource "digitalocean_database_user" "pguser" {
  cluster_id = digitalocean_database_cluster.pg.id
  name       = var.db_user
}

# Managed DB firewall -- allow only App Platform + optional admin IP.
# DO managed-database firewalls support type = "app" to restrict access
# to a specific App Platform app by its ID.
resource "digitalocean_database_firewall" "pgfw" {
  cluster_id = digitalocean_database_cluster.pg.id

  rule {
    type  = "app"
    value = digitalocean_app.platform.id
  }

  dynamic "rule" {
    for_each = var.admin_ip != "" ? [var.admin_ip] : []
    content {
      type  = "ip_addr"
      value = rule.value
    }
  }
}

############################
# Managed Redis
############################
resource "digitalocean_database_cluster" "redis" {
  name       = "${local.name_prefix}-redis"
  engine     = "redis"
  version    = var.redis_version
  region     = local.region
  size       = var.redis_size
  node_count = 1
  tags       = local.tags
}

# Redis firewall -- same approach as Postgres above.
resource "digitalocean_database_firewall" "redisfw" {
  cluster_id = digitalocean_database_cluster.redis.id

  rule {
    type  = "app"
    value = digitalocean_app.platform.id
  }

  dynamic "rule" {
    for_each = var.admin_ip != "" ? [var.admin_ip] : []
    content {
      type  = "ip_addr"
      value = rule.value
    }
  }
}

############################
# Cloud Firewall (Droplet-level -- placeholder)
############################
# Keep as a reusable policy if we later add self-hosted workers/dashboards on Droplets
resource "digitalocean_firewall" "default" {
  name = "${local.name_prefix}-fw"

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  tags = local.tags
}

############################
# DNS (root domain + app subdomain)
############################
# Assumes the root domain is or will be delegated to DO
resource "digitalocean_domain" "root" {
  name = var.domain
}

# <subdomain>.example.com -> App Platform default hostname.
# After the first deploy, replace the placeholder below with the app's
# live ingress hostname from the output `app_live_url`.
# Example: strip the "https://" prefix from digitalocean_app.platform.live_url.
# This cannot be automated because live_url includes the scheme.
resource "digitalocean_record" "app_cname" {
  domain = digitalocean_domain.root.name
  type   = "CNAME"
  name   = var.subdomain
  value  = "placeholder.apps.digitalocean.com" # replace after app create
  ttl    = 300
}

# CDN for assets: cdn-<subdomain>.example.com -> DO CDN endpoint
resource "digitalocean_record" "cdn_cname" {
  domain = digitalocean_domain.root.name
  type   = "CNAME"
  name   = "cdn-${var.subdomain}"
  value  = digitalocean_cdn.assets.endpoint
  ttl    = 300
}

############################
# App Platform -- web, api, worker
############################
# TLS & HTTPS Configuration:
# - DigitalOcean App Platform automatically manages TLS certificates for custom domains
# - HTTPS redirect is enabled by default for all custom domains
# - Certificates are auto-renewed by DO (Let's Encrypt)
# - If using Cloudflare in front of DO:
#   - Ensure Cloudflare SSL mode is 'Full (strict)' in production account
#   - This ensures end-to-end encryption between Cloudflare and DO App Platform
#
# Access Logs:
# - App Platform logs are available via DO dashboard and API
# - TODO: wire App Platform logs to external log sink (e.g. DO Spaces + Loki / Logtail) for long-term retention and analysis
resource "digitalocean_app" "platform" {
  spec {
    name   = "${local.name_prefix}-app"
    region = local.region

    # Custom domains with automatic HTTPS redirect
    # DO App Platform enforces HTTPS for all custom domains
    # HTTP requests are automatically redirected to HTTPS
    # TLS certificates are managed automatically by DO (Let's Encrypt)
    # Note: Custom domains are typically configured via DO dashboard or API after app creation
    # The domain resource above (digitalocean_record.app_cname) points DNS to the app

    # Web -- static/SSR front-end. Autoscaling is omitted here because
    # the Next.js front-end is statically exported; a single instance
    # behind the App Platform CDN is sufficient.  Add an autoscaling
    # block (like the API service below) if SSR is enabled later.
    service {
      name               = "web"
      http_port          = 80
      instance_count     = 1
      instance_size_slug = "professional-xs"
      docker {
        image = var.app_platform_stub_images["web"]
      }
      routes {
        path = "/"
      }
      health_check {
        http_path             = "/"
        initial_delay_seconds = 5
        period_seconds        = 10
        timeout_seconds       = 5
        success_threshold     = 1
        failure_threshold     = 3
      }
      env {
        key   = "NODE_ENV"
        value = "production"
        scope = "RUN_AND_BUILD_TIME"
      }
    }

    service {
      name               = "api"
      http_port          = 8080
      instance_size_slug = "professional-xs"
      autoscaling {
        min_instance_count = 2
        max_instance_count = 5
        metrics {
          cpu {
            percent = 80
          }
        }
      }
      docker {
        image = var.app_platform_stub_images["api"]
      }
      routes {
        path = "/api"
      }
      health_check {
        http_path             = "/api/health"
        initial_delay_seconds = 10
        period_seconds        = 10
        timeout_seconds       = 5
        success_threshold     = 1
        failure_threshold     = 3
      }
      env {
        key   = "PORT"
        value = "8080"
        scope = "RUN_TIME"
      }
      env {
        key   = "DATABASE_URL"
        value = digitalocean_database_cluster.pg.uri
        scope = "RUN_TIME"
        type  = "SECRET"
      }
      env {
        key   = "REDIS_URL"
        value = digitalocean_database_cluster.redis.uri
        scope = "RUN_TIME"
        type  = "SECRET"
      }
      env {
        key   = "PAYSTACK_TIMEOUT_MS"
        value = "10000"
        scope = "RUN_TIME"
      }
      env {
        key   = "PAYSTACK_MAX_RETRIES"
        value = "2"
        scope = "RUN_TIME"
      }
      env {
        key   = "EMAIL_TIMEOUT_MS"
        value = "15000"
        scope = "RUN_TIME"
      }
      env {
        key   = "EMAIL_MAX_RETRIES"
        value = "2"
        scope = "RUN_TIME"
      }
    }

    worker {
      name               = "worker"
      instance_count     = 1
      instance_size_slug = "professional-xs"
      docker {
        image   = var.app_platform_stub_images["worker"]
        command = ["node", "dist/worker/worker-main"]
      }
      env {
        key   = "QUEUE"
        value = "default"
        scope = "RUN_TIME"
      }
      env {
        key   = "DATABASE_URL"
        value = digitalocean_database_cluster.pg.uri
        scope = "RUN_TIME"
        type  = "SECRET"
      }
      env {
        key   = "REDIS_URL"
        value = digitalocean_database_cluster.redis.uri
        scope = "RUN_TIME"
        type  = "SECRET"
      }
      env {
        key   = "EMAIL_TIMEOUT_MS"
        value = "15000"
        scope = "RUN_TIME"
      }
      env {
        key   = "EMAIL_MAX_RETRIES"
        value = "2"
        scope = "RUN_TIME"
      }
    }

    alert {
      rule = "DEPLOYMENT_FAILED"
    }
  }

  # Tagging for hygiene
  project_id = null
}

############################
# OpenTelemetry Collector (Placeholder)
############################
# TODO: Add OTEL Collector service to App Platform spec
# The collector receives traces/metrics from web and api services
# and forwards them to an observability backend (Grafana Cloud, Tempo, Honeycomb, etc.)
#
# Example configuration:
# service {
#   name = "otel-collector"
#   http_port = 4318
#   instance_count = 1
#   instance_size_slug = "basic-xxs"
#   docker {
#     image = "otel/opentelemetry-collector:latest"
#   }
#   env {
#     key = "OTEL_EXPORTER_ENDPOINT"
#     value = "https://your-observability-backend.com"
#     scope = "RUN_TIME"
#   }
#   env {
#     key = "OTEL_EXPORTER_HEADERS"
#     value = '{"Authorization":"Bearer token"}'
#     scope = "RUN_TIME"
#     type = "SECRET"
#   }
# }
#
# For now, services can send directly to an external OTEL endpoint
# via OTEL_EXPORTER_OTLP_ENDPOINT environment variable.
#
# See: all_axs_infra/otel/otel-collector-config.yaml for collector configuration
