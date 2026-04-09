import Groq from 'groq-sdk';

export const config = {
  maxDuration: 60,
};

// Cron: every day at 06:00 UTC = 08:00 CET summer, 07:00 CET winter
// Vercel cron defined in vercel.json

export default async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
    const GROQ_KEY = process.env.GROQ_API_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY || !GROQ_KEY) {
      return res.status(500).json({ error: 'Missing environment variables' });
    }

    const groq = new Groq({ apiKey: GROQ_KEY });
    const results = { news: 0, errors: [] };

    // Get all countries from Supabase
    const countriesRes = await fetch(`${SUPABASE_URL}/rest/v1/countries?select=id,name&order=sort_weight.desc`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const countries = await countriesRes.json();

    // Search news for top 15 countries (by market size)
    const topCountries = countries.slice(0, 15);

    for (const country of topCountries) {
      try {
        const completion = await groq.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `You are a heat pump subsidy news analyst. Search for the latest news about heat pump subsidies, energy policy, and heating regulations in ${country.name}. Return JSON only.`
            },
            {
              role: 'user',
              content: `Find the most recent news (last 30 days) about heat pump subsidies or heating policy changes in ${country.name}.

Return a JSON array of 0-3 news items. If no recent news, return empty array [].

Format:
[{
  "title": "short headline",
  "description": "2-3 sentence summary",
  "impact": "critical|medium|info",
  "source_name": "source name",
  "source_url": "https://...",
  "date": "Mon YYYY"
}]

Only return the JSON array, nothing else.`
            }
          ],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.3,
          max_tokens: 1000,
          response_format: { type: 'json_object' }
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
          let newsItems;
          try {
            const parsed = JSON.parse(content);
            newsItems = Array.isArray(parsed) ? parsed : (parsed.news || parsed.items || []);
          } catch (e) {
            continue;
          }

          for (const item of newsItems) {
            if (!item.title) continue;

            // Check if news already exists (avoid duplicates)
            const existCheck = await fetch(
              `${SUPABASE_URL}/rest/v1/news?country_id=eq.${country.id}&title=eq.${encodeURIComponent(item.title)}&limit=1`,
              { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
            );
            const existing = await existCheck.json();
            if (existing.length > 0) continue;

            // Insert new news
            await fetch(`${SUPABASE_URL}/rest/v1/news`, {
              method: 'POST',
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify({
                country_id: country.id,
                date: item.date || new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                title: item.title,
                description: item.description || '',
                impact: item.impact || 'info',
                source_name: item.source_name || '',
                source_url: item.source_url || '',
                category: 'subsidy'
              })
            });
            results.news++;
          }
        }
      } catch (e) {
        results.errors.push(`${country.name}: ${e.message}`);
      }
    }

    // Check if 1st of month — update prices and market data
    const today = new Date();
    if (today.getDate() === 1) {
      results.monthly = 'Monthly update triggered (1st of month)';
      // TODO: Add Eurostat API parsing for energy prices
      // TODO: Add EHPA/national association parsing for market data
    }

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      news_added: results.news,
      countries_checked: topCountries.length,
      errors: results.errors,
      monthly: results.monthly || null
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
