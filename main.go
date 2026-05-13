package main

import (
	"embed"
	"encoding/json"
	"io/fs"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"github.com/fhirlint/fhirlint/pkg/fhirlint"
)

//go:embed static
var staticFiles embed.FS

var locationRe = regexp.MustCompile(`\(line (\d+), col (\d+)\)`)

type validateRequest struct {
	Content             string   `json:"content"`
	FHIRVersion         string   `json:"fhirVersion"`
	Profiles            []string `json:"profiles"`
	IGs                 []string `json:"igs"`
	NoTerminologyServer bool     `json:"noTerminologyServer"`
}

type issue struct {
	Severity  string `json:"severity"`
	Message   string `json:"message"`
	Location  string `json:"location"`
	MessageID string `json:"messageId"`
	Line      int    `json:"line,omitempty"`
	Col       int    `json:"col,omitempty"`
}

type summary struct {
	Errors      int `json:"errors"`
	Warnings    int `json:"warnings"`
	Information int `json:"information"`
}

type validateResponse struct {
	Valid    bool    `json:"valid"`
	Issues   []issue `json:"issues"`
	Summary  summary `json:"summary"`
}

func main() {
	staticFS, err := fs.Sub(staticFiles, "static")
	if err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.FS(staticFS)))
	mux.HandleFunc("/api/validate", handleValidate)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("fhirlint web listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func handleValidate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req validateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}
	if req.Content == "" {
		jsonError(w, "content is required", http.StatusBadRequest)
		return
	}

	fhirVersion := req.FHIRVersion
	if fhirVersion == "" {
		fhirVersion = "4.0.1"
	}

	opts := fhirlint.Options{
		FHIRVersion:         fhirVersion,
		Profiles:            req.Profiles,
		IGs:                 req.IGs,
		NoTerminologyServer: req.NoTerminologyServer,
	}

	result, err := fhirlint.Validate([]byte(req.Content), opts)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	resp := validateResponse{
		Valid:   result.Valid,
		Issues:  make([]issue, 0, len(result.Issues)),
	}
	for _, iss := range result.Issues {
		i := issue{
			Severity:  iss.Severity,
			Message:   iss.Message,
			Location:  iss.Location,
			MessageID: iss.MessageID,
		}
		if m := locationRe.FindStringSubmatch(iss.Location); m != nil {
			i.Line, _ = strconv.Atoi(m[1])
			i.Col, _ = strconv.Atoi(m[2])
		}
		resp.Issues = append(resp.Issues, i)
		switch iss.Severity {
		case "error", "fatal":
			resp.Summary.Errors++
		case "warning":
			resp.Summary.Warnings++
		case "information":
			resp.Summary.Information++
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp) //nolint:errcheck
}

func jsonError(w http.ResponseWriter, msg string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg}) //nolint:errcheck
}
