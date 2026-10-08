---
title: "Colophon"
description: "How this site is built, cached and served."
---

This site is static HTML built by [Hugo](https://gohugo.io), served by nginx on one small VPS, with Cloudflare in front as the cache. There is no framework, no tracker and no cookie. The only third-party request is the GitHub Discussions widget at the bottom of posts, and it doesn't load until you scroll to it.

## Serving path

```
reader ── Cloudflare edge (cache, TLS, HTTP/3) ── nginx origin (TLS, mTLS from edge only)
```

- **Origin:** one DigitalOcean droplet in Singapore (SGP1) running nginx. Port 443 accepts only Cloudflare's IP ranges and requires Cloudflare's client certificate (authenticated origin pulls).
- **Deploys:** a push to `main` builds the site in GitHub Actions, rsyncs it into a new release directory, swaps a symlink atomically, and purges the edge cache.
- **Fonts:** [Archivo](https://github.com/Omnibus-Type/Archivo) for text and [Fragment Mono](https://github.com/weiweihuanghuang/fragment-mono) for code and measurements. Both are self-hosted and licensed under the SIL Open Font License.

## Cache policy

| Path | Browser | Edge | Why |
|---|---|---|---|
| HTML pages | 60 s | 7 days | Deploys purge the edge, so a long edge TTL is safe |
| Fingerprinted CSS/JS | 1 year, immutable | 1 year | The file name changes when the content does |
| Fonts (`-v1.woff2`) | 1 year, immutable | 1 year | Versioned by file name |
| RSS feeds | 15 min | 1 hour | Readers poll; keep it cheap |
| `/__probe` | never | never | It's a measurement |

## The probe {#probe}

The panel at the bottom of each page measures the request that delivered it. [The numbers at the bottom of every page](/blog/the-numbers-at-the-bottom/) explains each field and its caveats. In short:

| Field | Source | Unit |
|---|---|---|
| Served from | `colo=` in `/cdn-cgi/trace` | edge code |
| Your round trip to the edge | `cfL4` in `Server-Timing` (TCP or QUIC RTT) if present, otherwise the fastest of 5 HTTP requests to the edge | ms |
| Edge to origin | nginx `$tcpinfo_rtt` from `/__probe` | ms |
| Time to first byte | Navigation Timing, `responseStart − requestStart` | ms |
| Protocol | `nextHopProtocol`, plus `tls=` from the trace | — |
| Edge cache | `cf-cache-status` and `age` from a `HEAD` request for this URL | — |

The comparison line uses reference latencies from a 2026 re-measure of [napkin-math](https://github.com/sirupsen/napkin-math), plus Jeff Dean's 2012 numbers where those still hold.
