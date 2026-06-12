// api/soal.js — POST /api/soal
// Jumlah soal dikurangi agar tidak timeout di Vercel Free (maks 60 detik).
// SKD: 10+12+13=35 soal. SKB: 20 soal.
// Vercel Pro bisa naikkan maxDuration ke 300 detik dan jumlah soal dinaikkan lagi.

const {
  handleCors, sendSuccess, sendError,
  createGroqClient, safeParseJSON, validateQuestions,
} = require('../lib/utils');
const { SYSTEM_PROMPTS, buildUserPrompt } = require('../lib/prompts');

const SOAL_CONFIG = {
  skd: { TWK: 10, TIU: 12, TKP: 13 },
  skb: { SKB: 20 },
};

// Batch besar = sedikit round-trip = lebih cepat
const BATCH_SIZE = 10;
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 'Gunakan POST.', 405);

  const { examType } = req.body || {};
  if (!examType || !['skd', 'skb'].includes(examType.toLowerCase())) {
    return sendError(res, 'Parameter "examType" harus "skd" atau "skb".', 400);
  }

  const normalizedType = examType.toLowerCase();
  const config = SOAL_CONFIG[normalizedType];
  console.log(`[soal.js] Request: examType=${normalizedType}`);

  try {
    const groq  = createGroqClient();
    const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
    const allQuestions = [];
    let globalId = 1;

    for (const [subtestKey, totalCount] of Object.entries(config)) {
      console.log(`[soal.js] Generating ${totalCount} soal ${subtestKey}...`);
      const questions = await generateSubtestQuestions(groq, model, subtestKey, totalCount);
      questions.forEach(q => {
        q.id   = globalId++;
        q.nilai = q.nilai || { benar: 5, salah: 0 };
      });
      allQuestions.push(...questions);
    }

    return sendSuccess(res, {
      examType: normalizedType,
      totalSoal: allQuestions.length,
      model,
      questions: allQuestions,
    });

  } catch (err) {
    console.error('[soal.js] Error:', err.message);
    if (err.status === 429) return sendError(res, 'Rate limit Groq. Coba lagi.', 429);
    if (err.status === 401) return sendError(res, 'GROQ_API_KEY tidak valid.', 401);
    return sendError(res, 'Gagal generate soal: ' + err.message, 500);
  }
};

async function generateSubtestQuestions(groq, model, subtestKey, totalCount) {
  const maxRetries = parseInt(process.env.MAX_RETRIES || '2', 10);
  const allQuestions = [];
  const usedTopics   = [];
  const batches = Math.ceil(totalCount / BATCH_SIZE);

  for (let b = 0; b < batches; b++) {
    const batchCount = Math.min(BATCH_SIZE, totalCount - allQuestions.length);
    let success = false;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const questions = await generateBatch(groq, model, subtestKey, batchCount, usedTopics);
        const tipe = subtestKey === 'TKP' ? 'tkp' : 'pg';
        validateQuestions(questions, tipe);
        questions.forEach(q => { if (q.topik) usedTopics.push(q.topik); });
        allQuestions.push(...questions);
        success = true;
        break;
      } catch (err) {
        console.warn(`[soal.js] Batch ${b+1} attempt ${attempt+1} gagal: ${err.message}`);
        if (attempt === maxRetries) throw new Error(`Gagal setelah ${maxRetries+1}x: ${err.message}`);
        await new Promise(r => setTimeout(r, 800 * Math.pow(2, attempt)));
      }
    }
    if (!success) break;
    if (b < batches - 1) await new Promise(r => setTimeout(r, 300));
  }
  return allQuestions;
}

async function generateBatch(groq, model, subtestKey, count, usedTopics) {
  const completion = await groq.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS[subtestKey] },
      { role: 'user',   content: buildUserPrompt(subtestKey, count, usedTopics) },
    ],
    temperature: 0.7,
    max_tokens:  4096,
    top_p:       0.9,
    stream:      false,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Groq response kosong.');

  let parsed = safeParseJSON(raw);
  if (Array.isArray(parsed)) return parsed;

  // Normalisasi berbagai bentuk output
  const arrayKey = ['questions','soal','data'].find(k => Array.isArray(parsed[k]))
    || Object.keys(parsed).find(k => Array.isArray(parsed[k]));
  if (arrayKey) return parsed[arrayKey];

  throw new Error('Output tidak mengandung array soal. Raw: ' + raw.substring(0, 150));
}
