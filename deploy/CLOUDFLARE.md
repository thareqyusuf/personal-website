# Going live: VPS + Cloudflare, step by step

About an hour end to end. Do these in order; each step says how to check it worked.

## 0. Create the droplet (DigitalOcean, Singapore)

DigitalOcean → **Create → Droplets**:

- **Region:** Singapore, datacenter **SGP1**.
- **Image:** Ubuntu 24.04 LTS.
- **Size:** Basic, Regular, **$6/mo** (1 vCPU, 1 GB, 25 GB, 1 TB transfer). nginx serving static files from page cache needs almost nothing, and Cloudflare absorbs most traffic.
- **Authentication:** SSH key only (add your laptop's public key).
- **Advanced:** tick **Enable IPv6** (free).
- **Hostname:** anything. The site calls this box `sgp1` (`params.originName` in `hugo.toml`, `$origin_name` in `deploy/nginx/site.conf`).
- Skip DigitalOcean's Cloud Firewall: `bootstrap.sh` sets up ufw with the same rules (SSH open, 443 from Cloudflare only).

Why Singapore: it's ~10–15 ms from Jakarta and one of Cloudflare's biggest hubs. The cost is on cache misses for far readers: a Singapore origin adds roughly ~320 ms for London and ~460 ms for US East, versus ~30 / ~180 ms from Frankfurt. Smart Tiered Cache (step 4) cuts how often the droplet is hit, but not that distance: the upper tier sits next to the origin. See *Moving to another region* at the end if that trade changes.

Then copy the deploy scripts over from your laptop (`scp -r deploy root@<droplet IP>:/root/`) and continue below.

## 1. Domain on Cloudflare

1. Done: thareqyusuf.com was registered through Cloudflare Registrar, so it's already on Cloudflare's nameservers.
2. DNS: `A thareqyusuf.com → <VPS IPv4>` (and `AAAA` if you have IPv6), **Proxied** (orange cloud). Add `CNAME www → thareqyusuf.com`, also Proxied.

## 2. TLS between Cloudflare and the origin

1. **SSL/TLS → Overview:** mode **Full (strict)**.
2. **SSL/TLS → Origin Server → Create Certificate** (RSA or ECDSA, hostnames `thareqyusuf.com, *.thareqyusuf.com`, 15 years). Save the two PEMs on the VPS:
   ```
   sudo install -d -m 700 /etc/ssl/cloudflare
   sudo tee /etc/ssl/cloudflare/origin.pem   # paste certificate
   sudo tee /etc/ssl/cloudflare/origin.key   # paste private key
   ```
3. **Authenticated Origin Pulls** (SSL/TLS → Origin Server → toggle on, zone-level). Download Cloudflare's origin-pull CA to the box:
   ```
   sudo curl -fsSo /etc/ssl/cloudflare/authenticated_origin_pull_ca.pem \
     https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem
   ```
4. **Edge Certificates:** Always Use HTTPS on, minimum TLS 1.2, TLS 1.3 on, HSTS optional (once you're sure).

## 3. Bootstrap the VPS

On your laptop, make the CI deploy key (no passphrase; it's jailed by `site-deploy-gate`):
```
ssh-keygen -t ed25519 -N '' -C github-actions -f deploy_key
```
On the VPS, from a checkout of this repo:
```
sudo DEPLOY_PUBKEY="$(cat deploy_key.pub)" ./deploy/bootstrap.sh
```
It prints the host key line for `DEPLOY_KNOWN_HOSTS` at the end.

Check: `curl -sk https://<VPS IP>/` from your laptop should **hang or be refused** (443 only accepts Cloudflare IPs), and `https://thareqyusuf.com/` should show "First deploy pending."

## 4. Cache rules (the "edge caching" part)

**Caching → Cache Rules → Create rule**. One rule is enough:

- **Rule name:** `Cache the site`
- **If incoming requests match:** Custom filter expression → **Edit expression**, paste:
  ```
  (http.host eq "thareqyusuf.com" and http.request.uri.path ne "/__probe")
  ```
- **Cache eligibility:** **Eligible for cache**. Leave Edge TTL and Browser TTL at their defaults, which use the `Cache-Control` headers nginx sends.

Without this rule, Cloudflare only caches by file extension and never caches HTML. With it, the `s-maxage` values nginx sends decide edge TTLs (see the table in `content/colophon.md`). `/__probe` is excluded in the expression rather than by a separate bypass rule: when several cache rules match, the later one wins, so rule order would matter. nginx also sends `no-store` for it.

Also worth turning on:
- **Speed → Optimization → Protocol:** HTTP/3 (QUIC) on, 0-RTT on (static GETs are safe to replay).
- **Caching → Tiered Cache:** Smart Tiered Caching on (fewer origin hits; note that it makes "Edge to origin" in the probe measure the upper tier).
- **Rules → Snippets/Workers:** none needed.

Check (twice, the second should be HIT):
```
curl -sI https://thareqyusuf.com/ | grep -iE 'cf-cache-status|cache-control|age'
curl -s  https://thareqyusuf.com/__probe     # {"origin":"sgp1","srtt_us":...}
curl -sI https://thareqyusuf.com/__probe | grep -i cf-cache-status   # BYPASS or DYNAMIC, never HIT
```

## 5. CI secrets

GitHub repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | VPS IP or a non-proxied hostname (SSH can't go through the orange cloud) |
| `DEPLOY_SSH_KEY` | contents of `deploy_key` (private) |
| `DEPLOY_KNOWN_HOSTS` | the line bootstrap.sh printed |
| `CF_ZONE_ID` | Overview page of the zone, right sidebar |
| `CF_API_TOKEN` | My Profile → API Tokens → Create → Custom: *Zone · Cache Purge · Purge*, scoped to this zone only |

Repository **variable** `SITE_URL` = `https://thareqyusuf.com` turns on the post-deploy smoke test.

Create an environment named `production` (Settings → Environments) if you want manual approval before deploys.

Push to `main`. The Actions log ends with `active: <sha>` and a purge.

## 6. Comments (giscus)

1. Make the repo public (giscus needs public Discussions), enable **Discussions**, create a category `Comments` (type *Announcement*, so only giscus creates threads).
2. Install the giscus GitHub app on the repo: https://github.com/apps/giscus
3. On https://giscus.app enter the repo; copy `data-repo-id` and `data-category-id` into `[params.giscus]` in `hugo.toml`.

## Rollback

```
ssh -i deploy_key deploy@<host> activate <older-sha>
```
then purge the cache from the dashboard (or re-run the workflow's purge step). The last 5 releases are kept on disk.

## Moving to another region

The droplet holds nothing you can't rebuild: CI produces the site and this repo holds the config. So moving (say, SGP1 → FRA1, same price) means building a new box and then switching over, with no downtime:

1. Create a droplet in the new region as in step 0. Copy `/etc/ssl/cloudflare/` from the old box, then run `bootstrap.sh` with the same `DEPLOY_PUBKEY`.
2. Set the new name in `hugo.toml` (`originName`) and `deploy/nginx/site.conf` (`$origin_name`), e.g. `sgp1`. Update the `DEPLOY_HOST` and `DEPLOY_KNOWN_HOSTS` secrets, then push. The deploy lands on the new box while the old one keeps serving.
3. In Cloudflare DNS, point the `A` (and `AAAA`) record at the new IP. Readers only ever see Cloudflare's addresses, so a proxied record switches in seconds.
4. Check that `curl -s https://thareqyusuf.com/__probe` reports the new origin name, then destroy the old droplet.
