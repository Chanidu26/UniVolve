# ---------- API Management (JWT validation, rate limiting, VNet forwarding) ----------
resource "azurerm_api_management" "apim" {
  name                 = "apim-${local.name}"
  resource_group_name  = azurerm_resource_group.rg.name
  location             = azurerm_resource_group.rg.location
  publisher_name       = "University VMS"
  publisher_email      = "admin@university.lk"
  sku_name             = "Developer_1"
  virtual_network_type = "External"           # public front door, private backend reach

  virtual_network_configuration {
    subnet_id = azurerm_subnet.apim.id
  }
  tags = local.tags
}

resource "azurerm_api_management_api" "vms" {
  name                = "vms-api"
  resource_group_name = azurerm_resource_group.rg.name
  api_management_name = azurerm_api_management.apim.name
  revision            = "1"
  display_name        = "VMS API"
  path                = "api"
  protocols           = ["https"]
  service_url         = "https://${azurerm_container_app.backend.ingress[0].fqdn}"

  subscription_required = false
}

# Policy: validate B2C JWT + rate limit before forwarding (NFR-03)
resource "azurerm_api_management_api_policy" "policy" {
  api_name            = azurerm_api_management_api.vms.name
  api_management_name = azurerm_api_management.apim.name
  resource_group_name = azurerm_resource_group.rg.name

  xml_content = <<XML
<policies>
  <inbound>
    <base />
    <cors allow-credentials="false">
      <allowed-origins><origin>*</origin></allowed-origins>
      <allowed-methods><method>*</method></allowed-methods>
      <allowed-headers><header>*</header></allowed-headers>
    </cors>
    <validate-jwt header-name="Authorization" failed-validation-httpcode="401">
      <openid-config url="https://${var.b2c_tenant_name}.b2clogin.com/${var.b2c_tenant_name}.onmicrosoft.com/${var.b2c_policy}/v2.0/.well-known/openid-configuration" />
      <audiences><audience>${var.b2c_client_id}</audience></audiences>
    </validate-jwt>
    <rate-limit calls="100" renewal-period="60" />
  </inbound>
  <backend><base /></backend>
  <outbound><base /></outbound>
  <on-error><base /></on-error>
</policies>
XML
}

resource "azurerm_api_management_api_operation" "wildcard" {
  operation_id        = "all-operations"
  api_name            = azurerm_api_management_api.vms.name
  api_management_name = azurerm_api_management.apim.name
  resource_group_name = azurerm_resource_group.rg.name
  display_name        = "All operations"
  method              = "GET"
  url_template        = "/*"
}
