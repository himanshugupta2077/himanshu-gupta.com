---
title: "Anatomy of a Phishing Infrastructure"
description: "How modern phishing campaigns build, rotate, and operate infrastructure that survives enterprise defenses. A breakdown of real operational patterns."
date: 2025-11-15
tags: ["phishing", "infrastructure", "red-team", "evasion"]
featured: true
---

Most phishing write-ups describe the bait. This covers the plumbing.

A well-designed phishing infrastructure has three properties:
- **Resilient** — not dependent on a single domain or IP
- **Believable** — infrastructure metadata matches the pretext
- **Invisible** — it looks like legitimate traffic to proxies and SWGs

This is how you build that.

## The Stack

A modern phishing infrastructure is not a single server. It's a pipeline:

```
Lure URL → Redirector → Backend → Payload / Credential Harvester
```

Each layer serves a specific purpose. Each layer can be burned independently without losing the campaign.

### Layer 1: Lure Domains

The domain the target clicks. Requirements:
- Aged 30+ days (fresh domains fail Alexa/Tranco scoring checks)
- Categorized as benign (business, technology, finance)
- Valid SSL cert (Let's Encrypt is fine, but EV increases trust)
- Matching WHOIS, MX records, and SPF/DKIM/DMARC

The domain itself is disposable. Burn it after the campaign.

### Layer 2: Redirectors

The middle layer that separates your lure from your backend. This is the most important layer for operational security.

Redirectors serve multiple purposes:
1. Mask the backend infrastructure
2. Implement geofencing and user-agent filtering
3. Log hits without exposing capabilities
4. Redirect non-targets to a legitimate site (reduces burn rate)

A simple Apache `.htaccess` redirector:

```apache
RewriteEngine On
RewriteCond %{HTTP_USER_AGENT} "curl|python|wget|scanner" [NC]
RewriteRule ^(.*)$ https://microsoft.com/ [L,R=302]

RewriteCond %{HTTP_REFERER} !^https://target-company\.com [NC]
RewriteRule ^(.*)$ https://microsoft.com/ [L,R=302]

RewriteRule ^(.*)$ https://backend.internal/$1 [P,L]
```

This bounces scanners and misses to a benign site, and proxies real targets to the backend.

### Layer 3: Backend

The credential harvester or payload delivery server. This should:
- Never be directly reachable from the public internet
- Only accept connections from known redirectors
- Log everything (IPs, user agents, form submissions)

For credential harvesting, [Evilginx3](https://github.com/kgretzky/evilginx2) with custom phishlets handles real 2FA bypass via adversary-in-the-middle.

## Operational Failures

Most campaigns get burned not through detection of the lure, but through:

1. **Infrastructure reuse** — same IP range across campaigns
2. **Timing correlation** — all infrastructure spun up at the same time
3. **Metadata leakage** — default server headers, default Nginx pages on unused ports
4. **No geofencing** — red team phishing infrastructure scanned from threat intel platforms

## What Actually Matters

Technical controls are one layer. The real evasion is operational:

- Build infrastructure in stages (age domains before use)
- Use different providers for each layer
- Automate teardown on campaign completion
- Monitor your own infrastructure with shodan to see what's exposed

The goal is that by the time anyone investigates the lure URL, the trail is cold.
