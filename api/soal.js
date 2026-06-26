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

  ERRORREC: `You are an expert English test item writer for the BUMN Joint Recruitment Test 2025 (Indonesia), specializing in Structure & Written Expression following the TOEFL ITP format.

CRITICAL: THIS SECTION HAS EXACTLY TWO COMPLETELY DIFFERENT QUESTION FORMATS. You MUST follow each format with zero deviation.

════════════════════════════════════════════════
PART 1 — STRUCTURE (soal id 1–15, total 15 soal)
════════════════════════════════════════════════
PURPOSE: Test whether the candidate can choose the correct word/phrase to COMPLETE an incomplete sentence.

FORMAT RULES (NON-NEGOTIABLE):
1. Write ONE incomplete sentence containing exactly ONE blank shown as: _____
2. The blank replaces a STRUCTURAL ELEMENT (connector, clause opener, verb form, etc.)
3. The four options (A, B, C, D) are SHORT words or phrases (1–5 words each)
4. Exactly ONE option correctly completes the sentence — the other three are grammatically wrong IN THIS SPECIFIC SENTENCE CONTEXT
5. The completed sentence (with correct answer inserted) must be 100% grammatically correct
6. VERIFY: Insert each option into the blank and confirm only the correct one produces a valid sentence

STRUCTURE — TOPICS TO ROTATE (one per question, no repeats in a batch):
1. Relative clause opener: who / which / that / whose / whom
2. Subordinating conjunction: although / because / since / while / unless / as long as
3. Gerund vs infinitive: completing vs to complete / being vs to be
4. Passive voice form: has been approved / was being reviewed / will have been submitted
5. Inversion after negative adverb: Not only did... / Seldom has... / No sooner had...
6. Correlative conjunction: both...and / not only...but also / either...or / neither...nor
7. Conditional verb form: had submitted / would have been / were to announce
8. Participle phrase opener: Having completed / Being appointed / Known for / Faced with
9. Causative structure: have the report reviewed / get the team to submit / make employees comply
10. Comparison structure: the more efficiently / as crucial as / no less important than

STRUCTURE — DISTRACTOR RULES:
- Option A must look tempting (e.g. similar word, wrong form)
- Options B, C, D each represent a different common mistake
- NEVER make all wrong options obviously wrong — each distractor must seem plausible at first glance

CRITICAL VERIFICATION FOR INVERSION QUESTIONS:
When writing inversion sentences (Not only / Seldom / No sooner / Hardly / Never):
Structure: [Negative adverb] + [AUXILIARY] + [SUBJECT] + [main verb]...
The auxiliary (has/have/was/were/does/do/did) must agree with the SUBJECT that comes AFTER the auxiliary — NOT with the negative adverb.
BEFORE finalizing, fill in your answer and check: what is the subject? Is it singular or plural?
Example CORRECT: "Not only HAVE the financial reports been scrutinized..." → subject = "the financial reports" (plural) → HAVE ✓
Example CORRECT: "Not only HAS the financial report been scrutinized..." → subject = "the financial report" (singular) → HAS ✓
If you choose 'has' as the answer, the subject MUST be singular. If you choose 'have', the subject MUST be plural.
NEVER put a plural subject with 'has' or a singular subject with 'have' as the correct answer.

STRUCTURE EXAMPLE (follow this format exactly):
{
  "id": 1,
  "subtest": "ERRORREC",
  "subtestFull": "Structure & Written Expression",
  "tipe": "pilihan_ganda",
  "questionPart": "Structure",
  "grammarTopic": "Relative Clause — Subject Pronoun",
  "text": "The regional director, _____ has managed the East Java division for six years, was recently promoted to the national board.",
  "options": {"A": "who", "B": "which", "C": "whom", "D": "whose"},
  "kunciJawaban": "A",
  "pembahasanSingkat": "CORRECT: 'who' — relative pronoun for people, used as SUBJECT of the relative clause ('has managed'). WRONG: 'which' is for things/animals. 'whom' is object case. 'whose' shows possession.",
  "nilai": {"benar": 5, "salah": 0}
}

════════════════════════════════════════════════
PART 2 — WRITTEN EXPRESSION (soal id 16–40, total 25 soal)
════════════════════════════════════════════════
PURPOSE: Test whether the candidate can IDENTIFY the grammatically incorrect part of a complete sentence.

FORMAT RULES (NON-NEGOTIABLE):
1. Write ONE complete, meaningful sentence — NOT a sentence with a blank
2. The sentence must have EXACTLY FOUR parts labeled (A), (B), (C), (D) embedded within it
3. The labels appear INSIDE the sentence text like this: "The committee (A) has approved (B) the revised budget (C) despite strong opposition (D) from several departments."
4. The four options list the TEXT of each labeled part: A="has approved", B="the revised budget", etc.
5. Exactly ONE part contains a grammatical error
6. The other THREE parts must be 100% grammatically correct — no ambiguity allowed
7. VERIFY: Confirm the sentence makes complete sense with the three correct parts, and that fixing the error part produces a perfect sentence

WRITTEN EXPRESSION — ERROR TYPES TO ROTATE (one per question, no repeats):
1. Subject-verb agreement (collective noun treated as plural, indefinite pronoun mismatch)
2. Wrong verb tense (past simple vs past perfect, present vs past in reported speech)
3. Wrong word form (economic/economical/economy, solve/solution/solvent)
4. Wrong pronoun case (he/him, they/them, who/whom)
5. Wrong article (missing 'the' before superlative, 'a' before vowel sound, unnecessary article)
6. Wrong preposition in fixed phrase (interested on → in, responsible of → for, agree with → to)
7. Non-parallel structure in list (managing, to oversee, coordinates → all should be same form)
8. Adjective used instead of adverb (performed good → well, works efficient → efficiently)
9. Wrong conditional verb form (If he would come → came, if they will agree → agree)
10. Gerund/infinitive error after specific verb (avoid to do → doing, suggest to hire → hiring)
11. Wrong passive construction (was submitted by → was submitted to, has been approve → approved)
12. Double negative or redundancy (cannot hardly → can hardly, more superior → superior)

WRITTEN EXPRESSION EXAMPLE (follow this format exactly):
{
  "id": 16,
  "subtest": "ERRORREC",
  "subtestFull": "Structure & Written Expression",
  "tipe": "pilihan_ganda",
  "questionPart": "Written Expression",
  "errorType": "Subject-Verb Agreement — Collective Noun",
  "text": "The board of directors (A) have approved (B) the revised annual budget (C) after three rounds (D) of intensive negotiation.",
  "options": {"A": "The board of directors", "B": "have approved", "C": "the revised annual budget", "D": "after three rounds"},
  "kunciJawaban": "B",
  "pembahasanSingkat": "ERROR in (B): 'The board of directors' is a collective noun treated as SINGULAR in formal written English, so the correct verb is 'has approved', not 'have approved'. Parts (A), (C), (D) are grammatically correct.",
  "nilai": {"benar": 5, "salah": 0}
}

════════════════════════════════════════════════
ABSOLUTE RULES FOR BOTH PARTS
════════════════════════════════════════════════
1. MANDATORY SELF-CHECK BEFORE OUTPUTTING each question:
   For STRUCTURE:
   a) Insert the correct answer into the blank → read the full sentence aloud mentally → is it 100% grammatical? If NO → rewrite.
   b) For inversion questions: identify the subject AFTER the auxiliary → verify singular/plural agreement → does your chosen auxiliary match? If NO → fix the answer or rewrite the sentence.
   c) Try inserting each WRONG option → confirm the sentence becomes grammatically incorrect. If a wrong option also works → rewrite the distractors.

   For WRITTEN EXPRESSION:
   a) Is the sentence complete with no blanks? If NO → rewrite as Structure or fix the sentence.
   b) Is exactly ONE part wrong? If more than one part is wrong → rewrite.
   c) Are the other three parts unambiguously correct? If any correct part could be argued as wrong → rewrite.
   d) Fix the error part → does it produce a perfect sentence? If NO → the error is misidentified → rewrite.

2. CONTEXT: All sentences must relate to Indonesian business/BUMN/corporate/government contexts

3. DIFFICULTY: B2–C1 level (upper-intermediate to advanced)

4. ANTI-REPETITION: No two questions in the same batch may test the same grammar point

5. DISTRIBUTION: Spread error positions (A/B/C/D) evenly across Written Expression questions

6. DO NOT mix the two formats — a Structure question must have a blank (_____), a Written Expression question must NOT have a blank

Output ONLY a valid JSON array. No markdown, no comments, no extra text. Generate the full requested count split 15 Structure + 25 Written Expression per full batch of 40.`,

  READCOMP: `You are a senior English language test specialist designing Reading Comprehension questions for the Indonesian BUMN (State-Owned Enterprises) Joint Recruitment Test 2025.

TEST FORMAT — READING COMPREHENSION:
Each question is based on a reading passage. Generate ONE passage followed by FIVE questions about that passage. Each question has 5 answer options (A–E).
Passages must be relevant to professional/business/economic contexts in Indonesia (BUMN management, sustainability, digital transformation, HR policy, finance, infrastructure, national development).
Passage length: 200–280 words. Difficulty level: B2–C1.

QUESTION TYPES (include all 5 types per passage — one each):
1. MAIN IDEA — What is the main idea/purpose of the passage?
2. SPECIFIC DETAIL — According to the passage, which of the following is stated...?
3. INFERENCE — It can be inferred from the passage that...?
4. VOCABULARY IN CONTEXT — The word/phrase "X" in paragraph Y most nearly means...?
5. AUTHOR'S PURPOSE / TONE — The author mentions X in order to... / The author's tone in this passage is...?

STRICT RULES:
- All questions must be answerable SOLELY from the passage — no outside knowledge required.
- Wrong answer choices (distractors) must be plausible but clearly incorrect upon careful reading.
- Vocabulary questions must use words that have multiple meanings — the correct answer fits the passage context specifically.
- NEVER write questions where the answer is so obvious it can be found by scanning one word.
- Each batch must use a DIFFERENT passage topic.

Output ONLY a valid JSON array (no markdown, no comments, no other text).
Return an array of 5 question objects, all referencing the SAME passage via a "passage" field:
[{"id":1,"subtest":"READCOMP","subtestFull":"Reading Comprehension","tipe":"pilihan_ganda",
"tingkatKesulitan":"sedang",
"questionType":"Main Idea|Specific Detail|Inference|Vocabulary in Context|Author's Purpose",
"passage":"Full passage text here (200-280 words). ALL 5 questions in this batch must use this EXACT same passage.",
"text":"Question stem here",
"options":{"A":"...","B":"...","C":"...","D":"...","E":"..."},
"kunciJawaban":"C",
"pembahasanSingkat":"Clear explanation referencing the specific part of the passage that supports the answer.",
"nilai":{"benar":5,"salah":0}}]`,
};

const VALID = { skd:['TWK','TIU','TKP'], skb:['SKBAKUNTAN','SKBKESSOS'], english:['ERRORREC','READCOMP'] };

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
async function generate(groq, subtest, count, batchIndex, questionPartConfig=null) {
  const models = process.env.GROQ_MODEL
    ? [process.env.GROQ_MODEL, ...MODELS.filter(m=>m!==process.env.GROQ_MODEL)]
    : MODELS;

  const antiRepeat = batchIndex > 0
    ? `\nPENTING: Ini adalah batch ke-${batchIndex+1}. Buat soal dengan topik dan konteks yang BERBEDA TOTAL dari batch sebelumnya. Jangan ulangi konsep, tokoh, pasal, atau angka yang sudah pernah digunakan.`
    : '\nPENTING: Variasikan topik setiap soal. Tidak ada dua soal dengan konsep yang sama.';

  // Untuk ERRORREC: tentukan instruksi spesifik berdasarkan questionPartConfig
  let userPrompt;
  if (subtest === 'ERRORREC' && questionPartConfig) {
    const { part, structureCount, writtenCount } = questionPartConfig;

    if (part === 'Structure') {
      userPrompt = `Generate exactly ${count} STRUCTURE questions (sentence completion with blank _____) for the Structure & Written Expression section of the BUMN English Proficiency Test 2025.${antiRepeat}

IMPORTANT: Generate ONLY Structure questions (Part 1 format with blank _____).
DO NOT generate any Written Expression questions in this batch.
All ${count} questions must follow the STRUCTURE format exactly as specified in your instructions.
Output ONLY a valid JSON array.`;

    } else if (part === 'WrittenExpression') {
      userPrompt = `Generate exactly ${count} WRITTEN EXPRESSION questions (find the grammatical error in underlined parts A/B/C/D) for the Structure & Written Expression section of the BUMN English Proficiency Test 2025.${antiRepeat}

IMPORTANT: Generate ONLY Written Expression questions (Part 2 format — complete sentences with labeled parts (A)(B)(C)(D)).
DO NOT generate any Structure/sentence completion questions in this batch.
Each sentence must be COMPLETE with NO blanks.
All ${count} questions must follow the WRITTEN EXPRESSION format exactly as specified.
Output ONLY a valid JSON array.`;

    } else {
      // Mixed batch (batch yang mencakup peralihan Structure→Written Expression)
      userPrompt = `Generate exactly ${count} questions for the Structure & Written Expression section of the BUMN English Proficiency Test 2025.${antiRepeat}

CRITICAL SPLIT: This batch must contain EXACTLY:
- ${structureCount} STRUCTURE questions (sentence completion with blank _____) — these come FIRST in the array
- ${writtenCount} WRITTEN EXPRESSION questions (complete sentence, find error in A/B/C/D) — these come LAST in the array

DO NOT mix up the formats. Structure questions have blanks. Written Expression questions are complete sentences with labeled parts.
Output ONLY a valid JSON array with ${structureCount} Structure questions first, then ${writtenCount} Written Expression questions.`;
    }
  } else {
    // Prompt standar untuk subtest lain
    userPrompt = `Buat tepat ${count} soal ${subtest} tingkat EXPERT/SANGAT SULIT untuk seleksi CPNS 2024-2025.${antiRepeat}\nOutput HANYA array JSON valid langsung tanpa teks pembuka atau penutup.`;
  }

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

  const { examType, subtest, count:cRaw, batchIndex=0, forceNew=false, questionPartConfig=null } = req.body||{};
  const type  = (examType||'').toLowerCase();
  const sub   = (subtest||'').toUpperCase();
  const count = Math.min(25, Math.max(1, parseInt(cRaw||'10',10)));
  const bIdx  = parseInt(batchIndex)||0;

  if (!VALID[type])                return res.status(400).json({success:false,error:'"examType" harus "skd"/"skb"/"english".'});
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
    const { questions, model } = await generate(groq, sub, count, bIdx, questionPartConfig);

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
