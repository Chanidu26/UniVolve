# ---------- Azure Static Web Apps (frontend, CI/CD via GitHub Actions) ----------
resource "azurerm_static_web_app" "frontend" {
  name                = "swa-${local.name}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = "eastasia"          # SWA has limited regions
  sku_tier            = "Standard"
  sku_size            = "Standard"
  tags                = local.tags
}
