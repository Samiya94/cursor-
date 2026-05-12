let currentRole = 'Student';

const roleSubtitles = {
  Student:     'Sign in to access your interview sessions and feedback.',
  Interviewer: 'Sign in to manage your scheduled interview sessions.',
  Institute:   'Sign in to your institute dashboard and track evaluations.',
  Mentor:      'Sign in as Department Head to oversee your department\'s evaluations.',
};

const showRegNote = {
  Student:     false,
  Interviewer: true,
  Institute:   true,
  Mentor:      true,
};

const regNoteTexts = {
  Interviewer: 'Not registered yet? <a href="/register">Join as an Interviewer</a>',
  Institute:   'Not registered yet? <a href="/register">Register your Institute</a>',
  Mentor:      '<i class="fa-solid fa-circle-info"></i> Mentor access is invite-only. Your account is created by your Institute from their dashboard.',
};

const roleDashboardMap = {
  STUDENT:     "/student-dashboard",
  INTERVIEWER: "/interviewer-dashboard",
  INSTITUTE:   "/institute-dashboard",
  MENTOR:      "/mentor-dashboard",
  ADMIN:       "/admin-dashboard"
};

/* ── ROLE SELECTION ── */
function selectRole(role, el) {
  currentRole = role;

  // update buttons
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');

  // update subtitle
  document.getElementById('role-subtitle').textContent = roleSubtitles[role] || 'Welcome back.';

  // update button label
  document.getElementById('btnRoleLabel').textContent = role;

  // reg note
  const note = document.getElementById('regNote');
  if (showRegNote[role]) {
    note.innerHTML = `<i class="fa-solid fa-circle-info"></i><span>${regNoteTexts[role]}</span>`;
    note.classList.add('show');
  } else {
    note.classList.remove('show');
  }

  clearError();
}

/* ── TOGGLE PASSWORD ── */
function togglePw() {
  const input = document.getElementById('passwordInput');
  const icon  = document.getElementById('pwIcon');
  const isHidden = input.type === 'password';
  input.type     = isHidden ? 'text' : 'password';
  icon.className = isHidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
}

async function extractErrorMessage(response) {
  const text = await response.text();
  if (!text) {
    return response.status === 401
      ? 'Invalid email or password.'
      : 'Something went wrong. Please try again.';
  }
  try {
    const data = JSON.parse(text);
    if (typeof data.message === 'string') return data.message;
    if (typeof data.detail === 'string') return data.detail;
    if (typeof data.title === 'string') return data.title;
  } catch (_) {
    /* not JSON */
  }
  const stripped = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped || 'Something went wrong. Please try again.';
}

/* ── ERROR HELPERS ── */
function showError(msg) {
  document.getElementById('errorText').textContent = msg;
  document.getElementById('errorAlert').classList.add('show');
}
function clearError() {
  document.getElementById('errorAlert').classList.remove('show');
  document.getElementById('emailInput').classList.remove('error');
  document.getElementById('passwordInput').classList.remove('error');
}

async function testDashboard() {
  const token = localStorage.getItem("accessToken");

  if (!token) {
    console.error("No token found!");
    return;
  }

  const user = JSON.parse(localStorage.getItem("user"));
  const role = user?.role?.toUpperCase();

  const url = roleDashboardMap[role];

  if (!url) {
    alert("Unknown role!");
    return;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": "Bearer " + token
    }
  });

  if (response.ok) {
    const data = await response.text();
    console.log("Dashboard Response:", data);
    alert(data);
  } else {
    alert("Access Denied");
  }
}


/* ── MAIN LOGIN HANDLER ── */
async function handleLogin(event) {
  event.preventDefault();
  clearError();

  

  const email = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value;

  if (!email || !password) {
    showError('Please enter both email and password.');
    return;
  }

  try {
    const response = await fetch("/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: email,
        password: password
      })
    });

    if (response.ok) {
      const data = await response.json();
      // 🔐 Store tokens
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);

        // 👤 Store user info
        localStorage.setItem("user", JSON.stringify({
        // Backend returns `email` (not `username`)
        username: data.email ?? data.username ?? email,
        role: data.role
        }));
  // optional success message
  showModal("Login successful", data.role);
} else {
      const err = await extractErrorMessage(response);
      showError(err);
      document.getElementById('emailInput').classList.add('error');
      document.getElementById('passwordInput').classList.add('error');
    }

  } catch (error) {
    console.error(error);
    showError("Server error");
  }
}

/* ── AUTO-SELECT ROLE FROM URL PARAM ── */
window.addEventListener('DOMContentLoaded', () => {
  const param = new URLSearchParams(window.location.search).get('role');
  const map   = {
    student:     'role-student',
    interviewer: 'role-interviewer',
    institute:   'role-institute',
    mentor:      'role-mentor',
  };
  if (param && map[param.toLowerCase()]) {
    const btn = document.getElementById(map[param.toLowerCase()]);
    if (btn) selectRole(param.charAt(0).toUpperCase() + param.slice(1), btn);
  }
});
let redirectUrl = null;

function showModal(message, role) {
  document.getElementById("modalMessage").textContent = message;
  document.getElementById("successModal").classList.add("show");

  const normalizedRole = role.toUpperCase();

    // All role redirects
    const roleRedirectMap = {
        STUDENT: "/student-dashboard",
        INTERVIEWER: "/interviewer-dashboard",
        INSTITUTE: "/institute-dashboard",
        MENTOR: "/mentor-dashboard",
        ADMIN: "/admin-dashboard"
    };

    redirectUrl = roleRedirectMap[normalizedRole] || "/";


  setTimeout(() => {
    if (redirectUrl) {
      
      window.location.href = redirectUrl;
    }
  }, 2000);
}

function closeModal() {
  document.getElementById("successModal").classList.remove("show");

  if (redirectUrl) {
    window.location.href = redirectUrl;
  }
}