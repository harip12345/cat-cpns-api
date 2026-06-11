// =============================================================================
// api/soal.js — Endpoint utama: POST /api/soal
//
// Cara pakai dari frontend:
//   const res  = await fetch('https://<domain-vercel-anda>/api/soal', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ examType: 'skd' })   // 'skd' atau 'skb'
//   });
//   const data = await res.json();
//   // data.questions → array soal siap pakai
//
// Environment Variables yang dibutuhkan di Vercel:
//   GROQ_API_KEY       — API key dari console.groq.com
//   GROQ_MODEL         — (opsional) default: llama-3.3-70b-versatile
//   MAX_RETRIES        — (opsional) default: 2
// =============================================================================

const {
  handleCors, sendSuccess, sendError,
  createGroqClient, safeParseJSON, validateQuestions,
} = require('../lib/utils');

const { SYSTEM_PROMPTS, buildUserPrompt } = require('../lib/prompts');

// ─── Konfigurasi jumlah soal per subtest ─────────────────────────────────────
// Ubah nilai di sini untuk menyesuaikan jumlah soal yang di-generate.
// Untuk produksi, naikkan angka ini sesuai kebutuhan ujian sebenarnya.
const SOAL_CONFIG = {
  skd: {
    TWK: 30,  // Total SKD: 110 soal (30 TWK + 35 TIU + 45 TKP)
    TIU: 35,
    TKP: 45,
  },
  skb: {
    SKB: 100, // Total SKB: 100 soal
  },
};

// ─── Batasi jumlah soal per request ke Groq (chunking) ───────────────────────
// Groq punya context window terbatas. Kirim dalam batch agar output lebih stabil.
const BATCH_SIZE = 5;

// ─── Model Groq yang digunakan ────────────────────────────────────────────────
// llama-3.3-70b-versatile dipilih karena:
//   - Reasoning kuat untuk soal logika dan hukum
//   - Output JSON yang konsisten
//   - Context window 128K (cukup untuk batch soal)
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

// =============================================================================
// HANDLER UTAMA
// =============================================================================
module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (handleCors(req, res)) return;

  // Hanya izinkan POST
  if (req.method !== 'POST') {
    return sendError(res, 'Method not allowed. Gunakan POST.', 405);
  }

  // ── Validasi input ──────────────────────────────────────────────────────────
  const { examType } = req.body || {};

  if (!examType || !['skd', 'skb'].includes(examType.toLowerCase())) {
    return sendError(
      res,
      'Parameter "examType" wajib diisi dengan nilai "skd" atau "skb".',
      400
    );
  }

  const normalizedType = examType.toLowerCase();
  const config         = SOAL_CONFIG[normalizedType];

  console.log(`[soal.js] Request masuk: examType=${normalizedType}`);

  try {
    const groq  = createGroqClient();
    const model = process.env.GROQ_MODEL || DEFAULT_MODEL;

    // ── Generate soal untuk setiap subtest ─────────────────────────────────
    const allQuestions = [];
    let   globalId     = 1;

    for (const [subtestKey, totalCount] of Object.entries(config)) {
      console.log(`[soal.js] Generating ${totalCount} soal ${subtestKey}...`);

      const subtestQuestions = await generateSubtestQuestions(
        groq, model, subtestKey, totalCount
      );

      // Re-assign id secara global dan tambahkan metadata
      subtestQuestions.forEach(q => {
        q.id    = globalId++;
        q.nilai = q.nilai || { benar: 5, salah: 0 };
      });

      allQuestions.push(...subtestQuestions);
      console.log(`[soal.js] ✓ Berhasil generate ${subtestQuestions.length} soal ${subtestKey}`);
    }

    // ── Kirim response ──────────────────────────────────────────────────────
    return sendSuccess(res, {
      examType:       normalizedType,
      totalSoal:      allQuestions.length,
      subtestBreakdown: Object.fromEntries(
        Object.entries(config).map(([k, v]) => [k, v])
      ),
      model,
      questions:      allQuestions,
    });

  } catch (err) {
    console.error('[soal.js] Error:', err.message);

    // Error khusus dari Groq SDK
    if (err.status === 429) {
      return sendError(res, 'Rate limit Groq tercapai. Coba beberapa saat lagi.', 429);
    }
    if (err.status === 401) {
      return sendError(res, 'GROQ_API_KEY tidak valid atau sudah kedaluwarsa.', 401);
    }

    return sendError(res, 'Gagal generate soal: ' + err.message, 500, err.stack);
  }
};

// =============================================================================
// generateSubtestQuestions — Generate soal satu subtest dengan batch + retry
// =============================================================================
async function generateSubtestQuestions(groq, model, subtestKey, totalCount) {
  const maxRetries = parseInt(process.env.MAX_RETRIES || '2', 10);
  const allQuestions = [];
  const usedTopics   = [];

  // Proses dalam batch agar output Groq lebih terkontrol
  const batches = Math.ceil(totalCount / BATCH_SIZE);

  for (let batchIdx = 0; batchIdx < batches; batchIdx++) {
    const remaining  = totalCount - allQuestions.length;
    const batchCount = Math.min(BATCH_SIZE, remaining);

    console.log(
      `[soal.js]   Batch ${batchIdx + 1}/${batches}: ${batchCount} soal ${subtestKey}...`
    );

    let success = false;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const questions = await generateBatch(
          groq, model, subtestKey, batchCount, usedTopics
        );

        // Validasi schema
        const tipeCheck = subtestKey === 'TKP' ? 'tkp' : 'pilihan_ganda';
        validateQuestions(questions, tipeCheck === 'tkp' ? 'tkp' : 'pg');

        // Kumpulkan topik yang sudah dipakai untuk variasi batch berikutnya
        questions.forEach(q => {
          if (q.topik) usedTopics.push(q.topik);
          if (q.aspek) usedTopics.push(q.aspek);
        });

        allQuestions.push(...questions);
        success = true;
        break; // Keluar dari retry loop

      } catch (err) {
        console.warn(
          `[soal.js]   Batch ${batchIdx + 1} attempt ${attempt + 1} gagal: ${err.message}`
        );

        if (attempt === maxRetries) {
          throw new Error(
            `Gagal generate batch soal ${subtestKey} setelah ${maxRetries + 1} percobaan. ` +
            `Terakhir: ${err.message}`
          );
        }

        // Tunggu sebelum retry (exponential backoff)
        await sleep(1000 * Math.pow(2, attempt));
      }
    }

    if (!success) break;

    // Jeda antar batch untuk menghindari rate limit
    if (batchIdx < batches - 1) {
      await sleep(500);
    }
  }

  return allQuestions;
}

// =============================================================================
// generateBatch — Satu request ke Groq untuk satu batch soal
// =============================================================================
async function generateBatch(groq, model, subtestKey, count, usedTopics) {
  const systemPrompt = SYSTEM_PROMPTS[subtestKey];
  const userPrompt   = buildUserPrompt(subtestKey, count, usedTopics);

  if (!systemPrompt) {
    throw new Error(`Tidak ada system prompt untuk subtest: ${subtestKey}`);
  }

  const completion = await groq.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
    temperature:     0.7,  // Sedikit kreatif namun tetap konsisten
    max_tokens:      4096, // Cukup untuk 5 soal lengkap dengan pembahasan
    top_p:           0.9,
    stream:          false,
    response_format: { type: 'json_object' }, // Paksa Groq output JSON
  });

  const raw = completion.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error('Groq mengembalikan response kosong.');
  }

  // Groq dengan response_format json_object kadang membungkus array dalam objek
  let parsed = safeParseJSON(raw);

  // Normalisasi: ambil array dari berbagai kemungkinan struktur
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed.questions && Array.isArray(parsed.questions)) {
    return parsed.questions;
  }
  if (parsed.soal && Array.isArray(parsed.soal)) {
    return parsed.soal;
  }
  if (parsed.data && Array.isArray(parsed.data)) {
    return parsed.data;
  }

  // Coba cari key pertama yang bernilai array
  const arrayKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
  if (arrayKey) {
    return parsed[arrayKey];
  }

  throw new Error(
    'Output Groq tidak mengandung array soal yang dapat dikenali. ' +
    'Raw: ' + raw.substring(0, 200)
  );
}

// =============================================================================
// Helper
// =============================================================================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
