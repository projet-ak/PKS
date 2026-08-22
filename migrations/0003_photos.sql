-- Gecis anindaki kamera goruntusu.
--
-- Goruntunun kendisi veritabaninda tutulmaz; dosya sisteminde saklanir ve
-- burada yalnizca goreli yolu durur. Binlerce JPEG'i tabloya koymak yedek
-- boyutunu ve sorgu maliyetini gereksiz sisirirdi.
ALTER TABLE attendance_events
    ADD COLUMN photo_path TEXT;
