# TOOLS.md - Tools & Notes

Notes on available MCP servers, their quirks, and anything else worth remembering.

## MCP Servers

### nomad

Nomad cluster operations.
- **Endpoint:** *(e.g. http://nomad.service.consul:4646)*
- **Notes:** *(quirks, common queries, useful job names)*

### gcp

Google Cloud resources.
- **Project:** *(GCP project ID if applicable)*
- **Notes:**

### tailscale

Tailscale mesh network.
- **Tailnet:** *(your tailnet name)*
- **Nodes:** Jerry (this one), + others as they come online
- **Notes:**

### infra

Infrastructure-level operations.
- **Notes:** *(what this covers — Ansible playbooks? Terraform? Both?)*

### a2a-hub

Agent-to-agent router. Dispatches tasks to specialized agents once they're online.
- **Notes:** *(routing logic, which agents are registered)*

## SSH / Access

*(add node access details here as needed — hostnames, jump hosts, key locations)*

- **Jerry:** *(hostname or Tailscale IP)*

## Cluster Layout

*(fill in as you explore)*

- **Nomad datacenter:**
- **Consul datacenter:**
- **Key services registered in Consul:**

## Lessons Learned

*(update as you go — quirks, gotchas, things not to forget)*
