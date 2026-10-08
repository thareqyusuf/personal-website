---
title: "The numbers at the bottom of every page"
date: 2026-10-08
description: "What the footer measures, how, and which of its numbers you should not trust."
---

<!-- TODO: this is a starter post written from the site's design notes. Edit it or replace it. -->

Every page on this site ends with a strip of measurements about how that page reached you. It's a small instrument panel, and like any instrument it's worth knowing what it measures and where it lies.

## The path

```
you ──(1)── Cloudflare edge ──(2)── origin: nginx on one VPS
```

Leg (1) is the one you feel. Leg (2) only happens when the edge doesn't have a fresh copy of the page.

## What each number is

**Served from** is the three-letter code of the Cloudflare data center that answered, read from `/cdn-cgi/trace`. It's usually an airport code: `CGK` is Jakarta, `SIN` is Singapore.

**Your round trip to the edge** comes from one of two sources, and the label under the number says which:

- **Transport RTT:** if Cloudflare includes a `cfL4` entry in the page's `Server-Timing` header, that's the edge's own RTT estimate for your connection, from TCP or QUIC. It's the best number available.
- **HTTP, fastest of 5:** otherwise the browser fetches a tiny edge-generated response five times on a warm connection and keeps the fastest. HTTP adds a little on top of the network RTT, so the minimum is the honest estimate. The median would include scheduling noise.

**Edge to origin** is the origin's own view. nginx reports `$tcpinfo_rtt`, the kernel's smoothed RTT on the socket the edge used to reach it, in a response that's never cached.

**Time to first byte** is `responseStart − requestStart` for this page load. It's RTT plus whatever the server did, so on a cache hit it's close to the RTT and on a miss it includes leg (2).

## What not to read into it

- It's one sample, n = 1. It says nothing about p99. That takes an external prober hitting the edge and the origin all day.
- Latency isn't bandwidth. A 14 ms RTT on a fat pipe still costs 14 ms per round trip, and TLS plus HTTP need several on a cold connection.
- Edge to origin is measured on whichever edge-to-origin connection served `/__probe`. With tiered caching on, that can be an upper-tier data center rather than the one near you.

## Why bother

Because I spend my days on numbers like these, and a personal site is a cheap place to keep myself honest about them. The comparison line under the panel, which puts your RTT in DRAM reads, NVMe reads and HDD seeks, uses the same reference table I use for napkin math.
