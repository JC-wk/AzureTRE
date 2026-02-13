resource "azurerm_servicebus_namespace" "sb" {
  name                         = "sb-${var.tre_id}"
  location                     = azurerm_resource_group.core.location
  resource_group_name          = azurerm_resource_group.core.name
  sku                          = var.service_bus_sku
  premium_messaging_partitions = var.service_bus_sku == "Premium" ? 1 : null
  capacity                     = var.service_bus_sku == "Premium" ? 1 : 0
  local_auth_enabled           = false
  tags                         = local.tre_core_tags

  dynamic "customer_managed_key" {
    for_each = var.enable_cmk_encryption ? [1] : []
    content {
      key_vault_key_id                  = azurerm_key_vault_key.tre_encryption[0].id
      identity_id                       = azurerm_user_assigned_identity.encryption[0].id
      infrastructure_encryption_enabled = true
    }
  }

  dynamic "identity" {
    for_each = var.enable_cmk_encryption ? [1] : []
    content {
      type         = "UserAssigned"
      identity_ids = [azurerm_user_assigned_identity.encryption[0].id]
    }
  }

  lifecycle { ignore_changes = [tags] }
}

resource "azurerm_servicebus_namespace_network_rule_set" "sb_network_rules" {
  namespace_id = azurerm_servicebus_namespace.sb.id

  default_action                = "Deny"
  public_network_access_enabled = true
  trusted_services_allowed      = true

  ip_rules = var.enable_local_debugging ? [local.myip] : []

  # Always include Airlock subnets
  network_rules {
    subnet_id                            = module.network.airlock_events_subnet_id
    ignore_missing_vnet_service_endpoint = false
  }
  network_rules {
    subnet_id                            = module.network.airlock_notification_subnet_id
    ignore_missing_vnet_service_endpoint = false
  }

  # Include core subnets if using Standard SKU because Private Endpoint is not available
  dynamic "network_rules" {
    for_each = var.service_bus_sku == "Standard" ? [
      module.network.web_app_subnet_id,
      module.network.resource_processor_subnet_id,
      module.network.airlock_processor_subnet_id
    ] : []
    content {
      subnet_id                            = network_rules.value
      ignore_missing_vnet_service_endpoint = false
    }
  }
}

resource "azurerm_servicebus_queue" "workspacequeue" {
  name         = "workspacequeue"
  namespace_id = azurerm_servicebus_namespace.sb.id

  partitioning_enabled = false
  requires_session     = true # use sessions here to make sure updates to each resource happen in serial, in order
}

resource "azurerm_servicebus_queue" "service_bus_deployment_status_update_queue" {
  name         = "deploymentstatus"
  namespace_id = azurerm_servicebus_namespace.sb.id

  # The returned payload might be large, especially for errors.
  # Cosmos is the final destination of the messages where 2048 is the limit.
  # Standard SKU supports up to 256 KB. Premium supports up to 100 MB.
  max_message_size_in_kilobytes = var.service_bus_sku == "Premium" ? 2048 : 256

  partitioning_enabled = false
  requires_session     = true
}

resource "azurerm_private_dns_zone" "servicebus" {
  name                = module.terraform_azurerm_environment_configuration.private_links["privatelink.servicebus.windows.net"]
  resource_group_name = azurerm_resource_group.core.name
  tags                = local.tre_core_tags
  lifecycle { ignore_changes = [tags] }
}

resource "azurerm_private_dns_zone_virtual_network_link" "servicebuslink" {
  name                  = "servicebuslink"
  resource_group_name   = azurerm_resource_group.core.name
  private_dns_zone_name = azurerm_private_dns_zone.servicebus.name
  virtual_network_id    = module.network.core_vnet_id
  tags                  = local.tre_core_tags

  lifecycle { ignore_changes = [tags] }
}

resource "azurerm_private_endpoint" "sbpe" {
  count               = var.service_bus_sku == "Premium" ? 1 : 0
  name                = "pe-${azurerm_servicebus_namespace.sb.name}"
  location            = azurerm_resource_group.core.location
  resource_group_name = azurerm_resource_group.core.name
  subnet_id           = module.network.resource_processor_subnet_id
  tags                = local.tre_core_tags

  lifecycle { ignore_changes = [tags] }

  private_dns_zone_group {
    name                 = "private-dns-zone-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.servicebus.id]
  }

  private_service_connection {
    name                           = "psc-${azurerm_servicebus_namespace.sb.name}"
    private_connection_resource_id = azurerm_servicebus_namespace.sb.id
    is_manual_connection           = false
    subresource_names              = ["namespace"]
  }

  # private endpoints in serial
  depends_on = [
    azurerm_private_endpoint.filepe
  ]
}

resource "azurerm_monitor_diagnostic_setting" "sb" {
  name                       = "diagnostics-${azurerm_servicebus_namespace.sb.name}"
  target_resource_id         = azurerm_servicebus_namespace.sb.id
  log_analytics_workspace_id = module.azure_monitor.log_analytics_workspace_id

  dynamic "enabled_log" {
    for_each = setintersection(data.azurerm_monitor_diagnostic_categories.sb.log_category_types, local.servicebus_diagnostic_categories_enabled)
    content {
      category = enabled_log.value
    }
  }

  enabled_metric {
    category = "AllMetrics"
  }

  lifecycle { ignore_changes = [log_analytics_destination_type] }
}
