/* ======================================================
   AI Fake ID Detector — Register Page JavaScript
   ====================================================== */

const API_BASE = 'http://localhost:3000/api/auth';

// ---- DOM ----
const form        = document.getElementById('register-form');
const nameInput   = document.getElementById('fullname');
const emailInput  = document.getElementById('email');
const passInput   = document.getElementById('password');
const confirmInput = document.getElementById('confirm-password');
const termsCheck  = document.getElementById('terms');
const btnRegister = document.getElementById('btn-register');
const btnText     = btnRegister.querySelector('.btn-text');
const btnLoader   = btnRegister.querySelector('.btn-loader');
const alertBox    = document.getElementById('alert-box');
const alertMsg    = document.getElementById('alert-message');
const togglePwd   = document.getElementById('toggle-password');
const strengthBar = document.getElementById('strength-bar');

// ---- Particles ----
(function createParticles() {
  const container = document.getElementById('particles');
  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.classList.add('particle');
    const size = Math.random() * 6 + 2;
    p.style.width  = size + 'px';
    p.style.height = size + 'px';
    p.style.left   = Math.random() * 100 + '%';
    p.style.animationDuration = (Math.random() * 15 + 10) + 's';
    p.style.animationDelay    = (Math.random() * 10) + 's';
    container.appendChild(p);
  }
})();

// ---- Toggle password ----
togglePwd.addEventListener('click', () => {
  const isPassword = passInput.type === 'password';
  passInput.type = isPassword ? 'text' : 'password';
  togglePwd.querySelector('i').classList.toggle('fa-eye');
  togglePwd.querySelector('i').classList.toggle('fa-eye-slash');
});

// ---- Password strength meter ----
passInput.addEventListener('input', () => {
  clearFieldError('password');
  const val = passInput.value;
  let score = 0;
  if (val.length >= 8)  score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
  const widths = ['25%', '50%', '75%', '100%'];

  if (val.length === 0) {
    strengthBar.style.width = '0';
    strengthBar.style.background = 'transparent';
  } else {
    strengthBar.style.width = widths[score - 1] || '10%';
    strengthBar.style.background = colors[score - 1] || '#ef4444';
  }
});

// ---- Helpers ----
function showAlert(message, type = 'error') {
  alertBox.className = `alert ${type}`;
  alertMsg.textContent = message;
}
function hideAlert() { alertBox.className = 'alert hidden'; }

function setFieldError(id, msg) {
  document.getElementById(`${id}-error`).textContent = msg;
  document.getElementById(id).classList.add('input-error');
}
function clearFieldError(id) {
  document.getElementById(`${id}-error`).textContent = '';
  document.getElementById(id).classList.remove('input-error');
}
function setLoading(loading) {
  btnRegister.disabled = loading;
  btnText.classList.toggle('hidden', loading);
  btnLoader.classList.toggle('hidden', !loading);
}
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ---- Clear errors ----
nameInput.addEventListener('input',    () => clearFieldError('fullname'));
emailInput.addEventListener('input',   () => clearFieldError('email'));
confirmInput.addEventListener('input', () => clearFieldError('confirm-password'));

// ---- Form submit ----
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();

  const fullname        = nameInput.value.trim();
  const email           = emailInput.value.trim();
  const password        = passInput.value;
  const confirmPassword = confirmInput.value;
  let valid = true;

  if (!fullname) { setFieldError('fullname', 'Full name is required'); valid = false; }

  if (!email) { setFieldError('email', 'Email is required'); valid = false; }
  else if (!validateEmail(email)) { setFieldError('email', 'Enter a valid email'); valid = false; }

  if (!password) { setFieldError('password', 'Password is required'); valid = false; }
  else if (password.length < 8) { setFieldError('password', 'Min 8 characters'); valid = false; }

  if (password !== confirmPassword) {
    setFieldError('confirm-password', 'Passwords do not match');
    valid = false;
  }

  if (!termsCheck.checked) {
    showAlert('You must agree to the Terms of Service', 'error');
    valid = false;
  }

  if (!valid) return;

  setLoading(true);

  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullname, email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      showAlert(data.message || 'Registration failed.', 'error');
      return;
    }

    showAlert('Account created! Redirecting to login…', 'success');
    setTimeout(() => { window.location.href = 'index.html'; }, 1500);
  } catch (err) {
    showAlert('Unable to connect to server.', 'error');
    console.error(err);
  } finally {
    setLoading(false);
  }
});
