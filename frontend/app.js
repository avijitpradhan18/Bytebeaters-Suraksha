document.addEventListener("DOMContentLoaded", () => {
  /* --- VIEW ROUTING & AUTHENTICATION --- */
  const loginScreen = document.getElementById('login-screen');
  const dashboardScreen = document.getElementById('dashboard-screen');
  const loginForm = document.getElementById('login-form');
  const logoutBtn = document.getElementById('logout-btn');
  const loginBtn = document.getElementById('login-btn');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    loginBtn.textContent = "Verifying...";
    loginBtn.disabled = true;

    try {
      // 1. UPDATE THIS URL to your backend login endpoint
      const response = await fetch('http://192.168.1.20:8000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email, password: password })
      });

      if (response.ok) {
        const data = await response.json();
        // Optional: Save auth token if your backend uses JWT
        // localStorage.setItem('token', data.token); 
        
        loginScreen.classList.add('hidden');
        dashboardScreen.classList.remove('hidden');
        dashboardScreen.classList.add('fade-in');
      } else {
        alert("Authentication failed. Please check your credentials.");
      }
    } catch (error) {
      console.error("Backend connection error:", error);
      alert("Cannot connect to server. Is your backend running?");
    } finally {
      loginBtn.textContent = "Authenticate";
      loginBtn.disabled = false;
    }
  });

  logoutBtn.addEventListener('click', () => {
    // localStorage.removeItem('token'); // Clear token on logout
    dashboardScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    
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

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      handleFile(e.dataTransfer.files[0]);
    }
  });
  
  fileInput.addEventListener('change', function() {
    if (this.files.length) {
      handleFile(this.files[0]);
    }
  });

  async function handleFile(file) {
    fileInfo.textContent = `Attached: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    
    scanOverlay.classList.add('active');
    resultsEmpty.textContent = "Extracting details and running NLM fraud detection...";
    resultsEmpty.style.display = "flex";
    resultsData.classList.remove('active');

    // Package the file to send to the backend
    const formData = new FormData();
    // 'document' is the key your backend must look for. Update if your backend expects 'file' or 'image'
    formData.append('document', file); 

    try {
      // 2. UPDATE THIS URL to your backend upload/analysis endpoint
      const response = await fetch('http://192.168.1.20:8000/api/scan', {
        method: 'POST',
        // headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }, // Uncomment if using JWT
        body: formData // Note: Do NOT set Content-Type header when sending FormData, the browser does it automatically
      });

      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status}`);
      }

      // 3. EXPECTED BACKEND JSON STRUCTURE
      // Your backend needs to return JSON that looks like this:
      // {
      //   "isFake": false,
      //   "score": "98%",
      //   "label": "Authentic",
      //   "documentType": "National ID",
      //   "extractedName": "Debayan Garai",
      //   "formatStatus": "Verified",
      //   "notes": "Natural Language Model confirms textual alignments..."
      // }
      const data = await response.json();
      
      scanOverlay.classList.remove('active');
      resultsEmpty.style.display = "none";
      resultsData.classList.add('active');

      const scoreRing = document.getElementById('score-ring');
      const scoreText = document.getElementById('score-text');
      const scoreLabelText = document.getElementById('score-label-text');
      const resNotes = document.getElementById('res-notes');
      const resFormatStatus = document.getElementById('res-format-status');
      
      // Populate UI with backend data
      document.getElementById('res-type').textContent = data.documentType || "Unknown";
      document.getElementById('res-name').textContent = data.extractedName || "Unknown";
      scoreText.textContent = data.score || "0%";
      scoreLabelText.textContent = data.label || "Unknown";
      resFormatStatus.textContent = data.formatStatus || "Unknown";
      resNotes.textContent = data.notes || "No notes provided by NLM.";

      if (data.isFake) {
        scoreRing.classList.add('danger');
        resFormatStatus.style.color = "var(--danger)";
        resNotes.style.color = "var(--danger)";
      } else {
        scoreRing.classList.remove('danger');
        resFormatStatus.style.color = "var(--success)";
        resNotes.style.color = "#ccc";
      }

    } catch (error) {
      console.error("File processing error:", error);
      scanOverlay.classList.remove('active');
      resultsEmpty.textContent = "Error processing document. Check console and backend connection.";
    }
  }

  resetBtn.addEventListener('click', () => {
    fileInput.value = "";
    fileInfo.textContent = "";
    resultsData.classList.remove('active');
    resultsEmpty.style.display = "flex";
    resultsEmpty.textContent = "Awaiting document upload for processing...";
  });
});