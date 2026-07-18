variable "project"     { default = "vms" }
variable "location"    { default = "southeastasia" }
variable "environment" { default = "prod" }

variable "db_admin_user"     { default = "vmsadmin" }
variable "db_admin_password" {
  description = "PostgreSQL admin password (stored in Key Vault)"
  type        = string
  sensitive   = true
}

variable "b2c_tenant_name" { description = "AD B2C tenant short name (created manually)" }
variable "b2c_tenant_id"   { description = "AD B2C tenant GUID" }
variable "b2c_client_id"   { description = "SPA app registration client id in B2C" }
variable "b2c_policy"      { default = "B2C_1_signupsignin" }

variable "backend_image" {
  description = "Container image, e.g. <acr>.azurecr.io/vms-backend:latest"
  default     = ""
}
