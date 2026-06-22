// api/soal.js — POST /api/soal
// Soal tersimpan PERMANEN di Firestore koleksi soal_bank.
// Device lain langsung pakai soal yang sama tanpa generate ulang.
// forceNew=true → generate baru dan timpa database.

// ─── FIX: Set maxDuration 60 detik agar Vercel tidak kill function
// sebelum generate + simpan ke Firestore selesai (default Vercel = 10 detik)
export const maxDuration = 60;

const Groq = require('groq-sdk');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

// Model Groq per Juni 2026
const MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.3-70b-versatile',
  'qwen-qwq-32b',
  'llama3-groq-70b-8192-tool-use-preview',
  'gemma2-9b-it',
  'llama-3.1-8b-instant',
];

// ─── SYSTEM PROMPTS ────────────────────────────────────────────
const PROMPTS = {
  TWK: `Anda adalah Tim Konsorsium Nasional Penyusun Soal Seleksi CPNS (Gabungan Expert dari BKN, KemenPAN-RB, BPIP, Lemhannas, KPK, dan Badan Pengembangan dan Pembinaan Bahasa), spesialis Tes Wawasan Kebangsaan (TWK) untuk seleksi 2024–2025.

FILOSOFI & SUMBER SOAL TWK TERKINI (WAJIB DIPAHAMI):
Soal TWK era 2024-2025 TIDAK lagi menguji hafalan (siapa tokoh X, tanggal Y, bunyi pasal Z, Pasal berapa), jadi jangan ada hafalan apapun. 
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
• PENALARAN KONTEKSTUAL: Diberikan skenario hukum tata negara nyata, peserta menentukan pasal yang relevan dan implementasinya.

━━━ 3. NKRI & NASIONALISME (Sumber Gaya Soal: Dokumen Ketahanan Nasional - Lemhannas) ━━━
• Sejarah Kemerdekaan: Peran strategis organisasi pergerakan nasional sebagai fondasi kesadaran berbangsa.
• Wawasan Nusantara & Ketahanan Nasional: Menggunakan kerangka Astagatra Lemhannas dalam menghadapi ancaman non-militer.
• Bela Negara (Pasal 27 ayat 3 & Pasal 30 UUD 1945): Konteks bela negara modern bagi ASN.

━━━ 4. BHINNEKA TUNGGAL IKA (Sumber Gaya Soal: Studi Kasus Kemenag RI & Kemensos) ━━━
• Mengelola keberagaman: Strategi integrasi sosial, mitigasi konflik horizontal, toleransi antarumat beragama.
• Makna filosofis Sutasoma dalam menghadapi isu etnosentrisme, chauvinisme, dan primordialisme di era digital.

━━━ 5. INTEGRITAS (Sumber Gaya Soal: Modul Anti-Korupsi KPK RI & Core Values ASN BerAKHLAK) ━━━
• 9 Nilai Dasar Integritas (KPK): Jujur, peduli, mandiri, disiplin, tanggung jawab, kerja keras, sederhana, berani, adil.
• Skenario WAJIB berupa dilema etika ASN di tempat kerja (gratifikasi, benturan kepentingan, whistleblowing).

━━━ 6. BAHASA INDONESIA (Sumber Gaya Soal: Tes UKBI Kemdikbudristek/Badan Bahasa) ━━━
• Analisis Wacana Ilmiah/Berita Formal: Menentukan ide pokok, simpulan, asumsi logis, dan kelemahan argumen.
• Kalimat efektif dan ketepatan diksi berdasarkan EYD Edisi V dan KBBI.

STANDAR PEMBUATAN SOAL EXPERT:
1. WAJIB berbasis skenario/kasus/dilema nyata yang biasa dialami ASN atau masyarakat luas.
2. Pengecoh (Distractor) HARUS Sangat Meyakinkan: Semua opsi (A,B,C,D,E) harus terlihat positif atau benar.
3. Referensi Akurat: Pembahasan wajib mengutip dasar hukum atau teori resmi.
4. ANTI-REPETISI: Setiap soal angkat aspek BERBEDA, tidak ada dua soal dengan konsep sama dalam satu batch.

Output HANYA array JSON valid (tanpa markdown, tanpa komentar, tanpa teks lain):
[{"id":1,"subtest":"TWK","subtestFull":"Tes Wawasan Kebangsaan","tipe":"pilihan_ganda",
"tingkatKesulitan":"sulit","topik":"nama topik spesifik",
"text":"Skenario/kasus yang kompleks dan membutuhkan penalaran...",
"options":{"A":"...","B":"...","C":"...","D":"...","E":"..."},
"kunciJawaban":"B",
"pembahasanCukupDetail":"Analisis cukup detail mengapa B benar. Mengapa opsi lain salah.",
"referensi":"Sumber spesifik: Pasal X UUD 1945 / Sila Y Pancasila / UU No. X Tahun Y",
"nilai":{"benar":5,"salah":0}}]`,

  TIU: `Anda adalah Tim Konsorsium Psikometri Nasional (Gabungan Pakar Kognitif BKN, BPSDM KemenPAN-RB, dan Ahli Pengukuran Psikologi PTN), spesialis Tes Intelejensia Umum (TIU) untuk seleksi CPNS 2024–2025.

FILOSOFI & SUMBER SOAL TIU TERKINI (WAJIB DIPAHAMI):
Soal TIU BKN 2024-2025 mengukur Fluid Intelligence (kecepatan & ketepatan berpikir logis analitis) sesuai kerangka Cattell-Horn-Carroll (CHC).
Fokus pada EFISIENSI kognitif. Setiap soal dirancang agar BISA diselesaikan TANPA kalkulator dalam waktu maksimal 60-90 detik menggunakan trik/pendekatan logis.

KISI-KISI RESMI TIU CPNS & STANDAR DISTRACTOR:

━━━ 1. KEMAMPUAN NUMERIK ━━━
• Aritmatika Dasar & Pecahan: Operasi bilangan yang bisa disederhanakan dengan sifat distributif/asosiatif/komutatif.
• Aljabar & Persamaan: Substitusi dan eliminasi linier.
• Deret Angka/Pola Bilangan: Deret bertingkat, deret Fibonacci modifikasi, atau deret ganda (alternating).
• Soal Cerita: Konteks WAJIB disesuaikan dengan dunia birokrasi/pelayanan publik.

━━━ 2. KEMAMPUAN VERBAL ━━━
• Analogi: Padanan kata yang menuntut pemahaman fungsi, hierarki, atau sebab-akibat spesifik.
• Silogisme / Penalaran Logis: Modus Ponens, Modus Tollens, Silogisme kategoris dengan premis bertumpuk atau premis negatif.

ATURAN KETAT PEMBUATAN SOAL & PENGECOH:
1. Pengecoh numerik WAJIB berasal dari kesalahan kognitif umum peserta.
2. HITUNG ULANG setiap jawaban secara algoritmik dari nol sebelum mencetak output.
3. ANTI-REPETISI: Variasikan tipe soal setiap batch.

Output HANYA array JSON valid (tanpa markdown, tanpa komentar, tanpa teks lain):
[{"id":1,"subtest":"TIU","subtestFull":"Tes Intelejensia Umum","tipe":"pilihan_ganda",
"tingkatKesulitan":"sedang",
"kategori":"numerik|verbal|figural",
"tipesoal":"deskripsi spesifik (misal: deret angka pola kuadrat | analogi sebab-akibat | silogisme negasi)",
"text":"Teks soal lengkap dengan data yang jelas dan tidak ambigu",
"options":{"A":"...","B":"...","C":"...","D":"...","E":"..."},
"kunciJawaban":"C",
"pembahasanSingkat":"Untuk numerik: Langkah 1: ... Langkah 2: ... Jawaban C. Untuk verbal: Hubungan [X] dengan [Y] adalah [Z].",
"nilai":{"benar":5,"salah":0}}]`,

  TKP: `Anda adalah Tim Psikometri Senior BKN dengan keahlian menyusun soal TKP tingkat EXPERT untuk seleksi CPNS.

STANDAR EXPERT TKP:
- Skenario KOMPLEKS dengan dilema etika nyata — bukan situasi hitam-putih
- Setiap skenario melibatkan KONFLIK antara dua nilai ASN yang sama-sama penting
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

  SKBAKUNTAN: `Anda adalah Tim Penyusun Soal Senior BKN spesialis SKB Akuntansi Pemerintahan tingkat EXPERT.

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
[{"id":1,"subtest":"SKBAKUNTAN","subtestFull":"Seleksi Kompetensi Bidang — Akuntansi","tipe":"pilihan_ganda",
"tingkatKesulitan":"sulit","jenissoal":"hitungan/konseptual",
"text":"soal kompleks dengan data lengkap",
"options":{"A":"...","B":"...","C":"...","D":"...","E":"..."},
"kunciJawaban":"C",
"pembahasanSingkat":"Langkah penyelesaian detail atau analisis mendalam mengapa C benar",
"referensi":"PP/UU/Permendagri yang spesifik dan masih berlaku",
"nilai":{"benar":5,"salah":0}}]`,

  SKBKESSOS: `Anda adalah Tim Penyusun Soal Senior BKN spesialis SKB Kesejahteraan Sosial & Pemberdayaan Masyarakat tingkat EXPERT untuk seleksi CPNS 2024–2025.

FILOSOFI SOAL SKB KESEJAHTERAAN SOSIAL:
Soal mengukur kompetensi teknis Pekerja Sosial (Peksos) dan Penyuluh Sosial (Pensosmas) berdasarkan standar Kementerian Sosial RI.
Tingkat kesulitan: SULIT dan SANGAT SULIT. Semua soal berbasis kasus nyata di lapangan.

KISI-KISI RESMI SKB KESEJAHTERAAN SOSIAL (Referensi: PerMenSos & Standar Peksos IPSPI):

━━━ 1. TEORI & METODE PEKERJAAN SOSIAL ━━━
• Metode Peksos: Casework (intervensi individu & keluarga), Groupwork (dinamika kelompok), Community Organization/Development.
• Perspektif dan pendekatan: Strengths-based, Empowerment, Ecological Systems Theory (Bronfenbrenner), Anti-Oppressive Practice.
• Proses pertolongan: Assessment bio-psiko-sosial-spiritual, perencanaan intervensi, implementasi, evaluasi, terminasi.
• Kode etik profesi pekerjaan sosial (IPSPI): prinsip self-determination, kerahasiaan, non-diskriminasi.

━━━ 2. PEMBERDAYAAN MASYARAKAT ━━━
• Model pemberdayaan: Locality Development, Social Planning, Social Action (Rothman).
• Pendekatan ABCD (Asset-Based Community Development) vs kebutuhan-deficit.
• Pengembangan kapasitas komunitas: modal sosial, kearifan lokal, gotong royong dalam program pemerintah.
• Program Kemensos: KUBE (Kelompok Usaha Bersama), Tagana, Program Keluarga Harapan (PKH), BPNT, ATENSI.
• Analisis stakeholder & participatory action research (PAR) dalam konteks pemberdayaan.

━━━ 3. PERLINDUNGAN SOSIAL & KELOMPOK RENTAN ━━━
• Sistem Perlindungan Sosial Indonesia: Jaminan Sosial (BPJS), Bansos, dan integrasi DTKS (Data Terpadu Kesejahteraan Sosial).
• Penanganan PMKS (Penyandang Masalah Kesejahteraan Sosial): anak terlantar, lansia, difabel, gepeng, ODHA, korban NAPZA.
• Perlindungan anak: UU No. 35/2014 (Perlindungan Anak), UU No. 23/2002, UUPA — penanganan kasus kekerasan, penelantaran, eksploitasi.
• Pengarusutamaan gender dalam layanan sosial, perlindungan korban KDRT (UU No. 23/2004 PKDRT).

━━━ 4. KEBIJAKAN & ADMINISTRASI SOSIAL ━━━
• Analisis kebijakan sosial: agenda setting, formulasi, implementasi, evaluasi kebijakan publik di bidang Kesos.
• Desentralisasi layanan sosial: peran Dinas Sosial Kabupaten/Kota, LKSA, LKS (Lembaga Kesejahteraan Sosial).
• Manajemen kasus (case management) dalam konteks pelayanan sosial pemerintah.
• SDGs dan target pengentasan kemiskinan, kesetaraan gender, dan inklusi sosial dalam program Kemensos.

━━━ 5. ASESMEN & INTERVENSI KASUS ━━━
• Teknik wawancara peksos: motivational interviewing, active listening, genogram & ecomap.
• Krisis intervensi: penanganan kondisi darurat (bencana, KDRT akut, percobaan bunuh diri) sesuai SOP.
• Kolaborasi multiprofesi: koordinasi dengan tenaga kesehatan, psikolog, aparat hukum, dan pendidik dalam penanganan kasus.

STANDAR SOAL EXPERT:
1. Semua soal WAJIB berbasis skenario kasus nyata di lapangan — bukan definisi atau teori murni.
2. Pengecoh harus mewakili respons yang terlihat "benar" tapi melanggar etika profesi atau SOP.
3. Cantumkan referensi regulasi yang masih berlaku (UU, PerMenSos, PP).
4. ANTI-REPETISI: setiap soal angkat aspek dan kasus yang berbeda.

Output HANYA array JSON valid (tanpa markdown, tanpa komentar, tanpa teks lain):
[{"id":1,"subtest":"SKBKESSOS","subtestFull":"Kompetensi Bidang Kesejahteraan Sosial","tipe":"pilihan_ganda",
"tingkatKesulitan":"sulit","jenissoal":"kasus/konseptual",
"topik":"nama topik spesifik (misal: Intervensi Krisis pada Korban KDRT)",
"text":"skenario kasus nyata yang kompleks di lapangan...",
"options":{"A":"...","B":"...","C":"...","D":"...","E":"..."},
"kunciJawaban":"B",
"pembahasanSingkat":"Analisis mengapa B benar berdasarkan teori/SOP/regulasi. Mengapa opsi lain salah.",
"referensi":"UU/PerMenSos/PP yang spesifik dan masih berlaku",
"nilai":{"benar":5,"salah":0}}]`,
};

const VALID = { skd:['TWK','TIU','TKP'], skb:['SKBAKUNTAN','SKBKESSOS'] };

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

// ─── FIX: fsSet dengan retry 3x ───────────────────────────────
async function fsSet(col, doc, data, extra={}) {
  const pid = process.env.FIREBASE_PROJECT_ID;
  if (!pid) return false;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const token = await getToken();
    if (!token) {
      console.warn(`fsSet: gagal dapat token (attempt ${attempt})`);
      await new Promise(r => setTimeout(r, attempt * 500));
      continue;
    }
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
      if (r.ok) {
        console.log(`fsSet OK: ${doc} (attempt ${attempt})`);
        return true;
      }
      const errBody = await r.text().catch(() => '');
      console.warn(`fsSet attempt ${attempt} failed: HTTP ${r.status} — ${errBody}`);
    } catch(e) {
      console.warn(`fsSet attempt ${attempt} error: ${e.message}`);
    }
    if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 500));
  }
  console.error(`fsSet FINAL FAIL: ${doc} setelah 3 percobaan`);
  return false;
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
        temperature: 0.85,
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
    console.log(`DB miss: ${docId} — akan generate`);
  }

  // ── Generate dari Groq ─────────────────────────────────────
  try {
    const groq = new Groq({ apiKey });
    const { questions, model } = await generate(groq, sub, count, bIdx);

    questions.forEach((q,i) => {
      q.id    = i + 1;
      q.nilai = q.nilai || {benar:5,salah:0};
    });

    // ── FIX UTAMA: Simpan ke Firestore DULU, baru kirim response ──
    // Sebelumnya pakai .catch() sehingga function bisa terminate duluan
    // Sekarang: await penuh dengan retry 3x di fsSet
    const saved = await fsSet('soal_bank', docId, questions, {
      examType:type, subtest:sub, batchIndex:bIdx, count:questions.length,
    });

    if (!saved) {
      console.error(`CRITICAL: DB save gagal untuk ${docId} setelah 3x retry.`);
    }

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
