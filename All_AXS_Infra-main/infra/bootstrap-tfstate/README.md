# Bootstrap: Terraform State Bucket

Creates a dedicated DigitalOcean Spaces bucket for storing Terraform remote
state. This bucket is **not** used for application assets — it exists solely
to hold `.tfstate` files for `envs/dev`, `envs/staging`, and `envs/prod`.

## Prerequisites

- Terraform >= 1.6
- `DIGITALOCEAN_TOKEN` (or `DIGITALOCEAN_ACCESS_TOKEN`) set in your environment
- Spaces credentials: either pass `spaces_access_id` / `spaces_secret_key`
  variables, or export `SPACES_ACCESS_KEY_ID` and `SPACES_SECRET_ACCESS_KEY`

Generate Spaces keys in the DO dashboard under **API → Spaces Keys**.

## Usage

```bash
cd infra/bootstrap-tfstate
terraform init
terraform plan
terraform apply
```

After apply, note the outputs:

```
bucket_name = "all-axs-tfstate"
region      = "ams3"
endpoint    = "ams3.digitaloceanspaces.com"
```

Then uncomment the `backend "s3"` block in each `envs/*/version.tf` and run
`terraform init` in each environment to migrate state.

## Bucket name uniqueness

Spaces bucket names are globally unique across all DO accounts. If
`all-axs-tfstate` is taken, override the name:

```bash
terraform apply -var='bucket_name=my-unique-tfstate-bucket'
```

Or set it in a `terraform.tfvars` file:

```hcl
bucket_name = "my-unique-tfstate-bucket"
```

## What this does NOT do

- Does not create any application infrastructure (databases, apps, etc.)
- Does not modify `envs/dev`, `envs/staging`, or `envs/prod`
- Does not store any secrets — authenticate via environment variables only
