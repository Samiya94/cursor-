function getToken() {
    return localStorage.getItem("accessToken");
}

function getUserRole() {
    const user = JSON.parse(localStorage.getItem("user"));
    return user?.role?.toUpperCase();
}

function getUserEmail() {
    const user = JSON.parse(localStorage.getItem("user"));
    return user?.username;
}

function authHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + getToken()
    };
}

// ✅ NEW: Check if a JWT token is expired without calling the server
function isTokenExpired(token) {
    if (!token) return true;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // exp is in seconds, Date.now() is in milliseconds
        return payload.exp * 1000 < Date.now();
    } catch (e) {
        return true;
    }
}

// ✅ UPDATED: Now tries to refresh before redirecting to login
async function checkAuth(requiredRole) {
    const token = getToken();
    const role = getUserRole();

    // No token at all → go to login
    if (!token) {
        window.location.href = "/login";
        return false;
    }

    // Token exists but is expired → try silent refresh first
    if (isTokenExpired(token)) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
            window.location.href = "/login";
            return false;
        }
    }

    // Role check
    if (requiredRole && role !== requiredRole) {
        window.location.href = "/login";
        return false;
    }

    return true;
}

async function refreshAccessToken() {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return false;

    // If refresh token itself is also expired, don't even try
    if (isTokenExpired(refreshToken)) {
        localStorage.clear();
        return false;
    }

    try {
        const res = await fetch("/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken })
        });

        if (res.ok) {
            const data = await res.json();
            localStorage.setItem("accessToken", data.accessToken);
            // Also update refreshToken if server returns a new one
            if (data.refreshToken) {
                localStorage.setItem("refreshToken", data.refreshToken);
            }
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

async function secureFetch(url, options = {}) {
    // ✅ Before every request, check if token is expired and refresh silently
    if (isTokenExpired(getToken())) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
            logout();
            return null;
        }
    }

    options.headers = {
        ...options.headers,
        "Authorization": "Bearer " + getToken()
    };

    let response = await fetch(url, options);

    // ✅ Fallback: if server still returns 401, try refresh once more
    if (response.status === 401) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            options.headers["Authorization"] = "Bearer " + getToken();
            response = await fetch(url, options);
        } else {
            logout();
            return null;
        }
    }

    return response;
}

function logout() {
    const token = getToken();
    if (token) {
        fetch("/logout", {
            method: "POST",
            headers: { "Authorization": "Bearer " + token }
        });
    }
    localStorage.clear();
    window.location.href = "/login";
}