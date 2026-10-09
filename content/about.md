---
title: "About"
description: "Who I am, what I work on, and how to reach me."
---

<!-- TODO: drafted from cv-infra.pdf; tune the voice. Facts and numbers are from the CV. -->

I'm a platform engineer in Jakarta. I work remotely for teams in Estonia, Singapore and Denmark, and most of my hours go into the parts of a Kubernetes platform that nobody notices until they fail: the network datapath (Cilium and eBPF, a CNI plugin I wrote in Go, `tc` shaping), runtime security (Falco, Tetragon), GPU scheduling for research clusters, and the databases underneath. I like problems where the answer starts with a back-of-the-envelope number and ends with a flame graph or an `ss -ti` dump.

On the side, I do [mechanistic interpretability](/research/) research. I want to know what a language model is actually computing, in the same way I'd want to know what a kernel is actually doing when a p99 spikes. The research log is where I keep work in progress, mistakes included.

The full story is in my [CV (PDF)](/cv.pdf). The short version:

## Background

- **Now:** platform engineer at ShuffleUp Technologies in Tallinn (remote, since 2024), an eSports and online-gambling platform with 100k+ concurrent users under EU gambling regulation. I run Cilium on the production cluster (eBPF datapath, kube-proxy replacement) with L3–L7 policies around the payment and PII services, Falco and Tetragon for runtime detection, GitLab pipelines with SAST/DAST for ISO 27001, and PostgreSQL Anonymizer for data compliance.
- **Also, since 2023:** software engineer for Royal Caribbean Cruises (Asia) in Singapore, where I wrote a Kubernetes CNI plugin in Go that steers pod traffic into HTB classes so database workloads keep 100 Mbps under contention, and traced ship-to-shore sync stalls over Starlink to PMTU blackholing on the VPN tunnel (MSS clamping roughly halved the failures). And for Desupervised in Copenhagen, where I moved forecasting runs from cron to Ray Jobs on KubeRay with autoscaling spot GPU workers, and redesigned a TimescaleDB schema to take aggregate queries from 750 ms to 150 ms.
- **Before:** machine learning engineer at Telkom University's research group (2021 to 2023). I partitioned the shared DGX A100 into MIG instances scheduled through Kubernetes, replacing SSH-and-`nvidia-smi` access for 50+ researchers, and profiled stalled training runs down to dataloader and NFS I/O with the PyTorch profiler and bcc tools.
- **School:** B.Eng. in Informatics Engineering, Institut Teknologi Bandung. Thesis: an Elasticsearch-based document search engine.

## Things I keep coming back to

- Latency is not bandwidth, and p50 is not p99.
- `fsync` is usually the expensive part.
- If a design can't survive a Fermi estimate, it won't survive production.

## Ways to follow along

- **RSS:** [everything](/index.xml), or just [writing](/blog/index.xml) or the [research log](/research/index.xml). Feeds carry the full text.
- **GitHub:** I'm [@thareqyusuf](https://github.com/thareqyusuf). Comments on posts are GitHub Discussions, so replying there works too.
- **CV:** [thareq-yusuf-cv.pdf](/cv.pdf).
- **Email:** I read everything and answer slowly. The addresses are below; decoding them is the spam filter.

{{< b64 >}}

The [colophon](/colophon/) explains how this site is built and served, including the numbers at the bottom of every page.
