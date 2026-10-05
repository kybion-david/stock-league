output "default_host_name" {
  description = "Live hostname of the site."
  value       = azurerm_static_web_app.this.default_host_name
}

output "api_key" {
  description = "Deployment token; goes into the AZURE_STATIC_WEB_APPS_API_TOKEN GitHub secret."
  value       = azurerm_static_web_app.this.api_key
  sensitive   = true
}
