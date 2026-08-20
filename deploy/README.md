# Sunucuya Kurulum (aaPanel)

Hedef: `https://pts.ernsaha.com.tr`

```
Internet ──► aaPanel Nginx (SSL)
                ├─ /      → frontend/dist (statik)
                └─ /api   → 127.0.0.1:8080
                                 │
                          Docker: pks-api ──► pks-db (postgres:17)
```

Postgres ve API portlari yalnizca `127.0.0.1`'e baglanir; internete
dogrudan acik degildir. Tek giris kapisi Nginx'tir.

## 1. Kodu sunucuya al

```bash
cd /www/wwwroot
git clone https://github.com/projet-ak/PKS.git pks
cd pks
cp .env.example .env
```

`.env` icindeki `POSTGRES_PASSWORD` degerini mutlaka degistir.

## 2. Backend + veritabanini baslat

```bash
docker compose up -d --build
```

Ilk derleme 3-5 dakika surer (4 cekirdekte). Migration'lar API acilirken
otomatik uygulanir.

Kontrol:

```bash
docker compose ps
curl -s localhost:8080/health
```

Beklenen cikti: `{"status":"ok"}`

## 3. Frontend'i derle

```bash
cd frontend
npm ci
npm run build
```

Cikti `frontend/dist/` altina duser.

## 4. aaPanel site kokunu ayarla

aaPanel > Web Sitesi > `pts.ernsaha.com.tr` > **Site dizini**:

```
/www/wwwroot/pks/frontend/dist
```

Ardindan **Konfigurasyon** sekmesinde, SSL server blogunun icine
[`nginx-pks.conf`](nginx-pks.conf) dosyasindaki bloklari ekle ve Nginx'i
yeniden yukle.

## 5. Dogrula

- `https://pts.ernsaha.com.tr/health` → `{"status":"ok"}`
- `https://pts.ernsaha.com.tr/personel` → personel ekle
- `https://pts.ernsaha.com.tr/kiosk` → tarayici kamera izni ister

Kamera yalnizca HTTPS uzerinden calisir; siteyi her zaman `https://` ile ac.

## Guncelleme

```bash
cd /www/wwwroot/pks
git pull
docker compose up -d --build          # backend degistiyse
cd frontend && npm ci && npm run build # frontend degistiyse
```

## Loglar

```bash
docker compose logs -f api
```

## Veritabani yedegi

```bash
docker compose exec -T db pg_dump -U pks pks | gzip > pks-$(date +%F).sql.gz
```

aaPanel > Cron ile bu komutu gunluk zamanlayabilirsin.
