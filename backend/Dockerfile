# Multi-stage: sunucuya Rust kurmadan derlenmis tek binary uretir.
# Build context repo kokudur, cunku sqlx::migrate! ../migrations dizinini gomer.

FROM rust:1-slim-bookworm AS builder

WORKDIR /app

# Once yalnizca manifest'i kopyalayip bagimliliklari derliyoruz; kaynak kod
# degistiginde bu katman cache'ten gelir ve yeniden derleme kisalir.
COPY backend/Cargo.toml backend/Cargo.lock* backend/
RUN mkdir -p backend/src \
    && echo 'fn main() {}' > backend/src/main.rs \
    && cargo build --release --manifest-path backend/Cargo.toml \
    && rm -rf backend/src

COPY migrations/ migrations/
COPY backend/src/ backend/src/

# Sahte main.rs ile uretilen binary'yi gecersiz kilip gercek kaynaktan derle.
RUN touch backend/src/main.rs \
    && cargo build --release --manifest-path backend/Cargo.toml

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Root olarak calistirmayalim.
RUN useradd --system --create-home --uid 10001 pks
USER pks

COPY --from=builder /app/backend/target/release/pks-backend /usr/local/bin/pks-backend

EXPOSE 8080
CMD ["pks-backend"]
