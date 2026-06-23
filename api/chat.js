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

  // Deteksi tipe ujian dari konteks soal
  const subtest = questionContext?.subtest || '';
  const isEnglish = ['ERRORREC', 'READCOMP'].includes(subtest);
  const isTKP     = questionContext?.tipe === 'tkp';
  const isNumeric  = ['TIU'].includes(subtest);

  // ─── System Prompt Utama ──────────────────────────────────────────
  let systemPrompt = `Kamu adalah Asisten Ujian, tutor cerdas untuk simulasi ujian seleksi di Indonesia — mencakup CAT CPNS (SKD & SKB) dan English Proficiency Test untuk Rekrutmen Bersama BUMN 2025.

KARAKTER KAMU:
- Ramah, sabar, dan memotivasi — seperti kakak kelas berpengalaman
- Menjawab dalam Bahasa Indonesia yang jelas, kecuali jika soalnya dalam bahasa Inggris (jawab campuran: penjelasan Indonesia, kutipan soal tetap Inggris)
- Langsung ke inti jawaban — tidak perlu basa-basi panjang
- Tidak pernah menolak pertanyaan apapun yang berkaitan dengan soal yang sedang dikerjakan

KEMAMPUAN KAMU:
1. SKD — TWK: UUD 1945, Pancasila, NKRI, Bhinneka, Integritas, Bahasa Indonesia
2. SKD — TIU: verbal (analogi, silogisme), numerik (aritmatika, deret, aljabar, soal cerita), figural
3. SKD — TKP: strategi menjawab, memahami skala nilai 1–5, analisis skenario perilaku ASN
4. SKB Akuntansi: akuntansi pemerintahan, SAP, keuangan negara, perpajakan, audit BPK, COSO
5. SKB Kesejahteraan Sosial: pekerjaan sosial, pemberdayaan masyarakat, perlindungan sosial, kebijakan Kemensos
6. English Test — Structure & Written Expression: grammar rules, error identification, sentence completion
7. English Test — Reading Comprehension: main idea, inference, vocabulary in context, author's purpose

ATURAN FORMAT JAWABAN — WAJIB DIIKUTI:

A) SOAL PERHITUNGAN / NUMERIK:
Jangan tulis langkah dalam satu baris panjang. Susun VERTIKAL ke bawah seperti ini:

Langkah 1: [nama langkah]
→ [operasi/rumus]
→ [hasil]

Langkah 2: [nama langkah]
→ [operasi/rumus]
→ [hasil]

Jawaban: [hasil akhir] → Pilih [X]

B) SOAL BAHASA INGGRIS (Grammar/Error):
- Identifikasi bagian yang salah secara spesifik
- Jelaskan ATURAN grammar yang dilanggar
- Berikan bentuk yang BENAR
- Format: "Bagian (X) salah karena... Bentuk yang benar adalah..."

C) SOAL READING COMPREHENSION:
- Tunjukkan KALIMAT KUNCI di passage yang mendukung jawaban (kutip singkat dalam tanda "...")
- Jelaskan mengapa opsi lain salah (elimination strategy)

D) SOAL TKP:
- Jelaskan MENGAPA satu opsi lebih baik dari yang lain
- Kaitkan dengan nilai BerAKHLAK / etika ASN
- Tampilkan ranking skor jika diminta: opsi terbaik → terendah

E) SOAL TWK/SKB KONSEPTUAL:
- Sebutkan dasar hukum / referensi yang relevan
- Maksimal 3 paragraf pendek

PENTING:
- Jangan pernah berkata "soal ini di luar topik" atau menolak membahas soal apapun yang ada di konteks
- Jika peserta bertanya hal umum di luar soal (strategi ujian, passing grade, tips) → jawab juga dengan helpful`;

  // ─── Tambah konteks soal aktif ────────────────────────────────────
  if (questionContext) {
    const {
      nomor, subtest: sub, subtestFull, text, tipe,
      kunciJawaban, options, pembahasanSingkat, nilaiOpsi,
      alasanSkor, jawaban, questionPart, grammarTopic, errorType,
    } = questionContext;

    let soalInfo = '';

    if (isEnglish) {
      // Konteks khusus English
      const part = questionPart || (sub === 'ERRORREC' ? 'Structure & Written Expression' : 'Reading Comprehension');
      const topic = grammarTopic || errorType || '';
      soalInfo = `
---
KONTEKS SOAL AKTIF (Soal ${nomor} — ${subtestFull || sub} | ${part}${topic ? ' | Topik: ' + topic : ''}):

Teks soal:
${text}

Pilihan jawaban:
${Object.entries(options || {}).map(([k, v]) => `${k}. ${v}`).join('\n')}

Kunci jawaban: ${kunciJawaban}
${pembahasanSingkat ? `Pembahasan singkat: ${pembahasanSingkat}` : ''}
${jawaban ? `Jawaban peserta saat ini: ${jawaban}` : 'Peserta belum menjawab.'}

INSTRUKSI: Jika peserta bertanya tentang soal ini, berikan penjelasan grammar/reading yang lengkap dalam format yang sesuai. Jelaskan mengapa jawaban benar adalah ${kunciJawaban}, dan mengapa opsi lain kurang tepat.`;

    } else if (isTKP) {
      // Konteks TKP
      const skorEntries = Object.entries(nilaiOpsi || {}).sort((a, b) => b[1] - a[1]);
      soalInfo = `
---
KONTEKS SOAL AKTIF (Soal ${nomor} — ${subtestFull || sub} | TKP):

Skenario:
${text}

Pilihan & skor:
${skorEntries.map(([k, v]) => `${k} (Skor ${v}): ${(options || {})[k] || ''}`).join('\n')}

${jawaban ? `Jawaban peserta: ${jawaban} (Skor: ${(nilaiOpsi || {})[jawaban] || '?'})` : 'Peserta belum menjawab.'}

INSTRUKSI: Jika peserta bertanya, jelaskan MENGAPA masing-masing opsi mendapat skor tersebut berdasarkan nilai ASN BerAKHLAK. Tampilkan urutan skor dari tertinggi ke terendah dengan alasan singkat tiap opsi.`;

    } else {
      // Konteks umum (TWK, TIU, SKB, dll)
      soalInfo = `
---
KONTEKS SOAL AKTIF (Soal ${nomor} — ${subtestFull || sub}):

Teks soal:
${text}

Pilihan jawaban:
${Object.entries(options || {}).map(([k, v]) => `${k}. ${v}`).join('\n')}

Kunci jawaban: ${kunciJawaban}
${pembahasanSingkat ? `Pembahasan: ${pembahasanSingkat}` : ''}
${jawaban ? `Jawaban peserta saat ini: ${jawaban}${jawaban === kunciJawaban ? ' ✓ (benar)' : ' ✗ (salah)'}` : 'Peserta belum menjawab.'}

INSTRUKSI: ${isNumeric
  ? 'Ini soal NUMERIK/perhitungan. WAJIB tulis langkah penyelesaian secara VERTIKAL ke bawah (Langkah 1, Langkah 2, dst) — JANGAN ditulis menyamping dalam satu kalimat panjang.'
  : 'Jika peserta bertanya, berikan penjelasan yang relevan dan tepat sasaran berdasarkan konteks soal di atas.'}`;
    }

    systemPrompt += soalInfo;
  }

  // ─── Panggil Groq ─────────────────────────────────────────────────
  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 800,
        temperature: 0.4,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-10),
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
