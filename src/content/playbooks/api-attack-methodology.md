---
title: "API Attack Methodology"
description: "A structured approach to attacking REST and GraphQL APIs. From discovery and authentication bypass to business logic exploitation and mass assignment."
date: 2025-09-10
tags: ["API", "methodology", "web", "testing"]
featured: true
---

APIs are the most interesting attack surface in modern web applications. They're less audited than UI flows, they expose raw business logic, and authorization failures are endemic.

> This is the methodology I use.

## Phase 1: Discovery and Mapping

Before testing, understand what you're looking at.

**Enumerate endpoints:**
- `robots.txt`, `sitemap.xml`, JavaScript source files
- Swagger/OpenAPI specs — often exposed at `/api/docs`, `/swagger`, `/openapi.json`
- GraphQL introspection: `{ __schema { types { name } } }`
- Mobile app APKs — decompile with `jadx`, grep for API routes and keys

**Map authentication:**
- What scheme? JWT, API key, session cookie, OAuth?
- Where are tokens passed? Headers, query params, cookies?
- Are there unauthenticated endpoints?

**Map objects:**
- What resource types exist? Users, orders, files, orgs?
- What identifiers are used? Sequential IDs, UUIDs, slugs?
- Are nested resources accessible independently?

## Phase 2: Authentication and Authorization

This is where most findings live.

### Broken Object-Level Authorization (BOLA/IDOR)

The most common API vulnerability. A user can access objects belonging to other users by manipulating the object identifier.

Test every parameter that references an object:

```http
GET /api/v1/users/1337/invoices HTTP/1.1
Authorization: Bearer <your_token>
```

Can you replace `1337` with another user's ID? Can you access `/api/v1/admin/users`?

Test all HTTP methods:
```bash
for method in GET POST PUT PATCH DELETE; do
  curl -X $method https://target.com/api/v1/users/1337 -H "Authorization: Bearer $TOKEN"
done
```

### Broken Function-Level Authorization (BFLA)

Regular users accessing admin-only functionality.

Look for:
- Admin endpoints in JavaScript (`/api/admin/`, `/api/internal/`)
- Role parameters in requests: `"role": "user"` → try `"role": "admin"`
- Privileged actions with `?admin=true` or similar bypass params

### JWT Attacks

```bash
# Test algorithm confusion (RS256 → HS256)
# Decode the token
echo "$TOKEN" | cut -d'.' -f2 | base64 -d | jq .

# Test "none" algorithm
python3 -c "
import base64, json
header = base64.b64encode(json.dumps({'alg':'none','typ':'JWT'}).encode()).decode().rstrip('=')
payload = base64.b64encode(json.dumps({'sub':'1','role':'admin'}).encode()).decode().rstrip('=')
print(f'{header}.{payload}.')
"
```

## Phase 3: Business Logic

Understanding the intended flow is required to break it intelligently.

**Mass assignment:**
Submit unexpected fields in POST/PUT requests:

```http
PATCH /api/v1/users/me HTTP/1.1
Content-Type: application/json

{
  "email": "me@example.com",
  "role": "admin",
  "credits": 99999,
  "verified": true
}
```

Which fields get applied? The response and subsequent GET requests reveal the answer.

**Rate limiting:**
- No rate limit on authentication endpoints
- No rate limit on OTP/2FA submission
- Account enumeration via response timing or error differentiation

**State manipulation:**
- Skip workflow steps (payment, verification)
- Replay transactions
- Negative quantities, overflow values

## Phase 4: Injection and Data Exposure

**NoSQL injection:**
```json
{"username": {"$gt": ""}, "password": {"$gt": ""}}
```

**GraphQL-specific:**
```graphql
# Batching to bypass rate limits
[
  {"query": "mutation { login(user: \"admin\", pass: \"pass1\") { token } }"},
  {"query": "mutation { login(user: \"admin\", pass: \"pass2\") { token } }"}
]

# Deep introspection for hidden fields
{ __type(name: "User") { fields { name description } } }
```

**Excessive data exposure:**
API returns all fields, UI filters. Access the raw API response. What's in the response that the UI doesn't show?

## Output Format

For each finding:

| Field | Content |
|---|---|
| Endpoint | `GET /api/v1/users/{id}` |
| Vulnerability | BOLA — access to other users' data |
| Impact | Access to PII, financial data |
| Proof | Request/response pair |
| Remediation | Enforce object ownership in server-side auth |

## Tools

- **Burp Suite** — primary proxy and active scanner
- **Caido** — lightweight alternative, good for API work
- **ffuf** — endpoint brute force
- **nuclei** — template-based detection
- **jwt_tool** — JWT attack automation
- **graphql-cop** — GraphQL security testing
