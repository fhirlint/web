# fhirlint web

Browser-based FHIR validator powered by [fhirlint](https://github.com/fhirlint/fhirlint) and the [HL7 FHIR Validator](https://confluence.hl7.org/display/FHIR/Using+the+FHIR+Validator).

## Features

- Monaco Editor (VS Code in the browser) with JSON and XML syntax highlighting
- Inline error markers — click an issue to jump to the offending line
- FHIR R4 / R4B / R5 support
- Custom profiles and implementation guides (IG packages)
- Optional: disable terminology server for offline use
- File upload (`.json` / `.xml`)

## Quick start

See [DEPLOYMENT.md](DEPLOYMENT.md) for Docker and nginx setup.

```bash
# Build and run locally (requires Go 1.24+ and Java 17+)
go build -o fhirlint-web .
PORT=8080 ./fhirlint-web
# → http://localhost:8080
```

The HL7 validator JAR (~250 MB) is downloaded automatically on first use and cached in `~/.fhirlint/`.

## Architecture

```
main.go          Go HTTP server — embeds static/ and exposes POST /api/validate
static/
  index.html     Single-page app shell
  style.css      Dark theme layout
  app.js         Monaco Editor setup, API calls, inline markers
Dockerfile       Multi-stage build: golang:1.24 builder + eclipse-temurin:21 runtime
```

The backend calls `fhirlint.Validate()` from [`pkg/fhirlint`](https://github.com/fhirlint/fhirlint/tree/main/pkg/fhirlint) and returns a JSON response with issues, severity, line/col positions, and a validity summary.

## API

`POST /api/validate`

```json
{
  "content": "<FHIR JSON or XML>",
  "fhirVersion": "4.0.1",
  "profiles": [],
  "igs": ["de.basisprofil.r4#1.5.0"],
  "noTerminologyServer": false
}
```

Response:

```json
{
  "valid": true,
  "issues": [
    {
      "severity": "warning",
      "message": "...",
      "location": "Patient (line 3, col 12)",
      "messageId": "dom-6",
      "line": 3,
      "col": 12
    }
  ],
  "summary": { "errors": 0, "warnings": 1, "information": 0 }
}
```

## License

MIT
