# VelocityVPN

A free, open-source WireGuard VPN dashboard for gamers. Manage your VPN providers, test server pings, track game server populations, and generate WireGuard configs — all in one place.

**[Live Demo](https://velocity-vpn.netlify.app/#/dashboard)**

## Features

- **7 VPN Providers Supported** — Mullvad, ProtonVPN, Windscribe, IVPN, PrivadoVPN, Hide.me, or Custom
- **18 Global Server Locations** — Live ping testing with jitter calculation
- **25 Game Trackers** — Live player counts from Steam + Epic
- **Heat Map** — "Pick Your Lobby" with 5 vibe levels (Bot Lobby to Sweaty)
- **IP & Leak Testing** — IP display, DNS leak test, WebRTC leak test, speed test
- **WireGuard Config Generator** — Real Curve25519 keys, import-ready .conf files
- **Chrome Extension** — Free VPN proxy extension included
- **Fully Free** — No ads, no tracking, no paid features locked behind paywalls

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
5. Import into the WireGuard app — done!

## Tech Stack

- React 19 + TypeScript
- Tailwind CSS
- WireGuard config generation with real Curve25519 cryptography
- Steam Web API for live game player counts

## License

MIT — free for personal and commercial use.
