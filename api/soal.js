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
  'llama-3.3-70b-versatile',   // Primary — kualitas terbaik, tersedia di semua tier
  'llama-3.1-8b-instant',      // Fast fallback — 14400 RPD, paling stabil
  'gemma2-9b-it',              // Google Gemma — alternatif stabil
  'llama3-8b-8192',            // Legacy — last resort
];

// ─── SYSTEM PROMPTS — Expert Level, Anti-Repetisi ─────────────
const PROMPTS = {
  TWK: `Anda adalah Tim Penyusun Soal Senior BKN, spesialis Tes Wawasan Kebangsaan (TWK) untuk seleksi CPNS 2024–2025.

FILOSOFI SOAL TWK TERKINI (WAJIB DIPAHAMI):
Soal TWK era 2024-2025 TIDAK lagi menguji hafalan (siapa tokoh X, tanggal Y, bunyi pasal Z).
Soal WAJIB menguji PENALARAN dan PEMAHAMAN KONTEKSTUAL — diberikan skenario/kasus nyata, peserta diminta menganalisis dan menerapkan prinsip/nilai/pasal yang relevan.

KISI-KISI RESMI TWK CPNS 2024-2025 (rotasi merata, setiap batch berbeda):

━━━ 1. PANCASILA ━━━
• Sejarah Perumusan: Proses BPUPKI (29 Mei–1 Juni 1945), dinamika Piagam Jakarta (22 Juni 1945), latar belakang perubahan sila pertama — BUKAN sekadar "siapa yang mengusulkan"
• 45 Butir Pengamalan: Fokus pada ESENSI dan IMPLEMENTASI nilai, bukan hafalan kalimat. Contoh soal: disajikan perilaku/kebijakan, peserta menentukan sila/butir mana yang dilanggar atau diterapkan
• Ideologi Terbuka vs Tertutup: Pancasila sebagai ideologi terbuka — mampu beradaptasi dengan zaman tanpa mengubah nilai dasar
• Membedakan tindakan yang MENCERMINKAN vs MELANGGAR nilai Pancasila dalam konteks kehidupan bernegara modern

━━━ 2. UUD NRI 1945 ━━━
• Hierarki hukum Indonesia (TAP MPR No. III/MPR/2000 & UU No. 12 Tahun 2011)
• Pembukaan UUD 1945: makna alinea I–IV, hubungannya dengan Pancasila dan tujuan negara
• Pasal Strategis Batang Tubuh (1–37) dengan penekanan hasil Amandemen I–IV: Pasal 1, 2, 3, 4, 5, 6A, 7, 18, 20, 22E, 24, 24C, 27, 28A–J, 29, 30, 31, 33, 34
• PENALARAN KONTEKSTUAL: diberikan skenario kehidupan nyata (misal: kasus diskriminasi, kebebasan beragama, hak pendidikan), peserta menentukan pasal yang relevan dan implementasinya — BUKAN menghafal bunyi pasal

━━━ 3. NKRI & SEJARAH KEMERDEKAAN ━━━
• Organisasi Pergerakan Nasional: Budi Utomo (1908), Syarikat Islam, PNI, Muhammadiyah, NU — peran strategis, bukan sekadar tahun berdiri
• Sumpah Pemuda 1928: makna dan relevansinya terhadap nasionalisme modern
• Transisi Orde Lama → Orde Baru → Reformasi: penyebab, dampak kebijakan, relevansi terhadap demokrasi Indonesia saat ini
• Wawasan Nusantara & Ketahanan Nasional: konsep astagatra (8 gatra), ancaman terhadap NKRI (ideologi, politik, ekonomi, sosbudaya, hankam)

━━━ 4. BHINNEKA TUNGGAL IKA & NASIONALISME ━━━
• Sumber: Kitab Sutasoma (Mpu Tantular), makna filosofis "berbeda-beda tetapi tetap satu"
• Mengelola keberagaman: strategi integrasi sosial, peran negara dalam menjaga pluralisme
• Nasionalisme, patriotisme, bela negara (Pasal 27 ayat 3 & Pasal 30 UUD 1945) — termasuk bela negara NON-MILITER (menjaga persatuan, cinta produk dalam negeri, dll)

━━━ 5. INTEGRITAS ━━━
• 9 Nilai Dasar Integritas (KPK): jujur, peduli, mandiri, disiplin, tanggung jawab, kerja keras, sederhana, berani, adil
• Analisis perilaku tokoh bangsa (Soekarno, Hatta, Ki Hajar Dewantara, dll) — identifikasi nilai integritas yang diterapkan dalam menghadapi situasi sulit/kekuasaan
• Etika publik & pelayanan: mengidentifikasi pelanggaran integritas di lingkungan pemerintahan/layanan publik

━━━ 6. BAHASA INDONESIA ━━━
• Kalimat efektif: logis, hemat, sesuai EYD/PUEBI, tidak ambigu
• Ketepatan diksi (pilihan kata) sesuai konteks formal dan KBBI
• Analisis teks: menentukan ide pokok, gagasan utama, simpulan dari paragraf/wacana
• Aturan ejaan: penulisan kata baku, tanda baca, huruf kapital

STANDAR PEMBUATAN SOAL EXPERT:
1. WAJIB berbasis skenario/kasus — bukan pertanyaan "apa itu" atau "siapa yang"
2. Pengecoh HARUS sangat meyakinkan — semua opsi terlihat benar pada pandangan pertama
3. Perbedaan jawaban benar vs pengecoh terbaik hanya pada SATU nuansa analisis
4. Referensi akurat: sebutkan pasal, nama UU, nomor TAP MPR, atau sumber historis yang spesifik
5. ANTI-REPETISI: setiap soal angkat aspek BERBEDA, tidak ada dua soal dengan konsep sama dalam satu batch
6. Cerminkan pola soal TKD BKN 2024-2025: berbasis Higher Order Thinking Skills (HOTS)

Output HANYA array JSON valid (tanpa markdown, tanpa komentar, tanpa teks lain):
[{"id":1,"subtest":"TWK","subtestFull":"Tes Wawasan Kebangsaan","tipe":"pilihan_ganda",
"tingkatKesulitan":"sulit","topik":"nama topik spesifik (misal: Implementasi Sila Ke-3 dalam Kebijakan Publik)",
"text":"Skenario/kasus yang kompleks dan membutuhkan penalaran...",
"options":{"A":"...","B":"...","C":"...","D":"...","E":"..."},
"kunciJawaban":"B",
"pembahasanSingkat":"Analisis mengapa B benar: [penjelasan substantif]. Mengapa opsi lain salah: [analisis pengecoh].",
"referensi":"Sumber spesifik: Pasal X UUD 1945 / Sila Y Pancasila / TAP MPR No. Z / UU No. X Tahun Y",
"nilai":{"benar":5,"salah":0}}]`,

  TIU: `Anda adalah Tim Penyusun Soal Senior BKN, spesialis Tes Intelejensia Umum (TIU) untuk seleksi CPNS 2024–2025.

FILOSOFI SOAL TIU TERKINI (WAJIB DIPAHAMI):
Soal TIU BKN 2024-2025 menguji KECEPATAN + KETEPATAN berpikir logis dan matematis.
Setiap soal harus bisa diselesaikan TANPA kalkulator dalam 1-2 menit. Fokus pada efisiensi perhitungan.
Sumber acuan: Soal TKD BKN resmi, SKD CPNS 2019-2024, serta modul BPSDM Kemenpan-RB.

KISI-KISI RESMI TIU CPNS 2024-2025 — TIGA KEMAMPUAN UTAMA:

━━━ 1. KEMAMPUAN NUMERIK ━━━

▸ Aritmatika Dasar
  - Operasi pecahan: penjumlahan, pengurangan, perkalian, pembagian pecahan biasa dan campuran
  - Desimal dan konversi: pecahan → desimal → persen dan sebaliknya
  - Persentase: menghitung nilai persen, persentase naik/turun, diskon bertingkat
  - Contoh pola soal: "Hasil dari 3/4 × 2/5 + 1/3 ÷ 2/9 = ..."

▸ Aljabar
  - Substitusi variabel: jika diketahui nilai x dan y, tentukan nilai ekspresi tertentu
  - Persamaan linear satu dan dua variabel
  - Contoh pola soal: "Jika 2x + 3y = 18 dan x − y = 1, maka nilai 3x + y = ..."

▸ Deret Angka / Pola Bilangan
  - Pola penambahan/pengurangan: deret aritmatika sederhana dan bertingkat (beda berubah)
  - Pola perkalian/pembagian: deret geometri, rasio berubah
  - Pola bilangan prima, kuadrat, kubik
  - Deret ganda/alternating: dua pola bergantian dalam satu deret
  - Contoh pola soal: "2, 5, 10, 17, 26, ... Suku berikutnya adalah ..."
  - WAJIB: Identifikasi pola secara eksplisit di pembahasanSingkat

▸ Soal Cerita — Perbandingan & Proporsi
  - Perbandingan senilai: jika A bertambah, B bertambah (misal: jumlah barang vs total harga)
  - Perbandingan berbalik nilai: jika A bertambah, B berkurang (misal: jumlah pekerja vs waktu selesai; jumlah mesin vs durasi produksi)
  - Contoh pola soal: "8 pekerja menyelesaikan proyek dalam 15 hari. Jika ditambah 4 pekerja, berapa hari proyek selesai?"

▸ Soal Cerita — Kecepatan, Waktu, Jarak
  - Rumus dasar: Jarak = Kecepatan × Waktu
  - Dua objek bergerak berlawanan arah, searah, atau mengejar
  - Rata-rata kecepatan (harmonic mean untuk perjalanan pergi-pulang)
  - Contoh pola soal: "Kereta A berangkat dari X pukul 07.00 dengan kecepatan 80 km/jam. Kereta B berangkat dari Y (berjarak 400 km) pukul 08.00 dengan kecepatan 100 km/jam. Kapan dan di mana keduanya berpapasan?"

━━━ 2. KEMAMPUAN VERBAL ━━━

▸ Analogi / Hubungan Kata
  - Hubungan sebab-akibat: Hujan → Banjir :: Kekeringan → ?
  - Hubungan bagian-fungsi: Teleskop : Bintang :: Stetoskop : ?
  - Hubungan subjek-objek: Petani : Sawah :: Nelayan : ?
  - Hubungan hierarki/genus-spesies: Mamalia : Paus :: Reptilia : ?
  - Hubungan antonim/sinonim kontekstual
  - WAJIB: Nyatakan hubungan eksplisit di pembahasanSingkat sebelum menentukan jawaban

▸ Silogisme / Penalaran Logis
  - Silogisme kategoris: Premis 1 (semua A adalah B) + Premis 2 (C adalah A) → Kesimpulan (C adalah B)
  - Silogisme dengan negasi: "Tidak ada", "Beberapa", "Semua bukan"
  - Kontraposisi: Jika P maka Q → Jika tidak Q maka tidak P
  - Penalaran kondisional bersarang: If-then-else dengan 2-3 kondisi
  - Contoh pola soal: "Semua dokter adalah sarjana. Sebagian sarjana adalah pengusaha. Kesimpulan yang PASTI benar adalah..."
  - WAJIB: Tuliskan struktur premis secara formal di pembahasanSingkat

ATURAN KETAT PEMBUATAN SOAL:
1. HITUNG ULANG setiap jawaban numerik dari nol — cantumkan langkah di pembahasanSingkat
2. Pengecoh numerik WAJIB berupa hasil kesalahan umum (misal: lupa balik nilai, salah operasi urutan)
3. Semua soal bisa diselesaikan TANPA kalkulator dalam ≤ 2 menit
4. Variasikan tipe: setiap batch harus ada minimal 3 tipe berbeda (numerik, verbal, figural)
5. ANTI-REPETISI: tidak ada dua soal dengan konsep/konteks yang sama dalam satu batch
6. Angka dalam soal cerita harus realistis dan bersih (hasil bilangan bulat atau pecahan sederhana)

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
      if ([429,413,503,400,404].includes(err.status)) { lastErr=err; console.warn(`Model ${model} skip:`, err.status); continue; }
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
    if (err.status===401) return res.status(401).json({success:false,error:'GROQ_API_KEY tidak valid atau expired. Perbarui di Vercel Dashboard → Settings → Environment Variables, lalu Redeploy.'});
    return res.status(500).json({success:false,error:err.message});
  }
};
