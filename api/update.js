const Groq = require('groq-sdk');

module.exports = async function handler(req, res) {
  try {
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

    // Get countries
    const countriesRes = await fetch(`${SUPABASE_URL}/rest/v1/countries?select=id,name,electricity_price,gas_price,market_size,subsidy_program,max_subsidy&order=sort_weight.desc`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const countries = await countriesRes.json();
    const topCountries = countries.slice(0, 15);

    // === DAILY: News from Google News RSS ===
    for (const country of topCountries) {
      try {
        // Local language searches for key countries
        const localQueries = {
          'DE': {q:'Wärmepumpe Förderung Heizung 2026',hl:'de',gl:'DE',ceid:'DE:de'},
          'FR': {q:'pompe à chaleur subvention 2026',hl:'fr',gl:'FR',ceid:'FR:fr'},
          'ES': {q:'bomba de calor subvención 2026',hl:'es',gl:'ES',ceid:'ES:es'},
          'IT': {q:'pompa di calore incentivi 2026',hl:'it',gl:'IT',ceid:'IT:it'},
          'PL': {q:'pompa ciepła dotacja 2026',hl:'pl',gl:'PL',ceid:'PL:pl'},
          'NL': {q:'warmtepomp subsidie 2026',hl:'nl',gl:'NL',ceid:'NL:nl'}
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
        const rssUrls = [enRssUrl];
        if (localRssUrl) rssUrls.push(localRssUrl);
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

        const completion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: 'You analyze real news articles about heat pump subsidies. Return JSON only.' },
            { role: 'user', content: `Real news articles about heat pumps in ${country.name}:\n\n${articleList}\n\nFor each RELEVANT article (subsidies, energy policy, heating regulations), create a summary.\n\nReturn: {"items": [{"title": "headline max 80 chars", "description": "2-3 sentences", "impact": "critical|medium|info", "original_index": number}]}\n\nSkip unrelated. If none relevant: {"items": []}` }
          ],
          model: 'llama-3.3-70b-versatile', temperature: 0.2, max_tokens: 800,
          response_format: { type: 'json_object' }
        });

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

    // === MONTHLY (1st of month): Energy prices + Market data ===
    if (isFirstOfMonth) {
      // Energy prices — search for latest Eurostat data
      for (const country of countries) {
        try {
          const query = encodeURIComponent(`${country.name} electricity price residential 2026 eurostat kWh`);
          const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en&gl=US&ceid=US:en`;
          const rssRes = await fetch(rssUrl);
          const rssText = await rssRes.text();

          // Use Groq to extract price from news
          const completion = await groq.chat.completions.create({
            messages: [
              { role: 'system', content: 'Extract energy prices from news context. Return JSON only.' },
              { role: 'user', content: `Based on the latest available data, what are the current residential electricity and gas prices in ${country.name}? Current values in our database: electricity €${country.electricity_price}/kWh, gas €${country.gas_price || 'N/A'}/kWh.\n\nIf you have more recent data, return: {"electricity": 0.XXX, "gas": 0.XXX, "updated": true}\nIf no update: {"updated": false}` }
            ],
            model: 'llama-3.3-70b-versatile', temperature: 0.1, max_tokens: 200,
            response_format: { type: 'json_object' }
          });

          const priceContent = completion.choices[0]?.message?.content;
          if (priceContent) {
            const priceData = JSON.parse(priceContent);
            if (priceData.updated && priceData.electricity) {
              await fetch(`${SUPABASE_URL}/rest/v1/countries?id=eq.${country.id}`, {
                method: 'PATCH',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  electricity_price: priceData.electricity,
                  gas_price: priceData.gas || country.gas_price,
                  price_ratio: priceData.gas ? (priceData.electricity / priceData.gas).toFixed(2) : country.price_ratio,
                  updated_at: new Date().toISOString()
                })
              });
              results.prices++;
            }
          }
        } catch (e) { results.errors.push(`Prices ${country.name}: ${e.message}`); }
      }

      // Market data — check for new reports
      for (const country of topCountries) {
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
      monthly_run: isFirstOfMonth,
      errors: results.errors
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
