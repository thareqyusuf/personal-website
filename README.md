# Personal site

Static Hugo site → nginx on one VPS → Cloudflare edge cache. Every page ends with a live
panel measuring how that page reached the reader (edge location, RTT, edge→origin RTT, TTFB,
protocol, cache status).

```
hugo server                      # write; http://localhost:1313 (probe shows partial data here)
hugo --gc --minify && scripts/check.sh   # build + checks CI runs
scripts/serve-nginx.sh           # serve public/ with the production nginx rules on :8080
```

- Writing a post: `hugo new blog/my-post.md`, set `draft: false` when ready.
- Research log: copy `content/research/mi-wip.md`, keep `status` and `lastmod` current.
- Now page: edit the `focus` list and `date` in `content/now.md`.

Going live: [`deploy/CLOUDFLARE.md`](deploy/CLOUDFLARE.md). Working with Claude Code: [`CLAUDE.md`](CLAUDE.md).

Fonts: Archivo and Fragment Mono, SIL Open Font License 1.1.
