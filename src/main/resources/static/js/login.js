const roleDashboardMap = {
  STUDENT:     "/student-dashboard",
  INTERVIEWER: "/interviewer-dashboard",
  INSTITUTE:   "/institute-dashboard",
  MENTOR:      "/mentor-dashboard",
  ADMIN:       "/admin-dashboard"
};

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

  const loginBtn = document.querySelector('.login-btn');
  const originalBtnText = loginBtn ? loginBtn.innerHTML : '';
  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging in...';
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
  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerHTML = originalBtnText;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // nothing to initialize
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