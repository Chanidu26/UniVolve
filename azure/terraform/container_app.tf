# ---------- Container Apps (backend, internal-only, VNet-integrated) ----------
resource "azurerm_log_analytics_workspace" "law" {
  name                = "law-${local.name}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
}

resource "azurerm_container_app_environment" "env" {
  name                           = "cae-${local.name}"
  resource_group_name            = azurerm_resource_group.rg.name
  location                       = azurerm_resource_group.rg.location
  log_analytics_workspace_id     = azurerm_log_analytics_workspace.law.id
  infrastructure_subnet_id       = azurerm_subnet.aca.id
  internal_load_balancer_enabled = true          # backend is NOT publicly reachable
  tags                           = local.tags
}

# User-assigned Managed Identity — pulls from ACR + reads Key Vault (no credentials in code)
resource "azurerm_user_assigned_identity" "backend" {
  name                = "id-backend-${local.name}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
}

resource "azurerm_role_assignment" "acr_pull" {
  scope                = azurerm_container_registry.acr.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.backend.principal_id
}

resource "azurerm_role_assignment" "kv_secrets_user" {
  scope                = azurerm_key_vault.kv.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.backend.principal_id
}

resource "azurerm_container_app" "backend" {
  name                         = "ca-backend-${local.name}"
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"
  tags                         = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.backend.id]
  }

  registry {
    server   = azurerm_container_registry.acr.login_server
    identity = azurerm_user_assigned_identity.backend.id
  }

  # Secrets sourced from Key Vault via Managed Identity
  secret {
    name                = "db-password"
    key_vault_secret_id = azurerm_key_vault_secret.db_password.id
    identity            = azurerm_user_assigned_identity.backend.id
  }
  secret {
    name                = "acs-connection"
    key_vault_secret_id = azurerm_key_vault_secret.acs_connection.id
    identity            = azurerm_user_assigned_identity.backend.id
  }

  ingress {
    external_enabled = false      # internal only; APIM is the sole entry point
    target_port      = 4000
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 1
    max_replicas = 5              # NFR-02: auto-scale for peak registration load

    container {
      name   = "backend"
      image  = var.backend_image != "" ? var.backend_image : "${azurerm_container_registry.acr.login_server}/vms-backend:latest"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "DB_HOST"
        value = azurerm_postgresql_flexible_server.pg.fqdn
      }
      env {
        name  = "DB_USER"
        value = var.db_admin_user
      }
      env {
        name  = "DB_NAME"
        value = "vmsdb"
      }
      env {
        name        = "DB_PASSWORD"
        secret_name = "db-password"
      }
      env {
        name        = "ACS_CONNECTION_STRING"
        secret_name = "acs-connection"
      }
      env { name = "ACS_SENDER",     value = "DoNotReply@${azurerm_email_communication_service_domain.domain.from_sender_domain}" }
      env {
        name  = "KEY_VAULT_URI"
        value = azurerm_key_vault.kv.vault_uri
      }
      env {
        name  = "B2C_TENANT_NAME"
        value = var.b2c_tenant_name
      }
      env {
        name  = "B2C_TENANT_ID"
        value = var.b2c_tenant_id
      }
      env {
        name  = "B2C_CLIENT_ID"
        value = var.b2c_client_id
      }
      env {
        name  = "B2C_POLICY"
        value = var.b2c_policy
      }

      liveness_probe {
        transport = "HTTP"
        path      = "/health"
        port      = 4000
      }
    }

    http_scale_rule {
      name                = "http-scaling"
      concurrent_requests = 50
    }
  }
}
