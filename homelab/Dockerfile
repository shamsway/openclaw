# homelab/Dockerfile - OpenClaw gateway with homelab infrastructure tools
#
# Extends the standard OpenClaw build with HashiCorp CLI tools (Nomad, Consul,
# Terraform), 1Password CLI, and general ops utilities needed for the Octant
# homelab agent (Jerry and future nodes).
#
# WHY NOT HOMEBREW?
# Homebrew (Linuxbrew) is designed for interactive use, requires a non-root
# user, adds 500 MB+ overhead, and can compile from source — all wrong for
# containers.  Use the HashiCorp APT repo and direct binary downloads instead.
#
# Build:
#   ./homelab/ctl.sh build   # uses OPENCLAW_IMAGE from .env
#
# Key runtime env vars (pass via .env or docker-compose environment):
#   NOMAD_ADDR              http://nomad.service.consul:4646
#   NOMAD_TOKEN             (Nomad ACL token, if enabled)
#   CONSUL_HTTP_ADDR        http://127.0.0.1:8500
#   CONSUL_HTTP_TOKEN       (Consul ACL token, if enabled)
#   OP_SERVICE_ACCOUNT_TOKEN  (1Password service account — preferred)
#   TF_TOKEN_app_terraform_io (Terraform Cloud token, if used)
#
# For Tailscale: the host daemon provides network connectivity; the CLI can
# query it by mounting the host socket (-v /var/run/tailscale:/var/run/tailscale).
# The Tailscale MCP server (listed in TOOLS.md) is the simpler alternative.

FROM node:22-bookworm

# ── Base system dependencies ──────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    git \
    jq \
    unzip \
    gnupg \
    lsb-release \
    ca-certificates \
    openssh-client \
    socat \
    dnsutils \
    iputils-ping \
    rsync \
    && rm -rf /var/lib/apt/lists/*

# ── yq (YAML processor) ───────────────────────────────────────────────────────
# Arch-aware: dpkg returns "amd64"/"arm64" which matches yq's release naming.
RUN ARCH=$(dpkg --print-architecture) \
    && curl -fsSL "https://github.com/mikefarah/yq/releases/latest/download/yq_linux_${ARCH}" \
        -o /usr/local/bin/yq \
    && chmod +x /usr/local/bin/yq \
    && yq --version

# ── HashiCorp APT repository ──────────────────────────────────────────────────
# Provides: nomad, consul, terraform (and vault if ever needed)
# Handles amd64/arm64 automatically via $(dpkg --print-architecture).
RUN curl -fsSL https://apt.releases.hashicorp.com/gpg \
        | gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] \
        https://apt.releases.hashicorp.com $(lsb_release -cs) main" \
        > /etc/apt/sources.list.d/hashicorp.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        nomad \
        consul \
        terraform \
    && rm -rf /var/lib/apt/lists/* \
    && nomad version \
    && consul version \
    && terraform version

# ── 1Password CLI (op) ────────────────────────────────────────────────────────
# Used by Jerry to read secrets directly: op read "op://Vault/Item/field"
# Requires OP_SERVICE_ACCOUNT_TOKEN at runtime (no interactive sign-in needed).
# Pinned version — bump ARG to upgrade.
ARG OP_VERSION=v2.32.1
RUN ARCH=$(dpkg --print-architecture) \
    && curl -sSf "https://cache.agilebits.com/dist/1P/op2/pkg/${OP_VERSION}/op_linux_${ARCH}_${OP_VERSION}.zip" \
        -o /tmp/op.zip \
    && unzip -q /tmp/op.zip op -d /usr/local/bin/ \
    && chmod +x /usr/local/bin/op \
    && rm /tmp/op.zip \
    && op --version

# ── Google Cloud CLI (gcloud) ─────────────────────────────────────────────────
# Used for GCP resource management: gcloud, gsutil, bq.
# APT repo handles amd64/arm64 automatically via $(dpkg --print-architecture).
RUN curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg \
        | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/cloud.google.gpg] \
        https://packages.cloud.google.com/apt cloud-sdk main" \
        > /etc/apt/sources.list.d/google-cloud-sdk.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends google-cloud-cli \
    && rm -rf /var/lib/apt/lists/* \
    && gcloud version

# ── OCI CLI (Oracle Cloud Infrastructure) ────────────────────────────────────
# Installed into an isolated Python venv; oci binary symlinked to /usr/local/bin.
# Requires ~/.oci/config (or OCI_* env vars) at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        python3-venv \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /opt/oracle/oci-cli \
    && /opt/oracle/oci-cli/bin/pip install --quiet oci-cli \
    && ln -sf /opt/oracle/oci-cli/bin/oci /usr/local/bin/oci \
    && oci --version

# ── Install Bun (required for OpenClaw build scripts) ────────────────────────
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"
RUN bun --version

RUN corepack enable

WORKDIR /app

# Optional: extra APT packages at build time (skill-specific tools)
# Example: --build-arg OPENCLAW_DOCKER_APT_PACKAGES="ripgrep fd-find"
ARG OPENCLAW_DOCKER_APT_PACKAGES=""
RUN if [ -n "$OPENCLAW_DOCKER_APT_PACKAGES" ]; then \
      apt-get update && \
      DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends $OPENCLAW_DOCKER_APT_PACKAGES && \
      apt-get clean && \
      rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*; \
    fi

# ── Build OpenClaw ────────────────────────────────────────────────────────────
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY patches ./patches
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
# Force pnpm for UI build (Bun may fail on ARM/Synology architectures)
ENV OPENCLAW_PREFER_PNPM=1
RUN pnpm ui:build

# ── mcporter (MCP CLI client — list and call MCP tools like other CLI tools) ──
# Installs mcporter globally, then generates /root/.mcporter/mcporter.json from
# homelab/.mcp.json. jq converts Claude's format ({type,url}) to mcporter's
# format ({baseUrl}). homelab/.mcp.json is the source of truth; rebuild the
# image whenever it changes.
RUN npm install -g mcporter \
    && mkdir -p /root/.mcporter \
    && jq '{mcpServers: (.mcpServers | to_entries | map({key, value: {baseUrl: .value.url}}) | from_entries)}' \
       /app/homelab/.mcp.json > /root/.mcporter/mcporter.json

ENV NODE_ENV=production

# ── Runtime environment defaults ─────────────────────────────────────────────
# Override these in .env / docker-compose or Nomad job template.
# Do NOT bake tokens or secrets into the image.
ENV NOMAD_ADDR="http://nomad.service.consul:4646"
ENV CONSUL_HTTP_ADDR="http://127.0.0.1:8500"
# OP_SERVICE_ACCOUNT_TOKEN — set at runtime, never here

# ── Rootless Podman user note ─────────────────────────────────────────────────
# Running as root inside the container is intentional and correct for rootless
# Podman: container uid=0 maps to the host user (e.g. hashi, uid=2000), so the
# process has no elevated host privileges. Bind-mounted volumes owned by the
# host user are readable/writable, and new files appear on the host under the
# correct owner — without needing `podman unshare` or `--userns=keep-id`.
# (podman-compose 1.0.3 silently drops userns_mode; running as root sidesteps
# the issue entirely.)

# Default CMD starts gateway with --allow-unconfigured (matches upstream).
# docker-compose.yml overrides this with full bind/port configuration.
CMD ["node", "openclaw.mjs", "gateway", "--allow-unconfigured"]
