// ─── Token helpers ────────────────────────────────────────────────────────────

function getToken() {
    return localStorage.getItem("accessToken");
}

function getUserRole() {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return user?.role?.toUpperCase();
}

function getUserEmail() {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return user?.username;
}

function authHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + getToken()
    };
}

// Decode JWT expiry without a server call
function isTokenExpired(token) {
    if (!token) return true;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp * 1000 < Date.now();
    } catch (e) {
        return true;
    }
}

// Milliseconds until a token expires (negative = already expired)
function msUntilExpiry(token) {
    if (!token) return -1;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp * 1000 - Date.now();
    } catch (e) {
        return -1;
    }
}

// ─── Refresh mutex ────────────────────────────────────────────────────────────
// Prevents multiple simultaneous refresh calls (race condition on parallel
// secureFetch calls when the token has just expired).

let _refreshPromise = null;

async function refreshAccessToken() {
    // If a refresh is already in flight, wait for that one instead of firing another
    if (_refreshPromise) return _refreshPromise;

    _refreshPromise = _doRefresh().finally(() => { _refreshPromise = null; });
    return _refreshPromise;
}

async function _doRefresh() {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return false;

    // If the refresh token itself is expired, force logout immediately
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
            if (data.refreshToken) {
                localStorage.setItem("refreshToken", data.refreshToken);
            }
            // Re-arm the proactive renewal for the new token
            _scheduleProactiveRefresh();
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

// ─── Proactive renewal ────────────────────────────────────────────────────────
// Silently refreshes the access token 2 minutes before it expires so that
// no user-facing request ever hits an expired token mid-session.

let _proactiveTimer = null;

function _scheduleProactiveRefresh() {
    if (_proactiveTimer) clearTimeout(_proactiveTimer);

    const token = getToken();
    const ms = msUntilExpiry(token);
    if (ms <= 0) return; // already expired — secureFetch will handle it

    // Refresh 2 minutes (120 000 ms) before expiry, minimum 5 seconds from now
    const delay = Math.max(ms - 120_000, 5_000);

    _proactiveTimer = setTimeout(async () => {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken || isTokenExpired(refreshToken)) {
            // Refresh token gone or expired → send to login
            logout();
            return;
        }
        const ok = await refreshAccessToken();
        if (!ok) logout();
        // If ok, _doRefresh already called _scheduleProactiveRefresh for the new token
    }, delay);
}

// ─── checkAuth ────────────────────────────────────────────────────────────────

async function checkAuth(requiredRole) {
    const token = getToken();
    const role  = getUserRole();

    if (!token) {
        window.location.href = "/login";
        return false;
    }

    if (isTokenExpired(token)) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
            window.location.href = "/login";
            return false;
        }
    }

    if (requiredRole && role !== requiredRole) {
        window.location.href = "/login";
        return false;
    }

    // Token is valid — arm proactive renewal so it stays valid throughout session
    _scheduleProactiveRefresh();
    return true;
}

// ─── secureFetch ─────────────────────────────────────────────────────────────

async function secureFetch(url, options = {}) {
    // Proactively refresh if the token is expired or about to be
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

    // Server-side 401 fallback (clock skew, blacklisted token, etc.)
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

// ─── logout ──────────────────────────────────────────────────────────────────

function logout() {
    if (_proactiveTimer) { clearTimeout(_proactiveTimer); _proactiveTimer = null; }
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