document.addEventListener("DOMContentLoaded", () => {
  // Where the FastAPI backend runs. Change this if the backend is on another machine/URL.
  const API_BASE = "http://127.0.0.1:8000";

  /* --- VIEW ROUTING (prototype login: any email/password is accepted) --- */
  const loginScreen = document.getElementById('login-screen');
  const dashboardScreen = document.getElementById('dashboard-screen');
  const loginForm = document.getElementById('login-form');
  const logoutBtn = document.getElementById('logout-btn');
  const loginBtn = document.getElementById('login-btn');

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loginBtn.textContent = "Verifying...";
    setTimeout(() => {
      loginScreen.classList.add('hidden');
      dashboardScreen.classList.remove('hidden');
      dashboardScreen.classList.add('fade-in');
    }, 800);
  });

  logoutBtn.addEventListener('click', () => {
    dashboardScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    loginBtn.textContent = "Authenticate";
    document.getElementById('email').value = "";
    document.getElementById('password').value = "";
  });

  /* --- ELEMENTS --- */
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const fileInfo = document.getElementById('file-info');
  const liveInput = document.getElementById('live-input');
  const liveInfo = document.getElementById('live-info');
  const scanBtn = document.getElementById('scan-btn');
  const scanOverlay = document.getElementById('scan-overlay');

  const resultsEmpty = document.getElementById('results-empty');
  const resultsData = document.getElementById('results-data');
  const resetBtn = document.getElementById('reset-btn');

  const scoreRing = document.getElementById('score-ring');
  const scoreText = document.getElementById('score-text');
  const scoreLabelText = document.getElementById('score-label-text');
  const resStatus = document.getElementById('res-status');
  const resFace = document.getElementById('res-face');
  const resFormat = document.getElementById('res-format-status');
  const resNotes = document.getElementById('res-notes');
  const resFlags = document.getElementById('res-flags');

  let docFile = null;
  let liveFile = null;
  let busy = false;

  const ALLOWED = ["image/jpeg", "image/png"];
  const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

  function updateButton() { scanBtn.disabled = !(docFile && liveFile) || busy; }

  function validate(file) {
    if (!ALLOWED.includes(file.type)) return "Only JPEG or PNG images are supported.";
    if (file.size > MAX_BYTES) return "File is too large (max 10 MB).";
    return null;
  }

  /* --- DOCUMENT FILE (drag & drop or click) --- */
  function setDoc(file) {
    const err = validate(file);
    if (err) { docFile = null; fileInfo.textContent = err; updateButton(); return; }
    docFile = file;
    fileInfo.textContent = `Attached: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    updateButton();
  }

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) setDoc(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', function () { if (this.files.length) setDoc(this.files[0]); });

  /* --- LIVE PHOTO --- */
  liveInput.addEventListener('change', function () {
    if (!this.files.length) return;
    const file = this.files[0];
    const err = validate(file);
    if (err) { liveFile = null; liveInfo.textContent = err; updateButton(); return; }
    liveFile = file;
    liveInfo.textContent = `Attached: ${file.name}`;
    updateButton();
  });

  /* --- RUN SCREENING (calls the FastAPI backend) --- */
  scanBtn.addEventListener('click', async () => {
    if (!(docFile && liveFile) || busy) return;
    busy = true; updateButton();

    scanOverlay.classList.add('active');
    resultsEmpty.textContent = "Running OCR, face match and document screening... (the first scan can take up to a minute)";
    resultsEmpty.style.display = "flex";
    resultsData.classList.remove('active');

    try {
      const formData = new FormData();
      formData.append("document", docFile);
      formData.append("live_photo", liveFile);

      const res = await fetch(`${API_BASE}/api/scan`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      showResult(data);
    } catch (err) {
      resultsEmpty.textContent = "Could not complete the scan: " + err.message +
        ". Check that the backend is running at " + API_BASE + ".";
    } finally {
      scanOverlay.classList.remove('active');
      busy = false; updateButton();
    }
  });

  function showResult(data) {
    const risk = Number(data.doc_risk_score);
    const suspicious = data.doc_label === "SUSPICIOUS";
    const flags = Array.isArray(data.doc_flags) ? data.doc_flags : [];

    resultsEmpty.style.display = "none";
    resultsData.classList.add('active');

    // Risk ring: shows RISK (0 = low, 100 = high), not "authenticity".
    scoreText.textContent = Number.isFinite(risk) ? String(risk) : "--";
    scoreLabelText.textContent = suspicious ? "High risk" : "Low risk";
    scoreRing.classList.toggle('danger', suspicious);

    // Decision
    const status = String(data.status || "");
    resStatus.textContent = status;
    resStatus.style.color = status.startsWith("PASS") ? "var(--success)"
                          : status.startsWith("REVIEW") ? "var(--gold)" : "var(--danger)";

    // Face match
    const matched = data.face_match_verified === true;
    resFace.textContent = matched ? "Match" : "No match";
    resFace.style.color = matched ? "var(--success)" : "var(--danger)";

    // Text checks + reasons
    resFormat.textContent = suspicious ? "Needs review" : "No issues found";
    resFormat.style.color = suspicious ? "var(--gold)" : "var(--success)";
    resNotes.textContent = flags.length
      ? "The document text raised the following concerns:"
      : "No inconsistencies found in the document text. This does not prove the card is genuine.";
    resNotes.style.color = flags.length ? "var(--danger)" : "#ccc";

    resFlags.replaceChildren();                       // textContent only: never insert server text as HTML
    flags.forEach((f) => {
      const li = document.createElement('li');
      li.textContent = f;
      resFlags.appendChild(li);
    });
  }

  /* --- RESET --- */
  resetBtn.addEventListener('click', () => {
    fileInput.value = ""; liveInput.value = "";
    docFile = null; liveFile = null;
    fileInfo.textContent = ""; liveInfo.textContent = "";
    resFlags.replaceChildren();
    resultsData.classList.remove('active');
    resultsEmpty.style.display = "flex";
    resultsEmpty.textContent = "Awaiting document and live photo...";
    updateButton();
  });
});
