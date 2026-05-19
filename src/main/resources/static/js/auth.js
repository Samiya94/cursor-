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

// Check if token is expiring within 30 seconds (used for access token).
// The 30-sec buffer prevents edge cases where a token expires mid-flight.
function isTokenExpired(token) {
    if (!token) return true;
    const payload = decodeJwtPayload(token);
    if (!payload || typeof payload.exp !== 'number') return true;
    const BUFFER_MS = 30 * 1000;
    return payload.exp * 1000 < Date.now() + BUFFER_MS;
}

// Strict check without buffer — used for refresh token and final redirect decisions.
function isTokenExpiredStrict(token) {
    if (!token) return true;
    const payload = decodeJwtPayload(token);
    if (!payload || typeof payload.exp !== 'number') return true;
    return payload.exp * 1000 < Date.now();
}

function loginPathForRole(requiredRole) {
    return requiredRole === 'ADMIN' ? '/admin-login' : '/login';
}

// Singleton refresh promise — prevents multiple concurrent /refresh calls
// (e.g. when several secureFetch calls fire simultaneously on page load).
let _refreshPromise = null;

async function refreshAccessToken() {
    if (_refreshPromise) return _refreshPromise;
    _refreshPromise = _doRefresh().finally(() => { _refreshPromise = null; });
    return _refreshPromise;
}

async function _doRefresh() {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return false;

    // Refresh token is expired — no point calling the server
    if (isTokenExpiredStrict(refreshToken)) {
        localStorage.removeItem("refreshToken");
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
            if (data.refreshToken) {
                localStorage.setItem("refreshToken", data.refreshToken);
            }
            // Keep user object in sync
            try {
                const existingRaw = localStorage.getItem("user");
                const existing = existingRaw ? JSON.parse(existingRaw) : {};
                const nextUser = {
                    username: data.email ?? data.username ?? existing?.username ?? null,
                    role: data.role ?? existing?.role ?? null
                };
                localStorage.setItem("user", JSON.stringify(nextUser));
            } catch { /* ignore */ }
            return true;
        }

        // Server rejected the refresh token — clear it so we don't loop
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        return false;

    } catch {
        // Network error — do NOT clear tokens or redirect.
        // The user might be temporarily offline; preserve their session.
        return false;
    }
}

// Called by every dashboard on DOMContentLoaded.
async function checkAuth(requiredRole) {
    const loginPath = loginPathForRole(requiredRole);
    let token = getToken();

    // ── No access token: try to recover via refresh token ───────────────
    if (!token) {
        const hasRefreshToken = !!localStorage.getItem("refreshToken");
        if (!hasRefreshToken) {
            // Genuinely not logged in
            window.location.href = loginPath;
            return false;
        }
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
            // Refresh token was there but server rejected it
            window.location.href = loginPath;
            return false;
        }
        token = getToken();
        if (!token) {
            window.location.href = loginPath;
            return false;
        }
    }

    // ── Access token near/past expiry: try silent refresh ───────────────
    if (isTokenExpired(token)) {
        const refreshed = await refreshAccessToken();
        // Only hard-redirect if the token is TRULY expired (past strict deadline)
        if (!refreshed && isTokenExpiredStrict(token)) {
            window.location.href = loginPath;
            return false;
        }
        // If within the 30-sec buffer and refresh failed, let them stay —
        // the token may still be valid on the server.
    }

    // ── Role missing: try refresh to rehydrate user info ────────────────
    let role = getUserRole();
    if (requiredRole && !role) {
        const refreshed = await refreshAccessToken();
        if (refreshed) role = getUserRole();
    }

    // ── Final role gate ──────────────────────────────────────────────────
    if (requiredRole && role !== requiredRole) {
        window.location.href = loginPath;
        return false;
    }

    return true;
}

async function secureFetch(url, options = {}) {
    // Proactively refresh before the request if expiring soon
    if (isTokenExpired(getToken())) {
        const refreshed = await refreshAccessToken();
        if (!refreshed && isTokenExpiredStrict(getToken())) {
            logout();
            return null;
        }
    }

    options.headers = {
        ...options.headers,
        "Authorization": "Bearer " + getToken()
    };

    let response = await fetch(url, options);

    // Server still returned 401 — try one more refresh
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