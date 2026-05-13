'use strict';

// Monaco loader config
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.47.0/min/vs' } });

require(['vs/editor/editor.main'], function () {
  // ── Editor setup ──────────────────────────────────────────────────────────
  const editor = monaco.editor.create(document.getElementById('editor'), {
    value: JSON.stringify({ resourceType: 'Patient', id: 'example' }, null, 2),
    language: 'json',
    theme: 'vs-dark',
    minimap: { enabled: false },
    fontSize: 13,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    automaticLayout: true,
  });

  // ── Format selector ───────────────────────────────────────────────────────
  const formatSelect = document.getElementById('formatSelect');
  formatSelect.addEventListener('change', () => {
    const lang = formatSelect.value === 'xml' ? 'xml' : 'json';
    monaco.editor.setModelLanguage(editor.getModel(), lang);
    if (formatSelect.value === 'xml' && editor.getValue().trim().startsWith('{')) {
      editor.setValue('<?xml version="1.0" encoding="UTF-8"?>\n<Patient xmlns="http://hl7.org/fhir">\n  <id value="example"/>\n</Patient>');
    } else if (formatSelect.value === 'json' && editor.getValue().trim().startsWith('<')) {
      editor.setValue(JSON.stringify({ resourceType: 'Patient', id: 'example' }, null, 2));
    }
  });

  // ── File upload ───────────────────────────────────────────────────────────
  document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target.result;
      editor.setValue(content);
      const isXML = content.trimStart().startsWith('<');
      formatSelect.value = isXML ? 'xml' : 'json';
      monaco.editor.setModelLanguage(editor.getModel(), isXML ? 'xml' : 'json');
    };
    reader.readAsText(file);
    // reset so the same file can be re-uploaded
    e.target.value = '';
  });

  // ── Validate ──────────────────────────────────────────────────────────────
  const validateBtn = document.getElementById('validateBtn');
  validateBtn.addEventListener('click', runValidation);

  // Ctrl+Enter / Cmd+Enter shortcut
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, runValidation);

  async function runValidation() {
    const content = editor.getValue().trim();
    if (!content) return;

    setLoading(true);
    clearMarkers();

    const profiles = parseLines(document.getElementById('profilesInput').value);
    const igs      = parseLines(document.getElementById('igsInput').value);

    const body = {
      content,
      fhirVersion:         document.getElementById('fhirVersion').value,
      profiles,
      igs,
      noTerminologyServer: document.getElementById('noTerminology').checked,
    };

    let data;
    try {
      const resp = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      data = await resp.json();
      if (!resp.ok) {
        showError(data.error || 'Validation failed');
        return;
      }
    } catch (err) {
      showError('Network error: ' + err.message);
      return;
    } finally {
      setLoading(false);
    }

    renderResults(data);
    addMarkers(data.issues);
  }

  // ── Results rendering ─────────────────────────────────────────────────────
  function renderResults(data) {
    const pane   = document.getElementById('resultsPane');
    const badges = document.getElementById('summaryBadges');

    badges.classList.remove('hidden');
    badges.innerHTML = '';

    if (data.valid && data.issues.length === 0) {
      badges.innerHTML = '<span class="badge badge-valid">✓ Valid</span>';
      pane.innerHTML   = '<div class="valid-banner">✓ Resource is valid</div>';
      return;
    }

    if (data.summary.errors > 0) {
      badges.innerHTML += `<span class="badge badge-error">✗ ${data.summary.errors} error${data.summary.errors !== 1 ? 's' : ''}</span>`;
    }
    if (data.summary.warnings > 0) {
      badges.innerHTML += `<span class="badge badge-warning">⚠ ${data.summary.warnings} warning${data.summary.warnings !== 1 ? 's' : ''}</span>`;
    }
    if (data.summary.information > 0) {
      badges.innerHTML += `<span class="badge badge-info">ℹ ${data.summary.information} info</span>`;
    }
    if (data.valid) {
      badges.innerHTML += '<span class="badge badge-valid">✓ Valid</span>';
    }

    pane.innerHTML = '';
    for (const issue of data.issues) {
      const card = issueCard(issue);
      pane.appendChild(card);
    }
  }

  function issueCard(issue) {
    const card = document.createElement('div');
    card.className = `issue-card severity-${issue.severity}`;

    const icon = severityIcon(issue.severity);
    const meta = [
      issue.location ? `<span class="issue-location">${escHtml(issue.location)}</span>` : '',
      issue.messageId ? `<span class="issue-id">${escHtml(issue.messageId)}</span>` : '',
    ].filter(Boolean).join('');

    card.innerHTML = `
      <div class="issue-icon">${icon}</div>
      <div class="issue-body">
        <div class="issue-message">${escHtml(issue.message)}</div>
        ${meta ? `<div class="issue-meta">${meta}</div>` : ''}
      </div>`;

    // Click → jump to line in editor
    if (issue.line && issue.line > 0) {
      card.title = `Go to line ${issue.line}`;
      card.addEventListener('click', () => {
        editor.revealLineInCenter(issue.line);
        editor.setPosition({ lineNumber: issue.line, column: issue.col || 1 });
        editor.focus();
      });
    }

    return card;
  }

  function severityIcon(s) {
    switch (s) {
      case 'error':
      case 'fatal':       return '✗';
      case 'warning':     return '⚠';
      case 'information': return 'ℹ';
      default:            return '·';
    }
  }

  // ── Monaco inline markers ─────────────────────────────────────────────────
  function addMarkers(issues) {
    const model = editor.getModel();
    if (!model) return;

    const markers = issues
      .filter(i => i.line > 0)
      .map(i => ({
        severity: monacoSeverity(i.severity),
        message:  i.message + (i.messageId ? ` [${i.messageId}]` : ''),
        startLineNumber: i.line,
        endLineNumber:   i.line,
        startColumn: i.col || 1,
        endColumn:   model.getLineMaxColumn(i.line),
      }));

    monaco.editor.setModelMarkers(model, 'fhirlint', markers);
  }

  function clearMarkers() {
    const model = editor.getModel();
    if (model) monaco.editor.setModelMarkers(model, 'fhirlint', []);
  }

  function monacoSeverity(s) {
    switch (s) {
      case 'error':
      case 'fatal':       return monaco.MarkerSeverity.Error;
      case 'warning':     return monaco.MarkerSeverity.Warning;
      case 'information': return monaco.MarkerSeverity.Info;
      default:            return monaco.MarkerSeverity.Hint;
    }
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  function setLoading(on) {
    validateBtn.disabled = on;
    if (on) {
      document.getElementById('resultsPane').innerHTML = `
        <div class="loading"><div class="spinner"></div>Validating…</div>`;
      document.getElementById('summaryBadges').classList.add('hidden');
    }
  }

  function showError(msg) {
    document.getElementById('resultsPane').innerHTML =
      `<div class="issue-card severity-error">
         <div class="issue-icon">✗</div>
         <div class="issue-body"><div class="issue-message">${escHtml(msg)}</div></div>
       </div>`;
  }

  function parseLines(raw) {
    return raw.split('\n').map(s => s.trim()).filter(Boolean);
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
});
