# ---------- Azure Container Registry ----------
resource "azurerm_container_registry" "acr" {
  name                = replace("acr${local.name}", "-", "")
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "Premium"          # Premium required for private endpoints
  admin_enabled       = false
  tags                = local.tags
}

resource "azurerm_private_endpoint" "acr" {
  name                = "pe-acr-${local.name}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  subnet_id           = azurerm_subnet.pe.id

  private_service_connection {
    name                           = "acr-connection"
    private_connection_resource_id = azurerm_container_registry.acr.id
    subresource_names              = ["registry"]
    is_manual_connection           = false
  }
}
