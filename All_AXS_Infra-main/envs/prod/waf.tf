############################
# WAF / Firewall Configuration (Placeholder)
############################
# This file documents the plan for Web Application Firewall (WAF) and firewall rules.
# Actual implementation depends on:
# - Cloudflare account setup (if using Cloudflare in front of DO)
# - DO App Platform firewall rules (if available)
# - Manual configuration in DO/Cloudflare dashboards
#
# TODO: Implement WAF rules once Cloudflare or DO firewall is configured
#
# Planned WAF Rules:
# 1. Managed WAF Rules (Cloudflare):
#    - Enable Cloudflare managed WAF rules for main web/app domains
#    - OWASP Core Rule Set
#    - Cloudflare Security Level: Medium or High
#
# 2. Rate Limiting / DDoS Protection:
#    - Rate limit login endpoints (e.g., /auth/login): 5 requests/minute per IP
#    - Rate limit checkout endpoints: 10 requests/minute per IP
#    - Block obvious abusive patterns (brute force, credential stuffing)
#
# 3. IP Allowlists (if needed):
#    - Paystack webhook IPs/ranges (if enforcing IP-based webhook validation)
#      - Note: Paystack webhooks can come from multiple IPs; prefer HMAC signature verification
#      - See: https://paystack.com/docs/payments/webhooks/#verify-webhook-signatures
#
# 4. Geo-blocking (optional):
#    - Block known malicious countries (if applicable)
#    - Allow only specific regions (if business requires it)
#
# 5. Bot Protection:
#    - Block known bad bots
#    - Allow legitimate crawlers (Google, Bing, etc.)
#
# Implementation Notes:
# - If using Cloudflare: Configure WAF rules via Cloudflare dashboard or Terraform provider
# - If using DO App Platform firewall: Use DO firewall resources (if available)
# - For now, rate limiting is handled at application level (NestJS Throttler)
#
# Current Status:
# - Application-level rate limiting: Implemented (NestJS Throttler)
# - Infrastructure-level WAF: TODO (depends on Cloudflare/DO setup)
# - Webhook IP allowlisting: TODO (prefer HMAC signature verification instead)
