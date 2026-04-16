// =============================================================
// /api/refresh-data — Monthly Gemini-driven refresh
//
// Updates per country:
//   - subsidy_program (concise name) + max_subsidy + subsidy_breakdown + subsidy_source_url
//   - market_size + market_year + market_method_note + market_source_url
//
// Rules:
//   - Year-forward STRICT: only update if newer year (or first-time write)
//   - First-time write rule: if existing column has no source_url AND no method_note,
//     this is legacy/unverified data → trust Gemini's finding even if older year
//   - Source URL is REQUIRED — no source = no write
//   - Trust whitelist: source domain must be in TRUSTED_DOMAINS or .gov / .gov.* / official agency
//   - A2A handling: if found data includes A2A, store value WITH method_note labeling it
//
// Triggered by: Vercel cron (1st of month) OR ?run=1 with auth
// Scope: hydronic-only (AW/LW/EW/Hybrids), residential + commercial, NO A2A, NO DHW-only
// =============================================================

const GEMINI_MODEL = 'gemini-2.5-flash-lite'; // higher free-tier quota than 2.5-flash, same grounding capability
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// =============================================================
// TIERED TRUST MODEL
// =============================================================
// Tier 1 (full trust): gov + official agencies + national HP associations + national stats offices
// Tier 2 (acceptable, needs stricter rules): everything else not blocked
// Tier 0 / BLOCKED: spam, blogs, social, lead-gen sites (never apply)

// Domains that should NEVER be trusted (block list — kept small + targeted)
const BLOCKED_DOMAINS = [
  // User-generated / blog platforms
  'blogspot.com', 'wordpress.com', 'medium.com', 'substack.com', 'tumblr.com',
  'wixsite.com', 'weebly.com', 'webflow.io', 'squarespace.com',
  // Social media
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com',
  'pinterest.com', 'reddit.com', 'quora.com', 'youtube.com', 'linkedin.com',
  // Lead-gen / marketing aggregators
  'homeadvisor.com', 'angi.com', 'thumbtack.com', 'modernize.com', 'houzz.com',
  // Content farms
  'wikihow.com', 'ehow.com', 'about.com'
];

// Tier 1 — full trust (auto-apply with confidence ≥ 0.7)
const TIER_1_DOMAINS = [
  // Government / official agencies — DE
  'kfw.de', 'bafa.de', 'energiewechsel.de', 'bmwk.de',
  // Government — FR
  'service-public.fr', 'anah.gouv.fr', 'gouv.fr', 'maprimerenov.gouv.fr', 'ademe.fr',
  // Government — UK
  'gov.uk', 'ofgem.gov.uk',
  // Government — NL
  'rvo.nl', 'rijksoverheid.nl',
  // Government — IT
  'gse.it', 'mase.gov.it', 'enea.it',
  // Government — ES
  'idae.es', 'miteco.gob.es',
  // Government — PL
  'czystepowietrze.gov.pl', 'mojecieplo.gov.pl', 'gov.pl',
  // Government — AT
  'sanierungsoffensive.gv.at', 'umweltfoerderung.at', 'oesterreich.gv.at',
  // Government — CH
  'dasgebaeudeprogramm.ch', 'admin.ch', 'bfe.admin.ch',
  // Government — LU
  'guichet.public.lu', 'klima-agence.lu',
  // Government — DK
  'klimatilskudd.dk', 'sparenergi.dk', 'ens.dk',
  // Government — NO
  'enova.no',
  // Government — FI
  'ara.fi', 'energiavirasto.fi',
  // Government — CZ
  'dotace.sfzp.cz', 'novazelenausporam.cz', 'mzp.cz',
  // Government — EE
  'kredex.ee',
  // Government — LT
  'apva.lt', 'enmin.lrv.lt',
  // EU / cross-border official
  'ehpa.org', 'ec.europa.eu', 'iea.org', 'eea.europa.eu', 'europa.eu',
  // National HP associations (hydronic-only by default)
  'waermepumpe.de', 'bdh-koeln.de',                  // BWP, BDH (DE)
  'afpac.org', 'uniclima.fr',                        // FR
  'sulpu.fi',                                        // FI
  'warmtepompen.nl', 'warmte-pompen.nl', 'dhpa-online.nl', // NL
  'mcscertified.com', 'heatpumps.org.uk',            // UK
  'portpc.pl',                                       // PL
  'waermepumpe-austria.at',                          // AT
  'varmepumpeindustrien.dk',                         // DK
  'fws.ch',                                          // CH
  'svepinfo.se',                                     // SE
  'assoclima.it',                                    // IT
  // National statistics offices (official numbers)
  'destatis.de', 'insee.fr', 'ons.gov.uk', 'ine.es', 'istat.it', 'cbs.nl',
  'scb.se', 'dst.dk', 'stat.fi', 'stat.gov.pl', 'czso.cz', 'bfs.admin.ch',
  'ssb.no', 'stat.ee', 'osp.stat.gov.lt'
];

/**
 * getSourceTier(url) — returns:
 *   0 = blocked (spam, blogs, social) — never apply
 *   1 = Tier 1 (full trust) — auto-apply with confidence ≥ 0.7
 *   2 = Tier 2 (acceptable secondary) — auto-apply with confidence ≥ 0.85 AND change < 30%
 */
function getSourceTier(url) {
  if (!url || typeof url !== 'string') return 0;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return 0;
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (host.length < 4 || host.length > 253) return 0;

    // Check BLOCKED first
    if (BLOCKED_DOMAINS.some(d => host === d || host.endsWith('.' + d))) return 0;

    // Tier 1: explicit whitelist OR any .gov.<country>
    if (TIER_1_DOMAINS.some(d => host === d || host.endsWith('.' + d))) return 1;
    if (/\.gov(\.[a-z]{2,3})?$/i.test(host)) return 1;
    if (/\.go\.[a-z]{2}$/i.test(host)) return 1; // some non-EU gov domains use .go

    // Tier 2: anything else (industry analysts, news, trade media, manufacturers, etc.)
    return 2;
  } catch (e) {
    return 0;
  }
}

// =============================================================
// Gemini call — research + breakdown for one country
// =============================================================
async function geminiResearch(country, geminiKey) {
  const prompt = `You are a heat pump market analyst. For ${country.name}, find the LATEST official data.

═══════════════════════════════════════════════════════
CRITICAL SCOPE — STRICT
═══════════════════════════════════════════════════════
We track ONLY HYDRONIC heat pumps (residential + commercial):
  • AW — Air-to-Water (space heating, NOT DHW-only)
  • LW — Liquid-to-Water / Ground-source / Brine
  • EW — Exhaust Air-to-Water
  • Hybrids — HP + boiler

We EXCLUDE:
  • A2A — Air-to-Air, split AC, VRF, reversible AC
  • DHW-only thermodynamic water heaters (CET) — these heat water only, not space

A2A HANDLING — read carefully:
  1. PREFER: source that gives hydronic-only figure (BWP, AFPAC, BDH, SULPU, EHPA breakdown)
  2. SECOND: total HP market with explicit breakdown — subtract A2A
  3. LAST RESORT: total INCLUDES A2A — return value WITH method note explaining what's included
     (Better to have labeled value than no value)

═══════════════════════════════════════════════════════
TASK 1 — SUBSIDY (subsidy_program, max_subsidy, breakdown, source_url)
═══════════════════════════════════════════════════════
Find the MAIN national heat pump subsidy program for residential homeowners installing a hydronic HP.

Return:
  • Concise program name (max 30 chars: "BEG/KfW 458", "MaPrimeRénov", "PRTR + IRPF")
  • Maximum total subsidy in EUR for a typical single-family home
  • Detailed BREAKDOWN of all components contributing to that maximum
    (look carefully for: base %, bonuses, additional surcharges INDEPENDENT of caps, fixed extras)
  • Direct URL to OFFICIAL government or agency page (this is REQUIRED)
  • Year the program is currently effective (e.g., 2026)

⚠️ DO NOT just take the headline number. Look for additional surcharges that are independent of percentage caps. Example: Germany BEG has €21,000 percentage cap PLUS €2,500 Emissionsminderungszuschlag = €23,500 total.

═══════════════════════════════════════════════════════
TASK 2 — MARKET SIZE (market_size, market_year, method_note, source_url)
═══════════════════════════════════════════════════════
Find the LATEST annual sales of HYDRONIC heat pumps in ${country.name} in thousands of units.

Return:
  • Number in thousands (e.g., 299 for 299,000 units)
  • Year of the data
  • Method note explaining EXACTLY what's included:
    - "hydronic only (BWP)" if from a national HP association breakdown
    - "total minus A2A 28%" if you subtracted A2A
    - "incl. A2A and CET" if total figure used because no breakdown available
  • Direct URL to source (REQUIRED)

═══════════════════════════════════════════════════════
TASK 3 — STATUS & OUTLOOK
═══════════════════════════════════════════════════════
Based on your research:

• status: Is the subsidy program currently "active" (accepting applications), "expiring" (end date announced or approaching), or "discontinued" (cancelled, suspended, no longer available)?
• outlook: Write 1-2 sentences about the near-term policy direction for heat pumps in this country. Focus on concrete facts (budget changes, program extensions, regulatory shifts), not speculation.

═══════════════════════════════════════════════════════
CURRENT DATABASE VALUES (for context only — return latest you can verify):
═══════════════════════════════════════════════════════
  subsidy_program: "${country.subsidy_program || 'unknown'}"
  max_subsidy: €${country.max_subsidy || 'unknown'}
  market_size: ${country.market_size || 'unknown'}k (${country.market_year || 'unknown'})

═══════════════════════════════════════════════════════
RETURN FORMAT — ONLY this JSON, no markdown, no other text:
═══════════════════════════════════════════════════════
{
  "subsidy": {
    "program_short": "<concise name, max 30 chars>",
    "max_eur": <number>,
    "breakdown": "<plain text describing components, e.g., '30% base + 20% speed + 5% efficiency = 55% capped at 70% × €30k = €21k + €2.5k Emissions surcharge = €23.5k'>",
    "source_url": "<official URL — REQUIRED>",
    "effective_year": <YYYY>,
    "status": "active" | "expiring" | "discontinued",
    "confidence": <0.0-1.0>
  },
  "market": {
    "value_thousands": <number>,
    "year": <YYYY>,
    "method_note": "<explain scope: 'hydronic only (source)' or 'incl. A2A' or similar>",
    "source_url": "<URL — REQUIRED>",
    "includes_a2a": <true|false>,
    "confidence": <0.0-1.0>
  },
  "outlook": "<1-2 sentences: near-term policy direction for heat pumps in this country. Concrete facts only, no speculation.>",
  "reasoning": "<2-3 sentences max — what you found and any uncertainties>"
}

If a field truly cannot be found, set it to null. NEVER make up data. Source URLs are REQUIRED — if you cannot provide a URL, set the entire subsidy or market object to null.`;

  const res = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8000 }
    })
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const d = await res.json();
  const text = d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Gemini returned empty response');

  // Robust JSON extraction (handles markdown fences, prose preface, etc.)
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace <= firstBrace) {
    throw new Error(`No JSON in response: ${text.slice(0, 200)}`);
  }
  const jsonStr = text.slice(firstBrace, lastBrace + 1);
  let parsed;
  try { parsed = JSON.parse(jsonStr); }
  catch (e) { throw new Error(`Invalid JSON: ${jsonStr.slice(0, 200)}`); }

  return { parsed, tokens: d?.usageMetadata?.totalTokenCount || 0 };
}

// =============================================================
// Tier-aware trust check — returns true if value can be applied
// Tier 1: confidence ≥ 0.7
// Tier 2: confidence ≥ 0.85 AND (first-write OR change < 30%)
// =============================================================
function passesTier(tier, confidence, isFirstWrite, changeFraction) {
  if (tier === 0) return false;            // blocked
  if (typeof confidence !== 'number') confidence = 0.5;
  if (tier === 1) return confidence >= 0.7;
  if (tier === 2) {
    if (confidence < 0.85) return false;
    if (isFirstWrite) return true;          // no existing value to compare against
    return changeFraction < 0.3;
  }
  return false;
}

// =============================================================
// Compute patches with tiered trust + year-forward + first-time-write rule
// =============================================================
function computePatches(country, gemini) {
  const patches = {};
  const decisions = [];
  const { subsidy, market } = gemini.parsed || {};

  // ===== SUBSIDY =====
  if (subsidy && typeof subsidy === 'object' && subsidy.max_eur != null) {
    const url = subsidy.source_url;
    const tier = getSourceTier(url);
    const newAmt = Number(subsidy.max_eur);
    const newYear = Number(subsidy.effective_year) || 0;
    const newProgram = (subsidy.program_short || '').trim();
    const newBreakdown = (subsidy.breakdown || '').trim();
    const confidence = Number(subsidy.confidence) || 0.5;
    const isFirstWrite = !country.subsidy_source_url;
    const curAmt = Number(country.max_subsidy) || 0;
    const change = curAmt > 0 ? Math.abs(newAmt - curAmt) / curAmt : 0;

    // Currency sanity check: detect raw GBP/CHF values (Gemini sometimes forgets EUR conversion)
    // For UK/CH, if amount looks suspiciously low (typical GBP/CHF amounts), skip
    const currencyMismatch = (country.id === 'GB' && newAmt > 0 && newAmt < curAmt * 0.95) ||
                              (country.id === 'CH' && newAmt > 0 && newAmt < curAmt * 0.95);

    // Subsidy year check: should be currentYear (latest) — old data rejected
    const newSubYear = Number(subsidy.effective_year) || 0;
    const subTooOld = newSubYear > 0 && newSubYear < CURRENT_YEAR - 1;

    // Top countries protection: don't allow subsidy reduction >20% from secondary sources
    const TOP_COUNTRIES = new Set(['DE','FR','NL','GB','IT']);
    const bigDrop = TOP_COUNTRIES.has(country.id) && curAmt > 0 && newAmt < curAmt * 0.8 && tier > 1;

    if (!url) {
      decisions.push(`subsidy: SKIP — no source URL`);
    } else if (tier === 0) {
      decisions.push(`subsidy: SKIP — blocked source (${url})`);
    } else if (newAmt < 100 || newAmt > 200000) {
      decisions.push(`subsidy: SKIP — value out of bounds (€${newAmt})`);
    } else if (!newProgram || newProgram.length > 60) {
      decisions.push(`subsidy: SKIP — program name invalid`);
    } else if (currencyMismatch) {
      decisions.push(`subsidy: SKIP — suspected currency conversion error (${country.id}: €${newAmt} too low vs €${curAmt})`);
    } else if (subTooOld) {
      decisions.push(`subsidy: SKIP — year ${newSubYear} too old (need ${CURRENT_YEAR-1}+)`);
    } else if (bigDrop) {
      decisions.push(`subsidy: SKIP — Top country, big drop ${(change*100).toFixed(0)}% from non-Tier-1 source`);
    } else if (!passesTier(tier, confidence, isFirstWrite, change)) {
      decisions.push(`subsidy: SKIP — tier ${tier} rules failed (conf=${confidence}, change=${(change*100).toFixed(0)}%)`);
    } else {
      // Year-forward check: existing breakdown contains a year tag — only update if newer
      const existingYearMatch = (country.subsidy_breakdown || '').match(/\b(20\d{2})\b/);
      const existingYearNum = existingYearMatch ? parseInt(existingYearMatch[1]) : 0;

      // Status from Gemini (active/expiring/discontinued) — always update if present
      const newStatus = (subsidy.status || '').toLowerCase().trim();
      const validStatuses = ['active', 'expiring', 'discontinued'];

      if (isFirstWrite) {
        patches.subsidy_program = newProgram;
        patches.max_subsidy = newAmt;
        patches.subsidy_breakdown = newBreakdown;
        patches.subsidy_source_url = url;
        patches.detail = newBreakdown; // also update legacy detail field
        if (validStatuses.includes(newStatus)) patches.status = newStatus;
        decisions.push(`subsidy: FIRST WRITE — €${newAmt} (${newProgram}, ${newStatus}, tier ${tier}) from ${url}`);
      } else if (newYear > 0 && existingYearNum > 0 && newYear < existingYearNum) {
        decisions.push(`subsidy: SKIP — found ${newYear} data, DB has ${existingYearNum}`);
      } else if (newAmt === curAmt && newProgram === country.subsidy_program) {
        // Amount unchanged, but still update status/breakdown if available
        if (validStatuses.includes(newStatus) && newStatus !== country.status) {
          patches.status = newStatus;
          decisions.push(`subsidy: amount unchanged €${curAmt}, but STATUS updated → ${newStatus}`);
        } else {
          decisions.push(`subsidy: unchanged €${curAmt}`);
        }
      } else {
        patches.max_subsidy = newAmt;
        patches.subsidy_program = newProgram;
        patches.subsidy_breakdown = newBreakdown;
        patches.subsidy_source_url = url;
        patches.detail = newBreakdown;
        if (validStatuses.includes(newStatus)) patches.status = newStatus;
        decisions.push(`subsidy: UPDATE €${curAmt}→€${newAmt} (${newProgram}, ${newStatus}, tier ${tier}) from ${url}`);
      }
    }
  } else {
    decisions.push(`subsidy: no data returned`);
  }

  // ===== MARKET SIZE =====
  // Rule: market data is annual sales — must be CONFIRMED ACTUAL year (currentYear - 1 or earlier)
  // Forecasts and current-year H1 numbers are rejected to avoid contamination
  const CURRENT_YEAR = new Date().getFullYear();
  const MAX_MARKET_YEAR = CURRENT_YEAR - 1; // e.g., in 2026, latest valid = 2025
  if (market && typeof market === 'object' && market.value_thousands != null) {
    const url = market.source_url;
    const tier = getSourceTier(url);
    const newVal = Number(market.value_thousands);
    const newYear = Number(market.year) || 0;
    const note = (market.method_note || '').trim();
    const confidence = Number(market.confidence) || 0.5;
    const isFirstWrite = !country.market_source_url;
    const curVal = Number(country.market_size) || 0;
    const curYear = Number(country.market_year) || 0;
    const change = curVal > 0 ? Math.abs(newVal - curVal) / curVal : 0;

    if (!url) {
      decisions.push(`market: SKIP — no source URL`);
    } else if (tier === 0) {
      decisions.push(`market: SKIP — blocked source (${url})`);
    } else if (newVal < 0.1 || newVal > 10000) {
      decisions.push(`market: SKIP — value out of bounds (${newVal}k)`);
    } else if (!newYear) {
      decisions.push(`market: SKIP — no year tag`);
    } else if (newYear > MAX_MARKET_YEAR) {
      decisions.push(`market: SKIP — year ${newYear} > max allowed ${MAX_MARKET_YEAR} (likely forecast or H1 data)`);
    } else if (!passesTier(tier, confidence, isFirstWrite, change)) {
      decisions.push(`market: SKIP — tier ${tier} rules failed (conf=${confidence}, change=${(change*100).toFixed(0)}%)`);
    } else if (newYear < curYear && !isFirstWrite) {
      decisions.push(`market: SKIP — found ${newYear} data, DB has ${curYear}`);
    } else if (newYear === curYear && newVal === curVal && !isFirstWrite) {
      decisions.push(`market: unchanged ${curVal}k/${curYear}`);
    } else {
      patches.market_size = newVal;
      patches.market_year = newYear;
      patches.market_source_url = url;
      patches.market_method_note = note;
      decisions.push(`market: ${isFirstWrite ? 'FIRST WRITE' : 'UPDATE'} ${curVal}k/${curYear} → ${newVal}k/${newYear} (tier ${tier}, ${note})`);
    }
  } else {
    decisions.push(`market: no data returned`);
  }

  // ===== OUTLOOK (always update if Gemini returned one) =====
  const newOutlook = (gemini.parsed?.outlook || '').trim();
  if (newOutlook && newOutlook.length > 10 && newOutlook.length < 500) {
    patches.outlook = newOutlook;
    decisions.push(`outlook: UPDATE → "${newOutlook.slice(0, 80)}..."`);
  }

  return { patches, decisions };
}

// =============================================================
// Apply patches to Supabase countries table
// =============================================================
async function applyPatches(SUPABASE_URL, SUPABASE_KEY, countryId, patches) {
  if (Object.keys(patches).length === 0) return false;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/countries?id=eq.${countryId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ ...patches, updated_at: new Date().toISOString() })
  });
  if (!res.ok) throw new Error(`PATCH ${countryId}: ${res.status} ${(await res.text()).slice(0, 100)}`);
  return true;
}

// =============================================================
// Main handler
// =============================================================
module.exports = async function handler(req, res) {
  try {
    // Auth
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    const authHeader = req.headers.authorization;
    if (!isVercelCron && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Missing Supabase env' });
    if (!GEMINI_KEY) return res.status(500).json({ error: 'Missing GEMINI_API_KEY env' });

    // Filters for cron / testing
    //   ?country=DE   — single country (ignored if batch is set)
    //   ?batch=1      — countries with sort_weight rank 1-18 (top markets, fits in 1 day's free quota)
    //   ?batch=2      — countries with sort_weight rank 19-32 (remaining)
    //   ?dry=1        — dry-run, no DB writes
    const onlyCountry = (req.query?.country || '').toUpperCase();
    const batch = parseInt(req.query?.batch) || 0;
    const dryRun = req.query?.dry === '1';
    const BATCH_SIZE = 18; // safe under 20 RPD free-tier limit (leaves 2 calls slack for retries)

    let url = `${SUPABASE_URL}/rest/v1/countries?select=id,name,subsidy_program,max_subsidy,subsidy_source_url,subsidy_breakdown,market_size,market_year,market_source_url,market_method_note&order=sort_weight.desc`;
    if (onlyCountry) {
      url += `&id=eq.${onlyCountry}`;
    } else if (batch === 1) {
      url += `&limit=${BATCH_SIZE}&offset=0`;
    } else if (batch === 2) {
      url += `&limit=${BATCH_SIZE}&offset=${BATCH_SIZE}`;
    }
    const cRes = await fetch(url, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
    if (!cRes.ok) throw new Error(`Fetch countries: ${cRes.status}`);
    const countries = await cRes.json();

    const log = [];
    let totalPatched = 0, totalTokens = 0;

    // Process sequentially with retry + throttling
    for (const country of countries) {
      let gemini = null, lastError = null;

      // Retry up to 3 times with exponential backoff (handles transient 503, empty responses)
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          gemini = await geminiResearch(country, GEMINI_KEY);
          break; // success
        } catch (e) {
          lastError = e;
          if (attempt < 3) {
            const backoff = attempt * 8000; // 8s, 16s
            await new Promise(r => setTimeout(r, backoff));
          }
        }
      }

      if (gemini) {
        totalTokens += gemini.tokens;
        const { patches, decisions } = computePatches(country, gemini);

        if (Object.keys(patches).length > 0 && !dryRun) {
          try {
            await applyPatches(SUPABASE_URL, SUPABASE_KEY, country.id, patches);
            totalPatched++;
          } catch (e) {
            decisions.push(`PATCH FAILED: ${e.message}`);
          }
        }

        log.push({
          country: country.id, name: country.name,
          decisions, patches: dryRun ? { dry_run: true, would_apply: patches } : patches,
          confidence_subsidy: gemini.parsed?.subsidy?.confidence,
          confidence_market: gemini.parsed?.market?.confidence,
          reasoning: gemini.parsed?.reasoning
        });
      } else {
        log.push({ country: country.id, name: country.name, error: `Failed after 3 attempts: ${lastError?.message}` });
      }

      // Throttle between countries — 5s gap respects 15 RPM free tier limit
      if (countries.length > 1) await new Promise(r => setTimeout(r, 5000));
    }

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      dry_run: dryRun,
      batch: batch || null,
      countries_checked: countries.length,
      countries_patched: totalPatched,
      gemini_tokens_used: totalTokens,
      log
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
