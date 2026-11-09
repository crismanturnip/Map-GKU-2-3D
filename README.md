# Interactive 3D Map GKU 2 — K-EXPO 2026

Prototype peta kawasan GKU 2 ITERA berbasis React, TypeScript, Three.js, React Three Fiber, dan Drei. Proyek ini hanya merender scene 3D penuh layar; tidak memiliki routing, backend, dashboard, atau sistem informasi acara.

## Menjalankan proyek

```bash
npm install
npm run dev
```

Build produksi:

```bash
npm run build
npm run preview
```

Uji browser otomatis (jalankan saat server `npm run dev` aktif dan Chrome tersedia):

```bash
node scripts/browser-smoke.mjs
```

Jika Chrome tidak berada di lokasi bawaan, set variabel lingkungan `CHROME_PATH` ke executable Chrome. Uji ini memeriksa pilihan area, kontrol kamera desktop, gesture mobile, dan error JavaScript.

## GitHub Pages

Website dapat dipublikasikan di `https://crismanturnip.github.io/Map-GKU-2-3D/`.
Workflow `.github/workflows/deploy-pages.yml` memasang dependency dari lockfile,
menjalankan build, dan menerbitkan folder `dist` setiap ada push ke branch `main`.
Di Settings → Pages, gunakan sumber **GitHub Actions**.

Konfigurasi Vite memakai `base: "./"` agar JavaScript, CSS, font, dan logo dapat
dimuat dari subfolder repo. Tidak diperlukan server backend atau database.
Folder `node_modules`, `dist`, dan `qa` tidak diunggah ke repository.

## Kontrol

- Desktop: drag kiri untuk memutar kamera mengelilingi kawasan.
- Mobile: drag satu jari untuk memutar kamera.
- Rotasi horizontal bebas 360°. Rotasi vertikal dibatasi agar kamera tetap di atas peta.
- Setelah interaksi berhenti selama empat detik, kamera kembali berputar pelan. Putaran otomatis mengikuti preferensi sistem untuk mengurangi gerakan.
- Pan dan zoom dinonaktifkan sesuai referensi gerakan MCT Classroom.
- Tombol **Reset view** menutup popup dan mengembalikan kamera ke sudut awal.
- Hover area menampilkan nama sederhana. Klik atau tap area membuka popup informasi zona (jenis, deskripsi, jadwal, jumlah stand, dan isi zona). Saat area dipilih, kamera meluncur mendekat ke area tersebut (sekitar 0,8 detik, dari arah pandang yang sama) dan area digeser agar tidak tertutup popup; selama itu kamera bisa diputar 360° mengelilingi area dan putaran otomatis berhenti. Popup ditutup dengan tombol ×, tombol Esc, atau klik area kosong, lalu kamera mundur ke sudut pandang sebelum area diklik. Memilih area lain langsung memindahkan kamera ke area itu. Di layar sempit popup tampil sebagai lembar bawah. Dengan preferensi sistem untuk mengurangi gerakan, kamera berpindah tanpa animasi.

Kamera mengorbit titik tengah kawasan dengan jarak tetap, sehingga bangunan dapat dilihat dari berbagai sisi tanpa berpindah ke bawah peta.

Latar memakai fungsi tekstur bintang dan bulan yang diport dari bundle publik `Scene3D-JafVaRTM.js` pada https://kmhexpo-2026.pages.dev/, termasuk ukuran tekstur, jumlah bintang, warna, kawah, dan kilau tepi bulan. Kamera latar mengikuti FOV asli 75° (responsif sampai 96°), posisi bulan `[90, -18, -360]`, radius 78, dan kecepatan putaran 0,054 radian/detik. Heading awal 029° mengikuti screenshot referensi agar bulan terlihat di samping peta. `SpaceBackdrop.tsx` merender latar ke tekstur pada resolusi 1x tanpa multisampling; React Three Fiber tetap menjalankan render peta secara normal pada satu renderer WebGL. Kontrol dan fokus kamera peta tidak mengubah kamera latar. Dengan `prefers-reduced-motion`, latar berhenti dan hasil render dipakai ulang; viewport hingga 768px memakai detail geometri/tekstur yang lebih rendah. Semua tekstur dibuat lokal melalui canvas dalam `spaceTextures.ts`, tanpa unduhan aset saat website dibuka. `SpaceBackground.tsx` menyediakan warna cadangan selama WebGL mulai dimuat; gambar WebP lama tidak dipakai lagi. `node qa/verify-reference-port.mjs` membandingkan perintah gambar tekstur desktop dan mobile dengan kode referensi yang tersimpan di `qa/reference/`.

Logo kiri atas menggunakan file pengguna di `public/branding/kemahasiswaan-expo-itera.png`. Label bangunan/area, judul panel, dan nama area terpilih menggunakan Ethnocentric dari `public/fonts/ethnocentric-regular.otf`; isi panel, status, tombol, dan petunjuk memakai IBM Plex Mono yang disimpan lokal beserta lisensinya. `SceneLabel.tsx` menunggu font Ethnocentric selesai dimuat sebelum menggambar tekstur label 3D, sehingga font tidak tertinggal memakai fallback setelah halaman dibuka.

## Struktur penting

```text
src/
├── components/map/
│   ├── Buildings.tsx       # daftar bangunan
│   ├── GKU2Building.tsx    # model detail GKU 2 (fasad, atap, pintu masuk)
│   ├── CameraRig.tsx       # kamera, batas kontrol, dan reset
│   ├── KExpoMap3D.tsx      # komponen publik/reusable
│   ├── KExpoScene.tsx      # komposisi scene
│   ├── SiteElements.tsx    # tanah dasar, pelataran GKU 2, jalan, stage, gate
│   ├── textures.ts         # tekstur canvas prosedural (paving, rumput, mural)
│   ├── Stands.tsx          # komponen stand untuk pengembangan berikutnya
│   ├── ZoneInfoPanel.tsx   # popup informasi zona
│   └── Zones.tsx           # bidang zona interaktif
├── config/mapConfig.ts     # posisi, nama, warna, dan relasi zona/stand
└── types/map.ts            # tipe data yang dipakai tim Frontend
```

Semua model dibuat dari primitive geometry dan tekstur canvas, tanpa file GLTF atau gambar eksternal. GKU 2 dimodelkan dari citra satelit dan Street View: denah U (blok depan melintang, sayap barat memanjang ke belakang, sayap timur lebih pendek, celah di antara kedua sayap yang terbuka ke utara, dan taman di halaman utara), lima lantai, dinding putih, kolom abu-abu gelap, koridor balkon dengan railing di setiap lantai, jendela berbingkai putih, unit AC, lisplang abu-abu dengan tepi coklat, dua atap metal, menara tangga di atap, panel mural di ujung sayap barat, serta pintu masuk di sisi depan dan barat. Gedung berdiri di atas pelataran paving beton putih krem. Tanah di luar pelataran berwarna navy gelap dengan grid samar agar menyatu dengan UI; rumput hanya dipakai pada taman di celah U.

Dimensi massa gedung (`wings`), keliling fasad (`outline`), posisi pintu masuk dan mural, jumlah lantai, tinggi lantai, atap metal, dan batas pelataran diatur di `siteLayout.gku2` pada `src/config/mapConfig.ts`. Detail fasad (jendela, kolom, pelat koridor, railing) dirender sebagai instanced mesh agar tetap ringan.

> Catatan tata letak: posisi area mengikuti gambar anotasi pengguna sebagai acuan visual. Koordinat dipusatkan di `src/config/mapConfig.ts` agar dapat dikalibrasi kembali bila denah berskala tersedia.

Pada revisi ini bidang hijau kebiruan, oranye, photobooth ungu, dan sponsor kuning tidak memiliki model stand. Gedung E, Embung C, GSC, dan area hijau lama telah dihapus; konfigurasi stand tetap tersedia untuk tahap informasi berikutnya.

Panjangnya GKU 2 ditambah empat kotak grid ke belakang. Ujung area hijau dan oranye mengikuti ujung belakang bangunan. Pelataran krem membentang dari tepi luar area tosca sampai tepi luar area oranye dan dari tepi depan area sponsor/photobooth sampai di belakang stage, sehingga semua area stand berada di satu pelataran. Jalan besar di depan berupa dua jalur satu arah (lajur kiri: jalur dekat gedung ke timur, jalur luar ke barat) dengan panah arah dan median hijau berpohon di tengahnya. Kedua jalur berakhir di bundaran sudut depan-barat, tempat jalan samping melintas sepanjang sisi barat di luar area oranye. Jalan samping juga dua badan jalan bermedian dengan aturan lajur kiri, dan kendaraan di bundaran berputar searah jarum jam (ditandai panah putar). Jalan masuk menyambung dari jalur dekat gedung, melewati Sentra Gate yang melintang di mulutnya, lalu berlanjut di atas pelataran menuju gedung dengan garis tengah putus-putus. Jalan di sisi tosca, jalan di belakang stage, dan area parkir tidak ada. Seluruh bidang area menggunakan warna solid dengan opacity 100%.

## API komponen

```tsx
import { KExpoMap3D } from "./components/map";

<KExpoMap3D
  onZoneSelect={(zone) => console.log(zone?.id)}
  onStandSelect={(stand) => console.log(stand?.id)}
/>
```

Props publik:

- `onZoneSelect(zone | null)` dipanggil saat zona dipilih atau selection dibersihkan.
- `onStandSelect(stand | null)` dipanggil saat stand dipilih atau selection dibersihkan.
- `selectionAnnouncement` opsional untuk mengontrol teks status dari parent; tanpa prop ini komponen mengelola teksnya sendiri.
- `className` menambahkan class pada viewport scene.

## Integrasi ke Next.js

React Three Fiber membutuhkan browser/WebGL. Muat komponen tanpa SSR dari Client Component:

```tsx
"use client";

import dynamic from "next/dynamic";
import "./kexpo-map.css";

const KExpoMap3D = dynamic(
  () => import("./components/map/KExpoMap3D").then((module) => module.KExpoMap3D),
  { ssr: false },
);

export function ExpoMapSection() {
  return (
    <div style={{ width: "100%", height: "100dvh" }}>
      <KExpoMap3D
        onZoneSelect={(zone) => console.log("zone", zone)}
        onStandSelect={(stand) => console.log("stand", stand)}
      />
    </div>
  );
}
```

Salin aturan `.map-*`, `.reset-button`, `.selection-pill`, dan `.zone-panel*` dari `src/styles.css` ke stylesheet aplikasi utama. Label objek dibuat sebagai tekstur dalam scene. Pastikan parent komponen memiliki tinggi eksplisit.

## Mengganti layout sesuai denah final

1. Edit `zones` untuk memindahkan bidang zona atau mengubah polygon. Isi popup tiap zona ada di properti `info` (`category`, `description`, `schedule`, `highlights`); saat ini masih lorem ipsum.
2. Edit `stands` untuk posisi sarnafil; pasangan angka selalu `[x, z]`.
3. Edit `buildings` jika gedung tambahan diperlukan pada tahap berikutnya.
4. Edit `siteLayout` untuk posisi GKU 2, batas pelataran (`gku2.plaza`), jalan cabang (`roads`), jalan dua badan (`dualRoads`: lebar lajur, lebar median, sumbu, dan rentang tiap jalan), bundaran (`roundabout`), stage, dan gate. Arah panah lajur dihitung otomatis dari aturan lajur kiri. Bentuk photobooth dan sponsor berada di `zones`.

Satuan scene bersifat relatif. Sumbu `x` bergerak kiri–kanan, `y` adalah tinggi, dan `z` bergerak depan–belakang.
