## Prereqs
- Terraform >= 1.6
- DIGITALOCEAN_TOKEN set in env
- (Optional) Root domain delegated to DigitalOcean

## Commands
cd infra-do/envs/staging
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars and set db_password (required, no default)
terraform init
terraform validate
# terraform plan   # review before apply

## Staging notes
- Sizing mirrors dev (basic-xs instances, single PG node).
- Intended as a pre-production validation environment.
- DOCR registry is shared across all environments (DO allows one per account).

## Next steps
- Swap stub images for DOCR images after CI pushes (login: `doctl registry login`).
- Update DNS `CNAME` to the real `app_cname_target` output after first `plan/apply`.
- Configure remote state backend (Spaces) for team collaboration.
