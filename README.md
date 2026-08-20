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

Bir personelin aynı anda yalnızca **tek aktif** ArUco kartı olabilir; aynı
marker ID de aynı anda yalnızca tek personele tanımlanabilir. Bunlar kısmi
unique index ile veritabanı seviyesinde garanti altındadır.

## API

| Metot | Yol | Açıklama |
|---|---|---|
| `GET` | `/health` | Sağlık kontrolü |
| `GET` | `/api/employees/` | Aktif personel listesi |
| `POST` | `/api/employees/` | Personel ekle |
| `GET` | `/api/employees/{id}` | Personel detayı |
| `DELETE` | `/api/employees/{id}` | Personeli pasife çek |
| `POST` | `/api/cards/employee/{id}` | ArUco kart tanımla (öncekini iptal eder) |
| `DELETE` | `/api/cards/employee/{id}` | Aktif kartı iptal et |
| `POST` | `/api/attendance/scan` | Kiosk marker bildirimi |
| `GET` | `/api/attendance/events` | Ham hareket listesi |
| `GET` | `/api/attendance/daily?date=` | Günlük puantaj |

`scan` yönü kendi belirler: personelin son hareketi `in` ise bu okuma `out`,
değilse `in` olur. Aynı kart `PKS_SCAN_DEBOUNCE_SECONDS` içinde tekrar
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

Panel: http://localhost:5173 — Kiosk sayfası kamera izni ister. Tarayıcılar
webcam'e yalnızca `localhost` veya HTTPS üzerinden izin verir; kiosk cihazını
ağdan açacaksan sertifika gerekir.

## ArUco kartları

Sözlük: **ARUCO_MIP_36h12** (backend varsayılanı ve kiosk sayfası aynı olmalı).
Marker görsellerini üretmek için OpenCV yeterlidir:

```python
import cv2
d = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_ARUCO_MIP_36h12)
cv2.imwrite("kart_7.png", cv2.aruco.generateImageMarker(d, 7, 600))
```

Üretilen ID'yi panelde ilgili personele **Tanımla** ile bağla.

## Durum

- [x] Şema, migration'lar, ArUco eşleştirme, giriş-çıkış ve günlük puantaj
- [ ] Kimlik doğrulama (`users` tablosu var, JWT akışı henüz yok)
- [ ] İzin ve vardiya ekranları (şema hazır, API/UI yazılacak)
- [ ] Aylık puantaj raporu ve Excel dışa aktarım
