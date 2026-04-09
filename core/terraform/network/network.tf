resource "azurerm_virtual_network" "core" {
  name                = "vnet-${var.tre_id}"
  location            = var.location
  resource_group_name = var.resource_group_name
  address_space       = [var.core_address_space]
  tags                = local.tre_core_tags
  lifecycle { ignore_changes = [tags] }

  subnet {
    name                                          = "WebAppSubnet"
    address_prefixes                              = [local.web_app_subnet_address_prefix]
    private_endpoint_network_policies             = "Disabled"
    private_link_service_network_policies_enabled = true
    security_group                                = azurerm_network_security_group.default_rules.id
    route_table_id                                = azurerm_route_table.rt.id

    delegation {
      name = "delegation"

      service_delegation {
        name    = "Microsoft.Web/serverFarms"
        actions = ["Microsoft.Network/virtualNetworks/subnets/action"]
      }
    }
  }

  subnet {
    name                              = "SharedSubnet"
    address_prefixes                  = [local.shared_services_subnet_address_prefix]
    private_endpoint_network_policies = "Disabled"
    security_group                    = azurerm_network_security_group.default_rules.id
    route_table_id                    = azurerm_route_table.rt.id
  }

  subnet {
    name                              = "ResourceProcessorSubnet"
    address_prefixes                  = [local.resource_processor_subnet_address_prefix]
    private_endpoint_network_policies = "Disabled"
    security_group                    = azurerm_network_security_group.default_rules.id
    route_table_id                    = azurerm_route_table.rt.id
  }

  subnet {
    name                              = "AirlockProcessorSubnet"
    address_prefixes                  = [local.airlock_processor_subnet_address_prefix]
    private_endpoint_network_policies = "Disabled"
    security_group                    = azurerm_network_security_group.default_rules.id
    route_table_id                    = azurerm_route_table.rt.id

    delegation {
      name = "delegation"

      service_delegation {
        name    = "Microsoft.Web/serverFarms"
        actions = ["Microsoft.Network/virtualNetworks/subnets/action"]
      }
    }

    service_endpoints = ["Microsoft.Storage"]
  }

  subnet {
    name                              = "AirlockNotifiactionSubnet"
    address_prefixes                  = [local.airlock_notifications_subnet_address_prefix]
    private_endpoint_network_policies = "Disabled"
    security_group                    = azurerm_network_security_group.default_rules.id

    delegation {
      name = "delegation"

      service_delegation {
        name    = "Microsoft.Web/serverFarms"
        actions = ["Microsoft.Network/virtualNetworks/subnets/action"]
      }
    }
    service_endpoints = ["Microsoft.ServiceBus"]
  }

  subnet {
    name                              = "AirlockStorageSubnet"
    address_prefixes                  = [local.airlock_storage_subnet_address_prefix]
    private_endpoint_network_policies = "Disabled"
    security_group                    = azurerm_network_security_group.default_rules.id
    route_table_id                    = azurerm_route_table.rt.id
  }

  subnet {
    name                              = "AirlockEventsSubnet"
    address_prefixes                  = [local.airlock_events_subnet_address_prefix]
    private_endpoint_network_policies = "Disabled"
    security_group                    = azurerm_network_security_group.default_rules.id
    route_table_id                    = azurerm_route_table.rt.id

    service_endpoints = ["Microsoft.ServiceBus"]
  }
}

resource "azurerm_virtual_network" "firewall" {
  name                = "vnet-fw-${var.tre_id}"
  location            = var.location
  resource_group_name = var.resource_group_name
  address_space       = [local.firewall_vnet_address_space]
  tags                = local.tre_core_tags
  lifecycle { ignore_changes = [tags] }

  subnet {
    name             = "AzureFirewallSubnet"
    address_prefixes = [cidrsubnet(local.firewall_vnet_address_space, 2, 0)]
    route_table_id   = var.firewall_force_tunnel_ip != "" ? azurerm_route_table.fw_tunnel_rt[0].id : null
  }

  subnet {
    name             = "AzureFirewallManagementSubnet"
    address_prefixes = [cidrsubnet(local.firewall_vnet_address_space, 2, 1)]
  }
}

resource "azurerm_virtual_network" "bastion" {
  name                = "vnet-bas-${var.tre_id}"
  location            = var.location
  resource_group_name = var.resource_group_name
  address_space       = [local.bastion_vnet_address_space]
  tags                = local.tre_core_tags
  lifecycle { ignore_changes = [tags] }

  subnet {
    name             = "AzureBastionSubnet"
    address_prefixes = [cidrsubnet(local.bastion_vnet_address_space, 2, 0)]
    security_group   = azurerm_network_security_group.bastion.id
  }
}

resource "azurerm_virtual_network" "appgw" {
  name                = "vnet-appgw-${var.tre_id}"
  location            = var.location
  resource_group_name = var.resource_group_name
  address_space       = [local.appgw_vnet_address_space]
  tags                = local.tre_core_tags
  lifecycle { ignore_changes = [tags] }

  subnet {
    name                                          = "AppGwSubnet"
    address_prefixes                              = [cidrsubnet(local.appgw_vnet_address_space, 2, 0)]
    private_endpoint_network_policies             = "Disabled"
    private_link_service_network_policies_enabled = true
    security_group                                = azurerm_network_security_group.app_gw.id
  }
}

resource "azurerm_ip_group" "resource_processor" {
  name                = "ipg-resource-processor"
  location            = var.location
  resource_group_name = var.resource_group_name
  cidrs               = [local.resource_processor_subnet_address_prefix]
  tags                = local.tre_core_tags
  lifecycle { ignore_changes = [tags] }
}

resource "azurerm_ip_group" "shared" {
  name                = "ipg-shared"
  location            = var.location
  resource_group_name = var.resource_group_name
  cidrs               = [local.shared_services_subnet_address_prefix]
  tags                = local.tre_core_tags
  lifecycle { ignore_changes = [tags] }
}

resource "azurerm_ip_group" "webapp" {
  name                = "ipg-web-app"
  location            = var.location
  resource_group_name = var.resource_group_name
  cidrs               = [local.web_app_subnet_address_prefix]
  tags                = local.tre_core_tags
  lifecycle { ignore_changes = [tags] }
}

resource "azurerm_ip_group" "airlock_processor" {
  name                = "ipg-airlock-processor"
  location            = var.location
  resource_group_name = var.resource_group_name
  cidrs               = [local.airlock_processor_subnet_address_prefix]
  tags                = local.tre_core_tags
  lifecycle { ignore_changes = [tags] }
}

resource "azurerm_virtual_network_peering" "core_to_firewall" {
  name                         = "core-to-firewall"
  resource_group_name          = var.resource_group_name
  virtual_network_name         = azurerm_virtual_network.core.name
  remote_virtual_network_id    = azurerm_virtual_network.firewall.id
  allow_virtual_network_access = true
  allow_forwarded_traffic      = true
  allow_gateway_transit        = false
  use_remote_gateways          = false
}

resource "azurerm_virtual_network_peering" "firewall_to_core" {
  name                         = "firewall-to-core"
  resource_group_name          = var.resource_group_name
  virtual_network_name         = azurerm_virtual_network.firewall.name
  remote_virtual_network_id    = azurerm_virtual_network.core.id
  allow_virtual_network_access = true
  allow_forwarded_traffic      = true
  allow_gateway_transit        = false
  use_remote_gateways          = false
}

resource "azurerm_virtual_network_peering" "core_to_bastion" {
  name                         = "core-to-bastion"
  resource_group_name          = var.resource_group_name
  virtual_network_name         = azurerm_virtual_network.core.name
  remote_virtual_network_id    = azurerm_virtual_network.bastion.id
  allow_virtual_network_access = true
  allow_forwarded_traffic      = true
  allow_gateway_transit        = false
  use_remote_gateways          = false
}

resource "azurerm_virtual_network_peering" "bastion_to_core" {
  name                         = "bastion-to-core"
  resource_group_name          = var.resource_group_name
  virtual_network_name         = azurerm_virtual_network.bastion.name
  remote_virtual_network_id    = azurerm_virtual_network.core.id
  allow_virtual_network_access = true
  allow_forwarded_traffic      = true
  allow_gateway_transit        = false
  use_remote_gateways          = false
}

resource "azurerm_virtual_network_peering" "core_to_appgw" {
  name                         = "core-to-appgw"
  resource_group_name          = var.resource_group_name
  virtual_network_name         = azurerm_virtual_network.core.name
  remote_virtual_network_id    = azurerm_virtual_network.appgw.id
  allow_virtual_network_access = true
  allow_forwarded_traffic      = true
  allow_gateway_transit        = false
  use_remote_gateways          = false
}

resource "azurerm_virtual_network_peering" "appgw_to_core" {
  name                         = "appgw-to-core"
  resource_group_name          = var.resource_group_name
  virtual_network_name         = azurerm_virtual_network.appgw.name
  remote_virtual_network_id    = azurerm_virtual_network.core.id
  allow_virtual_network_access = true
  allow_forwarded_traffic      = true
  allow_gateway_transit        = false
  use_remote_gateways          = false
}

module "terraform_azurerm_environment_configuration" {
  source          = "git::https://github.com/microsoft/terraform-azurerm-environment-configuration.git?ref=0.7.0"
  arm_environment = var.arm_environment
}
