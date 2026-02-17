# IRC Agent Bus Starter (Homelab)

A practical starting point for experimenting with multi-agent and multi-gateway communication over IRC using OpenClaw.

## 1) Docker Compose (IRCd + Web Client)

This stack runs:

- `ergo` as the IRC server
- `thelounge` as a modern web IRC client

```yaml
services:
  ergo:
    image: ghcr.io/ergochat/ergo:stable
    container_name: ergo
    restart: unless-stopped
    command: ["run", "--conf", "/ircd/ergo.yaml"]
    ports:
      - "6697:6697" # IRC over TLS
    volumes:
      - ./ergo/ergo.yaml:/ircd/ergo.yaml:ro
      - ./ergo/data:/ircd/data
      - ./ergo/certs:/ircd/certs:ro

  thelounge:
    # If this tag changes upstream, fallback to: thelounge/thelounge:latest
    image: ghcr.io/thelounge/thelounge:latest
    container_name: thelounge
    restart: unless-stopped
    depends_on:
      - ergo
    ports:
      - "9000:9000" # Web UI
    volumes:
      - ./thelounge:/var/opt/thelounge
```

Run:

```bash
docker compose up -d
docker compose logs -f ergo thelounge
```

Notes:

- Start with local/VPN-only exposure.
- Keep TLS enabled on IRC.
- Create a hardened `ergo.yaml` before opening to wider networks.

## 2) Modern IRC client suggestions

- The Lounge (self-hosted web client): <https://thelounge.chat/>
- Halloy (modern desktop IRC client): <https://halloy.squidowl.org/>
- IRCCloud (hosted, quick to test): <https://www.irccloud.com/>

For this setup, The Lounge is the fastest way to get a browser-based UI in homelab.

## 3) Suggested strict OpenClaw IRC config

Put this in `~/.openclaw/openclaw.json` and adjust hostmasks/channel names.

Design goals:

- DMs disabled
- channel allowlist only
- mention required
- strict sender allowlist
- risky tools denied by default

```json5
{
  channels: {
    irc: {
      enabled: true,
      host: "irc.lab.example",
      port: 6697,
      tls: true,
      nick: "openclaw-gw",
      username: "openclaw",
      realname: "OpenClaw Gateway",

      // Strict DM posture
      dmPolicy: "disabled",

      // Strict group posture
      groupPolicy: "allowlist",
      channels: ["#agents-control"],

      groups: {
        "#agents-control": {
          enabled: true,
          requireMention: true,
          allowFrom: [
            "orchestrator!~bot@10.0.0.21",
            "worker1!~bot@10.0.0.22",
            "worker2!~bot@10.0.0.23",
          ],
          tools: {
            deny: ["group:runtime", "group:fs", "gateway", "nodes", "cron", "browser"],
          },
        },
      },
    },
  },
}
```

## Suggested rollout order

1. Bring up IRCd + The Lounge and validate TLS login.
2. Connect one OpenClaw gateway with the strict profile above.
3. Verify mention-gating behavior in `#agents-control`.
4. Add one agent hostmask at a time to `allowFrom`.
5. Only relax policies (if needed) after observing stable behavior.

## Why this shape works for experiments

- preserves nostalgia and visibility
- keeps attack surface narrow during early tests
- keeps migration path open if you later move control-plane traffic to NATS/Redis
