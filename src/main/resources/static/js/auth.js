function getToken() {
    return localStorage.getItem("accessToken");
}

function decodeJwtPayload(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    try {
        let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const pad = base64.length % 4;
        if (pad) base64 += '='.repeat(4 - pad);
        return JSON.parse(atob(base64));
    } catch {
        return null;
    }
}

function getUserRole() {
    try {
        const raw = localStorage.getItem("user");
        if (!raw) return null;
        const user = JSON.parse(raw);
        const role = user?.role;
        if (typeof role !== 'string') return null;
        return role.trim().toUpperCase();
    } catch {
        return null;
    }
}

function getUserEmail() {
    try {
        const raw = localStorage.getItem("user");
        if (!raw) return null;
        const user = JSON.parse(raw);
        return user?.username;
    } catch {
        return null;
    }
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
    const payload = decodeJwtPayload(token);
    if (!payload || typeof payload.exp !== 'number') return true;
    // exp is in seconds, Date.now() is in milliseconds
    return payload.exp * 1000 < Date.now();
}

function loginPathForRole(requiredRole) {
    return requiredRole === 'ADMIN' ? '/admin-login' : '/login';
}

// ✅ UPDATED: Now tries to refresh before redirecting to login
async function checkAuth(requiredRole) {
    const loginPath = loginPathForRole(requiredRole);
    let token = getToken();

    // Access token missing but refresh may still be valid → recover session
    if (!token) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
            window.location.href = loginPath;
            return false;
        }
        token = getToken();
        if (!token) {
            window.location.href = loginPath;
            return false;
        }
    }

    // Token exists but is expired → try silent refresh first
    if (isTokenExpired(token)) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
            window.location.href = loginPath;
            return false;
        }
    }

    // Role check (read AFTER any refresh attempt so localStorage is up to date)
    let role = getUserRole();

    // If token exists but role info is missing (e.g., storage cleared partially),
    // try one silent refresh to rehydrate `user` from server.
    if (requiredRole && !role) {
        const refreshed = await refreshAccessToken();
        if (refreshed) role = getUserRole();
    }

    // Role check
    if (requiredRole && role !== requiredRole) {
        window.location.href = loginPath;
        return false;
    }

    return true;
}

async function refreshAccessToken() {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return false;

    // If refresh token is expired, don't even try
    // (avoid clearing all localStorage here; caller will redirect to login)
    if (isTokenExpired(refreshToken)) return false;

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

            // Keep `user` in sync so refresh+reload doesn't lose role/email
            try {
                const existingRaw = localStorage.getItem("user");
                const existing = existingRaw ? JSON.parse(existingRaw) : {};
                const nextUser = {
                    username: data.email ?? data.username ?? existing?.username ?? null,
                    role: data.role ?? existing?.role ?? null
                };
                localStorage.setItem("user", JSON.stringify(nextUser));
            } catch {
                // ignore storage/parse errors
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
    const role = getUserRole();
    const loginHref = role === 'ADMIN' ? '/admin-login' : '/login';
    if (token) {
        fetch("/logout", {
            method: "POST",
            headers: { "Authorization": "Bearer " + token }
        });
    }
    localStorage.clear();
    window.location.href = loginHref;
}