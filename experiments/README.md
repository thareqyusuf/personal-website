# Experiments

Measurements of how thareqyusuf.com performs, designed in [`PLAN.md`](PLAN.md), run by hand or by
GitHub Actions, and published at [/lab/](https://thareqyusuf.com/lab/).

## Layout

```
experiments/
  PLAN.md                 the design: questions, predictions, rules, order
  config.json             site, cities, probes per city
  run.mjs                 runner for the Globalping experiments (e00–e04, e07)
  lib/                    Globalping client, result writer, k6 summarizer
  eNN-name/
    README.md             question, prediction, method, how to run, threats to validity
    *.sh / *.js           experiment-specific scripts
    results/raw/          raw tool output, one file per run (UTC timestamp), origin IP redacted
data/lab/eNN/<stamp>.json summary tables the site renders (newest run first on /lab/eNN/)
content/lab/eNN-*.md      the page for each experiment (status, prediction, what I learned)
```

## Tools you need

| Tool | For | Install |
|---|---|---|
| Node ≥ 18 | `run.mjs`, summarizers | already needed for nothing else; `nvm`, distro package, or nodejs.org |
| Globalping | E00–E04, E07 (probes in ~20 cities, free) | nothing: `run.mjs` calls the API. Optional token: register at globalping.io, then `export GLOBALPING_TOKEN=...` (500 instead of 250 tests/hour) |
| curl | E00, E09, E10 | preinstalled |
| k6 | E05 (on the droplet), E06 (laptop) | E05's `setup.sh` installs it on the droplet; laptop: see grafana.com/docs/k6 |
| WebPageTest | E08 | browser, free account at webpagetest.org |

## Running one

```bash
node experiments/run.mjs e02 --dry-run   # see exactly what will be sent
node experiments/run.mjs e02             # E01 + E02 together, ~120 Globalping tests
git add experiments data/lab && git commit -m "lab: e02 run" && git push
```

The push deploys the site, and `/lab/e02-miss-penalty/` shows the new run. Or use the **lab** workflow in the
GitHub Actions tab (Run workflow → pick an experiment), which runs it from GitHub and commits the
results for you.

After a run, open `content/lab/<id>.md`, set `status: complete` (or `running`), and write what the
numbers say under **What I learned**, especially where the prediction was wrong.

## Rules (the short version of PLAN.md)

1. Write the prediction before running. Never edit it afterwards.
2. Report medians and percentiles; keep the raw files.
3. Heavy load only against the origin's loopback listener (E05), never through Cloudflare.
4. Don't deploy during E04 (a deploy purges the cache and ruins the measurement).
5. The origin IP never goes into a committed file. Pass it via `ORIGIN_IP`; the scripts redact it.
