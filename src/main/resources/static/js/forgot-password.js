let currentStep = 1;
let resendInterval = null;
let resendSeconds = 30;
let pendingResetEmail = '';

async function extractApiError(response) {
  const text = await response.text();
  if (!text) {
    return 'Something went wrong. Please try again.';
  }
  try {
    const data = JSON.parse(text);
    if (typeof data.message === 'string') return data.message;
    if (typeof data.detail === 'string') return data.detail;
    if (typeof data.title === 'string') return data.title;
  } catch (_) {
    /* plain text */
  }
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || 'Something went wrong.';
}

/* ── HELPERS ── */
function showError(msg) {
  const el = document.getElementById('errorAlert');
  document.getElementById('errorText').textContent = msg;
  el.classList.add('show');
}
function clearError() {
  document.getElementById('errorAlert').classList.remove('show');
}

function setLoading(btnId, loading, originalHTML) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  if (loading) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Please wait…';
    btn.style.opacity = '.7';
  } else {
    btn.innerHTML = originalHTML;
    btn.style.opacity = '1';
  }
}

/* ── STEP NAVIGATION ── */
function goToStep(step) {
  currentStep = step;

  for (let i = 1; i <= 4; i++) {
    const p = document.getElementById('panel' + i);
    if (p) p.classList.toggle('active', i === step);
  }

  for (let i = 1; i <= 3; i++) {
    const s = document.getElementById('step' + i);
    s.className = 'step' + (i < step ? ' done' : i === step ? ' active' : '');
    const dot = document.getElementById('dot' + i);
    dot.innerHTML = i < step ? '<i class="fa-solid fa-check" style="font-size:11px;"></i>' : i;
  }

  document.getElementById('line1').className = 'step-line' + (step > 1 ? ' done' : '');
  document.getElementById('line2').className = 'step-line' + (step > 2 ? ' done' : '');

  const titles = { 1: 'Forgot Password', 2: 'Verify Your Identity', 3: 'Set New Password', 4: 'All Done!' };
  const subs = {
    1: 'Enter your email and we\'ll send you a 6-digit reset code.',
    2: 'Enter the OTP sent to your email address.',
    3: 'Choose a strong new password for your account.',
    4: 'Your password has been successfully reset.',
  };
  const icons = { 1: 'fa-key', 2: 'fa-shield-halved', 3: 'fa-lock', 4: 'fa-circle-check' };
  document.getElementById('headerTitle').textContent = titles[step];
  document.getElementById('headerSub').textContent = subs[step];
  document.getElementById('headerIconI').className = 'fa-solid ' + icons[step];

  const footer = document.getElementById('cardFooter');
  const backBtn = document.getElementById('backBtn');
  if (step === 4) {
    footer.style.display = 'none';
    backBtn.style.display = 'none';
  } else {
    footer.style.display = '';
    backBtn.style.display = '';
  }

  clearError();
}

/* ── STEP 1 : EMAIL ── */
async function submitEmail(e) {
  e.preventDefault();
  clearError();
  const email = document.getElementById('emailInput').value.trim();
  if (!email) {
    showError('Please enter your email address.');
    return;
  }

  const originalBtn =
    '<i class="fa-solid fa-paper-plane"></i> Send OTP';
  setLoading('emailBtn', true, originalBtn);

  try {
    const res = await fetch('/api/password-reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      showError(await extractApiError(res));
      return;
    }

    pendingResetEmail = email;
    document.getElementById('emailDisplay').textContent = email;
    startResendTimer();
    goToStep(2);
  } catch (err) {
    console.error(err);
    showError('Could not reach the server. Please try again.');
  } finally {
    setLoading('emailBtn', false, originalBtn);
  }
}

/* ── OTP BOXES — auto-focus & paste ── */
document.querySelectorAll('.otp-box').forEach((box, idx) => {
  box.addEventListener('input', () => {
    const val = box.value.replace(/\D/g, '');
    box.value = val ? val[0] : '';
    box.classList.toggle('filled', !!box.value);
    if (box.value && idx < 5) document.getElementById('otp' + (idx + 1)).focus();
  });
  box.addEventListener('keydown', (ev) => {
    if (ev.key === 'Backspace' && !box.value && idx > 0) {
      document.getElementById('otp' + (idx - 1)).focus();
    }
  });
  box.addEventListener('paste', (ev) => {
    ev.preventDefault();
    const text = (ev.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
    [...text.slice(0, 6)].forEach((ch, i) => {
      const b = document.getElementById('otp' + i);
      if (b) {
        b.value = ch;
        b.classList.add('filled');
      }
    });
    const last = Math.min(text.length, 5);
    document.getElementById('otp' + last)?.focus();
  });
});

function getOtpValue() {
  return [0, 1, 2, 3, 4, 5].map((i) => document.getElementById('otp' + i).value).join('');
}

/* ── RESEND TIMER ── */
function startResendTimer() {
  resendSeconds = 30;
  const btn = document.getElementById('resendBtn');
  const timer = document.getElementById('resendTimer');
  btn.disabled = true;
  timer.textContent = '(30s)';

  clearInterval(resendInterval);
  resendInterval = setInterval(() => {
    resendSeconds--;
    timer.textContent = resendSeconds > 0 ? `(${resendSeconds}s)` : '';
    if (resendSeconds <= 0) {
      clearInterval(resendInterval);
      btn.disabled = false;
    }
  }, 1000);
}

async function resendOtp() {
  clearError();
  if (!pendingResetEmail) {
    showError('Go back and enter your email first.');
    return;
  }
  try {
    const res = await fetch('/api/password-reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingResetEmail }),
    });
    if (!res.ok) {
      showError(await extractApiError(res));
      return;
    }
  } catch (err) {
    console.error(err);
    showError('Could not reach the server. Please try again.');
    return;
  }

  startResendTimer();
  [0, 1, 2, 3, 4, 5].forEach((i) => {
    const b = document.getElementById('otp' + i);
    b.value = '';
    b.classList.remove('filled');
  });
  document.getElementById('otp0').focus();
}

/* ── STEP 2 : OTP ── */
async function submitOtp(e) {
  e.preventDefault();
  clearError();
  const entered = getOtpValue();
  if (entered.length < 6) {
    showError('Please enter all 6 digits of the OTP.');
    return;
  }

  const originalBtn =
    '<i class="fa-solid fa-check-circle"></i> Verify OTP';
  setLoading('otpBtn', true, originalBtn);

  try {
    const res = await fetch('/api/password-reset/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingResetEmail, otp: entered }),
    });

    if (!res.ok) {
      showError(await extractApiError(res));
      [0, 1, 2, 3, 4, 5].forEach((i) => {
        const b = document.getElementById('otp' + i);
        b.value = '';
        b.classList.remove('filled');
      });
      document.getElementById('otp0').focus();
      return;
    }

    goToStep(3);
  } catch (err) {
    console.error(err);
    showError('Could not reach the server. Please try again.');
  } finally {
    setLoading('otpBtn', false, originalBtn);
  }
}

/* ── STEP 3 : PASSWORD ── */
function checkStrength() {
  const val = document.getElementById('newPw').value;
  const fill = document.getElementById('strengthFill');
  const txt = document.getElementById('strengthText');
  let score = 0;
  if (val.length >= 8) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const levels = [
    { w: '0%', bg: 'transparent', t: '', c: '' },
    { w: '25%', bg: '#DC2626', t: 'Weak', c: '#DC2626' },
    { w: '50%', bg: '#EAB308', t: 'Fair', c: '#CA8A04' },
    { w: '75%', bg: '#0D9488', t: 'Good', c: '#0D9488' },
    { w: '100%', bg: '#16A34A', t: 'Strong', c: '#16A34A' },
  ];
  const l = levels[score] || levels[0];
  fill.style.width = l.w;
  fill.style.background = l.bg;
  txt.textContent = l.t ? `Strength: ${l.t}` : '';
  txt.style.color = l.c;
}

function togglePw(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  const hide = input.type === 'password';
  input.type = hide ? 'text' : 'password';
  icon.className = hide ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
}

async function submitPassword(e) {
  e.preventDefault();
  clearError();
  const pw = document.getElementById('newPw').value;
  const cpw = document.getElementById('confirmPw').value;
  document.getElementById('confirmPw').classList.remove('error');

  if (pw.length < 8) {
    showError('Password must be at least 8 characters.');
    return;
  }
  if (pw !== cpw) {
    showError('Passwords do not match.');
    document.getElementById('confirmPw').classList.add('error');
    return;
  }

  const originalBtn =
    '<i class="fa-solid fa-key"></i> Reset Password';
  setLoading('pwBtn', true, originalBtn);

  try {
    const res = await fetch('/api/password-reset/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingResetEmail, newPassword: pw }),
    });

    if (!res.ok) {
      showError(await extractApiError(res));
      return;
    }

    goToStep(4);
  } catch (err) {
    console.error(err);
    showError('Could not reach the server. Please try again.');
  } finally {
    setLoading('pwBtn', false, originalBtn);
  }
}
