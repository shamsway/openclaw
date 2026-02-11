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
#   podman build -t openclaw-homelab:local -f homelab/Dockerfile .
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
    && rm -rf /var/lib/apt/lists/*

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
RUN OPENCLAW_A2UI_SKIP_MISSING=1 pnpm build
# Force pnpm for UI build (Bun may fail on ARM/Synology architectures)
ENV OPENCLAW_PREFER_PNPM=1
RUN pnpm ui:build

ENV NODE_ENV=production

# ── Runtime environment defaults ─────────────────────────────────────────────
# Override these in .env / docker-compose or Nomad job template.
# Do NOT bake tokens or secrets into the image.
ENV NOMAD_ADDR="http://nomad.service.consul:4646"
ENV CONSUL_HTTP_ADDR="http://127.0.0.1:8500"
# OP_SERVICE_ACCOUNT_TOKEN — set at runtime, never here

# ── Security: run as non-root ─────────────────────────────────────────────────
USER node

CMD ["node", "dist/index.js"]
