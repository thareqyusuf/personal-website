---
title: "Now"
layout: "now"
date: 2026-10-29
description: "What I'm focused on this month."
# Rows here also render on the home page. Keep each `what` to one line.
# status (optional): wip | paused | done
focus:
  - area: Research
    what: "AI control: how much attack signal a weak LLM monitor throws away when it writes down one score"
    link: /research/monitor-readout-loss/
    status: wip
  - area: Harness
    what: "A sandbox for control experiments: Firecracker isolation, snapshot reset, vsock in and out, no network"
  - area: Learning
    what: "BlueDot Impact's Technical AI Safety course, October 2026 cohort"
  - area: Writing
    what: "*Adopt AI first, ask later* is out, here and on Substack; next, the technical piece on AI control"
    link: /blog/adopt-ai-first-ask-later/
    status: done
  - area: Work
    what: "Cilium network policy and Falco/Tetragon runtime detection on a regulated gambling platform"
  - area: Building
    what: "This site: nginx origin behind Cloudflare, with live latency in the footer"
    link: /colophon/
---

This page is a snapshot of what has my attention right now. It changes every month or so; the date above says when it last did.

**Research.** The monitor project has its results and is being written up; the open thread is whether the monitor's verdict is computed serially in its chain of thought or already sitting in the state before it starts writing. Two follow-ups are queued: does checking each action against each listed objective raise recall at a fixed audit budget, and can an attacker plant objective-like text to push the verdict. One limitation I now take seriously: the attack policy in these setups is elicited by prompting, and prompting is fragile, so part of any result is the prompt.

**Harness.** Every control evaluation needs an isolated machine an agent can be let loose in, reset in seconds, and reached without a network. I'm scoping it in three pieces: the isolation boundary (Firecracker, and what attacks it), fast reset at scale (incremental snapshots and checkpoint/restore, which is what makes a fleet affordable), and a host-to-guest channel over vsock for task injection, transcript capture and scoring. Reading KVM internals first; building second.

**Learning.** BlueDot's cohort started on 26 October. First lesson learned had nothing to do with alignment: a month of writing made me able to think about this field, and none of it came out in the first live discussion. Prepping out loud from now on.

**Writing.** [*Adopt AI first, ask later*](/blog/adopt-ai-first-ask-later/) went up on 24 October, on [Substack](https://thareqyusuf.substack.com/p/adopt-ai-first-ask-later) first and now here. Indonesia reports the highest workplace use of generative AI in the world and sits in the region that trusts most that it will be regulated well; I was part of that number for most of my career, and the essay is about why nobody here, including me, was ever required to ask why. It ends with one line about AI control and a promise that the next piece gets technical. That's the one I'm writing now.
