# Sunucuya Kurulum (aaPanel)

Hedef: `https://pts.ernsaha.com.tr`

```
Internet ──► aaPanel Nginx (SSL)
                ├─ /      → frontend/dist (statik)
                └─ /api   → 127.0.0.1:8080
                                 │
                          Docker: pts-api ──► pts-db (postgres:17)
```

Postgres hic port yayinlamaz; yalnizca compose agi uzerinden erisilir.
API ise sadece `127.0.0.1:8080`'e baglanir. Internete acik tek kapi
Nginx'tir.

Veritabanina elle baglanmak icin:

```bash
docker compose exec db psql -U pts -d pts
```

## 1. Kodu sunucuya al

```bash
cd /www/wwwroot
git clone https://github.com/projet-ak/PKS.git pts
cd pts
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
/www/wwwroot/pts/frontend/dist
```

Site kokunu degistirmek yerine symlink de kullanabilirsin; aaPanel'in
olusturdugu kokteki `.well-known` dizini SSL yenilemesi icin gerekli oldugundan
o dizini silme:

```bash
cd /www/wwwroot/pts.ernsaha.com.tr
rm -f index.html 404.html 502.html
ln -s /www/wwwroot/pts/frontend/dist/index.html index.html
ln -s /www/wwwroot/pts/frontend/dist/assets assets
ln -s /www/wwwroot/pts/frontend/dist/vendor vendor
```

## 5. Nginx yapilandirmasi

aaPanel her site icin bir eklenti dizini include eder. Ana konfigurasyona
dokunmadan oraya kopyala; boylece panel dosyayi yeniden urettiginde ayarlar
kaybolmaz:

```bash
mkdir -p /www/server/panel/vhost/nginx/extension/pts.ernsaha.com.tr
cp /www/wwwroot/pts/deploy/nginx-pts.conf    /www/server/panel/vhost/nginx/extension/pts.ernsaha.com.tr/pts.conf
nginx -t && nginx -s reload
```

## 6. Dogrula

- `https://pts.ernsaha.com.tr/health` → `{"status":"ok"}`
- `https://pts.ernsaha.com.tr/personel` → personel ekle
- `https://pts.ernsaha.com.tr/kiosk` → tarayici kamera izni ister

Kamera yalnizca HTTPS uzerinden calisir; siteyi her zaman `https://` ile ac.

## Guncelleme

```bash
cd /www/wwwroot/pts
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
docker compose exec -T db pg_dump -U pts pts | gzip > pts-$(date +%F).sql.gz
```

## Port cakismasi

aaPanel bir PostgreSQL kurduysa 5432 zaten dolu olabilir. Bu yuzden compose
dosyasi db icin port yayinlamaz. API'nin portu da doluysa `.env` ile
degistirip Nginx'teki `proxy_pass` hedefini ayni degere cek.

aaPanel > Cron ile bu komutu gunluk zamanlayabilirsin.

Gecis fotograflari veritabaninda degil `pts-photos` biriminde durur; onlari
ayrica yedeklemek gerekir:

```bash
docker run --rm -v pts_pts-photos:/data -v "$PWD":/backup alpine   tar czf /backup/pts-photos-$(date +%F).tar.gz -C /data .
```
