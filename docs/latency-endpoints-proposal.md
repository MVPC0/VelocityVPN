# Proposal: self-controlled latency endpoints (not implemented)

Today's latency test times AWS DynamoDB regional `/ping` endpoints, with
azurespeed.com's Azure blobs as a fallback. We don't control either one, and 7 of
the 18 cities are measured against the nearest region rather than a region in
that city. The sturdiest fix is a tiny endpoint we own in each city. It would
answer `GET /ping` with 204, send `Access-Control-Allow-Origin: *` and
`Timing-Allow-Origin: *` (TAO also lets us use Resource Timing), set
`Cache-Control: no-store`, and keep connections alive.

**Requirement:** the endpoint must be unicast and pinned to one region.
**Cloudflare Workers (and any anycast or CDN edge) are not suitable**, because
they answer from whichever PoP is nearest the user, not from the named city.

## Options

| Option | Rough cost | Cities covered (of our 18) | Notes |
|---|---|---|---|
| **Fly.io**, one shared-cpu-1x 256 MB machine per region | ~$2/mo per region always-on → ~$30–40/mo for ~16 regions; less with auto-stop (cold start ~300 ms; would need a warm-up request, which we already drop) | LA (lax), Dallas (dfw), Chicago (ord), NY (ewr), Tokyo (nrt), Amsterdam (ams), London (lhr), Warsaw (waw), Stockholm (arn), Sydney (syd), Singapore (sin), São Paulo (gru), Johannesburg (jnb), Hong Kong (hkg, check it's still offered) — ~14 in city. No Seoul, Auckland, Perth or Dubai: use the nearest region and label it | Easiest to deploy: one Docker image, `fly scale count` per region. Dedicated IPv4 costs ~$2/mo extra; shared IPv4 plus IPv6 is fine |
| **AWS Lambda function URLs**, one per region | ~$0 at our volume (free tier 1M requests/mo); provisioned concurrency to avoid cold starts is ~$3–5/mo per region | Same cities as today's AWS mapping: 11 in city; Dallas, Chicago, NY, Amsterdam, Warsaw, Perth and Dubai stay nearest-region | Cold starts add 100–300 ms to the first request. Because we drop the warm-up request, cold starts are mostly harmless. Gains: our own CORS/TAO headers. Geography does not improve |
| **Tiny VMs** (Vultr / Hetzner / DigitalOcean ~$4–6/mo each) | ~$5/mo × 18 ≈ $90/mo | Vultr alone covers LA, Dallas, Chicago, NY/NJ, Tokyo, Amsterdam, Seoul, London, Warsaw, Stockholm, Sydney, Singapore, São Paulo, Johannesburg, plus Melbourne/Mumbai etc. That is ~15 of 18 in city. Gaps are filled from other hosts (e.g. Auckland, Perth, Dubai, Hong Kong) | Best city fidelity, but 18 machines to patch and monitor |

## Recommendation
Use Fly.io for most cities and Vultr VMs for the 3–4 gaps; total ~$50–60/mo.
Keep the current AWS→Azure chain as a fallback. The client code already handles
the order primary → fallback → "Unavailable". Only `src/data/ping-targets.ts`
would change: add a `self` provider first and keep AWS second.
