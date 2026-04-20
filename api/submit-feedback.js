module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const RESEND_KEY = (process.env.RESEND_KEY || '').trim();
  const ALERT_EMAIL = 'bulanovaaaleksandra@gmail.com';

  try {
    const { message } = req.body || {};
    if (!message || typeof message !== 'string' || message.trim().length < 3) {
      return res.status(400).json({ error: 'Message too short' });
    }
    if (message.length > 5000) {
      return res.status(400).json({ error: 'Message too long (max 5000 chars)' });
    }

    // Honeypot: reject if hidden field is filled (anti-spam)
    if (req.body.website) return res.status(200).json({ ok: true }); // silent reject

    const cleanMsg = message.trim().slice(0, 5000);

    // 1. Save to Supabase
    if (SUPABASE_URL && SUPABASE_KEY) {
      await fetch(`${SUPABASE_URL}/rest/v1/feedback`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ message: cleanMsg })
      });
    }

    // 2. Send email via Resend (if key configured)
    if (RESEND_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'HP Subsidy Monitor <onboarding@resend.dev>',
          to: ALERT_EMAIL,
          subject: 'New anonymous feedback — HP Subsidy Monitor',
          text: `New anonymous feedback received:\n\n${cleanMsg}\n\n---\nSent from HP Subsidy Monitor feedback form\n${new Date().toISOString()}`
        })
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Internal error' });
  }
};
