# fhirlint web — Claude Code context

Browser-based FHIR validator. Go HTTP backend serving a single-page Monaco Editor frontend.

## Architecture

```
main.go          HTTP server: embeds static/, POST /api/validate → fhirlint.Validate()
static/
  index.html     App shell (Monaco via CDN, options panel, results panel)
  style.css      Dark theme, CSS variables, responsive layout
  app.js         Monaco setup, fetch /api/validate, inline markers, file upload
Dockerfile       golang:1.24 builder → eclipse-temurin:21-jre runtime
docker-compose.yml
```

## Key details

- Static files are embedded at compile time via `//go:embed static`
- `POST /api/validate` accepts JSON: `content`, `fhirVersion`, `profiles`, `igs`, `noTerminologyServer`
- Line/col positions are parsed from fhirlint location strings with `\(line (\d+), col (\d+)\)`
- Monaco is loaded from cdnjs CDN — no bundler, no build step for the frontend
- The HL7 validator JAR is downloaded by fhirlint on first use (~250 MB)

## Dependency

Uses `github.com/fhirlint/fhirlint` (public Go library). When a new fhirlint version is released:

```bash
go get github.com/fhirlint/fhirlint@latest
go mod tidy
```

## Commit messages

- One-liner only: `feat(#n): ...`, `fix(#n): ...`
- Follow Conventional Commits
- No `Co-Authored-By` lines
