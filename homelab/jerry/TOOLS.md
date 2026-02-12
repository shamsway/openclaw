# TOOLS.md - Tools & Notes

Notes on available tools, their usage patterns, and anything worth remembering.

---

## MCP Tools (mcporter)

MCP servers are accessed via **mcporter**, installed in the image alongside other
CLI tools (nomad, consul, op, gcloud). No agent config changes are required.

**Config:** `.mcp.json` in the repo root is the source of truth. At image build
time it is transformed to `/root/.mcporter/mcporter.json` automatically.

### Discover tools

```bash
mcporter list              # all configured servers + tool counts
mcporter list context7     # tools exposed by context7
mcporter list tavily       # tools exposed by tavily
```

### context7 — library and framework docs

```bash
# Step 1: resolve a library name to a Context7 library ID
mcporter call context7.resolve-library-id libraryName:"react"
mcporter call context7.resolve-library-id libraryName:"kubernetes"

# Step 2: fetch docs for that ID (use the /org/project ID from step 1)
mcporter call context7.get-library-docs libraryId:"/facebook/react" topic:"hooks"
mcporter call context7.get-library-docs libraryId:"/kubernetes/kubernetes" topic:"pods"
```

### tavily — web search

```bash
mcporter call tavily.search query:"your search query"
mcporter call tavily.search query:"nomad job scheduling" maxResults:5
```

### Troubleshooting

```bash
# Verify config loaded correctly
mcporter list

# Ad-hoc call without relying on saved config
mcporter list --http-url https://mcp.context7.com/mcp --name context7
```

**Adding servers:** edit `.mcp.json` → `./homelab/ctl.sh build`.
Full reference: `HOMELAB_DEPLOYMENT_NOTES.md` → Lesson 9.

---

## CLI Tools

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

---

## SSH / Access

*(add node access details here as needed — hostnames, jump hosts, key locations)*

- **Jerry:** *(hostname or Tailscale IP)*

---

## Cluster Layout

*(fill in as you explore)*

- **Nomad datacenter:**
- **Consul datacenter:**
- **Key services registered in Consul:**

---

## Lessons Learned

*(update as you go — quirks, gotchas, things not to forget)*
