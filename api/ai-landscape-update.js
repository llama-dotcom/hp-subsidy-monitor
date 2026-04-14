// ============================================
// AI Landscape — Daily Cron Handler (Full Automation)
// Schedule: 0 7 * * * (07:00 UTC = 09:00 Berlin CEST)
//
// DAILY: news via Google RSS + light model-release check via Groq
// WEEKLY (Monday): full system refresh + new events discovery via Groq
// ALWAYS: clean past events (>30d) and old news (>60d)
// ============================================

const Groq = require('groq-sdk');

module.exports = async function handler(req, res) {
  const startTime = Date.now();
  const results = { news: 0, systems_updated: 0, systems_added: 0, events_added: 0, events_cleaned: 0, errors: [] };

  try {
    // Auth
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    const cronSecret = process.env.CRON_SECRET_AI_LANDSCAPE;
    const authHeader = req.headers.authorization;
    if (!isVercelCron && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL_AI_LANDSCAPE;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY_AI_LANDSCAPE;
    const GROQ_KEY = process.env.GROQ_API_KEY_AI_LANDSCAPE;
    if (!SUPABASE_URL || !SUPABASE_KEY || !GROQ_KEY) {
      return res.status(500).json({ error: 'Missing env vars' });
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
    // 1. NEWS — Google News RSS (daily)
    // ============================================
    try {
      const queries = [
        `GPT OpenAI ChatGPT AI release ${year}`,
        `Claude Anthropic AI release ${year}`,
        `Gemini Google DeepMind AI ${year}`,
        `Llama Meta Mistral open source AI ${year}`,
        `AI funding round billion valuation ${year}`,
        `EU AI Act regulation enforcement ${year}`,
        `AI coding tool Cursor Copilot Claude Code ${year}`,
        `DeepSeek Qwen Chinese AI model ${year}`,
        `AI conference summit expo ${year}`,
        `AI startup acquisition merger ${year}`,
      ];
      const fetched = [];
      for (const q of queries) {
        try {
          const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en&gl=US&ceid=US:en`;
          const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          if (!r.ok) continue;
          const xml = await r.text();
          const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
          for (const item of items.slice(0, 3)) {
            const title = ((item.match(/<title>(.*?)<\/title>/) || [])[1] || '').replace(/<!\[CDATA\[(.*?)\]\]>/, '$1').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
            const link = (item.match(/<link>(.*?)<\/link>/) || [])[1] || '';
            const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
            const source = (item.match(/<source[^>]*>(.*?)<\/source>/) || [])[1] || 'Google News';
            if (!pubDate || (Date.now() - new Date(pubDate).getTime()) > 14 * 86400000) continue;
            const id = link.split('/articles/')[1]?.slice(0, 40)?.replace(/[^a-zA-Z0-9]/g, '_') || `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            fetched.push({ id, title: title.slice(0, 240), summary: title.slice(0, 280), date: new Date(pubDate).toISOString().slice(0, 10), source, source_url: link, category: q.includes('funding') ? 'funding' : q.includes('regulation') ? 'regulation' : q.includes('conference') ? 'other' : 'release', importance: 'medium' });
          }
        } catch (e) { results.errors.push(`news "${q.slice(0,30)}": ${e.message}`); }
      }
      const seen = new Set();
      const deduped = fetched.filter(n => { const k = n.title.slice(0, 60).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 20);

      if (deduped.length > 0) {
        // Generate real summaries via Groq BEFORE inserting
        const batchSize = 5;
        for (let b = 0; b < deduped.length; b += batchSize) {
          const batch = deduped.slice(b, b + batchSize);
          try {
            const titles = batch.map((n, i) => `${i}. ${n.title}`).join('\n');
            const sumResp = await askGroq(`You are an AI news editor. For each headline below, write a 5-sentence summary paragraph that explains what happened, who is involved, why it matters for the AI industry, what the impact could be, and relevant context. Be specific and informative.

Headlines:
${titles}

Reply with JSON: {"summaries": ["paragraph for item 0", "paragraph for item 1", ...]}
Return exactly ${batch.length} summaries.`, 3000, 'fast');

            const sums = sumResp.summaries || [];
            for (let i = 0; i < Math.min(sums.length, batch.length); i++) {
              if (sums[i] && sums[i].length > 30) {
                deduped[b + i].summary = sums[i];
              }
            }
          } catch (e) { results.errors.push(`news summaries batch ${b}: ${e.message}`); }
        }

        // Delete ALL existing news, then insert fresh ones with real summaries
        await fetch(`${SUPABASE_URL}/rest/v1/ai_news?id=neq.___`, { method: 'DELETE', headers: sbH });
        // Insert fresh
        const insertR = await fetch(`${SUPABASE_URL}/rest/v1/ai_news`, {
          method: 'POST', headers: sbH, body: JSON.stringify(deduped),
        });
        if (!insertR.ok) throw new Error(`news insert: ${insertR.status} ${await insertR.text()}`);
        results.news = deduped.length;
      }
      // Cleanup >60 days
      await fetch(`${SUPABASE_URL}/rest/v1/ai_news?date=lt.${new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)}`, { method: 'DELETE', headers: sbH });
    } catch (e) { results.errors.push(`news: ${e.message}`); }

    // ============================================
    // 2. SYSTEMS — daily: model releases check
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

Tasks (reply as JSON):

1. "pricing_updates": For any system where you KNOW the pricing has changed, return [{"id": "xxx", "pricing": {"free_tier": bool, "free_details": "...", "pro_price": "$X/mo", "enterprise": bool}}]

2. "user_updates": For any system where you have NEWER user count data, return [{"id": "xxx", "estimated_users": "new count"}]

3. "description_updates": For any system that had a MAJOR change (acquisition, pivot, rebrand), return [{"id": "xxx", "description": "new 2-sentence description"}]

4. "new_systems": Any MAJOR new AI system (LLM or coding tool) launched in the last month that we don't track yet? Return [{"id": "slug", "type": "llm|coding", "name": "...", "developer": "...", "owner": "...", "country": "...", "country_code": "xx", "cluster": "...", "description": "...", "latest_model": "...", "pricing": {...}, "estimated_users": "...", "market_position": N, "pros": [...], "cons": [...], "use_cases": [...], "url": "https://..."}]

5. "discontinued": Any systems that have been shut down? Return [{"id": "xxx", "reason": "..."}]

Rules:
- Only report changes you are CONFIDENT about
- If unsure, skip it — do not guess
- For user counts, use qualifier like "estimated" or "~"
- Reply with JSON: {"pricing_updates": [], "user_updates": [], "description_updates": [], "new_systems": [], "discontinued": [], "notes": "summary"}`;

        const weekly = await askGroq(weeklyPrompt, 6000);

        // Apply pricing updates
        for (const u of (weekly.pricing_updates || [])) {
          if (!u.id || !u.pricing) continue;
          await fetch(`${SUPABASE_URL}/rest/v1/ai_systems?id=eq.${u.id}`, {
            method: 'PATCH', headers: sbH,
            body: JSON.stringify({ pricing: u.pricing, updated_at: new Date().toISOString() }),
          });
          results.systems_updated++;
        }

        // Apply user count updates
        for (const u of (weekly.user_updates || [])) {
          if (!u.id || !u.estimated_users) continue;
          await fetch(`${SUPABASE_URL}/rest/v1/ai_systems?id=eq.${u.id}`, {
            method: 'PATCH', headers: sbH,
            body: JSON.stringify({ estimated_users: u.estimated_users, updated_at: new Date().toISOString() }),
          });
          results.systems_updated++;
        }

        // Apply description updates
        for (const u of (weekly.description_updates || [])) {
          if (!u.id || !u.description) continue;
          await fetch(`${SUPABASE_URL}/rest/v1/ai_systems?id=eq.${u.id}`, {
            method: 'PATCH', headers: sbH,
            body: JSON.stringify({ description: u.description, updated_at: new Date().toISOString() }),
          });
          results.systems_updated++;
        }

        // Add new systems
        for (const s of (weekly.new_systems || [])) {
          if (!s.id || !s.name || !s.type) continue;
          s.updated_at = new Date().toISOString();
          await upsert('ai_systems', [s]);
          results.systems_added++;
        }

        // Mark discontinued
        for (const d of (weekly.discontinued || [])) {
          if (!d.id) continue;
          await fetch(`${SUPABASE_URL}/rest/v1/ai_systems?id=eq.${d.id}`, {
            method: 'PATCH', headers: sbH,
            body: JSON.stringify({ description: `[DISCONTINUED] ${d.reason || 'Shut down.'}`, updated_at: new Date().toISOString() }),
          });
          results.systems_updated++;
        }
      } catch (e) { results.errors.push(`weekly systems: ${e.message}`); }

      // 3b. New events discovery
      try {
        const eventsPrompt = `You are an AI events researcher. Today is ${todayISO}.

List upcoming AI conferences, summits, and expos happening in the next 12 months (${todayISO} to ${new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)}).

Focus on:
1. Germany events (highest priority)
2. European events
3. Major global AI events (NeurIPS, ICML, Google I/O, etc.)

For each event return a JSON object:
{"id": "slug-${year}", "name": "Event Name", "date_start": "YYYY-MM-DD", "date_end": "YYYY-MM-DD", "location_city": "City", "location_country": "Country", "region": "germany|europe|world", "type": "conference|expo|summit|workshop", "description": "1-2 sentences", "url": "https://...", "estimated_attendees": "N+" or null, "highlight": true/false}

Reply with JSON: {"events": [...], "notes": "summary"}
Only include events you are confident about dates. If unsure of exact date, skip.`;

        const eventsData = await askGroq(eventsPrompt, 4000);
        const newEvents = (eventsData.events || []).filter(e => e.id && e.name && e.date_start);

        if (newEvents.length > 0) {
          for (const e of newEvents) e.updated_at = new Date().toISOString();
          await upsert('ai_events', newEvents);
          results.events_added = newEvents.length;
        }
      } catch (e) { results.errors.push(`weekly events: ${e.message}`); }
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
      { key: 'last_news_update', value: now, updated_at: now },
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
    return res.status(500).json({ error: err.message, ...results });
  }
};
