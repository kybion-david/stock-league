# Azure Static Web App (Free) for Stock League (ADR 004, ADR 009).
# Provisioned by hand once: see docs/SPEC.md → Commands. Deploys don't use
# Terraform; GitHub Actions uploads with the SWA deployment token.

terraform {
  required_version = ">= 1.6"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }

  # Local state outside the repo, so it survives worktree removal (ADR 009):
  # terraform init -backend-config="path=$HOME/.stock-league/terraform.tfstate"
  backend "local" {}
}

# The subscription comes from ARM_SUBSCRIPTION_ID or `az account show`.
provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "this" {
  name     = "rg-stock-league"
  location = var.location
}

# No repository_url: Azure must not wire itself to GitHub or commit its own
# workflow. No app_settings: secrets are set with `az` so they stay out of
# Terraform state (ADR 009).
resource "azurerm_static_web_app" "this" {
  name                = "swa-stock-league"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  sku_tier            = "Free"
  sku_size            = "Free"

  # Only main is deployed; no per-PR preview sites.
  preview_environments_enabled = false

  lifecycle {
    ignore_changes = [app_settings]
  }
}
