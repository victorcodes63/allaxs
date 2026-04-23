## Prereqs
- Terraform >= 1.6
- DIGITALOCEAN_TOKEN set in env
- (Optional) Root domain delegated to DigitalOcean

## Commands
cd infra-do/envs/dev
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform validate
# terraform plan   # when ready to review; still no apply per Day 2

## Next (Week 1–2)
- Replace `0.0.0.0/0` DB/Redis firewall rules with your IP or App Platform IDs once created.
- Swap stub images for DOCR images after CI pushes (login: `doctl registry login`).
- Update DNS `CNAME` to the real `app.live_url` after first `plan/apply` in staging.
- (Optional) Add remote state backend (Spaces + DynamoDB-equivalent not needed on DO).
