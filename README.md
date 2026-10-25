[README.md](https://github.com/user-attachments/files/32492152/README.md)
# VelocityVPN

A free, open-source WireGuard VPN dashboard for gamers. Manage your VPN providers, check browser latency to cloud regions, see Steam player counts, and generate WireGuard configs - all in one place.

**[Live Demo](https://velocity-vpn.netlify.app)**

## Features

- **7 VPN Providers Supported** - Mullvad, ProtonVPN, Windscribe, IVPN, PrivadoVPN, Hide.me, or Custom
- **18 Reference Locations** - Browser HTTP round-trip time to a cloud region near each city (median ± spread; not ICMP ping, not VPN servers)
- **26 Game Trackers** - Player counts from Steam's public API (shows "—" when Steam doesn't answer; Fortnite shows "—")
- **Regions** - Reference locations grouped by region (no server load data yet, so nothing is rated or ranked)
- **IP & Leak Testing** - IP display, DNS leak test, WebRTC leak test, speed test
- **WireGuard Config Generator** - Real Curve25519 keys, import-ready .conf files
- **Chrome Extension** - Routes Chrome through your own HTTP/HTTPS/SOCKS5 proxy
- **Fully Free** - No ads, no tracking, no paid features locked behind paywalls

## Quick Start

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

## How It Works

VelocityVPN is a **management dashboard**, not a VPN service itself. You bring your own WireGuard provider:

1. Go to the **Providers** tab
2. Select your VPN provider (free options: ProtonVPN, Windscribe, Hide.me, PrivadoVPN)
3. Paste your server endpoint, public key, and private key
4. Activate the config and download your .conf file
5. Import into the WireGuard app - done!

## Tech Stack

- React 19 + TypeScript
- Tailwind CSS
- WireGuard config generation with real Curve25519 cryptography
- Steam Web API (via a Netlify Function) for game player counts

## License

MIT - free for personal and commercial use.
