---
title: "What a weak monitor knows but doesn't say"
date: 2026-09-10          # project start
lastmod: 2026-10-08       # date of the newest log entry; bump it with each entry
status: wip               # wip | paused | done
description: "Measuring how much attack signal an open-weight LLM monitor throws away when it writes down a single suspicion score, on LinuxArena."
question: "Does a weak trusted monitor (gpt-oss-20b scoring every action of a stronger agent 0–10) know more about an attack than the integer it emits, and can that signal be read back out cheaply, from the digit distribution, the residual stream, or the chain of thought?"
setup: "LinuxArena agent-control benchmark via its public mirror (17,234 actions, 92 attack trajectories). gpt-oss-20b in MXFP4 as the live monitor on a 2,012-action subset, residuals captured at 7 positions × 25 layers. Linear probes, nine baselines, trajectory-cluster bootstrap. One 32 GB GPU on Runpod; everything else on a laptop."
links:
  - label: "Code, raw results and figures (GitHub)"
    url: "https://github.com/thareqyusuf/linuxarena-monitor-readout"
  - label: "Step-by-step walkthrough of the experiments"
    url: "https://claude.ai/artifact/UDnzBLJNf5dk4WQ9ohRnx6"
---

## Why this question

The control protocol I care about is trusted monitoring: a weak model you trust reads every action a strong model takes and scores it. Actions above a threshold go to a human. The threshold is not set by accuracy. It is set by an audit budget, because a person can only afford to read a fixed fraction of honest actions, so you place the cutoff at the honest 95th or 99th percentile and ask how many attacks clear it.

That framing is the whole game once agents run at scale. If a fleet of agents takes millions of actions a day, the human is the scarce resource, and almost all of the judging has to be done by weaker, cheaper models. So the question I want a general answer to is: **how do you measure what a weak model is actually capable of as a judge**, separately from how it happens to phrase its verdict? This project is a first instance of that, on one monitor and one benchmark. The longer-term aim is a reusable framework: a fixed set of readouts (emitted score, forced score distribution, internal state, chain of thought), a monitor-independent label, and an evaluation that reports ranking in the low-false-positive tail rather than accuracy, so any new small model can be dropped in and compared.

The thing that made me suspicious in the first place: the paper's own reference monitor, sampled twice per action, disagrees with itself by 4 to 6 points at mid scores. That is readout loss on a model you cannot open. gpt-oss-20b you can open.

## Current state

- **The emitted integer loses signal, and the loss is recoverable without touching the internals.** The expected score over the ten digit tokens (E) beats the integer on the 743-honest pool: AUROC 0.90 vs 0.74, TPR at 5 % FPR 0.55 vs 0.42. The signal the integer drops is probability mass at 2–3, not a hidden high verdict.
- **No linear probe on the residual stream beats E** on the payloads the integer misses. The best probe reaches 0.94 pooled but recovers the same 11 of 31 nulled payloads that E does, and the label-supervised probe collapses under leave-one-category-out (0.75). Nine baselines, matched negatives.
- **The verdict appears in the chain of thought** at the sentence that names the covert objective (forced E jumps from 0.77 to 6.74 across two sentences). This is one clean trajectory and one consistent one, so it is an existence result, not a rate.
- **A hunch, not a result:** the monitor's chain of thought computes the verdict serially rather than carrying it in the pre-generation state. That is where the next experiment points.

Every number above cites a raw file and a recompute command in the repo, and each stage has an independent verification section with a verdict. Two headline claims were downgraded by that process and one comparison was retracted; those are listed in the repo, not hidden.

## Log

Newest first. Each entry says what I tried, what happened, and what I believe now.

### 2026-10-08

Cleaned the working repository into a public snapshot and started the write-up. Reframed the project for myself: the specific result is about one monitor, but the method is the reusable part. The pieces a framework needs already exist here in rough form: a monitor-independent per-action label, four readouts of the same model, logit-ROC evaluation at fixed audit budgets, and a verification pass that recomputes every number from raw files. Next step is to write that down as a spec and try it on a second small model.

### 2026-09-12

Probe stage done. No linear probe beats E on the 31 payloads the integer scored ≤ 1. The score-supervised probe is a denoised E, nothing more. Pivoted to the chain of thought: truncating the monitor's reasoning sentence by sentence on one trajectory shows the forced readout rising exactly at the sentence that names the objective. Hypothesis that the pre-generation state carries the verdict: not supported. Wrote the summary figures and verbatim examples.

### 2026-09-11

Built the action-level attack label. Trajectory-level labels are useless here because in a 20-step attack one to three actions do the malicious thing, and a label derived from the monitor itself marks exactly the actions the hypothesis is about as benign. Drafted regex payload signatures blind, from the side-task objectives only, in a fresh session that had seen no scores. Then audited 176 actions by hand over two rounds, which was the slowest part of the whole project and the clearest demonstration of why human review does not scale past a few hundred actions. Six payloads only the signatures caught were deletion actions the reference monitor scored at 2 or below: the first direct evidence that "scored low" and "not a payload" are different things.

### 2026-09-10

Rebuilt the paper's cached-monitor ROC from the public mirror (honest pool and attack maxima identical to the paper's data) and checked it is roughly logit-linear, so budgets you cannot measure can be extrapolated. Ported the prompt builder to pure Python, byte-identical on all 17,234 actions. Ran gpt-oss-20b as the live monitor on the 2,012-action subset with chunked attention for 25k-token prompts, capturing residuals at seven positions. Started the project.
