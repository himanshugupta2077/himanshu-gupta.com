---
title: "Signed. Verified. Malicious."
description: "A technical postmortem on how a six-minute npm release window: exploiting pull_request_target, pnpm cache poisoning, and OIDC trusted publishing, compromised 42 @tanstack packages and spread malware across the JavaScript ecosystem without ever stealing a single credential."
date: 16 May 2026
tags: ["supply-chain", "npm", "ci-cd", "github-actions", "security"]
featured: true
---

# Signed. Verified. Malicious.

*How a six-minute npm release window turned half the ecosystem into a credential stealer.*

---

On May 11, 2026, an attacker pushed 84 malicious package versions across 42 `@tanstack/*` packages. No stolen credentials. No leaked tokens. No phishing. The packages were published by TanStack's own release pipeline, using valid OIDC trusted publishing and legitimate SLSA provenance.

That last sentence is the one worth sitting with.

Within hours, the malware had spread to packages from Mistral AI, UiPath, OpenSearch, DraftLab, Squawk, and a growing list of secondary victims: some sitting in dependency trees that get installed millions of times a week. The window of active exploitation was roughly six minutes. That was enough.

---

## The chain

This wasn't one bug. It was several trust assumptions that each looked fine in isolation, until someone lined them up and pushed.

The full sequence: `pull_request_target`, GitHub Actions cache poisoning, poisoned pnpm cache reuse, OIDC token extraction from runner memory, trusted publishing, valid Sigstore/SLSA attestations.

TanStack's postmortem describes it clearly. The attacker opened a PR from a fork using `pull_request_target`. That trigger matters because it executes in the security context of the *base* repository, not the fork. Then this:

```yaml
on:
  pull_request_target:

jobs:
  benchmark-pr:
    steps:
      - uses: actions/checkout@v6.0.2
        with:
          ref: refs/pull/${{ github.event.pull_request.number }}/merge

      - run: pnpm nx run @benchmarks/bundle-size:build
```

That checkout line is where the trust boundary breaks. Fork-controlled code ends up executing inside the base repository's CI context. The payload didn't immediately exfiltrate anything: it poisoned the pnpm cache instead, then waited.

---

## Cache poisoning crossed the trust boundary quietly

The attacker precomputed the exact cache key the release workflow would use:

```
Linux-pnpm-store-6f9233a50def742c09fde54f56553d6b449a535adf87d4083690539f49ae4da11
```

A poisoned artifact was stored under that key. Hours later, a legitimate merge into `main` triggered the real release workflow. The release workflow restored the poisoned cache. At that point, attacker-controlled binaries were executing inside the release job itself.

No maintainer interaction. No approval step. No credential theft beforehand. Just cache state reused across trust domains.

This is worth naming directly: a lot of teams still treat CI caches as a performance detail rather than a security boundary. They are absolutely a security boundary. This incident is a clean illustration of what happens when they're not treated as one.

---

## The runner memory scraping is the real escalation

Once the poisoned binaries were running inside the release job, the malware scraped GitHub runner process memory directly via `/proc/<pid>/mem` against `Runner.Worker`:

```python
with open(f"/proc/{pid}/mem", 'rb', 0) as mem_f:
```

It then searched memory for GitHub Actions secret structures:

```bash
grep -aoE '"[^"]+":{"value":"[^"]*","isSecret":true}'
```

This means log masking becomes largely irrelevant once arbitrary code runs inside the same runner namespace. That fundamentally changes the threat model. Most orgs are still asking "can this workflow access the secret?" The real question is "can any process on this runner inspect memory?" Those are different problems, and the second one is much harder. The same general technique appeared in the `tj-actions/changed-files` incident and earlier Shai-Hulud waves.

---

## The packages were legitimately signed

This is probably the part with the longest tail.

The malicious artifacts carried valid SLSA provenance. The attestations were real. The workflow identity was real. The OIDC exchange was real. Sigstore verified exactly what it was supposed to verify: because the pipeline itself had already been compromised before publish happened.

There's a persistent misunderstanding in supply chain conversations where provenance gets treated as a signal that a package is safe. It isn't. Provenance means *this package came from this pipeline*. Those two things are not equivalent, and this incident is a precise demonstration of why.

---

## `router_init.js`

Every compromised tarball contained a large obfuscated payload named `router_init.js`: around 2.3 MB, single-line blob, not listed in the package `files` field. The published tarball had been modified outside the expected build output.

Each package also received an injected dependency:

```json
"optionalDependencies": {
  "@tanstack/setup": "github:tanstack/router#79ac49eedf774dd4b0cfa308722bc463cfe5885c"
}
```

That GitHub URL looked legitimate: GitHub exposes commit objects across fork networks through the parent repository namespace. The commit actually originated from the attacker's fork. Easy to miss on a quick glance. Not easy to miss if you know to look for it.

---

## The Bun usage was deliberate

The payload executed through Bun rather than Node:

```json
{
  "scripts": {
    "prepare": "bun run tanstack_runner.js && exit 1"
  }
}
```

A lot of Node-focused monitoring products hook into Node execution paths. Bun sidesteps some of that visibility. The `&& exit 1` is also intentional: the dependency appears to fail normally, install logs stay noisy but unremarkable, and by the time that's happening, the payload has already detached and is running in the background.

The malware daemonized itself immediately using detached child processes and `unref()` semantics. By the time developers noticed install failures, the process was already persistent.

---

## Persistence moved into developer tooling

The worm wrote itself into:

```
.claude/settings.json
.vscode/tasks.json
```

Uninstalling the npm package does essentially nothing. Opening VS Code again can retrigger execution. Opening Claude Code again can retrigger execution.

The payload specifically targeted AI tooling state: Claude configs, MCP settings, session history, local tool integrations. That's not opportunistic harvesting. That's deliberate targeting of developer workflow infrastructure. MCP configs in particular can function as both persistence vectors and lateral movement vectors on their own.

---

## The exfiltration path avoided obvious infrastructure

The malware didn't rely entirely on attacker-controlled C2. It used GitHub GraphQL mutations, Session Protocol infrastructure, dead-drop commits, Dependabot-style branch names, and Claude bot impersonation. Some commit patterns:

```
dependabot/github_actions/format/fremen
dependabot/github_actions/format/atreides
```

The Dune references are scattered throughout. Commit author spoofing was also deliberate:

```
claude@users.noreply.github.com
```

That blends into repositories already saturated with AI-generated commits. Not sophisticated cryptography: just operational camouflage, and it worked well enough.

---

## The dead man's switch

One payload branch installed a token monitor service called `gh-token-monitor.service`. It polled GitHub continuously. If the stolen token was revoked, the payload triggered destructive behavior. Some variants referenced `rm -rf ~/`; others appeared to include broader wipe logic depending on environment and locale checks.

This created an unusual remediation problem: revoking credentials too early could trigger destructive behavior before the host was isolated. Most IR playbooks don't account for that scenario.

---

## SLSA didn't fail

This framing keeps appearing in coverage of the incident, and it's wrong.

SLSA didn't fail. OIDC didn't fail. Sigstore didn't fail. The workflow executed attacker-controlled artifacts before the publish step. The trust boundary had already collapsed. The attestation was accurate: it accurately described a pipeline that had been compromised.

A valid attestation can still describe a malicious artifact when the pipeline itself is compromised during execution. Provenance without runtime isolation isn't sufficient. That's the uncomfortable conclusion here.

---

## The actual lesson

Most organizations still treat these as separate security boundaries: CI runners, caches, package registries, provenance, editor tooling, lifecycle scripts, trusted publishing, AI agent configs.

This incident showed they effectively operate as one trust domain once arbitrary code executes on the runner. And modern JavaScript ecosystems execute arbitrary code constantly: especially during install.

---

## Things that matter now

The standard recommendations still hold:

- Stop using `pull_request_target` with fork-controlled execution
- Isolate caches aggressively between trust domains
- Separate build and publish runners
- Introduce cooldown windows for new package versions
- Disable lifecycle scripts where possible
- Restrict network egress during builds
- Treat CI runners as disposable
- Assume dependency installation is code execution

Realistically, most projects still optimize CI for speed before isolation. Which means cache poisoning is going to keep working. Just with different payloads.