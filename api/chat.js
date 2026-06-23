// api/chat.js — Vercel Serverless Function
// Endpoint: POST /api/chat
// Body: { messages: [{role, content}], questionContext?: {...} }
// Env: GROQ_API_KEY

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages = [], questionContext = null } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages wajib diisi.' });
  }

  const subtest      = questionContext?.subtest || '';
  const questionPart = questionContext?.questionPart || '';
  const isStructure  = subtest === 'ERRORREC' && questionPart === 'Structure';
  const isWrittenExp = subtest === 'ERRORREC' && questionPart === 'Written Expression';
  const isEnglish    = subtest === 'ERRORREC' || subtest === 'READCOMP';
  const isReading    = subtest === 'READCOMP';
  const isTKP        = questionContext?.tipe === 'tkp';
  const isNumeric    = subtest === 'TIU';

  // ─── SYSTEM PROMPT ──────────────────────────────────────────────
  let systemPrompt = `Kamu adalah Asisten Ujian untuk simulasi CAT CPNS dan English Proficiency Test BUMN 2025 di Indonesia.

PERAN KAMU:
- Tutor yang membantu peserta memahami soal dan jawaban
- Menjawab dalam Bahasa Indonesia, kecuali kutipan kalimat bahasa Inggris tetap dalam bahasa Inggris
- Ramah, to the point, tidak bertele-tele

═══════════════════════════════════════════
ATURAN TERPENTING — WAJIB DIPATUHI 100%:
═══════════════════════════════════════════

1. VERIFIKASI KUNCI JAWABAN SECARA MANDIRI.
   Sebelum menjawab apapun, kamu WAJIB memverifikasi sendiri apakah kunci jawaban yang diberikan secara grammatikal/logika sudah benar.

   JIKA KUNCI BENAR: Jelaskan mengapa kunci jawaban itu tepat dengan analisis grammar/logika yang akurat.

   JIKA KUNCI SALAH (kamu menemukan kesalahan nyata berdasarkan kaidah grammar/logika yang baku):
   - Akui dengan jelas dan sopan bahwa kunci jawaban di database kemungkinan keliru
   - Jelaskan jawaban yang BENAR berdasarkan kaidah yang berlaku
   - Sarankan peserta menggunakan fitur "🔄 Generate Soal Baru" untuk mengganti soal ini
   - Contoh frasa: "Kunci di database menunjukkan X, namun berdasarkan kaidah [nama aturan], jawaban yang benar seharusnya adalah Y karena..."

   JANGAN pernah memaksakan penjelasan yang salah hanya untuk membela kunci yang keliru.
   JANGAN juga asal meragukan kunci yang sudah benar — verifikasi dulu secara cermat.

   KHUSUS SOAL INVERSION (Not only / Seldom / No sooner):
   Struktur inversion: "Not only + auxiliary + SUBJECT + main verb..."
   Subject yang menentukan auxiliary adalah kata benda SETELAH auxiliary, bukan "Not only".
   Contoh: "Not only HAVE the reports been..." → subject = "the reports" (plural) → HAVE ✓
   Contoh: "Not only HAS the report been..." → subject = "the report" (singular) → HAS ✓
   Wajib cek: apakah subjek singular atau plural sebelum menentukan has/have/was/were.

2. JANGAN PERNAH mengarang atau menebak konten soal.
   Gunakan HANYA informasi yang ada di konteks soal yang diberikan.
   Jika informasi tidak cukup, minta peserta untuk mengetik ulang soalnya.

3. JANGAN menolak pertanyaan apapun yang berkaitan dengan soal aktif.

═══════════════════════════════════════════
FORMAT JAWABAN SESUAI TIPE SOAL:
═══════════════════════════════════════════

A) SOAL NUMERIK / PERHITUNGAN (TIU, SKB hitungan):
WAJIB tulis langkah secara VERTIKAL ke bawah. DILARANG menulis semua langkah dalam satu baris panjang.
Format:
Diketahui:
→ [data 1]
→ [data 2]

Langkah 1: [nama langkah]
→ [rumus atau operasi]
= [hasil antara]

Langkah 2: [nama langkah]
→ [operasi lanjutan]
= [hasil]

∴ Jawaban: [hasil akhir] → Pilih [X]

B) SOAL STRUCTURE (kalimat rumpang bahasa Inggris):
- Tunjukkan kalimat LENGKAP setelah blank diisi jawaban yang benar
- Jelaskan ATURAN GRAMMAR yang membuat opsi benar itu satu-satunya yang tepat
- Jelaskan mengapa setiap opsi lain TIDAK bisa dipakai (satu per satu, singkat)
- Format: "Jawaban [X] benar karena... / Opsi A salah karena... / Opsi B salah karena..."

C) SOAL WRITTEN EXPRESSION (cari bagian yang salah):
- Identifikasi BAGIAN MANA (A/B/C/D) yang salah
- Sebutkan NAMA ATURAN GRAMMAR yang dilanggar
- Tunjukkan BENTUK YANG BENAR
- Konfirmasi tiga bagian lain sudah benar
- Format: "Kesalahan ada di bagian (X): '[teks asli]' → seharusnya '[bentuk benar]' karena [aturan grammar]."

D) SOAL READING COMPREHENSION:
- Kutip KALIMAT KUNCI dari passage (dalam tanda "...")
- Jelaskan mengapa kutipan itu mendukung jawaban yang benar
- Eliminasi opsi lain dengan singkat

E) SOAL TKP:
- Tampilkan ranking skor dari tertinggi ke terendah
- Jelaskan mengapa opsi terbaik unggul berdasarkan nilai BerAKHLAK
- Format vertikal: Skor 5 → [opsi] karena... / Skor 4 → [opsi] karena... / dst.

F) SOAL TWK / SKB KONSEPTUAL:
- Sebutkan dasar hukum atau referensi resmi
- Maksimal 3 paragraf pendek`;

  // ─── Konteks soal aktif ─────────────────────────────────────────
  if (questionContext) {
    const {
      nomor, subtestFull, text, tipe,
      kunciJawaban, options, pembahasanSingkat,
      nilaiOpsi, alasanSkor, jawaban,
      grammarTopic, errorType, passage,
    } = questionContext;

    const jawabanStatus = jawaban
      ? `Jawaban peserta: ${jawaban}${jawaban === kunciJawaban ? ' ✓ (BENAR)' : ` ✗ (SALAH — kunci: ${kunciJawaban})`}`
      : 'Peserta belum menjawab.';

    let soalInfo = `\n\n${'═'.repeat(50)}\nKONTEKS SOAL AKTIF (Soal ${nomor} — ${subtestFull || subtest})\n${'═'.repeat(50)}\n`;

    if (isReading && passage) {
      soalInfo += `\nPASSAGE:\n${passage}\n\nPERTANYAAN:\n${text}\n\nPILIHAN JAWABAN:\n${Object.entries(options || {}).map(([k, v]) => `${k}. ${v}`).join('\n')}\n\nKUNCI JAWABAN: ${kunciJawaban}\n${pembahasanSingkat ? `PEMBAHASAN: ${pembahasanSingkat}` : ''}\n${jawabanStatus}`;

    } else if (isStructure) {
      soalInfo += `\nTIPE: Structure (Sentence Completion — kalimat rumpang)\nTOPIK GRAMMAR: ${grammarTopic || '-'}\n\nSOAL (isi _____ dengan jawaban yang tepat):\n${text}\n\nPILIHAN:\n${Object.entries(options || {}).map(([k, v]) => `${k}. ${v}`).join('\n')}\n\nKUNCI JAWABAN: ${kunciJawaban} (${(options || {})[kunciJawaban] || ''})\n${pembahasanSingkat ? `PEMBAHASAN: ${pembahasanSingkat}` : ''}\n${jawabanStatus}\n\nINSTRUKSI: Jelaskan mengapa "${(options || {})[kunciJawaban]}" adalah satu-satunya pilihan yang menghasilkan kalimat grammatikal sempurna. Tunjukkan kalimat lengkapnya setelah diisi. Jelaskan mengapa opsi lain tidak tepat.`;

    } else if (isWrittenExp) {
      soalInfo += `\nTIPE: Written Expression (cari bagian yang mengandung kesalahan grammar)\nTIPE ERROR: ${errorType || '-'}\n\nSOAL (temukan bagian A/B/C/D yang salah):\n${text}\n\nBAGIAN-BAGIAN:\n${Object.entries(options || {}).map(([k, v]) => `(${k}) "${v}"`).join('\n')}\n\nKUNCI JAWABAN: (${kunciJawaban}) — bagian ini yang salah\n${pembahasanSingkat ? `PEMBAHASAN: ${pembahasanSingkat}` : ''}\n${jawabanStatus}\n\nINSTRUKSI: Jelaskan mengapa bagian (${kunciJawaban}) salah, sebutkan nama aturan grammar yang dilanggar, tunjukkan bentuk yang benar, dan konfirmasi tiga bagian lain sudah benar.`;

    } else if (isTKP) {
      const skorSorted = Object.entries(nilaiOpsi || {}).sort((a, b) => b[1] - a[1]);
      soalInfo += `\nTIPE: TKP (Tes Karakteristik Pribadi)\n\nSKENARIO:\n${text}\n\nOPSI & SKOR:\n${skorSorted.map(([k, v]) => `${k} (Skor ${v}): ${(options || {})[k] || ''}`).join('\n')}\n\n${jawabanStatus}\n\nINSTRUKSI: Jelaskan ranking skor dari tertinggi ke terendah dengan alasan singkat tiap opsi berdasarkan nilai ASN BerAKHLAK.`;

    } else {
      // TWK, TIU, SKB umum
      soalInfo += `\n${isNumeric ? 'TIPE: Numerik/Perhitungan — WAJIB tulis langkah VERTIKAL ke bawah\n' : ''}\nSOAL:\n${text}\n\nPILIHAN JAWABAN:\n${Object.entries(options || {}).map(([k, v]) => `${k}. ${v}`).join('\n')}\n\nKUNCI JAWABAN: ${kunciJawaban} (${(options || {})[kunciJawaban] || ''})\n${pembahasanSingkat ? `PEMBAHASAN: ${pembahasanSingkat}` : ''}\n${jawabanStatus}`;
    }

    soalInfo += `\n\nCATATAN: Verifikasi kunci jawaban secara mandiri menggunakan kaidah grammar/logika yang berlaku. Jika kunci benar, jelaskan dengan tepat. Jika kunci keliru, sampaikan dengan sopan dan berikan jawaban yang benar beserta alasannya, lalu sarankan generate ulang soal.`;
    systemPrompt += soalInfo;
  }

  // ─── Panggil Groq ───────────────────────────────────────────────
  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 900,
        temperature: 0.2, // Rendah = konsisten, tidak mengarang
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

    const data  = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content || 'Maaf, tidak ada respons dari AI.';
    return res.status(200).json({ success: true, reply });

  } catch (err) {
    console.error('[chat.js]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
