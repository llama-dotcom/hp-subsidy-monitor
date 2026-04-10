# insight-map.com — Multi-Project Architecture

This document explains how AI_Landscape (and any future project) is integrated into the `insight-map.com` infrastructure.

## TL;DR

`insight-map.com` is **one Vercel project** + **one GitHub repo** that hosts **multiple sub-sites** at different URL paths. Each sub-site has its own Groq key and Supabase project, but shares the same domain and deployment pipeline.

## Per-service decisions

| Service | HP_Subsidy (existing) | AI_Landscape (new) | Decision |
|---|---|---|---|
| **GitHub** | repo `insight-map-site/heat-pumps/hp-subsidy-monitor/` | same repo, folder `ai/ai-landscape/` | one monorepo, separate subfolders |
| **Vercel** | one project `insight-map` | same project | one Vercel = one domain |
| **Domain** | `insight-map.com/heat-pumps/...` | `insight-map.com/ai/ai-landscape/` | one domain, different paths |
| **Groq API key** | `hp-monitor` | NEW key: `ai-landscape` | separate keys = separate cost tracking |
| **Supabase** | existing project `hp-monitor` | NEW project `ai-landscape` | separate = clean data isolation |
| **Cron** | `/api/update` daily 06:00 UTC | `/api/ai-landscape-update` daily 07:00 UTC | different endpoints, staggered times |

## Why this pattern

- **One domain** → simpler DNS, SSL, branding
- **One Vercel project** → one deployment pipeline, one billing line
- **Per-project Groq + Supabase** → clean cost tracking, scale independently, no data leakage between projects
- **Staggered crons** → no API rate-limit collisions

## How to add a new project

1. Pick the URL path: `insight-map.com/<category>/<slug>/` (kebab-case)
2. Create folder in `insight-map-site/<path>/` with all static files
3. Manually create:
   - **Groq API key** named after the project (in Groq console)
   - **Supabase project** named after the project (in Supabase dashboard)
4. Add Vercel env vars (project-prefixed):
   - `GROQ_API_KEY_<PROJECT>`
   - `SUPABASE_URL_<PROJECT>`
   - `SUPABASE_SERVICE_KEY_<PROJECT>`
5. Create cron handler at `api/<project>-update.js` reading those env vars
6. Add cron schedule to `vercel.json` (staggered time to avoid collisions)
7. Push → Vercel auto-deploys in 30-60s

## What NOT to do

- ❌ Separate Vercel projects per sub-site (would need separate domains)
- ❌ Share Groq keys across projects (impossible to track costs per project)
- ❌ Mix tables from different projects in one Supabase (confusing dashboard, harder backups)
- ❌ Run all crons at the same minute (rate-limit collisions)
- ❌ Put project files at the repo root (would conflict with infra files like `vercel.json`)

---

*Reference: this same architecture description is also stored in Claude's memory at `~/.claude/projects/-Users-aleksandra/memory/reference_insight_map_architecture.md`*
