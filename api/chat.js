// api/chat.js — Vercel Serverless Function
// Endpoint: POST /api/chat
// Body: { messages: [{role, content}], questionContext?: {...} }
// Env: GROQ_API_KEY

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages = [], questionContext = null } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages wajib diisi.' });
  }

  // Susun system prompt — kontekstual jika ada soal aktif
  let systemPrompt = `Kamu adalah Asisten CPNS, tutor cerdas untuk simulasi ujian CAT CPNS Indonesia.

Karakter kamu:
- Ramah, sabar, dan memotivasi — seperti kakak kelas yang sudah lulus CPNS
- Menjawab dalam Bahasa Indonesia yang jelas dan mudah dipahami
- Fokus pada materi TWK, TIU, TKP (SKD) dan Akuntansi Pemerintahan (SKB)
- Memberikan penjelasan ringkas namun tepat sasaran

Kemampuan kamu:
- Menjelaskan konsep TWK (UUD 1945, Pancasila, sejarah, bela negara, NKRI)
- Membantu soal TIU (verbal, numerik, figural, analogi, silogisme)
- Menjelaskan strategi menjawab TKP (skala nilai 1-5)
- Materi SKB Akuntansi (akuntansi pemerintahan, SAP, keuangan negara, perpajakan, audit)
- Tips & trik mengerjakan soal CAT dengan efisien
- Membahas strategi passing grade

Aturan:
- Jika ditanya di luar topik CPNS/ujian, arahkan kembali dengan sopan
- Jangan berikan jawaban langsung soal yang sedang dikerjakan tanpa penjelasan konsep
- Selalu dorong peserta untuk memahami, bukan sekadar menghafal
- Maksimal 3 paragraf per jawaban kecuali diminta lebih detail`;

  if (questionContext) {
    const { nomor, subtest, subtestFull, text, tipe, kunciJawaban, options, pembahasanSingkat, nilaiOpsi, jawaban } = questionContext;
    systemPrompt += `

---
KONTEKS SOAL AKTIF (Soal ${nomor} — ${subtestFull || subtest}):
Pertanyaan: ${text}

Pilihan jawaban:
${Object.entries(options || {}).map(([k, v]) => `${k}. ${v}`).join('\n')}
${tipe === 'tkp'
  ? `\nIni soal TKP (Tes Karakteristik Pribadi). Nilai per opsi: ${JSON.stringify(nilaiOpsi || {})}.`
  : `\nKunci jawaban: ${kunciJawaban}${pembahasanSingkat ? `\nPembahasan: ${pembahasanSingkat}` : ''}`
}
${jawaban ? `\nJawaban peserta saat ini: ${jawaban}` : '\nPeserta belum menjawab soal ini.'}

Jika peserta bertanya tentang soal ini, gunakan konteks di atas untuk memberikan penjelasan yang relevan.`;
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',   // ganti ke model Groq lain jika perlu
        max_tokens: 600,
        temperature: 0.5,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-10), // kirim max 10 pesan terakhir untuk hemat token
        ],
      }),
    });

    if (!groqRes.ok) {
      const errData = await groqRes.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Groq API error ${groqRes.status}`);
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content || 'Maaf, tidak ada respons dari AI.';

    return res.status(200).json({ success: true, reply });

  } catch (err) {
    console.error('[chat.js]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
