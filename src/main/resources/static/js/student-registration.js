/* ── URL PARAMS ── */
const urlParams   = new URLSearchParams(window.location.search);
const instituteId = urlParams.get('instituteId');
const deptId      = urlParams.get('dept');
const token       = urlParams.get('token');

/* ── PAGE LOAD: fetch institute + dept name from backend ── */
async function loadRegistrationInfo() {
    if (!instituteId) {
        document.getElementById('instReadonly').value = 'Invalid registration link';
        document.getElementById('deptReadonly').value = 'Invalid registration link';
        return;
    }

    try {
        const params = new URLSearchParams({ instituteId });
        if (deptId) params.append('deptId', deptId);

        const res = await fetch('/register/info?' + params.toString());

        if (!res.ok) {
            document.getElementById('instReadonly').value = 'Could not load institute';
            document.getElementById('deptReadonly').value = 'Could not load department';
            return;
        }

        const data = await res.json();
        document.getElementById('instReadonly').value = data.instituteName  || '—';
        document.getElementById('deptReadonly').value  = data.departmentName || '—';

    } catch (err) {
        console.error('Failed to load registration info:', err);
        document.getElementById('instReadonly').value = 'Error loading';
        document.getElementById('deptReadonly').value  = 'Error loading';
    }
}

/* ── TOGGLE PASSWORD VISIBILITY ── */
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
    if (val.length >= 6)           score++;
    if (/[A-Z]/.test(val))        score++;
    if (/[0-9]/.test(val))        score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    const levels = [
        { w: '0%',   bg: 'transparent', t: '',       c: '' },
        { w: '25%',  bg: '#DC2626',     t: 'Weak',   c: '#DC2626' },
        { w: '50%',  bg: '#EAB308',     t: 'Fair',   c: '#CA8A04' },
        { w: '75%',  bg: '#0D9488',     t: 'Good',   c: '#0D9488' },
        { w: '100%', bg: '#16A34A',     t: 'Strong', c: '#16A34A' },
    ];
    const l = levels[score] || levels[0];
    fill.style.width      = l.w;
    fill.style.background = l.bg;
    txt.textContent       = l.t ? 'Strength: ' + l.t : '';
    txt.style.color       = l.c;
}

/* ── LIVE EMAIL DUPLICATE CHECK ── */
async function checkAlreadyRegistered() {
    const email  = document.getElementById('regEmail').value.trim();
    const banner = document.getElementById('alreadyRegBanner');
    if (!email) return;

    try {
        const res  = await fetch('/api/students/check-email?email='
                                 + encodeURIComponent(email));
        const data = await res.json();

        if (data.exists) {
            document.getElementById('alreadyRegText').textContent =
                `"${email}" is already registered. Please login instead.`;
            banner.classList.add('show');
        } else {
            banner.classList.remove('show');
        }
    } catch (err) {
        banner.classList.remove('show');
    }
}

/* ── VALIDATION HELPERS ── */
function showError(msg) {
    document.getElementById('errorText').textContent = msg;
    document.getElementById('errorAlert').classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
function clearError() {
    document.getElementById('errorAlert').classList.remove('show');
}
function markField(id, valid) {
    const el = document.getElementById(id);
    if (!el) return;
    if (valid) el.classList.remove('error');
    else       el.classList.add('error');
    return valid;
}

function toggleDegreeOther() {
    const degree = document.getElementById('studentDegree').value;
    const wrap = document.getElementById('degreeOtherWrap');
    const other = document.getElementById('degreeOther');
    if (!wrap) return;
    const show = degree === 'Other';
    wrap.style.display = show ? '' : 'none';
    if (!show && other) other.value = '';
}

function resolveDegreeValue() {
    const degree = document.getElementById('studentDegree').value;
    if (degree === 'Other') {
        return document.getElementById('degreeOther').value.trim();
    }
    return degree;
}

/* ── FORM SUBMIT → POST to backend ── */
async function handleSubmit(e) {
    e.preventDefault();
    clearError();

    const firstName       = document.getElementById('firstName').value.trim();
    const lastName        = document.getElementById('lastName').value.trim();
    const email           = document.getElementById('regEmail').value.trim();
    const phone           = document.getElementById('phone').value.trim();
    const studentYear     = document.getElementById('studentYear').value;
    const degreeValue     = resolveDegreeValue();
    const password        = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const terms           = document.getElementById('terms').checked;
    const studentClass    = studentYear && degreeValue ? studentYear + degreeValue : '';

    // Client-side validation
    let ok = true;
    if (!markField('firstName',          firstName.length > 0))                      ok = false;
    if (!markField('lastName',           lastName.length > 0))                       ok = false;
    if (!markField('regEmail',           /^\S+@\S+\.\S+$/.test(email)))              ok = false;
    if (!markField('phone',              /^\d{10}$/.test(phone)))                    ok = false;
    if (!markField('studentYear',        studentYear !== ''))                        ok = false;
    if (!markField('studentDegree',      document.getElementById('studentDegree').value !== '')) ok = false;
    if (document.getElementById('studentDegree').value === 'Other') {
        if (!markField('degreeOther', degreeValue.length > 0)) ok = false;
    }
    if (!markField('regPassword',        password.length >= 6))                      ok = false;
    if (!markField('regConfirmPassword', password === confirmPassword && password.length >= 6)) ok = false;

    if (!ok)    { showError('Please fill in all required fields correctly.'); return; }
    if (!terms) { showError('Please accept the Terms & Conditions to continue.'); return; }
    if (!token) { showError('Invalid registration link — token missing.'); return; }

    // Disable button while submitting
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registering…';

    try {
        const payload = {
            instituteId:     Number(instituteId),
            departmentId:    deptId ? Number(deptId) : null,
            token:           token,
            firstName:       firstName,
            lastName:        lastName,
            email:           email,
            phone:           phone,
            studentClass:    studentClass,
            password:        password,
            confirmPassword: confirmPassword
        };

        const res = await fetch('/register/student', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
        });

        if (res.ok) {
            // Show success view
            document.getElementById('successInstName').textContent =
                document.getElementById('instReadonly').value;
            document.getElementById('successDeptName').textContent =
                document.getElementById('deptReadonly').value;
            document.getElementById('formView').style.display    = 'none';
            document.getElementById('successView').classList.add('show');
            document.getElementById('cardFooter').style.display  = 'none';
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        // Handle known backend errors
        const errorText = await res.text();

        if (res.status === 409 || errorText.includes('Email already exists')) {
            showError('This email is already registered. Please login instead.');
        } else if (errorText.includes('Invalid or expired registration link')
                || errorText.includes('Token expired')) {
            showError('This registration link has expired. Ask your mentor to generate a new one.');
        } else if (errorText.includes('Passwords do not match')) {
            showError('Passwords do not match.');
        } else {
            showError(errorText || 'Registration failed. Please try again.');
        }

    } catch (err) {
        console.error('Registration error:', err);
        showError('Network error. Please check your connection and try again.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Complete Registration';
    }
}

/* ── FIX: success button should go to /login, not login.html ── */
document.addEventListener('DOMContentLoaded', function () {
    const loginBtn = document.querySelector('.btn-go-login');
    if (loginBtn) {
        loginBtn.onclick = function () {
            window.location.href = '/login';
        };
    }
});

/* ── INIT ── */
loadRegistrationInfo();