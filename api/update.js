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

// Country code → display name (Eurostat returns codes; we need names for the table)
const EU_COUNTRIES = {
  DE: 'Germany', FR: 'France', NL: 'Netherlands', IT: 'Italy', ES: 'Spain',
  PL: 'Poland', AT: 'Austria', BE: 'Belgium', SE: 'Sweden', DK: 'Denmark',
  FI: 'Finland', CZ: 'Czech Republic', EE: 'Estonia', LT: 'Lithuania', NO: 'Norway'
};

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
    const topCountries = countries.slice(0, 15);

    // === DAILY: News from Google News RSS ===
    for (const country of topCountries) {
      try {
        // Local language searches — PRIMARY source for each country
        const localQueries = {
          'DE': {q:'Wärmepumpe Förderung Heizung 2026',hl:'de',gl:'DE',ceid:'DE:de'},
          'FR': {q:'pompe à chaleur subvention prime 2026',hl:'fr',gl:'FR',ceid:'FR:fr'},
          'NL': {q:'warmtepomp subsidie ISDE 2026',hl:'nl',gl:'NL',ceid:'NL:nl'},
          'GB': {q:'heat pump grant boiler upgrade scheme UK 2026',hl:'en',gl:'GB',ceid:'GB:en'},
          'IT': {q:'pompa di calore incentivi conto termico 2026',hl:'it',gl:'IT',ceid:'IT:it'},
          'ES': {q:'bomba de calor subvención aerotermia 2026',hl:'es',gl:'ES',ceid:'ES:es'},
          'PL': {q:'pompa ciepła dotacja czyste powietrze 2026',hl:'pl',gl:'PL',ceid:'PL:pl'},
          'AT': {q:'Wärmepumpe Förderung Österreich 2026',hl:'de',gl:'AT',ceid:'AT:de'},
          'CH': {q:'Wärmepumpe Förderung Schweiz Gebäudeprogramm 2026',hl:'de',gl:'CH',ceid:'CH:de'},
          'SE': {q:'värmepump bidrag Sverige 2026',hl:'sv',gl:'SE',ceid:'SE:sv'},
          'NO': {q:'varmepumpe tilskudd Enova 2026',hl:'no',gl:'NO',ceid:'NO:no'},
          'DK': {q:'varmepumpe tilskud Danmark 2026',hl:'da',gl:'DK',ceid:'DK:da'},
          'FI': {q:'lämpöpumppu tuki ARA 2026',hl:'fi',gl:'FI',ceid:'FI:fi'},
          'CZ': {q:'tepelné čerpadlo dotace zelená úsporám 2026',hl:'cs',gl:'CZ',ceid:'CZ:cs'},
          'GR': {q:'αντλία θερμότητας επιδότηση εξοικονομώ 2026',hl:'el',gl:'GR',ceid:'GR:el'},
          'IE': {q:'heat pump grant SEAI Ireland 2026',hl:'en',gl:'IE',ceid:'IE:en'},
          'RO': {q:'pompa de caldura casa verde subventie 2026',hl:'ro',gl:'RO',ceid:'RO:ro'},
          'HU': {q:'hőszivattyú pályázat támogatás 2026',hl:'hu',gl:'HU',ceid:'HU:hu'},
          'SI': {q:'toplotna črpalka subvencija eko sklad 2026',hl:'sl',gl:'SI',ceid:'SI:sl'},
          'BG': {q:'термопомпа субсидия 2026',hl:'bg',gl:'BG',ceid:'BG:bg'},
          'SK': {q:'tepelné čerpadlo dotácia zelená domácnostiam 2026',hl:'sk',gl:'SK',ceid:'SK:sk'},
          'HR': {q:'dizalica topline subvencija energetska obnova 2026',hl:'hr',gl:'HR',ceid:'HR:hr'},
          'LV': {q:'siltumsūknis atbalsts programma 2026',hl:'lv',gl:'LV',ceid:'LV:lv'},
          'LT': {q:'šilumos siurblys parama 2026',hl:'lt',gl:'LT',ceid:'LT:lt'},
          'EE': {q:'soojuspump toetus KredEx 2026',hl:'et',gl:'EE',ceid:'EE:et'},
          'PT': {q:'bomba de calor subsidio energia 2026',hl:'pt',gl:'PT',ceid:'PT:pt'}
        };
        const enQuery = encodeURIComponent(`heat pump subsidy ${country.name} 2026`);
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
        const maxArticles = ['DE','FR','GB'].includes(country.id) ? 10 : 5;

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

        if (articles.length === 0) continue;

        const articleList = articles.map((a, i) => `${i + 1}. "${a.title}" (${a.source}, ${a.date})`).join('\n');

        // Build current-data context for Llama (so it can spot updates vs current values)
        const currentContext = [
          country.max_subsidy ? `max_subsidy: €${country.max_subsidy}` : 'max_subsidy: unknown',
          country.subsidy_program ? `subsidy_program: "${country.subsidy_program}"` : 'subsidy_program: unknown',
          country.market_size ? `market_size: ${country.market_size}k units/year installed` : 'market_size: unknown'
        ].join('\n  ');

        const completion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: 'You analyze real news articles about heat pump policy. Return JSON only. Be conservative — only extract structured data if articles contain clear, specific numeric facts.' },
            { role: 'user', content: `Real news articles about heat pumps in ${country.name}:\n\n${articleList}\n\nCurrent data we track for ${country.name}:\n  ${currentContext}\n\nDo TWO tasks:\n\nTASK 1 — SUMMARIZE: For each RELEVANT article (subsidies, energy policy, heating regulations), create a summary.\n\nTASK 2 — EXTRACT STRUCTURED UPDATES: If any article contains a SPECIFIC NUMERIC OR FACTUAL UPDATE that would change our tracked data, extract it. Examples:\n- "Germany raised BEG to €25,000" → {data_type:"subsidy_amount", field_name:"max_subsidy", new_value:25000}\n- "Germany installed 350k heat pumps in 2025 (EHPA)" → {data_type:"market_size", field_name:"market_size", new_value:350}\n- "Italy abolished Conto Termico" → {data_type:"subsidy_program", field_name:"subsidy_program", new_value:"ABOLISHED"}\n\nRules:\n- Only extract if the article contains a CLEAR SPECIFIC FACT (not speculation, not vague mentions)\n- new_value must be a number for subsidy_amount/market_size, a string for subsidy_program\n- confidence: 0.9+ for crystal-clear specific facts, 0.6-0.9 for clear but indirect, <0.6 for soft mentions\n- If nothing extractable: extractions: []\n\nReturn:\n{\n  "items": [{"title":"headline max 80 chars","description":"2-3 sentences","impact":"critical|medium|info","original_index":N}],\n  "extractions": [{"original_index":N,"data_type":"subsidy_amount|subsidy_program|market_size","field_name":"max_subsidy|subsidy_program|market_size","new_value":<num or string>,"reasoning":"1 sentence","confidence":0.0-1.0}]\n}\n\nIf nothing relevant: {"items":[],"extractions":[]}` }
          ],
          model: 'llama-3.3-70b-versatile', temperature: 0.2, max_tokens: 1500,
          response_format: { type: 'json_object' }
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) continue;

        let newsItems, extractions;
        try {
          const parsed = JSON.parse(content);
          newsItems = parsed.items || [];
          extractions = parsed.extractions || [];
        } catch (e) { continue; }

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

        // === Phase E2: Process structured extractions → pending_data_review ===
        const validFields = new Set(['max_subsidy', 'subsidy_program', 'market_size']);
        for (const ex of extractions) {
          if (!ex || !ex.data_type || !ex.field_name || ex.new_value == null) continue;
          if (!validFields.has(ex.field_name)) continue;
          // Get current DB value
          const currentVal = country[ex.field_name];
          const currentStr = currentVal != null ? String(currentVal) : null;
          const newStr = String(ex.new_value);
          // Skip if no actual change
          if (currentStr === newStr) continue;
          // Skip if value is suspicious (too low/high for the field)
          if (ex.field_name === 'max_subsidy' && (Number(newStr) < 100 || Number(newStr) > 500000)) continue;
          if (ex.field_name === 'market_size' && (Number(newStr) < 0.1 || Number(newStr) > 10000)) continue;

          const origArt = articles[ex.original_index - 1] || articles[0];
          try {
            await fetch(`${SUPABASE_URL}/rest/v1/pending_data_review?on_conflict=country_code,data_type,field_name,source_article_url`, {
              method: 'POST',
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates,return=minimal'
              },
              body: JSON.stringify({
                country_code: country.id,
                data_type: ex.data_type,
                field_name: ex.field_name,
                current_value: currentStr,
                suggested_value: newStr,
                reasoning: ex.reasoning || '',
                source_article_title: origArt.title || '',
                source_article_url: origArt.url || '',
                confidence: typeof ex.confidence === 'number' ? Math.max(0, Math.min(1, ex.confidence)) : 0.5,
                status: 'pending'
              })
            });
            results.extractions = (results.extractions || 0) + 1;
          } catch (e) {
            results.errors.push(`Extraction ${country.id}: ${e.message}`);
          }
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

      // --- 1. Eurostat electricity (NRG_PC_204) + gas (NRG_PC_202) for 14 EU + Norway ---
      try {
        const geoQuery = Object.keys(EU_COUNTRIES).map(c => `geo=${c}`).join('&');
        const elec = await fetchEurostat('nrg_pc_204',
          `siec=E7000&nrg_cons=KWH2500-4999&unit=KWH&tax=I_TAX&currency=EUR&${geoQuery}`);
        const gas = await fetchEurostat('nrg_pc_202',
          `siec=G3000&nrg_cons=GJ20-199&unit=KWH&tax=I_TAX&currency=EUR&${geoQuery}`);

        const euRows = [];
        for (const code of Object.keys(EU_COUNTRIES)) {
          const elecData = elec.data[code] || {};
          const gasData = gas.data[code] || {};
          const allPeriods = new Set([...Object.keys(elecData), ...Object.keys(gasData)]);

          for (const periodCode of allPeriods) {
            const m = periodCode.match(/^(\d{4})-S(\d)$/);
            if (!m) continue;
            const year = parseInt(m[1]);
            if (year < MIN_YEAR) continue; // skip ancient history
            euRows.push({
              country_code: code,
              country_name: EU_COUNTRIES[code],
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
          const patch = {
            electricity_price: elec,
            gas_price: gas,
            price_ratio: ratio,
            updated_at: nowIso
          };
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
          const completion = await groq.chat.completions.create({
            messages: [
              { role: 'system', content: 'You track heat pump market data. Return JSON only.' },
              { role: 'user', content: `Current market data for ${country.name}: ${country.market_size}k units. Based on latest available reports, is there newer data?\n\nReturn: {"market_size": number_in_thousands, "year": YYYY, "source": "source name", "updated": true}\nIf no update: {"updated": false}` }
            ],
            model: 'llama-3.3-70b-versatile', temperature: 0.1, max_tokens: 200,
            response_format: { type: 'json_object' }
          });

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
