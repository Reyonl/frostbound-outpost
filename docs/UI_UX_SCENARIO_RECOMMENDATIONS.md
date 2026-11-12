# Frostbound Outpost: UI/UX Polish & Scenario Expansion Guide

Dokumen ini berisi rekomendasi komprehensif untuk memoles tampilan visual antarmuka (**UI Polish**), meningkatkan kenyamanan kontrol mobile portrait (**Ergonomics & Affordance**), serta menambahkan skenario gameplay interaktif (**UX Gameplay Scenarios**) pada game **Frostbound Outpost**.

---

## 1. Visi Desain & Game Feel ("Frosted Nordic Survival")

Frostbound Outpost menggabungkan kepuasan **stack-carry & idle automation** ala game mobile modern (*My Little Universe*, *Idle Lumber Empire*) dengan tensi **survival di alam salju es** (*Frostpunk lite*).

Untuk mewujudkan game feel yang *juicy*, memuaskan, dan adiktif di layar portrait smartphone:
- **Prinsip UI:** Informasi penting terlihat dalam lirikan 0,2 detik (*glanceable*), area jempol bebas halangan (*thumb-zone friendly*), dan angka/ikon kontras tinggi berlatar *frosted glass* khas cuaca es.
- **Prinsip UX:** Setiap aksi pemain menghasilkan umpan balik visual (*squash-and-stretch*), getaran haptik berirama (*tactile rhythm*), dan audio sintetis bernada naik (*pitch-ramped chimes*).

---

## 2. Rekomendasi Poles Visual Antarmuka (UI Polish)

```
┌────────────────────────────────────────────────────────┐
│ [🔥 85% THERMO] [DAY 2 · WAVE 3]          [🔊]         │  <-- Top Bar Glanceable
│                                                        │
│                                  [$ 450] [🪵 12]       │  <-- Resource Pills
│                                  [🥩 4]  [🪙 8]        │      (Tabular font)
│                                                        │
│                    [ 3D GAMEPLAY ]                     │
│         (Survivor dengan bubble donat progress)        │
│         (Unlock pad dengan pilar cahaya lembut)        │
│                                                        │
│           [⚠️ BADAI SALJU DALAM 15 DETIK!]             │  <-- Event Banner
│                                                        │
│    [🎯 Quest: Beri makan 2 Survivor (1/2)]             │  <-- Micro-Quest Pill
│                                                        │
│                                                        │
│  [⚡ UPGRADES]       [🎒 STACK: 8/12]        [🔥 FLARE]│  <-- Action Row (Bawah)
│  (Tombol Jempol)     (Visual segmented)      (Darurat) │
└────────────────────────────────────────────────────────┘
```

### 2.1. Frosted Nordic Glassmorphism & Color Palette
- **Latar Belakang Elemen HUD:** Ganti kartu solid abu-abu gelap dengan gaya *Frosted Glacial Glass*:
  - Background: `rgba(15, 23, 42, 0.72)` dengan `backdrop-filter: blur(12px)`.
  - Border: Garis tepi es halus `1.5px solid rgba(125, 211, 252, 0.35)` dengan bayangan lembut `box-shadow: 0 4px 16px rgba(2, 6, 23, 0.4)`.
- **Palet Warna Ikon & Resource:**
  - **Cash ($):** Emerald Green `#4ade80` (kesan keuntungan dan kekayaan).
  - **Wood (🪵):** Amber-Wood `#fb923c` (kayu hangat).
  - **Meat (🥩):** Crimson Salmon `#f43f5e` (protein daging segar).
  - **Gold (🪙):** Radiant Sun Gold `#fbbf24` (material mewah).
- **Tipografi Tabular:** Terapkan `font-variant-numeric: tabular-nums` dan font display tegas (seperti `Chakra Petch` atau `Russo One`) agar angka sumber daya tidak bergeser atau berkedip liar saat nilainya bertambah cepat.

### 2.2. Thermal Dial / Radial Frost Gauge (Pengganti Teks "🔥 100%")
- **Masalah Saat Ini:** Warmth hanya berupa teks kecil `🔥 100%` di pojok kiri atas, kurang memberikan sensasi urgensi ketika pemain kedinginan.
- **Solusi Rekomendasi:**
  - Buat **Thermal Gauge Melingkar / Termometer Busur** di sisi kiri atas.
  - Saat berada di dekat Campfire (kehangatan 100%): Gauge menyala oranye keemasan dengan efek partikel percikan api mikro (*ember sparks*).
  - Saat menjauh ke hutan bersalju / saat badai: Warna lingkaran berangsur berubah dari oranye -> kuning -> biru es beku.
  - Saat di bawah 25%: Lingkaran berkedip merah dan muncul **efek kristal es merambat di sudut layar handphone** (*Frost Screen Vignette*).

### 2.3. Segmented Backpack Capacity Bar (Indikator Beban Punggung)
- **Desain Saat Ini:** Garis progres batang sederhana `PACK 0 / 12`.
- **Polesan Baru:**
  - Tampilkan bilah bersegmen kotak-kotak kecil (sesuai kapasitas tas, misal 12 slot).
  - Saat item baru masuk ke punggung, kotak yang bersangkutan membesar sejenak (*bounce/punch effect*).
  - Saat tas penuh (`12/12`): Bar berdenyut warna merah marun dengan teks `MAX CAPACITY!`, dan tombol arah joystick memberikan sensasi getaran berat (*heavy drag*).

### 2.4. World-Space UI: Pilar Cahaya & Panah Navigasi Ground
- **Unlock Pads & Drop Zones:**
  - Ketika pemain memiliki sumber daya yang **cukup** untuk membeli Unlock Pad atau mengisi Drop Zone, pad tersebut memancarkan **Pilar Cahaya Lembut (Beacon Ray)** ke langit dan lingkaran lantai berputar pelan (*rotating dashed ring*).
  - Ini membantu navigasi intuitif di HP kecil tanpa pemain perlu bingung mencari ke mana harus menyetor kayu/daging.
- **Speech Bubble Survivor:**
  - Ganti teks statis kotak putih dengan bubble beranimasi lembut (mengambang naik-turun).
  - Tampilkan **ikon barang + cincin progres donat**: jika survivor butuh 6 kayu dan pemain baru menyetor 3, cincin terisi 50% warna hijau.
  - Begitu terpenuhi, muncul emotikon senang `😊` atau `❤️` dan lembaran uang melompat keluar ke tanah (*cash burst*).

### 2.5. Upgrade Modal Bertab (Weapon, Outpost, Automation)
- **Struktur Saat Ini:** Modal upgrade menggulung semua item dalam satu daftar panjang.
- **Polesan Baru:**
  - Berikan 3 Tab Kategori di bagian atas modal:
    1. ⚔️ **Combat** (Axe Speed, Axe Range, Axe Damage)
    2. 🏕️ **Survival** (Backpack Capacity, Move Speed, Warmth Retention)
    3. ⚙️ **Automation** (Turret Damage, Minecart Speed, Helper Efficiency)
  - Setiap kartu upgrade memiliki ikon ilustratif dan preview efek (misal: `Level 3 -> 4: +25% Kecepatan Tebas`).
  - Tombol beli memiliki indikator visual jelas: hijau menyala jika uang cukup, redup berarsir jika uang kurang.

---

## 3. Rekomendasi Skenario UX Baru (Gameplay Loop & Drama)

Berikut adalah 6 skenario UX interaktif yang dapat diterapkan untuk memperdalam pengalaman bermain:

### Skenario 1: "Survivor Rush Hour" & Tip Cepat (Morale System)
- **Latar Belakang:** Korban selamat (survivor) yang datang ke outpost kedinginan dan kelaparan.
- **Alur UX:**
  - Di atas kepala setiap survivor terdapat timer dingin (*frost countdown*).
  - **Skenario Happy Path:** Jika pemain mengantarkan makanan/kayu sebelum timer habis (dalam 15 detik pertama), survivor merasa sangat puas dan memberikan **Speed Tip (+25% Cash tambahan & partikel koin emas)**.
  - **Skenario Terlambat:** Jika terlambat, mereka tetap menerima barang tetapi hanya membayar tarif normal sambil menggigil.
  - **Survivor Khusus (Specialist Event):** Sesekali muncul survivor dengan topi khusus:
    - *The Trapper:* Meminta 4 Daging -> Memberikan buff sementara: serigala di hutan lari ketakutan selama 60 detik.
    - *The Miner:* Meminta 4 Kayu -> Menambahkan gerbong kedua pada kereta tambang emas selama 1 hari.

### Skenario 2: Krisis Badai Salju & Tombol "Stoke Campfire" (Survival Climax)
- **Latar Belakang:** Badai salju (blizzard) merupakan momok utama di Frostbound Outpost.
- **Alur UX:**
  - **Peringatan Dini (10 Detik Sebelum Badai):**
    - Terdengar tiupan terompet salju (*Nordic horn warning*).
    - Banner atas berdenyut: `⚠️ BADAI SALJU MENDEKAT! SEGERA KEMBALI KE BASE!`
    - Angin kencang bertiup di layar dan jarak pandang menyempit.
  - **Selama Badai:**
    - Kristal es membekukan pinggiran layar smartphone (*frosted camera edges*).
    - Musuh (Polar Bear & Wolf) menjadi lebih agresif dengan mata menyala merah.
    - Suhu tubuh menurun 2x lebih cepat jika berada di luar dinding outpost.
  - **Mekanik Penyelamat (Campfire Flare):**
    - Di dekat api unggun pusat base, muncul tombol darurat **"STOKE FIRE"** (Biaya: 5 Kayu).
    - Menekan tombol ini meluncurkan gelombang api hangat (*heat shockwave*) ke seluruh area outpost:
      - Menghangatkan pemain seketika ke 100%.
      - Membekukan/menakut-nakuti musuh yang mencoba menerobos gerbang base selama 8 detik.

### Skenario 3: Otomasi Outpost & Rantai Logistik Visual
- **Latar Belakang:** Sensasi terbaik dalam game idle-hybrid adalah melihat base berjalan mandiri (*autonomous satisfaction*).
- **Alur UX:**
  - Saat pemain membuka pekerja helper (Lumberjack atau Hauler):
    - Pekerja memiliki jejak kaki kecil di atas salju (*footstep trails*) menuju pohon terdekat.
    - Terdengar ketukan kapak ritmis dari hutan dan peluit riang saat pekerja menyetor kayu ke sawmill.
  - Kereta Tambang (Minecart Loop):
    - Saat gerobak tambang tiba di stasiun base penuh dengan bongkahan emas, terdengar lonceng stasiun `Ting-Ting!` yang merdu.
    - Bongkahan emas otomatis terlontar ke drop zone penyimpanan dengan suara denting koin berderai.

### Skenario 4: Pertarungan Boss "Goliath Frostclaw" (Cinematic Drama)
- **Latar Belakang:** Setiap wave kelipatan 5 (Wave 5, Wave 10, dst.), bos beruang raksasa muncul.
- **Alur UX:**
  - **Cinematic Letterboxing:** Dua bilah hitam sinematik muncul di atas dan bawah layar selama 1,5 detik. Kamera bergetar lembut saat langkah kaki raksasa mendekat.
  - **Segmented Boss Bar:** Bar darah bos muncul di bagian atas tengah layar dengan 3 segmen:
    - Segmen 1 (100%-66%): Serangan cakar normal.
    - Segmen 2 (66%-33%): *Ice Roar* (memunculkan 2 serigala pengawal).
    - Segmen 3 (33%-0%): *Rage Charge* (berlari kencang, pemain harus menghindar ke samping menggunakan joystick).
  - **Telegraphed Danger Decal:** Sebelum boss memukul tanah, muncul lingkaran merah di lantai es 1 detik sebelumnya (*ground hazard indicator*), memberi kesempatan pemain untuk bermanuver.

### Skenario 5: Upacara Ekspedisi Baru / Prestige Ceremony
- **Latar Belakang:** Melakukan prestige tidak boleh terasa seperti kehilangan progres, melainkan pencapaian heroik (*heroic rebirth*).
- **Alur UX:**
  - Saat pemain memilih **"NEW EXPEDITION"**:
    - Layar tidak langsung reset, melainkan menampilkan **Buku Ekspedisi (Expedition Ledger)**:
      - 🌲 Total Pohon Ditebang: `142`
      - 🐻 Predator Dikalahkan: `38`
      - 🧑‍🤝‍🧑 Korban Diselamatkan: `24`
      - 💎 Relik Kuno Didapatkan: `+15 Ancient Frost Cores`
    - Animasi penempaan relik bersinar biru es dengan suara paduan suara (*celestial chime*).
    - Karakter menaiki kereta seluncur anjing salju (*dog sled*), melaju ke arah cahaya utara (Aurora Borealis) sebelum babak baru dimulai dengan bonus permanen.

### Skenario 6: Micro-Quests & Objective Breadcrumbs ("One-More-Minute" Loop)
- **Latar Belakang:** Pemain mobile sering bermain dalam sesi 2–5 menit di sela aktivitas.
- **Alur UX:**
  - Letakkan kapsul objektif mini di bawah status bar:
    - Contoh: `🎯 Kumpulkan 10 Balok Kayu (7/10)`
    - Contoh berikutnya: `🎯 Beri makan 2 Survivor (1/2)`
    - Contoh berikutnya: `🎯 Bangun Menara Crossbow Pertama`
  - Menyelesaikan quest mini langsung memberikan semburan uang koin tunai, suara sukses (*fanfare* pendek), dan getaran haptik kepuasan.

---

## 4. Matriks Audio & Haptic Feedback (Juice Engine)

Agar sensasi bermain di smartphone Android terasa premium dan responsif:

| Aksi / Event | Respons Haptik (Vibration) | Respons Audio WebAudio (Synthesized) |
|---|---|---|
| **Langkah Kaki di Salju** | - | Suara *crunch* salju lembut teredam |
| **Kapak Menebas Pohon** | `10ms` Light Tap | *Thwack* kayu berfrekuensi sedang-tinggi |
| **Pohon Tumbang** | `35ms` Crisp Thud | *Creak-Crash* kayu retak + partikel daun |
| **Item Masuk ke Punggung** | `8ms` Micro Click | Nada pentatonik naik (C4 -> D4 -> E4 -> G4 -> A4) |
| **Mengisi Drop Zone** | Rangkaian getaran cepat 3x | Suara aliran *whoosh* serapan energi |
| **Membeli Upgrade / Pad** | `25ms` Dual Pulse `[15, 30, 25]` | Suara denting koin emas + nada akor sukses |
| **Peringatan Badai Salju** | Gelombang ganda `[40, 60, 40]` | Gemuruh angin bass rendah + terompet es |
| **Boss Ground Slam** | `70ms` Heavy Punch | Dentuman *sub-bass impact* + getaran layar |

---

## 5. Rencana Prioritas Implementasi

| Fase | Fokus Implementasi | Dampak Pengalaman Pemain |
|---|---|---|
| **Fase 1 (Quick Win Visual & HUD)** | - Terapkan tipografi tabular & styling *frosted glass* pada HUD.<br>- Bangun *Radial Thermal Gauge* dan *Segmented Backpack Bar*.<br>- Tambahkan pilar cahaya (*beacon rays*) pada Unlock Pad yang siap beli. | Tampilan langsung terlihat seperti game komersial berkualitas tinggi; informasi status terbaca instan. |
| **Fase 2 (Skenario Survival & Base Juice)** | - Tambahkan efek *Frost Screen Vignette* saat badai dan suhu dingin.<br>- Implementasikan sistem *Speed Tip* pada antrian survivor.<br>- Tambahkan tombol darurat api unggun (*Stoke Campfire*). | Gameplay terasa lebih menegangkan, dinamis, dan memuaskan secara taktikal. |
| **Fase 3 (Drama Boss & Upacara Prestige)** | - Tambahkan *Cinematic Letterboxing* & *Boss Health Bar* untuk Wave Boss.<br>- Hadirkan *Expedition Ledger* pada saat Prestige reset.<br>- Integrasikan *Micro-Quest Pills* untuk retensi pemain pemula. | Retensi jangka panjang meningkat; pemain memiliki kepuasan progresi yang jelas. |

---

*Dokumen ini siap ditinjau. Jika ada skenario tertentu yang ingin diimplementasikan terlebih dahulu ke dalam kode `web_game/`, silakan berikan arahan!*
