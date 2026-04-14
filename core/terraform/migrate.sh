#!/bin/bash

set -o errexit
set -o pipefail
set -o nounset
# set -o xtrace

get_resource_id() {
  local json_data="$1"
  local resource_addr="$2"
  echo "$json_data" | jq -r --arg addr "$resource_addr" '
    def walk_resources:
      (.resources[]?),
      (.child_modules[]? | walk_resources);
    .values.root_module | walk_resources | select(.address==$addr) | .values.id
  '
}

# Remove a resource from the Terraform state if it exists in the state
function remove_if_present() {
  echo -n "Checking $1 ..."
  ESCAPED_ADDRESS=$(printf '%q' "${1}")
  found=$(echo "$tf_state_list" | grep -q ^"$ESCAPED_ADDRESS"$; echo $?)

  if [[ $found -eq 0 ]]; then
    echo " removing"
    terraform state rm "$1"
  else
    echo " not present"
  fi
}

# Import a resource if it exists in Azure but doesn't exist in Terraform
function import_if_exists() {
  ADDRESS=$1
  ID=$2

  # Check if the resource exists in Terraform
  echo "Checking if ${ADDRESS} exists in Terraform state..."
  ESCAPED_ADDRESS=$(printf '%q' "${ADDRESS}")
  TF_RESOURCE_EXISTS=$(echo "$tf_state_list" | grep -q ^"${ESCAPED_ADDRESS}"$; echo $?)

  if [[ ${TF_RESOURCE_EXISTS} -eq 0 ]]; then
    echo "${ADDRESS} already in TF State, ignoring..."
    return
  fi

  # Some resources, e.g. Firewall rules and Diagnostics, don't show up in `az resource show`,
  # so we need a way to set up a custom command for them
  if [[ $# -eq 3 ]]; then
    # If a command is provided, use it to check if the resource exists in Azure
    CMD=$3
  else
    # Default command to check if the resource exists in Azure
    CMD="az resource show --ids ${ID}"
  fi

  echo "Checking if ${ADDRESS} exists in Azure..."
  # Temporarily disable errexit to capture command failure
  set +o errexit
  ${CMD} > /dev/null
  AZ_RESOURCE_EXISTS=$?
  set -o errexit  # Restore errexit


  # If resource exists in Terraform, it's already managed -- don't do anything
  # If resource doesn't exist in Terraform and doesn't exist in Azure, it will be created -- don't do anything
  # If resource doesn't exist in Terraform but exist in Azure, we need to import it
  if [[ ${TF_RESOURCE_EXISTS} -ne 0 && ${AZ_RESOURCE_EXISTS} -eq 0 ]]; then
    echo "IMPORTING ${ADDRESS} ${ID}"
    terraform import -var "tre_id=${TRE_ID}" -var "location=${LOCATION}" "${ADDRESS}" "${ID}"
  else
    echo "Resource ${ADDRESS} does not exist in Azure or is already managed by Terraform, skipping import."
  fi
}

# Configure AzureRM provider to use Azure AD to connect to storage accounts
export ARM_STORAGE_USE_AZUREAD=true

# Configure AzureRM backend to use Azure AD to connect to storage accounts
export ARM_USE_AZUREAD=true
export ARM_USE_OIDC=true

# These variables are loaded in for us
# shellcheck disable=SC2154
terraform init -input=false -backend=true -reconfigure \
    -backend-config="resource_group_name=${TF_VAR_mgmt_resource_group_name}" \
    -backend-config="storage_account_name=${TF_VAR_mgmt_storage_account_name}" \
    -backend-config="container_name=${TF_VAR_terraform_state_container_name}" \
    -backend-config="key=${TRE_ID}"

tf_state_list="$(terraform state list)"

echo "*** Migrating TF Resources... ***"

terraform refresh

# get TF state in JSON
terraform_show_json=$(terraform show -json)

# Remove the firewall adn other resources from the shared service state and import it into the core state.
# https://github.com/microsoft/AzureTRE/pull/4342
echo "REMOVING STATE FOR FIREWALL..."

pushd ../../templates/shared_services/firewall/terraform

# shellcheck disable=SC1091
terraform init -input=false -backend=true -reconfigure -upgrade \
    -backend-config="resource_group_name=${TF_VAR_mgmt_resource_group_name}" \
    -backend-config="storage_account_name=${TF_VAR_mgmt_storage_account_name}" \
    -backend-config="container_name=${TF_VAR_terraform_state_container_name}" \
    -backend-config="key=${TRE_ID}-shared-service-firewall"

tf_state_list="$(terraform state list)"

# routetable.tf
remove_if_present azurerm_route_table.rt
remove_if_present azurerm_subnet_route_table_association.rt_shared_subnet_association
remove_if_present azurerm_subnet_route_table_association.rt_resource_processor_subnet_association
remove_if_present azurerm_subnet_route_table_association.rt_web_app_subnet_association
remove_if_present azurerm_subnet_route_table_association.rt_airlock_processor_subnet_association
remove_if_present azurerm_subnet_route_table_association.rt_airlock_storage_subnet_association
remove_if_present azurerm_subnet_route_table_association.rt_airlock_events_subnet_association

# rules.tf
remove_if_present azurerm_firewall_network_rule_collection.core

# firewall.tf
remove_if_present azurerm_public_ip.fwtransit[0]
remove_if_present azurerm_public_ip.fwmanagement[0]
remove_if_present azurerm_firewall.fw
remove_if_present azurerm_monitor_diagnostic_categories.firewall
remove_if_present azurerm_monitor_diagnostic_setting.firewall
remove_if_present azurerm_firewall_policy_rule_collection_group.core
remove_if_present azurerm_firewall_policy.root

popd > /dev/null


echo "IMPORTING STATE FOR FIREWALL..."

tf_state_list="$(terraform state list)"
CORE_RESOURCE_GROUP_NAME="rg-${TRE_ID}"

# if resource group exists
if az group show --name "${CORE_RESOURCE_GROUP_NAME}" > /dev/null 2>&1; then
  echo "Resource group ${CORE_RESOURCE_GROUP_NAME} exists, proceeding with import."

  # Firewall
  import_if_exists module.firewall.azurerm_firewall.fw "/subscriptions/${ARM_SUBSCRIPTION_ID}/resourceGroups/${CORE_RESOURCE_GROUP_NAME}/providers/Microsoft.Network/azureFirewalls/fw-${TRE_ID}"

  # Firewall IPs
  if [[ "${FIREWALL_SKU:-}" == "Basic" ]]; then
    import_if_exists module.firewall.azurerm_public_ip.fwmanagement[0] "/subscriptions/${ARM_SUBSCRIPTION_ID}/resourceGroups/${CORE_RESOURCE_GROUP_NAME}/providers/Microsoft.Network/publicIPAddresses/pip-fw-management-${TRE_ID}"
  fi

  import_if_exists module.firewall.azurerm_public_ip.fwtransit[0] "/subscriptions/${ARM_SUBSCRIPTION_ID}/resourceGroups/${CORE_RESOURCE_GROUP_NAME}/providers/Microsoft.Network/publicIPAddresses/pip-fw-${TRE_ID}"

  # Firewall policy
  import_if_exists module.firewall.azurerm_firewall_policy.root "/subscriptions/${ARM_SUBSCRIPTION_ID}/resourceGroups/${CORE_RESOURCE_GROUP_NAME}/providers/Microsoft.Network/firewallPolicies/fw-policy-${TRE_ID}"
  import_if_exists module.firewall.azurerm_firewall_policy_rule_collection_group.core \
    "/subscriptions/${ARM_SUBSCRIPTION_ID}/resourceGroups/${CORE_RESOURCE_GROUP_NAME}/providers/Microsoft.Network/firewallPolicies/fw-policy-${TRE_ID}/ruleCollectionGroups/rcg-core"


  # Diagnostic settings
  import_if_exists module.firewall.azurerm_monitor_diagnostic_setting.firewall \
    "/subscriptions/${ARM_SUBSCRIPTION_ID}/resourceGroups/${CORE_RESOURCE_GROUP_NAME}/providers/Microsoft.Network/azureFirewalls/fw-${TRE_ID}|diagnostics-fw-${TRE_ID}" \
    "az monitor diagnostic-settings show --resource /subscriptions/${ARM_SUBSCRIPTION_ID}/resourceGroups/rg-${TRE_ID}/providers/microsoft.network/azureFirewalls/fw-${TRE_ID} --name diagnostics-fw-${TRE_ID}"

  # Route tables
  import_if_exists module.network.azurerm_route_table.rt \
    "/subscriptions/${ARM_SUBSCRIPTION_ID}/resourceGroups/${CORE_RESOURCE_GROUP_NAME}/providers/Microsoft.Network/routeTables/rt-${TRE_ID}"
  
  # Default route (was originally inline in route table, now separate)
  import_if_exists azurerm_route.default_route \
    "/subscriptions/${ARM_SUBSCRIPTION_ID}/resourceGroups/${CORE_RESOURCE_GROUP_NAME}/providers/Microsoft.Network/routeTables/rt-${TRE_ID}/routes/DefaultRoute"
fi
