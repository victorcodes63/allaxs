## Prereqs
- Terraform >= 1.6
- DIGITALOCEAN_TOKEN set in env
- Root domain delegated to DigitalOcean

## Commands
cd infra-do/envs/prod
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars and set db_password (required, no default)
terraform init
terraform validate
# terraform plan   # review before apply

## Production differences from dev
- Instance sizes: professional-xs (dedicated CPU)
- Postgres: db-s-2vcpu-4gb, 2 nodes (HA standby)
- Redis: db-s-1vcpu-2gb
- DOCR: professional tier
- API autoscaling: min=2, max=5
- No dev-only pgpass_user resource

## Next steps
- Swap stub images for DOCR images after CI pushes (login: `doctl registry login`).
- Update DNS `CNAME` to the real `app_cname_target` output after first `plan/apply`.
- Configure remote state backend (Spaces) for team collaboration.
