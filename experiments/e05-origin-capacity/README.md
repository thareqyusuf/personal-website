# E05: How much load can the origin take?

**Question.** Where is the knee of the latency curve for nginx on a 1 vCPU / 1 GB droplet, and how
much headroom is that compared with realistic traffic?

**Prediction.** HTML (~6 KB) from page cache, keep-alive, k6 on the same vCPU: knee around
3–8k req/s with p99 < 5 ms below it. Fonts (90 KB) knee lower in req/s but similar CPU. `/__probe`
(nginx `return`, no file) the highest. Realistic need: a front-page spike is ~10–50 HTML req/s at
the edge and ~1 % of that at the origin, so headroom is 100–1000×.

## Method

- Load goes to a **loopback-only** listener (`127.0.0.1:8081`, `deploy/nginx/loopback.conf`), same
  location rules, no TLS. Nothing leaves the droplet and Cloudflare is not involved.
- k6 `constant-arrival-rate` (open model) at 250, 500, 1k, 2k, 4k, 8k, 16k req/s, 60 s each, with
  `vmstat 1` running alongside. A path stops climbing once p99 > 50 ms, errors > 1 %, or k6 drops
  iterations.

## Run

```bash
# laptop → droplet
scp -r experiments/e05-origin-capacity root@<IP>:/root/e05
scp deploy/nginx/loopback.conf root@<IP>:/root/e05/

# droplet
ssh root@<IP>
cd /root/e05 && ./setup.sh && ./run.sh      # ~15–20 min
./teardown.sh

# laptop: fetch results and summarize
scp -r root@<IP>:/root/e05/results/<stamp> experiments/e05-origin-capacity/results/raw/
node experiments/lib/k6.mjs e05 experiments/e05-origin-capacity/results/raw/<stamp>
```

Pick a quiet hour: readers' cache misses share the same CPU.

## Threats to validity

- **k6 and nginx share one vCPU.** The knee you find is the knee of the pair, a lower bound for
  nginx alone. `dropped_iterations > 0` means k6 couldn't keep up. For a cleaner number, run k6 from
  a second $4 droplet in SGP1 over the private network (bind `loopback.conf` to the private IP and
  allow it in ufw for the test), then delete it.
- Loopback skips TLS, which is where real per-connection CPU goes. Cloudflare reuses connections, so
  TLS handshakes are rare in production, but not zero.
- Shared vCPU: `steal` in the table shows when a noisy neighbour took CPU time.
