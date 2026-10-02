document.addEventListener("DOMContentLoaded", () => {
  /* --- VIEW ROUTING (Connect your backend login logic here) --- */
  const loginScreen = document.getElementById('login-screen');
  const dashboardScreen = document.getElementById('dashboard-screen');
  const loginForm = document.getElementById('login-form');
  const logoutBtn = document.getElementById('logout-btn');
  const loginBtn = document.getElementById('login-btn');

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Simulate a successful login transition
    loginBtn.textContent = "Verifying...";
    
    setTimeout(() => {
      loginScreen.classList.add('hidden');
      dashboardScreen.classList.remove('hidden');
      dashboardScreen.classList.add('fade-in');
    }, 800);
  });

  logoutBtn.addEventListener('click', () => {
    // Return to login screen
    dashboardScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    loginBtn.textContent = "Authenticate";
    // Clear inputs
    document.getElementById('email').value = "";
    document.getElementById('password').value = "";
  });

  /* --- DRAG & DROP FILE HANDLING --- */
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const fileInfo = document.getElementById('file-info');
  const scanOverlay = document.getElementById('scan-overlay');
  
  const resultsEmpty = document.getElementById('results-empty');
  const resultsData = document.getElementById('results-data');
  const resetBtn = document.getElementById('reset-btn');

  // Click to browse
  dropZone.addEventListener('click', () => fileInput.click());

  // Drag hover effects
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });
  
  // Drop execution
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      handleFile(e.dataTransfer.files[0]);
    }
  });
  
  // File input execution
  fileInput.addEventListener('change', function() {
    if (this.files.length) {
      handleFile(this.files[0]);
    }
  });

  function handleFile(file) {
    // Display filename and size
    fileInfo.textContent = `Attached: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    
    // Trigger NLM Scanning UI
    scanOverlay.classList.add('active');
    resultsEmpty.textContent = "Extracting details and running NLM fraud detection...";
    resultsEmpty.style.display = "flex";
    resultsData.classList.remove('active');

    /* 
     * NOTE: CONNECT BACKEND EXTRACTION HERE.
     * Replace the setTimeout below with your fetch() call passing formData 
     * to your Python/Node backend. Then populate the UI with the response.
     */
    
    setTimeout(() => {
      // Stop scanning animation
      scanOverlay.classList.remove('active');
      
      // Hide empty state, Show results
      resultsEmpty.style.display = "none";
      resultsData.classList.add('active');

      // MOCK BACKEND RESPONSE DATA:
      // Simulate checking logic - dynamically change these based on backend response
      const mockIsFake = Math.random() > 0.7; // 30% chance to simulate a fake document
      const scoreRing = document.getElementById('score-ring');
      const scoreText = document.getElementById('score-text');
      const scoreLabelText = document.getElementById('score-label-text');
      const resNotes = document.getElementById('res-notes');
      const resFormatStatus = document.getElementById('res-format-status');

      if (mockIsFake) {
        scoreRing.classList.add('danger');
        scoreText.textContent = "12%";
        scoreLabelText.textContent = "High Risk";
        resFormatStatus.textContent = "Failed";
        resFormatStatus.style.color = "var(--danger)";
        resNotes.textContent = "NLM detects severe structural anomalies. Text alignment on DOB field indicates digital tampering. Verhoeff checksum validation failed.";
        resNotes.style.color = "var(--danger)";
      } else {
        scoreRing.classList.remove('danger');
        scoreText.textContent = "98%";
        scoreLabelText.textContent = "Authentic";
        resFormatStatus.textContent = "Verified";
        resFormatStatus.style.color = "var(--success)";
        resNotes.textContent = "Natural Language Model confirms textual alignments match standard issued templates. No synthetic text overlays detected.";
        resNotes.style.color = "#ccc";
      }

    }, 2500); // 2.5 second simulated processing time
  }

  // Reset Workspace Button
  resetBtn.addEventListener('click', () => {
    fileInput.value = "";
    fileInfo.textContent = "";
    resultsData.classList.remove('active');
    resultsEmpty.style.display = "flex";
    resultsEmpty.textContent = "Awaiting document upload for processing...";
  });
});