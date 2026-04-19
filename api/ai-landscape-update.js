// ============================================
// AI Landscape — Daily Cron Handler (Full Automation)
// Schedule: 0 7 * * * (07:00 UTC = 09:00 Berlin CEST)
//
// DAILY: news via Google RSS + light model-release check via Groq
// WEEKLY (Monday): full system refresh + new events discovery via Groq
// ALWAYS: clean past events (>30d) and old news (>60d)
// ============================================

const Groq = require('groq-sdk');

// In-memory IP rate limiter (survives warm invocations on same instance)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MAX = 2; // max 2 requests per IP per 5 minutes

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  entry.count++;
  rateLimitStore.set(ip, entry);
  // Cleanup old entries (prevent memory leak)
  if (rateLimitStore.size > 1000) {
    for (const [k, v] of rateLimitStore) if (now > v.resetAt) rateLimitStore.delete(k);
  }
  return {
    ok: entry.count <= RATE_LIMIT_MAX,
    remaining: Math.max(0, RATE_LIMIT_MAX - entry.count),
    resetIn: Math.ceil((entry.resetAt - now) / 1000),
  };
}

module.exports = async function handler(req, res) {
  const startTime = Date.now();
  const results = { systems_updated: 0, systems_added: 0, events_added: 0, events_cleaned: 0, errors: [] };

  try {
    // Auth: accept Vercel Cron OR valid Bearer token (if CRON_SECRET set)
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    const cronSecret = process.env.CRON_SECRET_AI_LANDSCAPE;
    const authHeader = req.headers.authorization;
    const hasValidSecret = cronSecret && authHeader === `Bearer ${cronSecret}`;

    // Public refresh path: rate-limit by IP
    if (!isVercelCron && !hasValidSecret) {
      const ip = req.headers['x-forwarded-for']?.split(',')[0].trim()
              || req.headers['x-real-ip']
              || 'unknown';
      const rl = checkRateLimit(ip);
      res.setHeader('X-RateLimit-Remaining', rl.remaining);
      res.setHeader('X-RateLimit-Reset', rl.resetIn);
      if (!rl.ok) {
        return res.status(429).json({ error: 'rate_limited', retry_in_seconds: rl.resetIn });
      }
    }

    const SUPABASE_URL = process.env.SUPABASE_URL_AI_LANDSCAPE;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY_AI_LANDSCAPE;
    const GROQ_KEY = process.env.GROQ_API_KEY_AI_LANDSCAPE;
    if (!SUPABASE_URL || !SUPABASE_KEY || !GROQ_KEY) {
      return res.status(500).json({ error: 'internal_error' });
    }

    const sbH = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };
    const groq = new Groq({ apiKey: GROQ_KEY });
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const year = today.getFullYear();
    // Always do full refresh (triggered manually via Refresh button)
    const isFullRefresh = true;

    // Helper: ask Groq, parse JSON
    // model: 'big' (70b, complex tasks) or 'fast' (8b, high-volume simple tasks)
    async function askGroq(prompt, maxTokens = 4000, size = 'big') {
      const modelMap = { big: 'llama-3.3-70b-versatile', fast: 'llama-3.1-8b-instant' };
      const model = modelMap[size] || modelMap.big;
      const c = await groq.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      });
      return JSON.parse(c.choices[0].message.content);
    }

    // Helper: Supabase upsert
    async function upsert(table, rows, conflictCol = 'id') {
      if (!rows || rows.length === 0) return;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflictCol}`, {
        method: 'POST',
        headers: { ...sbH, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      });
      if (!r.ok) throw new Error(`upsert ${table}: HTTP ${r.status} ${await r.text()}`);
    }

    // ============================================
    // 1. SYSTEMS — model releases check
    // ============================================
    try {
      const existingR = await fetch(`${SUPABASE_URL}/rest/v1/ai_systems?select=id,name,type,latest_model,pricing,estimated_users,market_position,description&order=type.asc,market_position.asc`, { headers: sbH });
      const existing = await existingR.json();

      const dailyPrompt = `You track the AI landscape. Today is ${todayISO}.

Current systems (${existing.length}):
${existing.map(s => `- ${s.name} (${s.type}): latest_model="${s.latest_model || 'n/a'}"`).join('\n')}

Based on your knowledge through ${todayISO}, have any of these systems released a NEW flagship model in the last 7 days?

Reply with JSON: {"updates": [{"id": "system_id", "latest_model": "new model name"}], "notes": "summary"}
If nothing changed, return {"updates": [], "notes": "no changes"}.
Only report changes you are confident about. Do NOT speculate.`;

      const daily = await askGroq(dailyPrompt, 2000);
      for (const u of (daily.updates || [])) {
        if (!u.id || !u.latest_model) continue;
        await fetch(`${SUPABASE_URL}/rest/v1/ai_systems?id=eq.${u.id}`, {
          method: 'PATCH', headers: sbH,
          body: JSON.stringify({ latest_model: u.latest_model, updated_at: new Date().toISOString() }),
        });
        results.systems_updated++;
      }
    } catch (e) { results.errors.push(`daily systems: ${e.message}`); }

    // ============================================
    // 3. WEEKLY (Monday): full system refresh + new systems + events
    // ============================================
    if (isFullRefresh) {
      // 3a. Full system data refresh
      try {
        const existingR = await fetch(`${SUPABASE_URL}/rest/v1/ai_systems?select=*&order=type.asc,market_position.asc`, { headers: sbH });
        const existing = await existingR.json();
        const summary = existing.map(s => `${s.id}|${s.name}|${s.type}|${s.latest_model || ''}|${s.pricing?.pro_price || ''}|${s.estimated_users || ''}`).join('\n');

        const weeklyPrompt = `You are an AI industry analyst. Today is ${todayISO}.

Here are the ${existing.length} AI systems we track:
ID|Name|Type|LatestModel|ProPrice|EstUsers
${summary}

Reply with JSON. Provide updates for ANY field that has changed since these systems were first added. Be thorough — this is a comprehensive refresh.

Tasks:

1. "pricing_updates": [{"id": "xxx", "pricing": {"free_tier": bool, "free_details": "...", "pro_price": "$X/mo", "enterprise": bool}}]

2. "user_updates": [{"id": "xxx", "estimated_users": "new count"}]

3. "description_updates": [{"id": "xxx", "description": "new 2-sentence description"}] — only on MAJOR changes (acquisition, pivot, rebrand)

4. "pros_cons_updates": [{"id": "xxx", "pros": [4 strings], "cons": [4 strings]}] — for systems where current pros/cons feel outdated

5. "use_cases_updates": [{"id": "xxx", "use_cases": [3-4 strings]}] — for systems where new use cases have emerged

6. "ides_updates": [{"id": "xxx", "supported_ides": ["..."]}] — coding tools only, when new IDE support added

7. "owner_updates": [{"id": "xxx", "owner": "new owner string"}] — when company is acquired or rebranded

8. "new_systems": Find 10-15 NEW major AI systems (LLM chatbots OR coding tools) launched in the last 6 months that we don't track. BE AGGRESSIVE — include any system with >100K users or major backing. Return [{"id": "slug", "type": "llm|coding", "name": "...", "developer": "...", "owner": "...", "country": "...", "country_code": "xx", "cluster": "...", "description": "...", "latest_model": "..." (LLM only), "pricing": {...}, "estimated_users": "...", "market_position": N, "pros": [4 strings], "cons": [4 strings], "use_cases": [3-4 strings], "supported_ides": [...] (coding only), "url": "https://..."}]

9. "discontinued": [{"id": "xxx", "reason": "..."}] — systems that have been shut down

Rules:
- For TASKS 1-7 (updates): only report changes you are CONFIDENT about, do not guess on existing systems
- For TASK 8 (new_systems): be thorough — we want comprehensive coverage of the AI landscape
- For user counts use qualifiers like "estimated" or "~"
- For coding tools, set type="coding"; for LLM chatbots, type="llm"
- Cluster values for LLM: frontier|open-weight|search-research|specialized|regional
- Cluster values for coding: ide-native|ide-extension|cli-agent|cloud-ide|specialized

Reply with JSON: {"pricing_updates": [], "user_updates": [], "description_updates": [], "pros_cons_updates": [], "use_cases_updates": [], "ides_updates": [], "owner_updates": [], "new_systems": [], "discontinued": [], "notes": "summary"}`;

        const weekly = await askGroq(weeklyPrompt, 8000);

        // Helper to PATCH a single field
        async function patchSystem(id, fields) {
          await fetch(`${SUPABASE_URL}/rest/v1/ai_systems?id=eq.${id}`, {
            method: 'PATCH', headers: sbH,
            body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
          });
          results.systems_updated++;
        }

        for (const u of (weekly.pricing_updates || [])) {
          if (u.id && u.pricing) await patchSystem(u.id, { pricing: u.pricing });
        }
        for (const u of (weekly.user_updates || [])) {
          if (u.id && u.estimated_users) await patchSystem(u.id, { estimated_users: u.estimated_users });
        }
        for (const u of (weekly.description_updates || [])) {
          if (u.id && u.description) await patchSystem(u.id, { description: u.description });
        }
        for (const u of (weekly.pros_cons_updates || [])) {
          if (u.id && u.pros && u.cons) await patchSystem(u.id, { pros: u.pros, cons: u.cons });
        }
        for (const u of (weekly.use_cases_updates || [])) {
          if (u.id && u.use_cases) await patchSystem(u.id, { use_cases: u.use_cases });
        }
        for (const u of (weekly.ides_updates || [])) {
          if (u.id && u.supported_ides) await patchSystem(u.id, { supported_ides: u.supported_ides });
        }
        for (const u of (weekly.owner_updates || [])) {
          if (u.id && u.owner) await patchSystem(u.id, { owner: u.owner });
        }

        // Add new systems (aggressive discovery)
        for (const s of (weekly.new_systems || [])) {
          if (!s.id || !s.name || !s.type) continue;
          s.updated_at = new Date().toISOString();
          await upsert('ai_systems', [s]);
          results.systems_added++;
        }

        // Mark discontinued
        for (const d of (weekly.discontinued || [])) {
          if (d.id) await patchSystem(d.id, { description: `[DISCONTINUED] ${d.reason || 'Shut down.'}` });
        }
      } catch (e) { results.errors.push(`weekly systems: ${e.message}`); }

      // 3b. New events discovery via Google News RSS + Groq extraction
      try {
        // Step 1: Fetch event announcements from Google News RSS (no year hardcoded)
        const eventQueries = [
          { q: 'AI conference Germany summit Konferenz', hl: 'de', gl: 'DE', ceid: 'DE:de' },
          { q: 'KI Konferenz Deutschland Messe', hl: 'de', gl: 'DE', ceid: 'DE:de' },
          { q: 'AI summit Europe conference expo', hl: 'en', gl: 'US', ceid: 'US:en' },
          { q: 'AI conference Berlin Munich Hamburg Frankfurt', hl: 'en', gl: 'DE', ceid: 'DE:en' },
          { q: 'machine learning conference NeurIPS ICML', hl: 'en', gl: 'US', ceid: 'US:en' },
          { q: 'artificial intelligence expo summit London Paris', hl: 'en', gl: 'GB', ceid: 'GB:en' },
          { q: 'AI startup event tech conference Europe', hl: 'en', gl: 'US', ceid: 'US:en' },
        ];

        const eventHeadlines = [];
        for (const eq of eventQueries) {
          try {
            const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(eq.q)}&hl=${eq.hl}&gl=${eq.gl}&ceid=${eq.ceid}`;
            const r = await fetch(rssUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (!r.ok) continue;
            const xml = await r.text();
            const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
            for (const item of items.slice(0, 4)) {
              const title = ((item.match(/<title>(.*?)<\/title>/) || [])[1] || '')
                .replace(/<!\[CDATA\[(.*?)\]\]>/, '$1').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
              const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
              // Only recent articles (last 30 days)
              if (pubDate && (Date.now() - new Date(pubDate).getTime()) > 30 * 86400000) continue;
              if (title) eventHeadlines.push(title);
            }
          } catch (e) { /* skip failed RSS */ }
        }

        // Step 2: Ask Groq to extract events from headlines
        if (eventHeadlines.length > 0) {
          const uniqueHeadlines = [...new Set(eventHeadlines)].slice(0, 25);

          const eventsPrompt = `You are an AI events researcher. Today is ${todayISO}.

These are recent news headlines about AI conferences and events:
${uniqueHeadlines.map((h, i) => `${i}. ${h}`).join('\n')}

From these headlines, extract any upcoming AI conferences, summits, expos, or workshops.
Also add any major AI events you know about for the next 12 months that are NOT in these headlines.

For each event return a JSON object with:
- id: slug (lowercase, hyphenated, include year)
- name: full event name
- date_start: YYYY-MM-DD (must be in the future, after ${todayISO})
- date_end: YYYY-MM-DD (or same as date_start if one day)
- location_city
- location_country
- region: "germany" | "europe" | "world"
- type: "conference" | "expo" | "summit" | "workshop"
- description: 1-2 sentences
- url: official website (if known, otherwise null)
- estimated_attendees: string or null
- highlight: true for major events (1000+ attendees)

Priority: Germany first, then Europe, then world.
Only include events with dates you are confident about.
Skip past events.

Reply with JSON: {"events": [...]}`;

          const eventsData = await askGroq(eventsPrompt, 4000);
          const newEvents = (eventsData.events || []).filter(e =>
            e.id && e.name && e.date_start && new Date(e.date_start) > new Date()
          );

          if (newEvents.length > 0) {
            for (const e of newEvents) e.updated_at = new Date().toISOString();
            await upsert('ai_events', newEvents);
            results.events_added = newEvents.length;
          }
        }
      } catch (e) { results.errors.push(`events discovery: ${e.message}`); }
    }

    // ============================================
    // 4. Cleanup past events (>30 days)
    // ============================================
    try {
      const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const r = await fetch(`${SUPABASE_URL}/rest/v1/ai_events?or=(date_end.lt.${cutoff},and(date_end.is.null,date_start.lt.${cutoff}))`, {
        method: 'DELETE', headers: { ...sbH, 'Prefer': 'return=representation' },
      });
      if (r.ok) { const d = await r.json(); results.events_cleaned = Array.isArray(d) ? d.length : 0; }
    } catch (e) { results.errors.push(`events cleanup: ${e.message}`); }

    // ============================================
    // 5. Update meta
    // ============================================
    const now = new Date().toISOString();
    await upsert('ai_meta', [
      { key: 'last_systems_update', value: now, updated_at: now },
      { key: 'last_run', value: now, updated_at: now },
      { key: 'last_run_type', value: 'manual_full', updated_at: now },
    ], 'key');

    return res.status(200).json({
      ok: true,
      run_type: 'manual_full',
      elapsed_ms: Date.now() - startTime,
      ...results,
    });
  } catch (err) {
    console.error('ai-landscape-update error:', err);
    return res.status(500).json({ error: 'internal_error', ...results });
  }
};
