const MAX_ATTEMPTS = 3;
let failedAttempts = 0;
let lockoutTimer   = null;

/* ── TOGGLE PASSWORD ── */
function togglePw() {
  const input = document.getElementById('adminPassword');
  const icon  = document.getElementById('pwIcon');
  const hide  = input.type === 'password';
  input.type     = hide ? 'text' : 'password';
  icon.className = hide ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
}

/* ── ERROR / CLEAR ── */
function showError(msg) {
  document.getElementById('errorText').textContent = msg;
  document.getElementById('errorAlert').classList.add('show');
}
function clearError() {
  document.getElementById('errorAlert').classList.remove('show');
  document.getElementById('adminEmail').classList.remove('error');
  document.getElementById('adminPassword').classList.remove('error');
}

/* ── ATTEMPT BAR ── */
function updateAttemptBar() {
  const remaining = MAX_ATTEMPTS - failedAttempts;
  const bar       = document.getElementById('attemptBar');
  const label     = document.getElementById('attemptLabel');
  const fill      = document.getElementById('attemptFill');

  if (failedAttempts === 0) { bar.classList.remove('show'); return; }

  bar.classList.add('show');
  const pct = (failedAttempts / MAX_ATTEMPTS) * 100;
  fill.style.width = pct + '%';

  if (remaining > 0) {
    label.textContent = `${remaining} attempt${remaining > 1 ? 's' : ''} remaining before lockout`;
  } else {
    label.textContent = 'Account temporarily locked. Please wait 30 seconds.';
  }
}

/* ── LOCKOUT ── */
function lockForm(seconds) {
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.style.opacity = '.55';
  btn.style.cursor  = 'not-allowed';

  let remaining = seconds;
  showError(`Too many failed attempts. Try again in ${remaining}s.`);

  lockoutTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(lockoutTimer);
      failedAttempts = 0;
      btn.disabled      = false;
      btn.style.opacity = '1';
      btn.style.cursor  = 'pointer';
      updateAttemptBar();
      clearError();
    } else {
      showError(`Too many failed attempts. Try again in ${remaining}s.`);
    }
  }, 1000);
}

/* ── MAIN LOGIN HANDLER ── */
async function handleAdminLogin(event) {
event.preventDefault();
clearError();
// rate limit guard
if (lockoutTimer) return;

const email = document.getElementById('adminEmail').value.trim();
const password = document.getElementById('adminPassword').value;
if (!email || !password) { showError('Enter email and password.'); return; }

try {
const res = await fetch('/login', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ email, password })
});
if (res.ok) {
const data = await res.json();
if (data.role !== 'ADMIN') { showError('Not an admin account.'); return; }
localStorage.setItem('accessToken', data.accessToken);
localStorage.setItem('refreshToken', data.refreshToken);
localStorage.setItem('user', JSON.stringify({ username: data.email ?? data.username ?? email, role: data.role }));
window.location.href = '/admin-dashboard';
} else {
failedAttempts++; updateAttemptBar();
if (failedAttempts >= MAX_ATTEMPTS) lockForm(30);
else showError('Invalid credentials.');
}
} catch(e) { showError('Server error.'); }
}

/* ── CHECK EXISTING SESSION ── */
window.addEventListener('DOMContentLoaded', () => {
  const existing =
    JSON.parse(localStorage.getItem('adminSession')) ||
    JSON.parse(sessionStorage.getItem('adminSession'));
  if (existing && existing.role === 'Admin') {
    window.location.href = 'admin-dashboard.html';
  }
});