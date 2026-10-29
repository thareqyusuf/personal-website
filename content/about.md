---
title: "About"
description: "Who I am, what I'm working toward, and how to reach me."
---

I'm a platform engineer in Jakarta. I work remotely for teams in Estonia, Singapore and Denmark, and most of my hours go into the parts of a Kubernetes platform that nobody notices until they fail: the network datapath (Cilium and eBPF, a CNI plugin I wrote in Go, `tc` shaping), runtime security (Falco, Tetragon), GPU scheduling for research clusters, and the databases underneath. I like problems where the answer starts with a back-of-the-envelope number and ends with a flame graph or an `ss -ti` dump.

The rest of my time goes to AI safety, and inside it to AI control. This page says why, because the why is most of what I'd want you to know.

## What I'm working toward

I don't think we can currently verify whether a model is aligned. I also don't think that lets us off the hook. Control is the part of safety that starts from that admission: assume the model might be working against you, bound what it can touch, and watch it with something cheaper than a person. The usual shape is trusted monitoring. A small model you trust reads every action a stronger model takes and gives it a score, never an action of its own, and only the actions above a budget-set threshold reach a human. Human attention is the scarce resource once agents run at scale, so almost all of the judging has to be done by weaker, cheaper models.

That rests on a load-bearing claim: that the weaker model is actually competent to judge the stronger one. Most of the field assumes it. I want to measure it. My [first project](/research/monitor-readout-loss/) asks where a weak monitor loses information it already has, because each kind of loss has a different fix, and the next ones go after the gap itself: does making the monitor check each action against each listed objective raise recall at a fixed audit budget, and can an attacker put objective-like text in front of the monitor to push its verdict? [Mechanistic interpretability](/research/) is the tool, not the goal; it's the applied end of it that I find most actionable.

The second half is the sandbox. Every control experiment needs an isolated machine the agent can be let loose in, reset in seconds, and talked to without a network. That's an infrastructure problem, and it's the one I'm best placed to solve: a Firecracker boundary, snapshot-based reset so a fleet of them is affordable, and a vsock channel for task injection, transcript capture and scoring. Building that harness is the thread that ties the day job to the research.

I know which side of the table I've chosen. Capabilities has a trend line and a business model; safety has neither, and it has to prove its worth to companies that would rather it didn't exist. I'm doing it anyway, partly because the one lever safety does have is that a private company eventually has to prove its product is reliable, and mostly because it's the side that matches what I believe. The field is also nearly unknown where I live. Mechanistic interpretability and AI safety have almost no footprint in Indonesia, and one of the things I want out of the write-ups on this site is a reason for peers here to look at them.

Right now that means three things: the monitor work above, the harness, and BlueDot Impact's Technical AI Safety course, which I started in October 2026. The long version of the why, on Indonesia adopting AI faster than anywhere else and asking the fewest questions about it, is [Adopt AI first, ask later](/blog/adopt-ai-first-ask-later/), also on [Substack](https://thareqyusuf.substack.com/p/adopt-ai-first-ask-later). The technical follow-up on control is the next piece.

The full career story is in my [CV (PDF)](/cv.pdf). The short version:

## Background

- **Now:** platform engineer at ShuffleUp Technologies in Tallinn (remote, since 2024), an eSports and online-gambling platform with 100k+ concurrent users under EU gambling regulation. I run Cilium on the production cluster (eBPF datapath, kube-proxy replacement) with L3–L7 policies around the payment and PII services, Falco and Tetragon for runtime detection, GitLab pipelines with SAST/DAST for ISO 27001, and PostgreSQL Anonymizer for data compliance.
- **Also, since 2023:** software engineer for Royal Caribbean Cruises (Asia) in Singapore, where I wrote a Kubernetes CNI plugin in Go that steers pod traffic into HTB classes so database workloads keep 100 Mbps under contention, and traced ship-to-shore sync stalls over Starlink to PMTU blackholing on the VPN tunnel (MSS clamping roughly halved the failures). And for Desupervised in Copenhagen, where I moved forecasting runs from cron to Ray Jobs on KubeRay with autoscaling spot GPU workers, and redesigned a TimescaleDB schema to take aggregate queries from 750 ms to 150 ms.
- **Before:** machine learning engineer at Telkom University's research group (2021 to 2023). I partitioned the shared DGX A100 into MIG instances scheduled through Kubernetes, replacing SSH-and-`nvidia-smi` access for 50+ researchers, and profiled stalled training runs down to dataloader and NFS I/O with the PyTorch profiler and bcc tools.
- **School:** B.Eng. in Informatics Engineering, Institut Teknologi Bandung. Thesis: an Elasticsearch-based document search engine.

## Things I keep coming back to

- Latency is not bandwidth, and p50 is not p99.
- `fsync` is usually the expensive part.
- If a design can't survive a Fermi estimate, it won't survive production.
- Reward hacking is what you get when the judge is weaker than the policy. Measure the gap before you trust the judge.
- A model's chain of thought is a fragile gift. The moment it stops being needed, it stops being honest, and we lose the best monitor we have.
- Assume you're wrong first, then try to falsify yourself. "Model not smart enough" is a finding; write it up anyway.
- Language models are grown, not designed. Psychology and neuroscience are what an incomplete science of interpretability looks like after a century. We should expect this one to take a while too.

## Ways to follow along

- **RSS:** [everything](/index.xml), or just [writing](/blog/index.xml) or the [research log](/research/index.xml). Feeds carry the full text.
- **GitHub:** I'm [@thareqyusuf](https://github.com/thareqyusuf). Comments on posts are GitHub Discussions, so replying there works too.
- **Substack:** longer essays go out at [thareqyusuf.substack.com](https://thareqyusuf.substack.com/). The first one is the why behind everything above.
- **CV:** [thareq-yusuf-cv.pdf](/cv.pdf).
- **Email:** I read everything and answer slowly. The addresses are below; decoding them is the spam filter. If you work on control, monitoring or sandboxing anywhere near Southeast Asia, I especially want to hear from you.

{{< b64 >}}

The [colophon](/colophon/) explains how this site is built and served, including the numbers at the bottom of every page.
