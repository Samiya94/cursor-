
/* ── URL PARAMS ── */
const urlParams = new URLSearchParams(window.location.search);
const instId    = urlParams.get('inst')  || '1';
const regToken  = urlParams.get('token') || '';

const DEPTS_KEY = 'instituteDepts_' + instId;
const TPO_KEY   = 'tpoCoordinators_' + instId;

/* ── LOAD INSTITUTE INFO ── */
async function loadInstituteInfo() {
  try {
    const token = localStorage.getItem("accessToken");

    const res = await fetch(`/api/institutes/${instId}/public`);

    if (!res.ok) throw new Error("Failed to fetch institute");

    const inst = await res.json();

    const name = inst.instituteName || "Institute";
    const sub  = inst.city || "";

    document.getElementById('instName').textContent     = name;
    document.getElementById('instFullName').textContent = sub;
    document.getElementById('instReadonly').value       = name;

    const initials = name.split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0,3);

    document.getElementById('instInitials').textContent = initials;

  } catch (err) {
    console.error(err);
    document.getElementById('instName').textContent = "Invalid or expired link";
  }
}

/* ── LOAD DEPARTMENTS ── */
async function loadDepartments() {
  const select = document.getElementById('deptSelect');
  const notice = document.getElementById('noDeptNotice');

  try {
    const res = await fetch(`/departments/institute/${instId}`);

    if (!res.ok) throw new Error("Failed");

    const depts = await res.json();

    if (!depts.length) {
      select.innerHTML = '<option>No departments available</option>';
      select.disabled = true;
      notice.classList.add('show');
      return;
    }

    notice.classList.remove('show');
    select.disabled = false;
    select.innerHTML = '<option value="">Select your department…</option>';

    depts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.name;
      select.appendChild(opt);
    });

  } catch (err) {
    console.error(err);
  }
}

/* ── DEPT CHANGE ── */
function onDeptChange() {
  const val   = document.getElementById('deptSelect').value;
  const badge = document.getElementById('deptBadge');
  const warn  = document.getElementById('alreadyRegBanner');

  document.getElementById('deptBadgeText').textContent = val;
  badge.classList.toggle('show', !!val);

  if (val) {
    const coords  = JSON.parse(localStorage.getItem(TPO_KEY)) || [];
    const exists  = coords.find(c => c.departmentName.toLowerCase() === val.toLowerCase());
    if (exists) {
      document.getElementById('alreadyRegText').textContent =
        `"${val}" already has a registered coordinator: ${exists.coordinatorName}. Contact the admin to reassign.`;
      warn.classList.add('show');
    } else {
      warn.classList.remove('show');
    }
  } else {
    warn.classList.remove('show');
  }
}

/* ── PASSWORD TOGGLE ── */
function togglePw(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon  = document.getElementById(iconId);
  const hide  = input.type === 'password';
  input.type     = hide ? 'text' : 'password';
  icon.className = hide ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
}

/* ── PASSWORD STRENGTH ── */
function checkStrength() {
  const val  = document.getElementById('regPassword').value;
  const fill = document.getElementById('strengthFill');
  const txt  = document.getElementById('strengthText');
  let score  = 0;
  if (val.length >= 6)         score++;
  if (/[A-Z]/.test(val))      score++;
  if (/[0-9]/.test(val))      score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const levels = [
    { w:'0%',   bg:'transparent', t:'',       c:'' },
    { w:'25%',  bg:'#DC2626',     t:'Weak',   c:'#DC2626' },
    { w:'50%',  bg:'#EAB308',     t:'Fair',   c:'#CA8A04' },
    { w:'75%',  bg:'#0D9488',     t:'Good',   c:'#0D9488' },
    { w:'100%', bg:'#16A34A',     t:'Strong', c:'#16A34A' },
  ];
  const l = levels[score] || levels[0];
  fill.style.width      = l.w;
  fill.style.background = l.bg;
  txt.textContent       = l.t ? 'Strength: ' + l.t : '';
  txt.style.color       = l.c;
}

/* ── FIELD VALIDATION ── */
function validateField(id, condition) {
  const el = document.getElementById(id);
  if (!condition) { el.classList.add('error'); return false; }
  el.classList.remove('error'); return true;
}

function showError(msg) {
  document.getElementById('errorText').textContent = msg;
  document.getElementById('errorAlert').classList.add('show');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function clearError() {
  document.getElementById('errorAlert').classList.remove('show');
}

/* ── FORM SUBMIT ── */
async function handleSubmit(e) {
  e.preventDefault();
  clearError();

  const firstName   = document.getElementById('firstName').value.trim();
  const lastName    = document.getElementById('lastName').value.trim();
  const email       = document.getElementById('regEmail').value.trim();
  const phone       = document.getElementById('phone').value.trim();
  const deptId    = document.getElementById('deptSelect').value;
  const designation = document.getElementById('designation').value;
  const password    = document.getElementById('regPassword').value;
  const confirm     = document.getElementById('regConfirm').value;
  const terms       = document.getElementById('terms').checked;

  if (password.length < 6) {
  return showError("Password must be at least 6 characters");
}

if (password !== confirm) {
  return showError("Passwords do not match");
}

  let valid = true;
  valid = validateField('firstName',   firstName.length > 0)              && valid;
  valid = validateField('lastName',    lastName.length > 0)               && valid;
  valid = validateField('regEmail',    /\S+@\S+\.\S+/.test(email))        && valid;
  valid = validateField('phone',       phone.length >= 10)                && valid;
  valid = validateField('deptSelect',  deptId !== '')                   && valid;
  valid = validateField('designation', designation !== '')                && valid;
  valid = validateField('regPassword', password.length >= 6)              && valid;
  valid = validateField('regConfirm',  password === confirm)              && valid;

  if (!valid) { showError('Please fill in all required fields correctly.'); return; }
  if (!terms) { showError('Please accept the Terms & Conditions to continue.'); return; }

  // PAYLOAD FOR BACKEND
  const payload = {
    firstName,
    lastName,
    email,
    phone,
    password,
    confirmPassword: confirm,
    departmentId: Number(deptId),
    designation,
    instituteId: instId,
    token: regToken
  };

  const submitBtn = document.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registering...';
  }

try {
  console.log("Payload:", payload);
  // await fetch(`/register/mentor?token=${regToken}`
    const res = await fetch(`/register/mentor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();

    if (res.status === 409 || text.includes("Mentor already exists for this department")) {
      showError("Coordinator already exists for this department");
      return;
    }

    if (!res.ok) {
      throw new Error(text || "Registration failed");
    }

    

    // document.getElementById('successDeptName').textContent = deptId;
    // Show department name not ID
    const deptSelect = document.getElementById('deptSelect');
    const deptName = deptSelect.options[deptSelect.selectedIndex].text;
    document.getElementById('successDeptName').textContent = deptName;
    document.getElementById('formView').classList.add('hidden');
    document.getElementById('successView').classList.add('show');
    document.getElementById('cardFooter').style.display = 'none';
    document.getElementById('alreadyRegBanner').classList.remove('show');

    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    console.error(err);
    showError("Registration failed. Try again.");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  }
}

/* ── INIT ── */
loadInstituteInfo();
loadDepartments();
