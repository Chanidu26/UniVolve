output "resource_group"      { value = azurerm_resource_group.rg.name }
output "acr_login_server"    { value = azurerm_container_registry.acr.login_server }
output "backend_internal_fqdn" { value = azurerm_container_app.backend.ingress[0].fqdn }
output "apim_gateway_url"    { value = azurerm_api_management.apim.gateway_url }
output "static_web_app_url"  { value = "https://${azurerm_static_web_app.frontend.default_host_name}" }
output "static_web_app_deploy_token" {
  value     = azurerm_static_web_app.frontend.api_key
  sensitive = true
}
output "postgres_fqdn"       { value = azurerm_postgresql_flexible_server.pg.fqdn }
output "key_vault_uri"       { value = azurerm_key_vault.kv.vault_uri }
output "acs_sender_domain"   { value = azurerm_email_communication_service_domain.domain.from_sender_domain }
