# E07: Plain-internet path to the origin vs Cloudflare's path

**Question.** Is a cache miss through Cloudflare (E02's miss penalty) faster or slower than simply
pinging the droplet from the same city over the public internet?

**Prediction.** Roughly equal. On the Free plan there is no Argo Smart Routing, so Cloudflare's path
from London to Singapore is about as long as the internet's (~160 ms). If E02's penalty is much
larger than the ping RTT here, Cloudflare is adding hops (e.g. via the upper tier) or opening new
connections.

## Run

```bash
ORIGIN_IP=<droplet IP> node experiments/run.mjs e07     # ~40 tests (ping, 16 packets each)
```

`ORIGIN_IP` is only used for the measurement and is redacted from every file written. ufw allows ICMP
echo by default; if pings to the origin all show 100 % loss, that has changed.

## Threats to validity

- ICMP can be deprioritised by routers; ping RTT is a floor, not what TCP sees under load.
- Run it in the same hour as E02 so routing hasn't changed in between.
