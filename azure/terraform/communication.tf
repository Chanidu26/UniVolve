# ---------- Azure Communication Services (email notifications, FR-08) ----------
resource "azurerm_communication_service" "acs" {
  name                = "acs-${local.name}"
  resource_group_name = azurerm_resource_group.rg.name
  data_location       = "Asia Pacific"
  tags                = local.tags
}

resource "azurerm_email_communication_service" "email" {
  name                = "email-${local.name}"
  resource_group_name = azurerm_resource_group.rg.name
  data_location       = "Asia Pacific"
  tags                = local.tags
}

resource "azurerm_email_communication_service_domain" "domain" {
  name              = "AzureManagedDomain"
  email_service_id  = azurerm_email_communication_service.email.id
  domain_management = "AzureManaged"
}
