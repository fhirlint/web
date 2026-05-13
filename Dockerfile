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

COPY --from=builder /fhirlint-web /usr/local/bin/fhirlint-web

EXPOSE 8080

ENTRYPOINT ["fhirlint-web"]
