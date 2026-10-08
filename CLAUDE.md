# CLAUDE.md

Personal site for a platform engineer (kernel, networking, storage) who also does mechanistic
interpretability research. Static Hugo site, served by nginx on one VPS, with Cloudflare in front
as the edge cache. Its signature feature is a **live probe panel** in the footer of every page that
measures how that page reached the reader. Design is brutalist: hard 2px rules, a bordered sheet
on a cool grey page, one loud ultramarine band (the probe), no decoration that isn't information.

## Commands

```bash
hugo server                                  # dev at :1313. Probe shows partial data (no edge, no /__probe)
hugo --gc --minify                           # build into public/
scripts/check.sh                             # feeds, size budgets, no 3rd-party, probe on every page, nginx -t
scripts/serve-nginx.sh                       # serve public/ with the PRODUCTION nginx rules on :8080
scripts/serve-nginx.sh --test                # nginx -t only
hugo new blog/<slug>.md                      # new post (draft: true by default)
hugo new research/<slug>.md                  # new research entry from archetype
```

Hugo is pinned to **0.140.2 extended** (see `.github/workflows/deploy.yml`). Use the same locally.
Always run `hugo --gc --minify && scripts/check.sh` before saying a change is done.
For anything touching the probe or nginx, also run `scripts/serve-nginx.sh` and curl the
endpoints, because `hugo server` has no `/__probe` and no cache headers.

## Layout

```
hugo.toml                  site params: author, timezone, originName, giscus ids, menu
content/
  _index.md                home page intro paragraph
  about.md now.md colophon.md subscribe.md
  blog/                    posts; URL = /blog/<filename>/
  research/                MI research log entries; URL = /research/<filename>/
layouts/
  _default/baseof.html     page shell
  _default/single.html     posts + plain pages;   research/single.html  research entries
  _default/list.html       section lists;         _default/now.html     /now page
  _default/rss.xml         full-content RSS (home = blog + research; sections = their own)
  index.html               home: hero, clock + Game of Life tools, now table, writing, research
  partials/                head, header, footer (probe markup), comments (giscus), entry, status, focus-table
  shortcodes/b64.html      base64-encoded email with a Decode button
assets/css/main.css        all styles; tokens at the top
assets/js/site.js          probe, clock, life, b64. No deps. Bundled by js.Build
static/fonts/              Archivo (variable, wght+wdth) and Fragment Mono, versioned file names
deploy/
  nginx/site.conf          production server blocks (TLS, mTLS from Cloudflare, real_ip)
  nginx/snippets/site-locations.conf   ALL location/caching rules; shared by prod and local test
  nginx/snippets/security-headers.conf CSP etc., re-included in every location
  nginx/local-test.conf    plain-HTTP server used by scripts/serve-nginx.sh
  bin/site-activate        atomic symlink swap + prune (also the rollback tool)
  bin/site-deploy-gate     forced command for the CI SSH key (rrsync upload + activate only)
  bootstrap.sh cf-ips.sh   one-time VPS setup; weekly Cloudflare IP refresh
  CLOUDFLARE.md            go-live runbook, cache rules, CI secrets
.github/workflows/deploy.yml   build → check → rsync release → activate → purge → smoke test
```

## Content model

**Blog post** (`content/blog/*.md`): `title`, `date`, `description` (shown in lists and feeds), `draft`.

**Research entry** (`content/research/*.md`), a lab notebook, not a paper:

| Field | Meaning |
|---|---|
| `date` | project start |
| `lastmod` | date of the newest log entry. **Bump it with every entry.** Front matter wins over git (see `[frontmatter]`) |
| `status` | `wip` \| `paused` \| `done`. Rendered by `partials/status.html`; `wip` adds a "working log, not a result" notice |
| `question`, `setup` | one or two sentences each, markdown allowed |
| `links` | list of `{label, url}`: repo, notebooks, W&B, write-up |

Body convention: `## Why this question`, `## Current state` (what a reader can trust), `## Log` with
`### YYYY-MM-DD` entries, newest first. Feeds prefix research items with `[Research, <status>]`.

**Now page** (`content/now.md`): `date` = last updated; `focus` = list of `{area, what, link?, status?}`.
The same table renders on the home page, so keep each `what` to one line.

Don't invent research claims, results, employers or biography. Content the owner hasn't written is
marked `TODO` and `scripts/check.sh` warns about it. Leave those markers in place unless asked.

## The probe: what each number means

This panel is the point of the site. The owner is a latency person and readers will be too, so
**never label a number as something it isn't.** If you change how something is measured, update the
label in `footer.html`, the note set in `site.js`, `content/colophon.md` (#probe table) and
`content/blog/the-numbers-at-the-bottom.md` in the same change.

| Cell | How | Caveats |
|---|---|---|
| Served from | `colo=` from `/cdn-cgi/trace` (Cloudflare-only path) | Absent off Cloudflare → shows `origin` |
| Your round trip to the edge | 1st choice: `cfL4` entry in the navigation's `Server-Timing` (edge's TCP/QUIC RTT, µs). Fallback: **minimum** of 5 sequential fetches of `/cdn-cgi/trace` using Resource Timing `responseStart − requestStart`. Off Cloudflare: origin's `srtt_us` | Use min, not median: noise only adds. Whether Cloudflare emits `cfL4` must be verified on the live zone |
| Edge to origin | `/__probe` → nginx `$tcpinfo_rtt` (kernel srtt of the socket that carried the request) | With Tiered Cache this is the upper-tier colo, not the reader's colo |
| Time to first byte | Navigation Timing `responseStart − requestStart` | Includes server/edge time; on a MISS includes the origin leg |
| Protocol | `nextHopProtocol`; TLS version from trace | |
| Edge cache | `HEAD` of the current path → `cf-cache-status`, `age` | Reflects the edge now, not necessarily this exact load |

Rules for `site.js`: measure only after `load`; every fetch must fail soft (cell shows `—` plus a
reason); no timers faster than the Game of Life's 160 ms; respect `prefers-reduced-motion`
(life renders one still frame); pause life when off-screen or the tab is hidden. Budget: JS ≤ 12 kB.

## Caching contract

| Path | Cache-Control | Notes |
|---|---|---|
| HTML (`location /`) | `public, max-age=60, s-maxage=604800, stale-while-revalidate=86400` | Safe only because deploys purge |
| `/css/*.<sha256>.css`, `/js/*.<sha256>.js` | `public, max-age=31536000, immutable` | Hugo `fingerprint`; never reference unfingerprinted CSS/JS |
| `/fonts/*` | immutable 1y | **Changing a font file means a new name** (`-v2.woff2`) and updating `main.css` + preloads in `head.html` |
| `index.xml` feeds | `max-age=900, s-maxage=3600` | `application/rss+xml` |
| `/__probe` | `no-store` | Also bypassed by a Cloudflare cache rule. Must never be cached |
| `/404.html` | short | |

nginx gotcha: `add_header` in a location **discards** inherited `add_header`s. Every location includes
`snippets/security-headers.conf` for that reason, so keep that pattern for new locations.
All location logic lives in `snippets/site-locations.conf`, the server block only sets `root` and
`$origin_name`, so `scripts/serve-nginx.sh` exercises the exact production rules.

Cloudflare (configured in the dashboard, documented in `deploy/CLOUDFLARE.md`): proxied DNS,
Full (strict) with an Origin CA cert, Authenticated Origin Pulls (nginx `ssl_verify_client on`),
Cache Rules (bypass `/__probe`; everything else "eligible", edge TTL from origin headers), HTTP/3 on.
Port 443 on the VPS accepts Cloudflare ranges only (ufw, refreshed weekly by `cf-ips`).

## Deploy

Push to `main` → Actions builds with `HUGO_BUILD_SHA` (shown in the footer) → `scripts/check.sh` →
`rsync` into `/srv/site/releases/<sha7>/` (deploy key is jailed by `site-deploy-gate` + rrsync) →
`ssh deploy@host activate <sha7>` (atomic `rename(2)` of the `current` symlink, keeps 5) →
purge everything on Cloudflare → smoke test via `vars.SITE_URL`.
Rollback: `ssh deploy@host activate <older-sha>` then purge. PRs build and check but don't deploy.

## Design system

Tokens are at the top of `assets/css/main.css`. Use them and don't add new colors casually.

- **Color:** `--paper` (page, cool grey), `--sheet` (content frame), `--ink` (pure black / near-white in dark),
  `--muted`, `--signal` ultramarine `#2d2df0` (link underlines, link hover fill, the probe band; nothing else),
  `--signal-tint` (inline code, `wip` badge). Dark mode redefines the same tokens.
- **Type:** Archivo variable (use `font-stretch` 112–125% + weight 750–850 for headings; the name on
  the home page is 125%/850) and Fragment Mono for code, dates in lists, and probe readouts only.
  Labels are sentence case. No all-caps eyebrows, no letter-spaced labels.
- **Structure:** 2px rules between major regions, 1px between rows. Zero border radius, no shadows,
  no gradients. Borders and tables carry information (rows, cells, definitions), not decoration.
- **Motion:** none except the Game of Life and the ticking clock. No entrance animations, no hover transitions.
- **Copy:** plain, specific, active voice. Links say where they go ("RSS for writing", not "Click here").
  Empty and error states say what to do next.
- Widgets mimic the typesafe.ai "instrument" idea (named, versioned tools: `Clock 1.0`, `Glider 1.0`).
  A new widget must show real information about the site or the owner, not just be decoration.

## Guardrails

- No JS frameworks, no CSS frameworks, no analytics or trackers, no cookies, no web fonts from CDNs.
- The only third party is giscus (script + iframe). Adding any other origin means updating the CSP in
  `security-headers.conf`, and `scripts/check.sh` will fail on new third-party `src=`.
- Budgets (enforced by `check.sh`): CSS ≤ 20 kB, JS ≤ 12 kB, home HTML ≤ 30 kB.
- Everything must work without JS except the probe/clock/life/decoder, which show static fallbacks.
- Keep pages responsive to 360px wide with no horizontal scroll; check light and dark.
- Visible focus (`:focus-visible` 3px signal outline) on anything interactive.

## Open TODOs (owner's placeholders)

- `hugo.toml`: `baseURL`, `title`/`author`, `email`, `github`, `originName`, `[params.giscus]` ids.
- `deploy/nginx/site.conf`: `server_name`, `$origin_name`.
- Content: home intro, about page, now table, first real research entry (rename `mi-wip.md`), starter post.
- After first deploy, verify: whether `Server-Timing: cfL4` appears on HTML responses
  (`curl -sI https://<domain>/ | grep -i server-timing`); if not, the RTT cell uses the HTTP fallback,
  which is fine but the label must say so (it does).
- Optional: custom giscus theme matching the site (needs a CSS file served with
  `Access-Control-Allow-Origin: https://giscus.app`).
