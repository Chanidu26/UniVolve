# ---------- Azure Database for PostgreSQL Flexible Server (private, HA) ----------
resource "azurerm_postgresql_flexible_server" "pg" {
  name                          = "pg-${local.name}"
  resource_group_name           = azurerm_resource_group.rg.name
  location                      = azurerm_resource_group.rg.location
  version                       = "16"
  administrator_login           = var.db_admin_user
  administrator_password        = var.db_admin_password
  sku_name                      = "GP_Standard_D2s_v3"
  storage_mb                    = 32768
  backup_retention_days         = 7
  delegated_subnet_id           = azurerm_subnet.db.id
  private_dns_zone_id           = azurerm_private_dns_zone.pg.id
  public_network_access_enabled = false

  high_availability { mode = "ZoneRedundant" }   # NFR-05: 99.5%+ availability
  tags = local.tags

  depends_on = [azurerm_private_dns_zone_virtual_network_link.pg]
}

resource "azurerm_postgresql_flexible_server_database" "vmsdb" {
  name      = "vmsdb"
  server_id = azurerm_postgresql_flexible_server.pg.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}
