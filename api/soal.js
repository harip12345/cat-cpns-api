// api/soal.js — POST /api/soal
// Soal tersimpan PERMANEN di Firestore koleksi soal_bank.
// Device lain langsung pakai soal yang sama tanpa generate ulang.
// forceNew=true → generate baru dan timpa database.

const Groq = require('groq-sdk');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

// Model Groq per Juni 2026 — urutan: terbaik kualitas → paling available
// Referensi limit: console.groq.com/settings/limits
const MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct', // Llama 4 Scout — terbaru, limit besar
  'llama-3.3-70b-versatile',                   // 70B — kualitas terbaik, 6000 RPD
  'qwen-qwq-32b',                              // QwQ 32B — reasoning kuat
  'llama3-groq-70b-8192-tool-use-preview',     // 70B tool-use — alternatif
  'gemma2-9b-it',                              // Google Gemma 9B — 14400 RPD
  'llama-3.1-8b-instant',                      // 8B — paling cepat, 14400 RPD
];

// ─── SYSTEM PROMPTS — Expert Level, Anti-Repetisi ─────────────
const PROMPTS = {
  TWK: `Anda adalah Tim Konsorsium Nasional Penyusun Soal Seleksi CPNS (Gabungan Expert dari BKN, KemenPAN-RB, BPIP, Lemhannas, KPK, dan Badan Pengembangan dan Pembinaan Bahasa), spesialis Tes Wawasan Kebangsaan (TWK) untuk seleksi 2024–2025.

FILOSOFI & SUMBER SOAL TWK TERKINI (WAJIB DIPAHAMI):
Soal TWK era 2024-2025 TIDAK lagi menguji hafalan (siapa tokoh X, tanggal Y, bunyi pasal Z), jadi jangan ada hafalan apapun. 
Soal WAJIB menguji PENALARAN TINGKAT TINGGI (HOTS) dan PEMAHAMAN KONTEKSTUAL. Skenario soal harus mengambil inspirasi dari rilis kasus nyata, kajian, atau dokumen resmi dari lembaga negara terkait.

KISI-KISI RESMI TWK & REFERENSI LEMBAGA SUMBER SOAL:

━━━ 1. PANCASILA (Sumber Gaya Soal: Kajian BPIP - Badan Pembinaan Ideologi Pancasila) ━━━
• Sejarah Perumusan: Dinamika sidang BPUPKI, Piagam Jakarta, dan latar belakang kompromi politik. 
• 45 Butir Pengamalan: Fokus pada ESENSI dan IMPLEMENTASI nilai, bukan hafalan kalimat. Skenario harus berupa dilema kebijakan publik, konflik sosial di masyarakat, atau etika birokrasi.
• Ideologi Terbuka vs Tertutup: Respon Pancasila terhadap disrupsi digital, radikalisme, dan globalisasi.
• Membedakan tindakan yang MENCERMINKAN vs MELANGGAR nilai Pancasila dalam kehidupan bernegara modern.

━━━ 2. UUD NRI 1945 (Sumber Gaya Soal: Putusan MK & Jurnal Mahkamah Konstitusi/MPR RI) ━━━
• Hierarki hukum Indonesia (UU No. 12/2011 j.o UU No. 13/2022).
• Pembukaan UUD 1945: Makna alinea dan hubungannya dengan tujuan negara dalam konteks geopolitik saat ini.
• Pasal Strategis Batang Tubuh hasil Amandemen (Hak Asasi Manusia, Sistem Pemerintahan, Perekonomian).
• PENALARAN KONTEKSTUAL: Diberikan skenario hukum tata negara nyata (misal: sengketa kewenangan lembaga, kasus diskriminasi rasial/gender, kebebasan beragama), peserta menentukan pasal yang relevan dan implementasinya.

━━━ 3. NKRI & NASIONALISME (Sumber Gaya Soal: Dokumen Ketahanan Nasional - Lemhannas) ━━━
• Sejarah Kemerdekaan: Peran strategis organisasi pergerakan nasional sebagai fondasi kesadaran berbangsa.
• Wawasan Nusantara & Ketahanan Nasional: Menggunakan kerangka Astagatra Lemhannas (Geografi, Demografi, SDA, Ideologi, Politik, Ekonomi, Sosial Budaya, Hankam) dalam menghadapi ancaman non-militer (proxy war, cyber crime, perang dagang).
• Bela Negara (Pasal 27 ayat 3 & Pasal 30 UUD 1945): Konteks bela negara modern bagi ASN (pelayanan publik prima, menangkal hoaks, bangga buatan Indonesia).

━━━ 4. BHINNEKA TUNGGAL IKA (Sumber Gaya Soal: Studi Kasus Kemenag RI & Kemensos) ━━━
• Mengelola keberagaman: Strategi integrasi sosial, mitigasi konflik horizontal, toleransi antarumat beragama, dan peran ASN sebagai perekat bangsa.
• Makna filosofis Sutasoma dalam menghadapi isu etnosentrisme, chauvinisme, dan primordialisme di era digital.

━━━ 5. INTEGRITAS (Sumber Gaya Soal: Modul Anti-Korupsi KPK RI & Core Values ASN BerAKHLAK KemenPAN-RB) ━━━
• 9 Nilai Dasar Integritas (KPK): Jujur, peduli, mandiri, disiplin, tanggung jawab, kerja keras, sederhana, berani, adil.
• Skenario WAJIB berupa dilema etika ASN di tempat kerja (gratifikasi, benturan kepentingan/conflict of interest, whistleblowing system).
• Analisis perilaku keteladanan tokoh bangsa (Soekarno, Hatta, Hoegeng, Baharuddin Lopa, dll) dalam menolak intervensi/korupsi.

━━━ 6. BAHASA INDONESIA (Sumber Gaya Soal: Tes UKBI Kemdikbudristek/Badan Bahasa) ━━━
• Analisis Wacana Ilmiah/Berita Formal: Menentukan ide pokok, simpulan, asumsi logis, dan kelemahan argumen dari teks yang panjang dan kompleks.
• Kalimat efektif dan ketepatan diksi berdasarkan EYD Edisi V dan KBBI.

STANDAR PEMBUATAN SOAL EXPERT (STANDAR KONSORSIUM PTN & CAT BKN):
1. WAJIB berbasis skenario/kasus/dilema nyata yang biasa dialami ASN atau masyarakat luas.
2. Pengecoh (Distractor) HARUS Sangat Meyakinkan: Semua opsi (A,B,C,D,E) harus terlihat positif atau benar. Perbedaan jawaban benar vs pengecoh terbaik hanya terletak pada TINGKAT KETEPATAN KONTEKS atau HIERARKI NILAI.
3. Referensi Akurat: Pembahasan wajib mengutip dasar hukum (Pasal, UU) atau teori resmi (misal: Nilai Dasar KPK, Astagatra Lemhannas).
4. ANTI-REPETISI: Setiap soal angkat aspek BERBEDA, tidak ada dua soal dengan konsep sama dalam satu batch.

Output HANYA array JSON valid (tanpa markdown, tanpa komentar, tanpa teks lain):
[{"id":1,"subtest":"TWK","subtestFull":"Tes Wawasan Kebangsaan","tipe":"pilihan_ganda",
"tingkatKesulitan":"sulit","topik":"nama topik spesifik (misal: Implementasi Sila Ke-3 dalam Kebijakan Publik)",
"text":"Skenario/kasus yang kompleks dan membutuhkan penalaran...",
"options":{"A":"...","B":"...","C":"...","D":"...","E":"..."},
"kunciJawaban":"B",
"pembahasanCukupDetail":"Analisis cukup detail mengapa B benar: [penjelasan substantif]. Mengapa opsi lain salah: [analisis pengecoh].",
"referensi":"Sumber spesifik: Pasal X UUD 1945 / Sila Y Pancasila / TAP MPR No. Z / UU No. X Tahun Y",
"nilai":{"benar":5,"salah":0}}]`,

  TIU: `Anda adalah Tim Konsorsium Psikometri Nasional (Gabungan Pakar Kognitif BKN, BPSDM KemenPAN-RB, dan Ahli Pengukuran Psikologi PTN), spesialis Tes Intelejensia Umum (TIU) untuk seleksi CPNS 2024–2025.

FILOSOFI & SUMBER SOAL TIU TERKINI (WAJIB DIPAHAMI):
Soal TIU BKN 2024-2025 mengukur Fluid Intelligence (kecepatan & ketepatan berpikir logis analitis) sesuai kerangka Cattell-Horn-Carroll (CHC).
Fokus pada EFISIENSI kognitif. Setiap soal dirancang sedemikian rupa agar BISA diselesaikan TANPA kalkulator dalam waktu maksimal 60-90 detik menggunakan trik/pendekatan logis, bukan hitungan kuli (brute-force).

KISI-KISI RESMI TIU CPNS & STANDAR DISTRACTOR:

━━━ 1. KEMAMPUAN NUMERIK (Fokus: Logika Perhitungan & Aproksimasi) ━━━
• Aritmatika Dasar & Pecahan: Operasi bilangan yang sekilas rumit namun bisa disederhanakan dengan sifat distributif/asosiatif/komutatif atau konversi bentuk (misal: 33,33% = 1/3; 0,875 = 7/8).
• Aljabar & Persamaan: Substitusi dan eliminasi linier. Sering kali yang ditanya adalah bentuk modifikasi dari persamaannya, sehingga tidak perlu mencari nilai tunggal variabel.
• Deret Angka/Pola Bilangan: Wajib mencakup deret bertingkat, deret Fibonacci modifikasi, atau deret ganda (alternating) yang tidak langsung terlihat.
• Soal Cerita (Perbandingan & JKW): Konteks soal WAJIB disesuaikan dengan dunia birokrasi/pelayanan (misal: pengadaan barang instansi, penugasan dinas, proyek infrastruktur daerah).

━━━ 2. KEMAMPUAN VERBAL (Fokus: Pemahaman Konteks & Silogisme HOTS) ━━━
• Analogi: Dilarang menggunakan kosakata pasaran. Gunakan padanan kata yang menuntut pemahaman fungsi, hierarki, atau sebab-akibat spesifik (mengacu pada KBBI & Tes Potensi Skolastik BPPP). 
• Silogisme / Penalaran Logis: Gunakan Modus Ponens, Modus Tollens, dan Silogisme kategoris dengan premis bertumpuk atau premis negatif ("Tidak ada", "Semua bukan"). Skenario harus berupa kebijakan instansi atau aturan kepegawaian.

ATURAN KETAT PEMBUATAN SOAL & PENGECOH:
1. Pengecoh numerik WAJIB berasal dari "kesalahan kognitif umum" peserta (misal: lupa membalik perbandingan berbalik nilai, salah menempatkan desimal, atau jawaban dari perhitungan yang baru selesai setengah jalan).
2. HITUNG ULANG setiap jawaban secara algoritmik dari nol sebelum mencetak output. Cantumkan trik cepat (smart solution) di pembahasanSingkat.
3. ANTI-REPETISI: Variasikan tipe soal setiap batch.

Output HANYA array JSON valid (tanpa markdown, tanpa komentar, tanpa teks lain):
[{"id":1,"subtest":"TIU","subtestFull":"Tes Intelejensia Umum","tipe":"pilihan_ganda",
"tingkatKesulitan":"sedang",
"kategori":"numerik|verbal|figural",
"tipesoal":"deskripsi spesifik (misal: deret angka pola kuadrat | analogi sebab-akibat | silogisme negasi)",
"text":"Teks soal lengkap dengan data yang jelas dan tidak ambigu",
"options":{"A":"...","B":"...","C":"...","D":"...","E":"..."},
"kunciJawaban":"C",
"pembahasanSingkat":"Untuk numerik: Langkah 1: ... Langkah 2: ... Jawaban C. Untuk verbal: Hubungan [X] dengan [Y] adalah [Z], maka [A] dengan [B] adalah [C]. Untuk silogisme: Premis 1: ... Premis 2: ... Kesimpulan: ...",
"nilai":{"benar":5,"salah":0}}]`,

  TKP: `Anda adalah Tim Psikometri Senior BKN dengan keahlian menyusun soal TKP tingkat EXPERT untuk seleksi CPNS.

STANDAR EXPERT TKP:
- Skenario KOMPLEKS dengan dilema etika nyata — bukan situasi hitam-putih
- Setiap skenario melibatkan KONFLIK antara dua nilai ASN yang sama-sama penting
  (misal: efisiensi vs prosedur, loyalitas vs integritas, pelayanan vs aturan)
- Semua 5 opsi HARUS terlihat benar — peserta yang tidak cermat pasti salah
- Perbedaan skor 4 dan 5 hanya pada satu nuansa tindakan yang halus
- DILARANG skenario dangkal yang jawabannya obvious

ASPEK YANG DIUKUR (rotasi ketat, setiap soal satu aspek berbeda):
1. Integritas menghadapi tekanan atasan yang tidak etis
2. Inovasi vs kepatuhan prosedur birokrasi
3. Konflik kepentingan pribadi vs kepentingan publik
4. Pengelolaan tim dengan anggota bermasalah
5. Respons terhadap keluhan publik yang viral/media
6. Pengambilan keputusan dengan data tidak lengkap dan waktu terbatas
7. Kolaborasi lintas instansi yang saling bersaing kepentingan
8. Whistleblowing: dilema melapor vs loyalitas kolega
9. Pelayanan publik kepada kelompok rentan dengan keterbatasan anggaran
10. Adaptasi terhadap kebijakan baru yang bertentangan dengan kebiasaan

DISTRIBUSI SKOR KETAT: {1,2,3,4,5} masing-masing TEPAT SATU opsi.

Output HANYA array JSON valid:
[{"id":1,"subtest":"TKP","subtestFull":"Tes Karakteristik Pribadi","tipe":"tkp",
"aspek":"nama aspek yang diukur",
"text":"skenario kompleks dengan dilema nyata",
"options":{"A":"...","B":"...","C":"...","D":"...","E":"..."},
"nilaiOpsi":{"A":3,"B":5,"C":1,"D":4,"E":2},
"alasanSkor":{"A":"mengapa skor 3...","B":"mengapa skor 5 — terbaik karena...","C":"mengapa skor 1...","D":"mengapa skor 4...","E":"mengapa skor 2..."}}]`,

  SKB: `Anda adalah Tim Penyusun Soal Senior BKN spesialis SKB Akuntansi Pemerintahan tingkat EXPERT.

STANDAR EXPERT SKB AKUNTANSI:
- Tingkat kesulitan: SULIT dan SANGAT SULIT  
- 50% soal hitungan multi-langkah (jurnal, laporan keuangan, perhitungan pajak)
- 50% soal konseptual analitik (interpretasi standar, kasus audit, analisis kebijakan)
- DILARANG soal definisi sederhana atau pengertian dasar
- Semua referensi peraturan WAJIB masih berlaku per 2024

TOPIK EXPERT (rotasi ketat):
1. Jurnal akrual pemerintah: pengakuan pendapatan LO vs LRA, koreksi kesalahan
2. Konsolidasi laporan keuangan entitas pemerintah
3. Penyusutan aset tetap pemerintah: metode, nilai sisa, revaluasi
4. Perhitungan PPh 21 karyawan dengan PTKP, tunjangan, natura
5. PPN: faktur pajak, kredit pajak masukan, PKP threshold
6. Rekonsiliasi fiskal: koreksi positif/negatif, kompensasi kerugian
7. Analisis varians anggaran APBN/APBD, efisiensi, efektivitas
8. Temuan audit BPK: klasifikasi, rekomendasi, tindak lanjut
9. Sistem pengendalian internal: COSO framework dalam pemerintahan
10. Dana transfer daerah: DAU formula, DAK penggunaan, DBH perhitungan

WAJIB untuk soal hitungan:
- Sajikan data numerik yang realistis dan spesifik
- Tampilkan langkah penyelesaian lengkap di pembahasanSingkat
- Hitung ulang sebelum menetapkan kunci jawaban

Output HANYA array JSON valid:
[{"id":1,"subtest":"SKB","subtestFull":"Seleksi Kompetensi Bidang — Akuntansi","tipe":"pilihan_ganda",
"tingkatKesulitan":"sulit","jenissoal":"hitungan/konseptual",
"text":"soal kompleks dengan data lengkap",
"options":{"A":"...","B":"...","C":"...","D":"...","E":"..."},
"kunciJawaban":"C",
"pembahasanSingkat":"Langkah penyelesaian detail atau analisis mendalam mengapa C benar",
"referensi":"PP/UU/Permendagri yang spesifik dan masih berlaku",
"nilai":{"benar":5,"salah":0}}]`,
};

const VALID = { skd:['TWK','TIU','TKP'], skb:['SKB'] };

// ─── Firebase ──────────────────────────────────────────────────
async function getToken() {
  const { FIREBASE_CLIENT_EMAIL: email, FIREBASE_PRIVATE_KEY: key } = process.env;
  if (!email || !key) return null;
  try {
    const crypto = require('crypto');
    const now = Math.floor(Date.now() / 1000);
    const hdr = Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT'})).toString('base64url');
    const pay = Buffer.from(JSON.stringify({
      iss:email, sub:email,
      aud:'https://oauth2.googleapis.com/token',
      iat:now, exp:now+3600,
      scope:'https://www.googleapis.com/auth/datastore',
    })).toString('base64url');
    const sig = crypto.createSign('RSA-SHA256')
      .update(`${hdr}.${pay}`)
      .sign(key.replace(/\\n/g,'\n'), 'base64url');
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion:`${hdr}.${pay}.${sig}`,
      }),
    });
    return r.ok ? (await r.json()).access_token : null;
  } catch { return null; }
}

const FS_BASE = (pid) =>
  `https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents`;

async function fsGet(col, doc) {
  const pid = process.env.FIREBASE_PROJECT_ID;
  if (!pid) return null;
  const token = await getToken();
  if (!token) return null;
  try {
    const r = await fetch(`${FS_BASE(pid)}/${col}/${doc}`,
      { headers:{ Authorization:`Bearer ${token}` } });
    if (!r.ok) return null;
    const d = await r.json();
    return d.fields?.data?.stringValue ? JSON.parse(d.fields.data.stringValue) : null;
  } catch { return null; }
}

async function fsSet(col, doc, data, extra={}) {
  const pid = process.env.FIREBASE_PROJECT_ID;
  if (!pid) return false;
  const token = await getToken();
  if (!token) return false;
  try {
    const fields = {
      data:    { stringValue: JSON.stringify(data) },
      savedAt: { stringValue: new Date().toISOString() },
    };
    Object.entries(extra).forEach(([k,v]) => {
      fields[k] = typeof v==='number' ? {integerValue:v} : {stringValue:String(v)};
    });
    const mask = Object.keys(fields).map(k=>`updateMask.fieldPaths=${k}`).join('&');
    const r = await fetch(`${FS_BASE(pid)}/${col}/${doc}?${mask}`, {
      method:'PATCH',
      headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ fields }),
    });
    return r.ok;
  } catch(e) { console.warn('fsSet error:', e.message); return false; }
}

// ─── Parse JSON ────────────────────────────────────────────────
function parseJSON(raw) {
  const clean = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim();
  let p = JSON.parse(clean);
  if (Array.isArray(p)) return p;
  const key = ['questions','soal','data','items'].find(k=>Array.isArray(p[k]))
    || Object.keys(p).find(k=>Array.isArray(p[k]));
  if (key) return p[key];
  throw new Error('Tidak ada array soal');
}

// ─── Generate dengan model fallback ───────────────────────────
async function generate(groq, subtest, count, batchIndex) {
  const models = process.env.GROQ_MODEL
    ? [process.env.GROQ_MODEL, ...MODELS.filter(m=>m!==process.env.GROQ_MODEL)]
    : MODELS;

  // Tambahkan instruksi anti-repetisi berdasarkan batchIndex
  const antiRepeat = batchIndex > 0
    ? `\nPENTING: Ini adalah batch ke-${batchIndex+1}. Buat soal dengan topik dan konteks yang BERBEDA TOTAL dari batch sebelumnya. Jangan ulangi konsep, tokoh, pasal, atau angka yang sudah pernah digunakan.`
    : '\nPENTING: Variasikan topik setiap soal. Tidak ada dua soal dengan konsep yang sama.';

  const userPrompt = `Buat tepat ${count} soal ${subtest} tingkat EXPERT/SANGAT SULIT untuk seleksi CPNS 2024-2025.${antiRepeat}\nOutput HANYA array JSON valid langsung tanpa teks pembuka atau penutup.`;

  let lastErr = null;
  for (const model of models) {
    try {
      console.log(`Trying: ${model} for ${subtest} batch ${batchIndex}`);
      const res = await groq.chat.completions.create({
        model,
        messages: [
          { role:'system', content: PROMPTS[subtest] },
          { role:'user',   content: userPrompt },
        ],
        temperature: 0.85, // Lebih tinggi untuk variasi lebih besar
        max_tokens:  7000,
        response_format: { type:'json_object' },
      });
      const raw = res.choices?.[0]?.message?.content || '';
      if (!raw) throw new Error('Empty response');
      const questions = parseJSON(raw);
      if (!questions.length) throw new Error('Empty array');
      console.log(`OK: ${model} → ${questions.length} soal`);
      return { questions, model };
    } catch(err) {
      if ([429,413,503].includes(err.status)) { lastErr=err; continue; }
      throw err;
    }
  }
  throw new Error('Semua model tidak tersedia: ' + lastErr?.message);
}

// ─── Main Handler ──────────────────────────────────────────────
module.exports = async function handler(req, res) {
  cors(res);
  if (req.method==='OPTIONS') return res.status(204).end();
  if (req.method!=='POST') return res.status(405).json({success:false,error:'Gunakan POST.'});

  const { examType, subtest, count:cRaw, batchIndex=0, forceNew=false } = req.body||{};
  const type  = (examType||'').toLowerCase();
  const sub   = (subtest||'').toUpperCase();
  const count = Math.min(15, Math.max(1, parseInt(cRaw||'10',10)));
  const bIdx  = parseInt(batchIndex)||0;

  if (!VALID[type])                return res.status(400).json({success:false,error:'"examType" harus "skd"/"skb".'});
  if (!VALID[type].includes(sub))  return res.status(400).json({success:false,error:`"subtest" harus: ${VALID[type].join(', ')}.`});

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({success:false,error:'GROQ_API_KEY belum diset.'});

  // Dokumen: soal_bank/skd_TWK_b0, skd_TWK_b1, dst.
  const docId = `${type}_${sub}_b${bIdx}`;

  // ── Cek database dulu ──────────────────────────────────────
  if (!forceNew) {
    const stored = await fsGet('soal_bank', docId);
    if (stored?.length) {
      console.log(`DB hit: ${docId} (${stored.length} soal)`);
      return res.status(200).json({
        success:true, examType:type, subtest:sub,
        count:stored.length, questions:stored, source:'database',
      });
    }
  }

  // ── Generate dari Groq ─────────────────────────────────────
  try {
    const groq = new Groq({ apiKey });
    const { questions, model } = await generate(groq, sub, count, bIdx);

    questions.forEach((q,i) => {
      q.id    = i + 1;
      q.nilai = q.nilai || {benar:5,salah:0};
    });

    // Simpan PERMANEN ke Firestore — await agar tidak terminate sebelum selesai
    const saved = await fsSet('soal_bank', docId, questions, {
      examType:type, subtest:sub, batchIndex:bIdx, count:questions.length,
    }).catch(e => { console.warn('DB save error:', e.message); return false; });
    console.log(`DB ${saved?'saved':'FAIL'}: ${docId}`);

    return res.status(200).json({
      success:true, examType:type, subtest:sub,
      count:questions.length, questions,
      source:'generated', modelUsed:model,
      dbSaved:saved,
    });
  } catch(err) {
    console.error('Generate error:', err.message);
    if (err.status===401) return res.status(401).json({success:false,error:'GROQ_API_KEY tidak valid.'});
    return res.status(500).json({success:false,error:err.message});
  }
};
