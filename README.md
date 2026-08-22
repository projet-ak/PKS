# PTS — Personel Takip Sistemi

ArUco kartlarıyla personel giriş-çıkış takibi. Kamera personelin kartındaki
ArUco markerini okur, marker ID veritabanındaki personel kaydıyla eşleşir ve
mesai hareketi otomatik olarak açılır/kapanır.

## Mimari

```
frontend/  React + Vite (TypeScript)
           ├─ Kiosk    : webcam + js-aruco2 ile marker okuma
           ├─ Personel : personel kartı ve ArUco tanımlama
           └─ Puantaj  : günlük giriş/çıkış ve çalışılan süre
                │  HTTP (/api, dev'de Vite proxy)
                ▼
backend/   Rust + Axum + SQLx
                │
                ▼
           PostgreSQL 17
```

ArUco tespiti **tarayıcıda** yapılır (`js-aruco2`), yani kiosk cihazında
OpenCV veya native bağımlılık kurmaya gerek yoktur. Sunucu yalnızca marker
ID'sini alır.

## Veri modeli

| Tablo | Amaç |
|---|---|
| `departments` | Departmanlar |
| `employees` | Personel künyesi, işe giriş, izin hakkı |
| `aruco_cards` | Marker ID ↔ personel eşleşmesi (kart iptali destekli) |
| `checkpoints` | Kart okutulan fiziksel geçiş noktaları |
| `attendance_events` | Giriş/çıkış hareketleri |
| `shifts`, `shift_assignments` | Vardiya tanımı ve günlük atama |
| `leave_requests` | İzin talebi ve onay akışı |
| `users` | Panel kullanıcıları ve rolleri |
| `companies` | ERN Holding / ERN Taahhüt ile gelir, panelden yenisi eklenebilir; personel ve geçiş noktası bu firmalara bağlanır |

Bir personelin aynı anda yalnızca **tek aktif** ArUco kartı olabilir; aynı
marker ID de aynı anda yalnızca tek personele tanımlanabilir. Bunlar kısmi
unique index ile veritabanı seviyesinde garanti altındadır.

## API

| Metot | Yol | Açıklama |
|---|---|---|
| `GET` | `/health` | Sağlık kontrolü |
| `POST` | `/api/auth/login` | Kullanıcı girişi, JWT döner |
| `GET` | `/api/auth/me` | Oturumun hâlâ geçerli olduğunu doğrular |
| `GET` | `/api/companies` | Firma listesi |
| `POST` | `/api/companies` | Firma ekle (yönetici) |
| `DELETE` | `/api/companies/{id}` | Firmayı pasife çek (yönetici) |
| `GET` | `/api/checkpoints` | Geçiş noktaları (yönetici) |
| `POST` | `/api/checkpoints` | Geçiş noktası oluştur, cihaz anahtarı üretir (yönetici) |
| `POST` | `/api/checkpoints/whoami` | Cihaz anahtarını doğrular (kiosk kurulumu, oturum istemez) |
| `GET` | `/api/employees` | Aktif personel listesi |
| `POST` | `/api/employees` | Personel ekle |
| `GET` | `/api/employees/{id}` | Personel detayı |
| `PUT` | `/api/employees/{id}` | Personel bilgilerini güncelle |
| `DELETE` | `/api/employees/{id}` | Personeli pasife çek |
| `POST` | `/api/cards/employee/{id}` | ArUco kart tanımla (öncekini iptal eder) |
| `POST` | `/api/cards/employee/{id}/auto` | Kartı sicil numarasından türetip tanımla |
| `DELETE` | `/api/cards/employee/{id}` | Aktif kartı iptal et |
| `POST` | `/api/attendance/scan` | Kiosk marker bildirimi |
| `GET` | `/api/attendance/events` | Ham hareket listesi |
| `GET` | `/api/attendance/daily?from&to&company_id&employee_id` | Puantaj özeti |
| `GET` | `/api/attendance/photo/{id}` | Geçiş anındaki kamera görüntüsü |
| `GET` | `/api/dashboard` | Genel bakış sayıları ve son 7 gün |
| `GET` | `/api/reports/timesheet.xlsx?from&to&company_id&lang` | Excel puantaj raporu (tr/en) |
| `GET` | `/api/users` | Kullanıcı listesi (yönetici) |
| `POST` | `/api/users` | Kullanıcı ekle (yönetici) |
| `PUT` | `/api/users/{id}` | Rol, durum veya parola güncelle (yönetici) |
| `DELETE` | `/api/users/{id}` | Kullanıcıyı pasife çek (yönetici) |

`scan` isteğinde `direction` verilirse (`in` / `out`) yön zorlanır; giriş ve
çıkış için ayrı kamera kurulduğunda her cihaz kendi yönünü bildirir. Alan boş
bırakılırsa yön kendiliğinden belirlenir: personelin son hareketi `in` ise bu
okuma `out`, değilse `in` olur. Aynı kart `PTS_SCAN_DEBOUNCE_SECONDS` içinde tekrar
okunursa yeni kayıt açılmaz (`duplicate_ignored: true` döner).

## Kurulum

Gereksinimler: **Rust 1.80+**, **Node 20+**, **PostgreSQL 17** (veya Docker).

```bash
cp .env.example .env
```

Veritabanını başlat:

```bash
docker compose up -d db
```

Backend (migration'lar açılışta otomatik uygulanır):

```bash
cd backend && cargo run
```

Frontend:

```bash
cd frontend && npm install && npm run dev
```

Panel: http://localhost:5173 — Kiosk sayfası kamera izni ister. Kiosk
sayfasındaki kamera ve yön seçimi tarayıcıda saklanır, yani giriş ve çıkış
cihazları aynı adresi açıp farklı ayarla çalışır. Tarayıcılar
webcam'e yalnızca `localhost` veya HTTPS üzerinden izin verir; kiosk cihazını
ağdan açacaksan sertifika gerekir.

## Yetkilendirme

Panelin tamamı oturum ister. `/api/auth/login` bir JWT döner, istemci bunu
`Authorization: Bearer ...` başlığında taşır. Parolalar Argon2id ile saklanır.

Roller: `admin` her şeyi yapar (kullanıcı, firma, geçiş noktası dahil), `hr` ve
`manager` veri girer, `viewer` **yalnızca okur** — veri değiştiren her uç bu
rolde 403 döner. İlk yönetici hesabı `PTS_ADMIN_USERNAME` / `PTS_ADMIN_PASSWORD` ile
**sadece hiç kullanıcı yokken** oluşturulur.

Kiosk cihazları oturum açmaz. Her cihaz bir geçiş noktasına bağlanır ve
isteklerinde `X-Checkpoint-Key` başlığını gönderir; anahtar sunucuda üretilir,
panelin **Geçiş Noktaları** sayfasından kopyalanıp cihaza bir kez girilir.
Anahtar kaydedilmeden önce sunucuya doğrulatılır; yanlış yapıştırılan bir
anahtarın ilk kart okutulana kadar fark edilmemesi kötü olurdu. Panelde
yönetici olarak açıldığında anahtarı kopyalamaya bile gerek yoktur, noktalar
liste hâlinde gelir.
Böylece hangi geçişin hangi kapıda olduğu da kayda düşer.

## Geçiş fotoğrafları

Kiosk her okumada o anki kamera karesini JPEG olarak gönderir. Görüntüler
**veritabanında tutulmaz**; `PTS_PHOTO_DIR` altında gün bazlı klasörlenip
diske yazılır, tabloda yalnızca göreli yol durur. Böylece veritabanı yedeği
küçük kalır. Fotoğraf yazılamazsa geçiş yine kaydedilir — kanıt görüntüsü
kaydın tamamlayıcısıdır, ön koşulu değil.

Puantajdaki **Aktivite** penceresi her hareketi fotoğrafıyla birlikte gösterir.

## Dil desteği

Panel Türkçe ve İngilizce çalışır; sağ üstteki **TR / EN** düğmeleri dili
değiştirir ve seçim tarayıcıda saklanır. Tarih ve saat biçimleri de dile göre
değişir. Excel raporu `lang` parametresiyle aynı dilde üretilir — yabancı bir
muhataba Türkçe başlıklı tablo göndermek zorunda kalınmaz.

Metinler tek sözlükte (`frontend/src/i18n.tsx`) durur; eksik bir anahtar
ekranda anahtar adı olarak görünür, böylece unutulan çeviri fark edilir.

## Arayüz

ERN tasarım dili kullanılır: marka yeşili `#00584E`, koyu yeşil gradyanlı
sidebar, açık zemin, Outfit tipografisi — Beton Takip Sistemi ile aynı görsel
sistem, iki uygulama yan yana tutarlı durur. Logolar `frontend/src/assets/` altındadır ve Vite tarafından paketlenir;
böylece sunucuda ayrı bir dosya yolu ayarı gerekmez.

## Sunucuya kurulum

Canlı ortam `https://pts.ernsaha.com.tr` üzerinde aaPanel arkasında çalışır.
Adım adım kurulum: [deploy/README.md](deploy/README.md).

## ArUco kartları

Sözlük: **ARUCO_MIP_36h12** (backend varsayılanı ve kiosk sayfası aynı olmalı).
Kartları panelin **Kart Üret** sayfasından üretebilirsin: ID (ve istersen
personel adını) gir, **Yazdır**'a bas. Marker çizimini `js-aruco2`'nin kendi
`generateSVG` fonksiyonu ürettiği için kiosk okumasıyla birebir uyumludur ve
sunucuya OpenCV kurmak gerekmez.

ArUco ID'yi elle vermek yerine **Sicilden** düğmesiyle sicil numarasından
türetebilirsin: sicildeki rakamlar okunur, baştaki sıfırlar atılır (`00042` →
`42`). Kural sunucuda tek yerde durur, panel ile kart sayfası ayrışamaz.

Sözlükte 250 kod bulunduğu için geçerli aralık **0–249**. Sicil numaraların
bunu aşıyorsa 1000 markerlı bir sözlüğe (`ARUCO_4X4_1000` gibi) geçmek
gerekir; bu durumda backend'deki `MAX_MARKER_ID` ve kiosk/kart sayfasındaki
`DICTIONARY` sabitleri birlikte değişmeli.

## Durum

- [x] Şema, migration'lar, ArUco eşleştirme, giriş-çıkış ve günlük puantaj
- [ ] Kimlik doğrulama (`users` tablosu var, JWT akışı henüz yok)
- [ ] İzin ve vardiya ekranları (şema hazır, API/UI yazılacak)
- [ ] Aylık puantaj raporu ve Excel dışa aktarım
