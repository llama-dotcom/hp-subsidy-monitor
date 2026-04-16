const Groq = require('groq-sdk');
const XLSX = require('xlsx');

// =============================================================
// HELPER: Eurostat JSON-stat fetcher
// Returns { data: { COUNTRY_CODE: { 'YYYY-Sn': value } }, updated }
// =============================================================
async function fetchEurostat(dataset, queryString) {
  const url = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${dataset}?format=JSON&${queryString}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Eurostat ${dataset} HTTP ${res.status}`);
  const d = await res.json();

  const geoCat = d.dimension.geo.category;
  const timeCat = d.dimension.time.category;
  const nTime = d.size[7]; // dimension order: freq,siec,nrg_cons,unit,tax,currency,geo,time

  const result = {};
  for (const [gCode, gIdx] of Object.entries(geoCat.index)) {
    result[gCode] = {};
    for (const [tCode, tIdx] of Object.entries(timeCat.index)) {
      const flatIdx = gIdx * nTime + tIdx;
      const val = d.value[flatIdx];
      if (val != null) result[gCode][tCode] = val;
    }
  }
  return { data: result, updated: d.updated };
}

// =============================================================
// HELPER: ElCom SPARQL — Swiss median electricity tariff (Rappen/kWh)
// =============================================================
async function fetchSwissElectricity(year) {
  const query = `PREFIX dim: <https://energy.ld.admin.ch/elcom/electricityprice/dimension/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
SELECT (AVG(?total) AS ?avg) (COUNT(?total) AS ?n) WHERE {
  GRAPH <https://lindas.admin.ch/elcom/electricityprice> {
    ?obs a <https://cube.link/Observation> ;
         dim:period "${year}"^^xsd:gYear ;
         dim:category <https://energy.ld.admin.ch/elcom/electricityprice/category/H4> ;
         dim:product <https://energy.ld.admin.ch/elcom/electricityprice/product/standard> ;
         dim:total ?total .
  }
}`;
  const url = `https://lindas.admin.ch/query?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } });
  if (!res.ok) throw new Error(`ElCom HTTP ${res.status}`);
  const d = await res.json();
  const b = d.results.bindings[0];
  if (!b || !b.avg || parseInt(b.n.value) === 0) return null;
  return parseFloat(b.avg.value) / 100; // Rappen → CHF per kWh
}

// =============================================================
// HELPER: UK prices via gov.uk DESNZ XLSX (annual data, IEA-derived)
// commodity = 'electricity' | 'gas' → returns [{year, pence}]
// =============================================================
async function fetchUkPricesFromDesnz(commodity) {
  const titles = {
    electricity: 'Domestic electricity prices in the IEA',
    gas:         'Domestic gas prices in the IEA'
  };
  // 1. Find latest XLSX URL via gov.uk content API (stable URL)
  const govRes = await fetch('https://www.gov.uk/api/content/government/statistical-data-sets/international-domestic-energy-prices');
  if (!govRes.ok) throw new Error(`gov.uk API HTTP ${govRes.status}`);
  const govData = await govRes.json();
  const att = (govData.details?.attachments || []).find(a => (a.title || '').includes(titles[commodity]));
  if (!att) throw new Error(`gov.uk: attachment "${titles[commodity]}" not found`);

  // 2. Download XLSX
  const xlsxRes = await fetch(att.url);
  if (!xlsxRes.ok) throw new Error(`DESNZ XLSX HTTP ${xlsxRes.status}`);
  const buffer = Buffer.from(await xlsxRes.arrayBuffer());

  // 3. Parse — find sheet with "(inc. taxes)" but not "% change"
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames.find(n => n.includes('(inc. taxes)') && !n.includes('change'));
  if (!sheetName) throw new Error('DESNZ: no "(inc. taxes)" sheet');
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  // 4. Find header row containing "Year" + "United Kingdom"
  let headerRow = -1, ukIdx = -1, yearIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    if (row.includes('Year') && row.includes('United Kingdom')) {
      headerRow = i;
      yearIdx = row.indexOf('Year');
      ukIdx = row.indexOf('United Kingdom');
      break;
    }
  }
  if (headerRow === -1) throw new Error('DESNZ: header row not found');

  // 5. Extract data
  const data = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const year = parseInt(row[yearIdx]);
    const pence = parseFloat(row[ukIdx]);
    if (Number.isFinite(year) && Number.isFinite(pence)) data.push({ year, pence });
  }
  return data;
}

// =============================================================
// HELPER: ECB exchange rate via Frankfurter (free, no key)
// =============================================================
async function fetchEcbRate(fromCurrency) {
  const res = await fetch(`https://api.frankfurter.app/latest?from=${fromCurrency}&to=EUR`);
  if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`);
  const d = await res.json();
  return d.rates.EUR;
}

// =============================================================
// HELPER: Batch UPSERT into energy_prices (one HTTP call for many rows)
// =============================================================
async function upsertEnergyPrices(SUPABASE_URL, SUPABASE_KEY, rows) {
  if (!rows.length) return 0;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/energy_prices?on_conflict=country_code,year,period`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(rows)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Batch upsert ${rows.length} rows: ${res.status} ${text.slice(0, 200)}`);
  }
  return rows.length;
}

// Eurostat uses ISO 3166-1 alpha-2 codes EXCEPT for Greece (EL not GR) and UK (UK not GB).
// We use db_id internally (matches countries.id which is mostly ISO).
// EUROSTAT_COUNTRIES maps Eurostat geo code → { db_id, name }
const EUROSTAT_COUNTRIES = {
  // 25 EU countries + Norway (EFTA, included in NRG_PC_204)
  DE: { db_id: 'DE', name: 'Germany' },
  FR: { db_id: 'FR', name: 'France' },
  NL: { db_id: 'NL', name: 'Netherlands' },
  BE: { db_id: 'BE', name: 'Belgium' },
  IT: { db_id: 'IT', name: 'Italy' },
  SE: { db_id: 'SE', name: 'Sweden' },
  PL: { db_id: 'PL', name: 'Poland' },
  ES: { db_id: 'ES', name: 'Spain' },
  AT: { db_id: 'AT', name: 'Austria' },
  EL: { db_id: 'GR', name: 'Greece' },              // Eurostat uses EL for Greece
  CZ: { db_id: 'CZ', name: 'Czech Republic' },
  DK: { db_id: 'DK', name: 'Denmark' },
  FI: { db_id: 'FI', name: 'Finland' },
  SI: { db_id: 'SI', name: 'Slovenia' },
  RO: { db_id: 'RO', name: 'Romania' },
  EE: { db_id: 'EE', name: 'Estonia' },
  HU: { db_id: 'HU', name: 'Hungary' },
  HR: { db_id: 'HR', name: 'Croatia' },
  BG: { db_id: 'BG', name: 'Bulgaria' },
  LT: { db_id: 'LT', name: 'Lithuania' },
  LV: { db_id: 'LV', name: 'Latvia' },
  IE: { db_id: 'IE', name: 'Ireland' },
  LU: { db_id: 'LU', name: 'Luxembourg' },
  SK: { db_id: 'SK', name: 'Slovakia' },
  PT: { db_id: 'PT', name: 'Portugal' },
  NO: { db_id: 'NO', name: 'Norway' },
  // Western Balkans + Turkey — Eurostat covers these too
  BA: { db_id: 'BA', name: 'Bosnia-Herzegovina' },
  RS: { db_id: 'RS', name: 'Serbia-Montenegro' },
  TR: { db_id: 'TR', name: 'Turkey' }
  // Not covered by Eurostat: CH (handled by ElCom), GB (handled by DESNZ), UA (manual)
};

// Groq call with automatic model fallback on quota errors
const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
async function groqChat(groq, messages, opts = {}) {
  for (const model of GROQ_MODELS) {
    try {
      return await groq.chat.completions.create({ ...opts, model, messages });
    } catch (e) {
      if (e?.status === 429 || (e?.message || '').includes('429') || (e?.message || '').includes('rate_limit')) {
        continue; // try next model
      }
      throw e; // non-quota error, rethrow
    }
  }
  throw new Error('All Groq models quota exhausted');
}

module.exports = async function handler(req, res) {
  try {
    // Auth check — only allow Vercel Cron or requests with secret
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = req.headers['x-vercel-cron'] === '1';

    if (!isVercelCron && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
    const GROQ_KEY = process.env.GROQ_API_KEY;
    const ALERT_EMAIL = 'bulanovaaaleksandra@gmail.com';

    if (!SUPABASE_URL || !SUPABASE_KEY || !GROQ_KEY) {
      return res.status(500).json({ error: 'Missing environment variables' });
    }

    const groq = new Groq({ apiKey: GROQ_KEY });
    const results = { news: 0, prices: 0, market: 0, alerts: [], errors: [] };
    const today = new Date();
    const isFirstOfMonth = today.getDate() === 1;
    // Manual override for testing (requires CRON_SECRET auth)
    const forcePrices = req.query?.run_prices === '1';
    const runMonthly = isFirstOfMonth || forcePrices;

    // Get countries
    const countriesRes = await fetch(`${SUPABASE_URL}/rest/v1/countries?select=id,name,electricity_price,gas_price,market_size,subsidy_program,max_subsidy&order=sort_weight.desc`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const countries = await countriesRes.json();
    // Tiered news: top 5 countries = 6 articles, top 6-10 = 3 articles, rest = skip
    // Top 5 by verified 2025 market data: DE, FR, NL, GB, IT
    const TOP5 = new Set(['DE','FR','NL','GB','IT']);
    const TOP10 = new Set(['SE','PL','ES','AT','BE','CH']);
    // Top 5 = 6 articles, Top 6-11 = 3 articles, rest = 1 article
    const topCountries = countries;

    // === DAILY: Manufacturer news FIRST (runs before country news to ensure quota) ===
    const currentYear = today.getFullYear(); // dynamic year — no hardcoded "2026"
    results.manufacturer_block_entered = true; // DEBUG: confirm this code path runs
    try {
      // Top HP manufacturers by European market share (hydronic focus)
      // Grouped with OR for efficiency: 1 query catches multiple brands
      // DE locale works best for HP manufacturer news (German press dominates HP coverage)
      // One query per major brand to maximize results
      const mfgRssFeeds = [
        { q: 'Daikin Wärmepumpe', hl: 'de', gl: 'DE', ceid: 'DE:de' },
        { q: 'Bosch Wärmepumpe', hl: 'de', gl: 'DE', ceid: 'DE:de' },
        { q: 'Vaillant Wärmepumpe', hl: 'de', gl: 'DE', ceid: 'DE:de' },
        { q: 'Viessmann Wärmepumpe', hl: 'de', gl: 'DE', ceid: 'DE:de' },
        { q: 'NIBE Wärmepumpe', hl: 'de', gl: 'DE', ceid: 'DE:de' },
        { q: 'Stiebel Eltron Wärmepumpe', hl: 'de', gl: 'DE', ceid: 'DE:de' },
        { q: 'Mitsubishi Wärmepumpe', hl: 'de', gl: 'DE', ceid: 'DE:de' },
        { q: 'Panasonic Wärmepumpe', hl: 'de', gl: 'DE', ceid: 'DE:de' }
      ];
      let mfgArticles = [];
      for (const feed of mfgRssFeeds) {
        try {
          const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(feed.q)}&hl=${feed.hl}&gl=${feed.gl}&ceid=${feed.ceid}`;
          const rssRes = await fetch(rssUrl);
          const rssText = await rssRes.text();
          const itemRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<source[^>]*>([\s\S]*?)<\/source>[\s\S]*?<\/item>/g;
          let match;
          while ((match = itemRegex.exec(rssText)) !== null && mfgArticles.length < 15) {
            const pubDate = new Date(match[3].trim());
            const daysDiff = (today - pubDate) / (1000 * 60 * 60 * 24);
            // 60-day window for manufacturers — HP brands publish less frequently than country news.
            // 14d window (used for country news) returned 0 mfg articles in production tests.
            if (daysDiff <= 60) {
              const title = match[1].trim().replace(/<!\[CDATA\[|\]\]>/g, '');
              if (!mfgArticles.some(a => a.title === title)) {
                mfgArticles.push({ title, url: match[2].trim(), date: pubDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), source: match[4].trim().replace(/<!\[CDATA\[|\]\]>/g, '') });
              }
            }
          }
        } catch (e) { results.mfg_feed_errors = (results.mfg_feed_errors || 0) + 1; }
      }

      // Cooling Post (UK industry source) — high-quality manufacturer news, not rate-limited
      // Reliable backup when Google News throttles Vercel IP
      try {
        const cpRes = await fetch('https://www.coolingpost.com/feed/');
        const cpText = await cpRes.text();
        // WordPress RSS uses dc:creator instead of <source>; parse with simpler regex
        const cpRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<\/item>/g;
        let cpMatch;
        let cpAdded = 0;
        while ((cpMatch = cpRegex.exec(cpText)) !== null && cpAdded < 10) {
          const pubDate = new Date(cpMatch[3].trim());
          const daysDiff = (today - pubDate) / (1000 * 60 * 60 * 24);
          if (daysDiff <= 60) {
            const title = cpMatch[1].trim().replace(/<!\[CDATA\[|\]\]>/g, '');
            if (!mfgArticles.some(a => a.title === title)) {
              mfgArticles.push({
                title,
                url: cpMatch[2].trim(),
                date: pubDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                source: 'Cooling Post'
              });
              cpAdded++;
            }
          }
        }
        results.cooling_post_added = cpAdded;
      } catch (e) { results.errors.push(`Cooling Post: ${e.message}`); }

      results.mfg_articles_fetched = mfgArticles.length;
      if (mfgArticles.length > 0) {
        const mfgList = mfgArticles.map((a, i) => `${i+1}. "${a.title}" (${a.source}, ${a.date})`).join('\n');
        const mfgCompletion = await groqChat(groq, [
            { role: 'system', content: 'You curate PRODUCT-focused news about heat pump manufacturers. Return JSON only.' },
            { role: 'user', content: `News articles potentially about heat pump manufacturers:\n\n${mfgList}\n\n=== ACCEPT (must be about a SPECIFIC named brand) ===\n• New heat pump model / product launch (e.g., "LG launches Therma V R290")\n• Refrigerant or technology release (R290, R32, propane, CO2)\n• Factory news (new plant, capacity expansion, layoffs, relocation)\n• M&A / partnerships / acquisitions involving a brand\n• Financial results / sales volumes by brand\n• New B2B distribution or rental fleet from a brand\n\n=== REJECT (do NOT include even if a brand is mentioned) ===\n• Subsidy / grant / funding programs\n• Government policy / regulation / EPBD / tax credit\n• Generic market trend articles ("heat pump sales up in Country X")\n• Energy price news / electricity / gas tariffs\n• Installation tips / consumer guides / buying advice\n\nFor each ACCEPTED article identify the MANUFACTURER NAME (e.g., "Bosch", "Daikin", "Vaillant", "LG", "NIBE").\n\nIMPORTANT: If multiple articles describe the SAME event from different outlets, merge into ONE summary.\n\nReturn: {"items": [{"title": "ManufacturerName: headline max 80 chars", "description": "2-3 sentences explaining the product/business news", "impact": "critical|medium|info", "manufacturer": "ManufacturerName", "original_index": number}]}\n\nIf NO articles match ACCEPT criteria: {"items": []}` }
          ], { temperature: 0.2, max_tokens: 800, response_format: { type: 'json_object' } });
        const mfgContent = mfgCompletion.choices[0]?.message?.content;
        if (mfgContent) {
          let mfgItems;
          try { mfgItems = JSON.parse(mfgContent).items || []; } catch (e) { mfgItems = []; }
          results.mfg_items_extracted = mfgItems.length;
          for (const item of mfgItems) {
            if (!item.title || !item.manufacturer) continue;
            const origArticle = mfgArticles[item.original_index - 1] || mfgArticles[0];
            const existCheck = await fetch(`${SUPABASE_URL}/rest/v1/news?category=eq.manufacturer&title=eq.${encodeURIComponent(item.title)}&limit=1`, {
              headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            const existing = await existCheck.json();
            if (existing.length > 0) continue;
            const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/news`, {
              method: 'POST',
              headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
              body: JSON.stringify({
                country_id: 'MFG', date: origArticle.date, title: item.title,
                description: item.description || '', impact: item.impact || 'info',
                source_name: origArticle.source || '', source_url: origArticle.url || '',
                category: 'manufacturer'
              })
            });
            if (insertRes.ok) {
              results.mfg_news = (results.mfg_news || 0) + 1;
            } else {
              const errBody = await insertRes.text().catch(() => '');
              results.errors.push(`MFG insert HTTP ${insertRes.status}: ${errBody.slice(0, 150)}`);
              results.mfg_insert_failed = (results.mfg_insert_failed || 0) + 1;
            }
          }
        }
      }
    } catch (e) { results.errors.push(`Manufacturer news: ${e.message}`); }

    // === DAILY: EHPA EU-level policy feed (supplements country-specific Google News) ===
    // EHPA covers EU-wide policy announcements, industry letters, country-specific updates.
    // We fetch once, then per-country filter by country-name match to add to that country's article pool.
    let ehpaArticles = [];
    try {
      const ehpaRes = await fetch('https://www.ehpa.org/feed/');
      const ehpaText = await ehpaRes.text();
      const ehpaRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>(?:[\s\S]*?<description>([\s\S]*?)<\/description>)?[\s\S]*?<\/item>/g;
      let m;
      while ((m = ehpaRegex.exec(ehpaText)) !== null) {
        const pubDate = new Date(m[3].trim());
        const daysDiff = (today - pubDate) / (1000 * 60 * 60 * 24);
        if (daysDiff <= 14) {
          ehpaArticles.push({
            title: m[1].trim().replace(/<!\[CDATA\[|\]\]>/g, ''),
            url: m[2].trim(),
            date: pubDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            source: 'EHPA',
            description: (m[4] || '').trim().replace(/<!\[CDATA\[|\]\]>/g, '').slice(0, 300)
          });
        }
      }
      results.ehpa_articles_fetched = ehpaArticles.length;
    } catch (e) { results.errors.push(`EHPA: ${e.message}`); }

    // === DAILY: Country news from Google News RSS ===
    for (const country of topCountries) {
      try {
        // Local language searches — PRIMARY source for each country
        const Y = currentYear;
        const localQueries = {
          'DE': {q:`Wärmepumpe Förderung Heizung ${Y}`,hl:'de',gl:'DE',ceid:'DE:de'},
          'FR': {q:`pompe à chaleur subvention prime ${Y}`,hl:'fr',gl:'FR',ceid:'FR:fr'},
          'NL': {q:`warmtepomp subsidie ISDE ${Y}`,hl:'nl',gl:'NL',ceid:'NL:nl'},
          'GB': {q:`heat pump grant boiler upgrade scheme UK ${Y}`,hl:'en',gl:'GB',ceid:'GB:en'},
          'IT': {q:`pompa di calore incentivi conto termico ${Y}`,hl:'it',gl:'IT',ceid:'IT:it'},
          'ES': {q:`bomba de calor subvención aerotermia ${Y}`,hl:'es',gl:'ES',ceid:'ES:es'},
          'PL': {q:`pompa ciepła dotacja czyste powietrze ${Y}`,hl:'pl',gl:'PL',ceid:'PL:pl'},
          'AT': {q:`Wärmepumpe Förderung Österreich ${Y}`,hl:'de',gl:'AT',ceid:'AT:de'},
          'CH': {q:`Wärmepumpe Förderung Schweiz Gebäudeprogramm ${Y}`,hl:'de',gl:'CH',ceid:'CH:de'},
          'SE': {q:`värmepump bidrag Sverige ${Y}`,hl:'sv',gl:'SE',ceid:'SE:sv'},
          'NO': {q:`varmepumpe tilskudd Enova ${Y}`,hl:'no',gl:'NO',ceid:'NO:no'},
          'DK': {q:`varmepumpe tilskud Danmark ${Y}`,hl:'da',gl:'DK',ceid:'DK:da'},
          'FI': {q:`lämpöpumppu tuki ARA ${Y}`,hl:'fi',gl:'FI',ceid:'FI:fi'},
          'CZ': {q:`tepelné čerpadlo dotace zelená úsporám ${Y}`,hl:'cs',gl:'CZ',ceid:'CZ:cs'},
          'GR': {q:`αντλία θερμότητας επιδότηση εξοικονομώ ${Y}`,hl:'el',gl:'GR',ceid:'GR:el'},
          'IE': {q:`heat pump grant SEAI Ireland ${Y}`,hl:'en',gl:'IE',ceid:'IE:en'},
          'RO': {q:`pompa de caldura casa verde subventie ${Y}`,hl:'ro',gl:'RO',ceid:'RO:ro'},
          'HU': {q:`hőszivattyú pályázat támogatás ${Y}`,hl:'hu',gl:'HU',ceid:'HU:hu'},
          'SI': {q:`toplotna črpalka subvencija eko sklad ${Y}`,hl:'sl',gl:'SI',ceid:'SI:sl'},
          'BG': {q:`термопомпа субсидия ${Y}`,hl:'bg',gl:'BG',ceid:'BG:bg'},
          'SK': {q:`tepelné čerpadlo dotácia zelená domácnostiam ${Y}`,hl:'sk',gl:'SK',ceid:'SK:sk'},
          'HR': {q:`dizalica topline subvencija energetska obnova ${Y}`,hl:'hr',gl:'HR',ceid:'HR:hr'},
          'LV': {q:`siltumsūknis atbalsts programma ${Y}`,hl:'lv',gl:'LV',ceid:'LV:lv'},
          'LT': {q:`šilumos siurblys parama ${Y}`,hl:'lt',gl:'LT',ceid:'LT:lt'},
          'EE': {q:`soojuspump toetus KredEx ${Y}`,hl:'et',gl:'EE',ceid:'EE:et'},
          'PT': {q:`bomba de calor subsidio energia ${Y}`,hl:'pt',gl:'PT',ceid:'PT:pt'}
        };
        const enQuery = encodeURIComponent(`heat pump subsidy ${country.name} ${Y}`);
        const enRssUrl = `https://news.google.com/rss/search?q=${enQuery}&hl=en&gl=US&ceid=US:en`;
        const localCfg = localQueries[country.id];
        const localRssUrl = localCfg ? `https://news.google.com/rss/search?q=${encodeURIComponent(localCfg.q)}&hl=${localCfg.hl}&gl=${localCfg.gl}&ceid=${localCfg.ceid}` : null;
        // Extra EN search for key countries with broader terms
        const extraQueries = {
          'DE': 'Germany heat pump heating policy BEG KfW Wärmepumpe',
          'FR': 'France heat pump MaPrimeRenov pompe chaleur',
          'GB': 'UK heat pump boiler upgrade scheme grant'
        };
        const extraQuery = extraQueries[country.id];
        const extraRssUrl = extraQuery ? `https://news.google.com/rss/search?q=${encodeURIComponent(extraQuery)}&hl=en&gl=US&ceid=US:en` : null;
        const maxArticles = TOP5.has(country.id) ? 6 : TOP10.has(country.id) ? 3 : 1; // Top5=6, Top6-11=3, rest=1

        let articles = [];
        // Fetch from both English and local language RSS
        // Local language FIRST (better results), then EN as supplement
        const rssUrls = [];
        if (localRssUrl) rssUrls.push(localRssUrl);
        rssUrls.push(enRssUrl);
        if (extraRssUrl) rssUrls.push(extraRssUrl);

        for (const rssUrl of rssUrls) {
          try {
            const rssRes = await fetch(rssUrl);
            const rssText = await rssRes.text();
            const itemRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<source[^>]*>([\s\S]*?)<\/source>[\s\S]*?<\/item>/g;
            let match;
            while ((match = itemRegex.exec(rssText)) !== null && articles.length < maxArticles) {
              const pubDate = new Date(match[3].trim());
              const daysDiff = (today - pubDate) / (1000 * 60 * 60 * 24);
              if (daysDiff <= 30) {
                const title = match[1].trim().replace(/<!\[CDATA\[|\]\]>/g, '');
                // Avoid duplicates from different language feeds
                if (!articles.some(a => a.title === title)) {
                  articles.push({
                    title,
                    url: match[2].trim(),
                    date: pubDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                    source: match[4].trim().replace(/<!\[CDATA\[|\]\]>/g, '')
                  });
                }
              }
            }
          } catch (e) { /* skip this feed */ }
        }

        // Merge relevant EHPA articles (EU-level source) — match by country name in title/description
        for (const ehpa of ehpaArticles) {
          if (articles.length >= maxArticles) break;
          const hay = (ehpa.title + ' ' + ehpa.description).toLowerCase();
          if (hay.includes(country.name.toLowerCase()) && !articles.some(a => a.title === ehpa.title)) {
            articles.push({ title: ehpa.title, url: ehpa.url, date: ehpa.date, source: ehpa.source });
          }
        }

        if (articles.length === 0) continue;

        const articleList = articles.map((a, i) => `${i + 1}. "${a.title}" (${a.source}, ${a.date})`).join('\n');

        // Llama: news summarization only (subsidy/market extraction moved to Gemini cron)
        const completion = await groqChat(groq, [
            { role: 'system', content: 'You analyze real news articles about heat pump subsidies and policy. Return JSON only.' },
            { role: 'user', content: `Real news articles about heat pumps in ${country.name}:\n\n${articleList}\n\nFor each RELEVANT article (subsidies, energy policy, heating regulations), create a summary.\n\nIMPORTANT DEDUP RULE: If multiple articles describe the SAME event or topic (e.g. same subsidy change reported by different outlets), merge them into ONE summary and note all sources. Do not create separate entries for the same story from different websites.\n\nReturn: {"items": [{"title": "headline max 80 chars", "description": "2-3 sentences", "impact": "critical|medium|info", "original_index": number}]}\n\nSkip unrelated. If none relevant: {"items": []}` }
          ], { temperature: 0.2, max_tokens: 800, response_format: { type: 'json_object' } });

        const content = completion.choices[0]?.message?.content;
        if (!content) continue;

        let newsItems;
        try { newsItems = JSON.parse(content).items || []; } catch (e) { continue; }

        for (const item of newsItems) {
          if (!item.title) continue;
          const origArticle = articles[item.original_index - 1] || articles[0];

          // Check duplicates
          const existCheck = await fetch(
            `${SUPABASE_URL}/rest/v1/news?country_id=eq.${country.id}&title=eq.${encodeURIComponent(item.title)}&limit=1`,
            { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
          );
          const existing = await existCheck.json();
          if (existing.length > 0) continue;

          // Check if critical — add to alerts
          if (item.impact === 'critical') {
            results.alerts.push({ country: country.name, title: item.title });
          }

          await fetch(`${SUPABASE_URL}/rest/v1/news`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({
              country_id: country.id, date: origArticle.date, title: item.title,
              description: item.description || '', impact: item.impact || 'info',
              source_name: origArticle.source || '', source_url: origArticle.url || '', category: 'subsidy'
            })
          });
          results.news++;
        }
      } catch (e) { results.errors.push(`News ${country.name}: ${e.message}`); }
    }

    // === MONTHLY (1st of month) or ?run_prices=1: REAL energy prices from Eurostat + ElCom ===
    if (runMonthly) {
      const MIN_YEAR = 2020; // only keep recent history (matches the chart range)
      const nowIso = new Date().toISOString();
      const elecSrcUrl = 'https://ec.europa.eu/eurostat/databrowser/view/nrg_pc_204/default/table';
      // Track all rows we wrote, so we can sync the countries table afterwards
      const allFreshRows = [];

      // --- 1. Eurostat electricity (NRG_PC_204) + gas (NRG_PC_202) for 29 countries ---
      // (25 EU + Norway + Bosnia + Serbia + Turkey)
      try {
        const eurostatCodes = Object.keys(EUROSTAT_COUNTRIES);
        const geoQuery = eurostatCodes.map(c => `geo=${c}`).join('&');
        const elec = await fetchEurostat('nrg_pc_204',
          `siec=E7000&nrg_cons=KWH2500-4999&unit=KWH&tax=I_TAX&currency=EUR&${geoQuery}`);
        const gas = await fetchEurostat('nrg_pc_202',
          `siec=G3000&nrg_cons=GJ20-199&unit=KWH&tax=I_TAX&currency=EUR&${geoQuery}`);

        const euRows = [];
        for (const eurostatCode of eurostatCodes) {
          const meta = EUROSTAT_COUNTRIES[eurostatCode];
          const elecData = elec.data[eurostatCode] || {};
          const gasData = gas.data[eurostatCode] || {};
          const allPeriods = new Set([...Object.keys(elecData), ...Object.keys(gasData)]);

          for (const periodCode of allPeriods) {
            const m = periodCode.match(/^(\d{4})-S(\d)$/);
            if (!m) continue;
            const year = parseInt(m[1]);
            if (year < MIN_YEAR) continue;
            euRows.push({
              country_code: meta.db_id,           // use our DB code (e.g., GR not EL)
              country_name: meta.name,
              year,
              period: `H${m[2]}`,
              electricity_eur_kwh: elecData[periodCode] ?? null,
              gas_eur_kwh: gasData[periodCode] ?? null,
              source: 'eurostat',
              source_url: elecSrcUrl,
              updated_at: nowIso
            });
          }
        }
        const written = await upsertEnergyPrices(SUPABASE_URL, SUPABASE_KEY, euRows);
        results.prices += written;
        allFreshRows.push(...euRows);
      } catch (e) {
        results.errors.push(`Eurostat: ${e.message}`);
      }

      // --- 2. Switzerland (ElCom SPARQL, annual, last 6 years) ---
      try {
        const chfRate = await fetchEcbRate('CHF');
        const currentYear = today.getFullYear();
        const chRows = [];
        for (let y = currentYear; y >= MIN_YEAR; y--) {
          const chfPerKwh = await fetchSwissElectricity(y);
          if (chfPerKwh != null) {
            chRows.push({
              country_code: 'CH',
              country_name: 'Switzerland',
              year: y,
              period: 'A',
              electricity_eur_kwh: +(chfPerKwh * chfRate).toFixed(5),
              gas_eur_kwh: null,
              source: 'elcom',
              source_url: 'https://www.strompreis.elcom.admin.ch/',
              updated_at: nowIso
            });
          }
        }
        const written = await upsertEnergyPrices(SUPABASE_URL, SUPABASE_KEY, chRows);
        results.prices += written;
        allFreshRows.push(...chRows);
      } catch (e) {
        results.errors.push(`ElCom: ${e.message}`);
      }

      // --- 3. UK (gov.uk DESNZ IEA tables, annual data) ---
      try {
        const [ukElec, ukGas, gbpRate] = await Promise.all([
          fetchUkPricesFromDesnz('electricity'),
          fetchUkPricesFromDesnz('gas'),
          fetchEcbRate('GBP')
        ]);
        // Merge electricity + gas by year, filter to MIN_YEAR onwards
        const ukByYear = {};
        for (const { year, pence } of ukElec) {
          if (year < MIN_YEAR) continue;
          ukByYear[year] = ukByYear[year] || { year };
          ukByYear[year].electricity_eur_kwh = +((pence / 100) * gbpRate).toFixed(5);
        }
        for (const { year, pence } of ukGas) {
          if (year < MIN_YEAR) continue;
          ukByYear[year] = ukByYear[year] || { year };
          ukByYear[year].gas_eur_kwh = +((pence / 100) * gbpRate).toFixed(5);
        }
        const ukRows = Object.values(ukByYear).map(r => ({
          country_code: 'GB',
          country_name: 'UK',
          year: r.year,
          period: 'A',
          electricity_eur_kwh: r.electricity_eur_kwh ?? null,
          gas_eur_kwh: r.gas_eur_kwh ?? null,
          source: 'gov-uk-desnz',
          source_url: 'https://www.gov.uk/government/statistical-data-sets/international-domestic-energy-prices',
          updated_at: nowIso
        }));
        const written = await upsertEnergyPrices(SUPABASE_URL, SUPABASE_KEY, ukRows);
        results.prices += written;
        allFreshRows.push(...ukRows);
      } catch (e) {
        results.errors.push(`UK DESNZ: ${e.message}`);
      }

      // --- 4. SYNC: patch countries.electricity_price/gas_price/price_ratio ---
      // For each country, compute the LATEST YEAR's ANNUAL value using the same priority as
      // the front-end chart: average(H1+H2) → H2 → H1 → A. This guarantees that
      // index.html (countries.*) and energy-prices.html (energy_prices.*) show identical numbers.
      try {
        // Group fresh rows by country → year → period
        const grouped = {};
        for (const r of allFreshRows) {
          if (!grouped[r.country_code]) grouped[r.country_code] = {};
          if (!grouped[r.country_code][r.year]) grouped[r.country_code][r.year] = {};
          grouped[r.country_code][r.year][r.period] = r;
        }
        // For each country, find latest year and compute annual aggregate
        let synced = 0;
        for (const [code, byYear] of Object.entries(grouped)) {
          const latestYear = Math.max(...Object.keys(byYear).map(Number));
          const yd = byYear[latestYear];
          let elec = null, gas = null;
          if (yd.H1 && yd.H2) {
            // Average both semesters when both available
            elec = (yd.H1.electricity_eur_kwh != null && yd.H2.electricity_eur_kwh != null)
              ? +((yd.H1.electricity_eur_kwh + yd.H2.electricity_eur_kwh) / 2).toFixed(5)
              : (yd.H2.electricity_eur_kwh ?? yd.H1.electricity_eur_kwh);
            gas = (yd.H1.gas_eur_kwh != null && yd.H2.gas_eur_kwh != null)
              ? +((yd.H1.gas_eur_kwh + yd.H2.gas_eur_kwh) / 2).toFixed(5)
              : (yd.H2.gas_eur_kwh ?? yd.H1.gas_eur_kwh);
          } else if (yd.H2) {
            elec = yd.H2.electricity_eur_kwh; gas = yd.H2.gas_eur_kwh;
          } else if (yd.H1) {
            elec = yd.H1.electricity_eur_kwh; gas = yd.H1.gas_eur_kwh;
          } else if (yd.A) {
            elec = yd.A.electricity_eur_kwh; gas = yd.A.gas_eur_kwh;
          }
          const ratio = (elec && gas) ? +(elec / gas).toFixed(2) : null;
          // Защита: патчим только не-null значения. Если Eurostat молчит по
          // gas (как у Польши с 2023-S2), сохраняем последнее известное значение
          // вместо перезаписи NULL.
          const patch = { updated_at: nowIso };
          if (elec != null) patch.electricity_price = elec;
          if (gas != null) patch.gas_price = gas;
          if (ratio != null) patch.price_ratio = ratio;
          const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/countries?id=eq.${code}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify(patch)
          });
          if (patchRes.ok) synced++;
          else results.errors.push(`Sync ${code}: ${patchRes.status}`);
        }
        results.countries_synced = synced;
      } catch (e) {
        results.errors.push(`Sync countries: ${e.message}`);
      }

      // Market data — only on real 1st-of-month cron (skip when ?run_prices=1)
      // NOTE: this block still uses Llama hallucination (legacy from before Phase C).
      // Will be replaced with real source in a future task.
      if (isFirstOfMonth) for (const country of topCountries) {
        try {
          const query = encodeURIComponent(`${country.name} heat pump sales 2025 2026 units market`);
          const completion = await groqChat(groq, [
              { role: 'system', content: 'You track heat pump market data. Return JSON only.' },
              { role: 'user', content: `Current market data for ${country.name}: ${country.market_size}k units. Based on latest available reports, is there newer data?\n\nReturn: {"market_size": number_in_thousands, "year": YYYY, "source": "source name", "updated": true}\nIf no update: {"updated": false}` }
            ], { temperature: 0.1, max_tokens: 200, response_format: { type: 'json_object' } });

          const mktContent = completion.choices[0]?.message?.content;
          if (mktContent) {
            const mktData = JSON.parse(mktContent);
            if (mktData.updated && mktData.market_size) {
              await fetch(`${SUPABASE_URL}/rest/v1/countries?id=eq.${country.id}`, {
                method: 'PATCH',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  market_size: mktData.market_size,
                  market_year: mktData.year,
                  data_source: mktData.source || country.data_source,
                  updated_at: new Date().toISOString()
                })
              });
              results.market++;
            }
          }
        } catch (e) { results.errors.push(`Market ${country.name}: ${e.message}`); }
      }
    }

    // === EMAIL ALERT if critical news found ===
    if (results.alerts.length > 0) {
      // Log alert (email integration can be added via Resend/SendGrid)
      console.log(`🚨 CRITICAL ALERTS for ${ALERT_EMAIL}:`, results.alerts);
      results.email_alert = `${results.alerts.length} critical alert(s) detected. Email: ${ALERT_EMAIL}`;
    }

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      news_added: results.news,
      prices_updated: results.prices,
      market_updated: results.market,
      countries_checked: topCountries.length,
      critical_alerts: results.alerts,
      email_alert: results.email_alert || null,
      monthly_run: runMonthly,
      forced_run: forcePrices,
      errors: results.errors
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
