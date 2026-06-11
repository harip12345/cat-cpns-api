// =============================================================================
// lib/utils.js — Shared utilities untuk semua Vercel Serverless Functions
// =============================================================================

/**
 * Menangani preflight CORS dan menyisipkan header CORS ke setiap response.
 * Kembalikan `true` jika request adalah OPTIONS (preflight sudah ditangani).
 *
 * @param {import('@vercel/node').VercelRequest}  req
 * @param {import('@vercel/node').VercelResponse} res
 * @returns {boolean} true = request sudah selesai ditangani (OPTIONS)
 */
function handleCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

/**
 * Kirim response JSON sukses dengan struktur yang konsisten.
 */
function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

/**
 * Kirim response JSON error dengan struktur yang konsisten.
 */
function sendError(res, message, statusCode = 500, details = null) {
  const body = {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  };
  if (details && process.env.NODE_ENV !== 'production') {
    body.details = details;
  }
  return res.status(statusCode).json(body);
}

/**
 * Membuat instance Groq SDK.
 * Melempar Error jika GROQ_API_KEY belum diset di environment.
 */
function createGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GROQ_API_KEY belum diset. ' +
      'Tambahkan di Vercel Dashboard → Project → Settings → Environment Variables.'
    );
  }

  // Groq SDK — lazy require agar tidak error saat dev tanpa install
  const Groq = require('groq-sdk');
  return new Groq({ apiKey });
}

/**
 * Parse teks JSON dari response Groq secara aman.
 * Mendukung output yang dibalut markdown code fence (```json ... ```)
 */
function safeParseJSON(raw) {
  // Hapus code fence jika ada
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  return JSON.parse(cleaned);
}

/**
 * Validasi bahwa array soal yang di-generate memenuhi schema minimum.
 * Melempar Error dengan pesan detail jika ada soal yang cacat.
 */
function validateQuestions(questions, expectedType) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Output AI bukan array soal yang valid.');
  }

  questions.forEach((q, i) => {
    const label = `Soal[${i + 1}]`;

    if (typeof q.text !== 'string' || q.text.trim().length < 20) {
      throw new Error(`${label}: field "text" kosong atau terlalu pendek.`);
    }
    if (typeof q.options !== 'object' || Object.keys(q.options).length !== 5) {
      throw new Error(`${label}: harus memiliki tepat 5 opsi jawaban (A–E).`);
    }
    const letters = ['A', 'B', 'C', 'D', 'E'];
    letters.forEach(l => {
      if (typeof q.options[l] !== 'string' || q.options[l].trim().length === 0) {
        throw new Error(`${label}: opsi "${l}" kosong.`);
      }
    });

    if (expectedType === 'tkp') {
      // TKP: harus ada nilaiOpsi, masing-masing bernilai 1–5 dan unik
      if (typeof q.nilaiOpsi !== 'object') {
        throw new Error(`${label} TKP: field "nilaiOpsi" wajib ada.`);
      }
      const vals = letters.map(l => q.nilaiOpsi[l]);
      if (vals.some(v => typeof v !== 'number' || v < 1 || v > 5)) {
        throw new Error(`${label} TKP: semua nilaiOpsi harus angka 1–5.`);
      }
      const uniqueVals = new Set(vals);
      if (uniqueVals.size !== 5) {
        throw new Error(`${label} TKP: nilaiOpsi harus unik (1,2,3,4,5 masing-masing sekali).`);
      }
    } else {
      // TWK/TIU/SKB: harus ada kunciJawaban yang valid
      if (!letters.includes(q.kunciJawaban)) {
        throw new Error(`${label}: "kunciJawaban" harus salah satu dari A–E.`);
      }
    }
  });
}

module.exports = { handleCors, sendSuccess, sendError, createGroqClient, safeParseJSON, validateQuestions };
