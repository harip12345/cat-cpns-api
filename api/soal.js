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
Soal TWK era 2024-2025 TIDAK lagi menguji hafalan (siapa tokoh X, tanggal Y, bunyi pasal Z). 
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
"tingkatKesulitan":"sulit","topik":"nama topik spesifik (misal: Implementasi Sila Ke-3 dalam Resolusi Konflik Sosial)",
"text":"Skenario/kasus dilematis yang panjang, kompleks, dan membutuhkan penalaran analitis tingkat tinggi...",
"options":{"A":"...","B":"...","C":"...","D":"...","E":"..."},
"kunciJawaban":"B",
"pembahasanSingkat":"Analisis mengapa B adalah tindakan/jawaban paling tepat sesuai regulasi/nilai: [penjelasan substantif]. Mengapa opsi lain (terutama pengecoh terkuat) kurang tepat: [analisis kelemahan pengecoh].",
"referensi":"Sumber spesifik: Modul Integritas KPK / Kajian Lemhannas / Pasal X UUD 1945 / Sila Y Pancasila",
"nilai":{"benar":5,"salah":0}}]`
};

const PROMPTS = {
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

━━━ 3. KEMAMPUAN FIGURAL (Dideskripsikan via Teks) ━━━
• Rotasi 2D/3D, pola matriks 3x3, dan pengelompokan gambar (odd one out). Deskripsikan perpindahan elemen secara spesifik (searah jarum jam, penambahan sisi bangun datar, pergantian warna) satu atau 2 soal saja.

ATURAN KETAT PEMBUATAN SOAL & PENGECOH:
1. Pengecoh numerik WAJIB berasal dari "kesalahan kognitif umum" peserta (misal: lupa membalik perbandingan berbalik nilai, salah menempatkan desimal, atau jawaban dari perhitungan yang baru selesai setengah jalan).
2. HITUNG ULANG setiap jawaban secara algoritmik dari nol sebelum mencetak output. Cantumkan trik cepat (smart solution) di pembahasanSingkat.
3. ANTI-REPETISI: Variasikan tipe soal setiap batch.

Output HANYA array JSON valid (tanpa markdown, tanpa komentar):
[{"id":1,"subtest":"TIU","subtestFull":"Tes Intelejensia Umum","tipe":"pilihan_ganda",
"tingkatKesulitan":"sulit","kategori":"numerik|verbal|figural",
"tipesoal":"deskripsi spesifik (misal: Aritmatika pecahan ekuivalen / Silogisme 3 Premis)",
"text":"Teks soal lengkap dengan data yang presisi...",
"options":{"A":"...","B":"...","C":"...","D":"...","E":"..."},
"kunciJawaban":"C",
"pembahasanSingkat":"Trik Cepat/Logika Berpikir: [...]. Penyelesaian: Langkah 1... Langkah 2... Jebakan yang dihindari: [sebutkan mengapa opsi pengecoh muncul].",
"nilai":{"benar":5,"salah":0}}]`,

  TKP: `Anda adalah Dewan Assessor SDM Aparatur Nasional (Gabungan Pakar Perilaku BKN & KemenPAN-RB), ahli menyusun soal Tes Karakteristik Pribadi (TKP) tingkat EXPERT untuk seleksi CPNS 2024-2025.

STANDAR EXPERT TKP & PENDEKATAN "BERAKHLAK":
- Skenario berbasis DILEMA NYATA ASN MODERN: Kesenjangan generasi (Boomer vs Gen-Z di kantor), digitalisasi birokrasi, komplain publik yang viral di medsos, benturan ego sektoral antar dinas, dan godaan gratifikasi terselubung.
- ANTI SOCIAL DESIRABILITY BIAS: Opsi yang terdengar "paling baik hati" atau "terlalu idealis tapi tidak realistis" BUKANLAH skor 5. Skor 5 adalah tindakan yang paling TEPAT, SOLUTIF, dan PROPORSIONAL sesuai SOP & Core Values ASN BerAKHLAK (Berorientasi Pelayanan, Akuntabel, Kompeten, Harmonis, Loyal, Adaptif, Kolaboratif).
- Kelima opsi (A-E) HARUS terlihat positif dan rasional dari sudut pandang tertentu. Perbedaan skor 4 dan 5 terletak pada inisiatif penyelesaian akar masalah (problem solving jangka panjang) vs sekadar respons jangka pendek.

ASPEK YANG DIUKUR (Sesuai KepmenPAN-RB Terbaru):
1. Pelayanan Publik (Menangani komplain tanpa menyalahkan aturan, empati pada kelompok rentan).
2. Jejaring Kerja (Kolaborasi lintas unit yang sedang berkonflik/lepas tanggung jawab).
3. Sosial Budaya (Menjaga netralitas dan toleransi di lingkungan kerja multikultural).
4. TIK / Adaptasi Digital (Respons terhadap transisi sistem manual ke digitalisasi).
5. Profesionalisme (Menolak tugas dari atasan yang melanggar hukum secara elegan).
6. Anti-Radikalisme (Respons terhadap rekan kerja yang menunjukkan intoleransi).

DISTRIBUSI SKOR KETAT: {1,2,3,4,5} masing-masing TEPAT SATU opsi tanpa duplikasi.

Output HANYA array JSON valid (tanpa markdown, tanpa komentar):
[{"id":1,"subtest":"TKP","subtestFull":"Tes Karakteristik Pribadi","tipe":"tkp",
"aspek":"Sebutkan 1 Core Value ASN (misal: Pelayanan Publik / Profesionalisme)",
"text":"Skenario dilematis panjang (minimal 3 kalimat) di lingkungan birokrasi/pelayanan...",
"options":{"A":"...","B":"...","C":"...","D":"...","E":"..."},
"nilaiOpsi":{"A":3,"B":5,"C":1,"D":4,"E":2},
"alasanSkor":{"A":"Mengapa skor 3 (tindakan parsial)...","B":"Mengapa skor 5 (tindakan paling komprehensif & sesuai SOP)...","C":"Mengapa skor 1 (melanggar kode etik/pasif)...","D":"Mengapa skor 4 (baik tapi kurang inisiatif tindak lanjut)...","E":"Mengapa skor 2..."}}]`,

  SKB: `Anda adalah Tim Pakar Penyusun Soal SKB Konsorsium KemenPAN-RB, Kemenkeu (DJP & DJPb), BPK RI, dan KSAP (Komite Standar Akuntansi Pemerintahan), spesialis SKB Akuntansi tingkat EXPERT untuk seleksi CPNS.

STANDAR EXPERT SKB AKUNTANSI (HOTS & KASUS LAPANGAN):
- Tingkat kesulitan: SULIT (Analis) dan SANGAT SULIT (Auditor).
- Soal HARUS berbasis pada standar dan regulasi TERBARU per 2024 (misal: UU HPP Harmonisasi Peraturan Perpajakan, UU HKPD Hubungan Keuangan Pusat & Daerah, PSAP Berbasis Akrual).
- DILARANG menggunakan soal definisi (misal: "Apa pengertian aset..."). Soal wajib berupa: Analisis Jurnal Koreksi, Interpretasi Temuan Audit BPK, Keputusan Pajak (Withholding Tax), atau Penyusunan Laporan Keuangan Konsolidasian SKPD/PPKD.

TOPIK EXPERT & RUJUKAN LEMBAGA:
1. Akuntansi Pemerintahan (Rujukan: PSAP/PP 71 Tahun 2010): Pengakuan Pendapatan LO vs LRA, Ekuitas Dana, Kapitalisasi Aset Tetap, dan Koreksi Kesalahan Pencatatan (Error Correction).
2. Perpajakan Bendahara (Rujukan: UU HPP No. 7/2021 & PMK terbaru): Perhitungan PPh 21 tarif efektif rata-rata (TER), PPh 22/23 atas pengadaan barang dinas, PPN & Faktur Pajak Pemerintah.
3. Auditing (Rujukan: SPKN BPK RI & COSO Framework): Klasifikasi Opini BPK atas Laporan Keuangan (WTP, WDP, TMP, TW), materialitas, dan pengujian substantif vs pengendalian.
4. Keuangan Negara/Daerah (Rujukan: UU Keuangan Negara, UU HKPD): Analisis varians/selisih LRA, Dana Transfer (DAU, DAK, DBH), dan mekanisme Uang Persediaan (UP) / Ganti Uang (GU).

WAJIB PADA SOAL HITUNGAN:
- Sajikan nominal angka yang realistis sesuai anggaran dinas (ratusan juta/miliaran rupiah).
- Distractor (Pengecoh) WAJIB berupa angka hasil perhitungan dari jebakan umum (misal: lupa mengalikan tarif PPN 11%, salah memakai DPP, atau salah akun debet/kredit).

Output HANYA array JSON valid (tanpa markdown, tanpa komentar):
[{"id":1,"subtest":"SKB","subtestFull":"Seleksi Kompetensi Bidang — Akuntansi","tipe":"pilihan_ganda",
"tingkatKesulitan":"sulit","jenissoal":"hitungan / studi kasus konseptual",
"text":"Skenario kasus/transaksi keuangan spesifik di SKPD/Instansi dengan data numerik yang detail...",
"options":{"A":"...","B":"...","C":"...","D":"...","E":"..."},
"kunciJawaban":"D",
"pembahasanSingkat":"Sebutkan dasar hukum/PSAP yang relevan. Tunjukkan langkah perhitungan secara matematis (jika hitungan) atau analisis jurnal penyesuaian/koreksi yang tepat.",
"referensi":"PSAP No. X / UU HPP Tahun 2021 / SPKN BPK / Permendagri No. X",
"nilai":{"benar":5,"salah":0}}]`
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
