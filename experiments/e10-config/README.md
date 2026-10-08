# E10: Is the live config what the repo says it is?

**Question.** Do the headers, redirects, TLS settings and origin lockdown on the live site match
`deploy/nginx/` and `deploy/CLOUDFLARE.md`?

**Prediction.** Everything passes. The informational check, whether `Server-Timing: cfL4` is present,
decides whether the footer can use the edge's own RTT or has to fall back to HTTP timing.

## Run

```bash
ORIGIN_IP=<droplet IP> experiments/e10-config/check.sh
```

It checks: HTML/CSS/font/feed cache headers, CSP and HSTS, HTTP/3 advertised and (if your curl
supports it) used, `/__probe` never cached, 404s, www → bare domain, http → https, TLS 1.1 refused,
and that the droplet refuses direct connections (firewall + client certificate). Then add the
SSL Labs grade to the summary's notes by hand.

Run it after every change to `deploy/nginx/` or to Cloudflare settings.
