# ── Stage 1: build the Go binary ────────────────────────────────────────────
FROM golang:1.24-bookworm AS builder

ENV GOTOOLCHAIN=auto

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /fhirlint-web .

# ── Stage 2: runtime (Go binary + Java for the validator JAR) ────────────────
FROM eclipse-temurin:21-jre-jammy

# Non-root user
RUN groupadd -r app && useradd -r -g app app

# fhirlint caches the JAR in $HOME/.fhirlint; give the app user a writable home
ENV HOME=/home/app
RUN mkdir -p /home/app && chown app:app /home/app

COPY --from=builder /fhirlint-web /usr/local/bin/fhirlint-web

USER app
EXPOSE 8080

ENTRYPOINT ["fhirlint-web"]
