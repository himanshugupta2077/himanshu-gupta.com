---
title: "recon-ai"
description: "AI-augmented reconnaissance framework. Adapts scan depth and technique selection based on target fingerprint. Built for complex, multi-scope environments."
date: 2025-10-20
tags: ["recon", "automation", "AI", "tooling", "python"]
featured: true
github: "https://github.com/himanshugupta2077/recon-ai"
---

## Problem

Manual recon doesn't scale. Static scripts miss context. Existing frameworks are built around checkbox completion, not decision-making.

When you're operating against a large scope — hundreds of subdomains, mixed cloud and on-prem, varying tech stacks — the biggest cost is not running tools. It's deciding **which tools to run, on which targets, in what order**.

That's a reasoning problem. Which is now solvable with LLMs.

## What It Does

`recon-ai` wraps a modular recon pipeline with an LLM decision layer that:

1. Fingerprints the target (tech stack, infrastructure, exposure)
2. Selects relevant modules based on the fingerprint
3. Runs scans, parses output, feeds results back into context
4. Generates prioritized findings with suggested next steps

The result is adaptive recon that behaves like a senior engineer triaging scope — not a script running everything in sequence.

## Architecture

```
Target Input
     │
     ▼
Fingerprinting Layer
  ├── DNS enumeration (subfinder, dnsx)
  ├── Port scanning (naabu)
  └── Tech detection (httpx, wappalyzer)
     │
     ▼
LLM Decision Layer (GPT-4o / local Ollama)
  ├── Parse fingerprint output
  ├── Select next module set
  └── Generate hypotheses
     │
     ▼
Execution Layer
  ├── Web scanning (nuclei, custom templates)
  ├── Cloud checks (S3, Azure blobs, GCP)
  ├── API endpoint discovery
  └── Auth surface mapping
     │
     ▼
Output: Prioritized findings + reasoning trace
```

## Key Design Decisions

**Why not just chain tools?**
Chaining tools produces noise. The LLM layer adds a triage step that would otherwise require manual review. It's not replacing expertise — it's applying it at scale.

**Why expose the reasoning trace?**
Operational transparency. You need to understand why a finding was flagged, not just that it was. The trace is as valuable as the finding itself.

**Why modular?**
Real engagements don't use every module. A modular design means the framework stays fast and the LLM has fewer choices to reason about per step.

## Usage

```bash
# Basic scan
python recon-ai.py --target example.com --mode adaptive

# With custom LLM endpoint
python recon-ai.py --target example.com --llm-endpoint http://localhost:11434 --model llama3

# Scope file
python recon-ai.py --scope scope.txt --mode aggressive --output ./results/
```

## Status

Active development. Core pipeline stable. LLM decision layer being refined with real engagement data.

Templates and prompt engineering are open — contributions welcome if you have signal to add.
