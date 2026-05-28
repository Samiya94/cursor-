/* ═══════════════════════════════════════
   STATE
═══════════════════════════════════════ */
let currentProcessRow = null;
let deleteCallback = null;
let mainChartInstance = null;
let pieChartInstance = null;
const reportChartsInited = { interviewer: false, institute: false, student: false };

let platformDomains = [];

/** Pending schedule PUT after UI confirmation modal */
let _pendingSchedule = null;
let _scheduleSubmitting = false;

function toBackendLocalDateTime(dtLocalValue) {
    if (!dtLocalValue) return null;
    const s = String(dtLocalValue).trim();
    if (s.length === 16) return `${s}:00`;
    return s;
}

/* ═══════════════════════════════════════
   BOOT
═══════════════════════════════════════ */
window.addEventListener('load', async function () {
    if (!await checkAuth('ADMIN')) return;
    loadDashboard();
    initBaseCharts();
});

async function loadDashboard() {
    await Promise.all([
        loadAdminStats(),
        loadPendingInterviewers(),
        loadAllInterviewRequests(),
        loadMonthlyChart(),
        loadRecentActivity(),
        loadPlatformDomains(),
        loadAdminProfile()
    ]);
}

/* ═══════════════════════════════════════
   STATS CARDS
═══════════════════════════════════════ */
async function loadAdminStats() {
    try {
        const res = await secureFetch('/api/admin/stats');
        if (!res || !res.ok) return;
        const data = await res.json();

        setEl('statTotalInstitutes', data.totalInstitutes ?? 0);
        setEl('statTotalInterviewers', data.activeInterviewers ?? data.totalInterviewers ?? 0);
        setEl('statTotalStudents', data.totalStudents ?? 0);
        setEl('statTotalRequests', data.totalRequests ?? 0);
        setEl('statPendingInterviewers', data.pendingInterviewers ?? 0);
        setEl('statConfirmedRequests', data.confirmedRequests ?? 0);
        setEl('statPendingRequests', data.pendingRequests ?? 0);

        // After existing stat assignments:
        const deptCounts = data.deptStudentCounts || {};
        const deptEl = document.getElementById('statDeptStudentCounts');
        if (deptEl) {
        deptEl.innerHTML = Object.entries(deptCounts)
            .map(([dept, cnt]) => `<span class="req-tag">${dept}: <b>${cnt}</b></span>`)
            .join('');
        }

        // Update sidebar badge
        const intBadge = document.getElementById('intBadge');
        if (intBadge) intBadge.textContent = data.pendingInterviewers ?? 0;

    } catch (e) { console.error('Stats error:', e); }
}

function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

/* ═══════════════════════════════════════
   MONTHLY CHART
═══════════════════════════════════════ */
async function loadMonthlyChart() {
    try {
        const res = await secureFetch('/api/admin/monthly-stats');
        if (!res || !res.ok) return;
        const data = await res.json();
        renderMainChart(data.labels, data.counts);
    } catch (e) { console.error('Monthly stats error:', e); }
}

function renderMainChart(labels, counts) {
    const canvas = document.getElementById('mainChart');
    if (!canvas) return;
    if (mainChartInstance) mainChartInstance.destroy();
    mainChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Interview Requests',
                data: counts,
                borderColor: '#1E3A8A',
                backgroundColor: 'rgba(30,58,138,.07)',
                tension: .4,
                fill: true,
                pointBackgroundColor: '#1E3A8A',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function initBaseCharts() {
    const pieCanvas = document.getElementById('pieChart');
    if (pieCanvas) {
        if (pieChartInstance) pieChartInstance.destroy();
        pieChartInstance = new Chart(pieCanvas, {
            type: 'doughnut',
            data: {
                labels: ['Confirmed', 'Pending', 'Completed'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#3B82F6', '#EAB308', '#10B981'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom' } },
                cutout: '65%'
            }
        });
    }
}

async function updatePieChart() {
    try {
        const res = await secureFetch('/api/admin/stats');
        if (!res || !res.ok) return;
        const data = await res.json();
        if (pieChartInstance) {
            const confirmed = data.confirmedRequests ?? 0;
            const pending = data.pendingRequests ?? 0;
            const completed = data.completedRequests ?? 0;
            pieChartInstance.data.datasets[0].data = [confirmed, pending, completed];
            pieChartInstance.update();
        }
    } catch (e) {}
}

/* ═══════════════════════════════════════
   RECENT ACTIVITY (upcoming interviews)
═══════════════════════════════════════ */
async function loadRecentActivity() {
    try {
        const res = await secureFetch('/api/interview-requests/all');
        if (!res || !res.ok) return;
        const requests = await res.json();

        // Recent activity list
        const activityContainer = document.getElementById('recentActivityList');
        if (activityContainer) {
            const recent = [...requests]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5);

            activityContainer.innerHTML = recent.length === 0
                ? '<p style="color:var(--muted);font-size:13px;padding:12px 0;">No activity yet.</p>'
                : recent.map(r => {
                    const colorMap = { CONFIRMED: 'green', PENDING: 'yellow', CANCELLED: 'red', RESCHEDULED: 'blue' };
                    const iconMap = { CONFIRMED: 'fa-check', PENDING: 'fa-clock', CANCELLED: 'fa-xmark', RESCHEDULED: 'fa-rotate' };
                    const color = colorMap[r.status] || 'blue';
                    const icon = iconMap[r.status] || 'fa-circle-info';
                    const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
                    return `<div class="activity-item">
                        <div class="activity-dot ${color}"><i class="fa-solid ${icon}"></i></div>
                        <div>
                            <div class="activity-text">Interview request from <b>${r.instituteName || 'Unknown'}</b> — ${r.departmentName || ''}</div>
                            <div class="activity-time">${date}</div>
                        </div>
                    </div>`;
                }).join('');
        }

        // Upcoming interviews list
        const upcomingContainer = document.getElementById('upcomingInterviewsList');
        if (upcomingContainer) {
            const upcoming = requests
                .filter(r => r.status === 'CONFIRMED' && r.scheduledDate)
                .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))
                .slice(0, 3);

            upcomingContainer.innerHTML = upcoming.length === 0
                ? '<p style="color:var(--muted);font-size:13px;padding:12px 0;">No upcoming interviews scheduled.</p>'
                : upcoming.map(r => {
                    const d = new Date(r.scheduledDate);
                    const mon = d.toLocaleString('en', { month: 'short' }).toUpperCase();
                    const day = d.getDate();
                    const time = d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
                    return `<div style="display:flex;align-items:center;gap:12px;padding:12px;background:#F8FAFC;border-radius:10px;border-left:3px solid var(--secondary);margin-bottom:8px;">
                        <div style="text-align:center;min-width:36px;">
                            <div style="font-size:10px;color:var(--muted);">${mon}</div>
                            <div style="font-size:19px;font-weight:800;color:var(--primary);line-height:1;">${day}</div>
                        </div>
                        <div>
                            <b style="font-size:13px;">${r.instituteName || 'Unknown'}</b>
                            <div style="font-size:12px;color:var(--muted);">${r.departmentName || ''} · ${time}</div>
                        </div>
                        <span class="badge bg-success" style="margin-left:auto;">Confirmed</span>
                    </div>`;
                }).join('');
        }

        updatePieChart();
    } catch (e) { console.error('Activity error:', e); }
}

/* ═══════════════════════════════════════
   PENDING INTERVIEWERS
═══════════════════════════════════════ */
async function loadPendingInterviewers() {
    try {
        const res = await secureFetch('/api/admin/interviewers/pending');
        if (!res || !res.ok) return;
        let interviewers = [];
        try {
            interviewers = await res.json();
        } catch (e) {
            const txt = await res.text().catch(() => '');
            console.error('Pending interviewers: non-JSON response:', txt);
            return;
        }

        const tbody = document.querySelector('#newInterviewerTable tbody') || document.getElementById('newInterviewerTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (interviewers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:16px;">No pending registrations</td></tr>';
        } else {
            interviewers.forEach(iv => {
                const name = iv.fullName || 'Unknown';
                const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                const email = iv.user?.email || '—';
                const row = document.createElement('tr');
                row.setAttribute('data-name', name);
                row.setAttribute('data-domain', iv.domain || '');
                row.setAttribute('data-exp', iv.experience || '');
                row.setAttribute('data-phone', iv.phone || '');
                row.setAttribute('data-email', email);
                row.setAttribute('data-bio', iv.bio || '');
                row.setAttribute('data-linkedin', iv.linkedin || '');
                row.setAttribute('data-loc', iv.location || '');
                row.setAttribute('data-resume', iv.resumeUrl || '');
                row.setAttribute('data-id', iv.id || '');
                row.setAttribute('data-jobtitle', iv.jobTitle || '');
                row.setAttribute('data-company', iv.company || '');
                row.setAttribute('data-qualification', iv.qualification || '');
                row.setAttribute('data-skills', (iv.skills || []).join(','));
                row.setAttribute('data-interview-exp', iv.interviewExperience || '');
                row.innerHTML = `
                    <td><div style="display:flex;align-items:center;gap:10px;">
                        <div style="width:34px;height:34px;border-radius:50%;background:#EFF6FF;color:var(--primary);display:grid;place-items:center;font-weight:800;font-size:12px;">${initials}</div>
                        <b>${name}</b></div></td>
                    <td style="font-size:12px;color:var(--muted);">${email}</td>
                    <td>${iv.domain || '—'}</td>
                    <td>${iv.experience || '—'}</td>
                    <td>${iv.location || '—'}</td>
                    <td><span class="badge bg-pending">Pending</span></td>
                    <td><div style="display:flex;gap:5px;flex-wrap:wrap;">
                        <button class="btn btn-info btn-sm" onclick="openRegProfileModal(this.closest('tr'))">
                            <i class="fa-solid fa-eye"></i> Profile</button>
                        <button class="btn btn-s btn-sm" onclick="approveInterviewerById(${iv.id},'${name}','${iv.domain || ''}','${initials}','${iv.location || ''}')">
                            <i class="fa-solid fa-check"></i> Approve</button>
                        <button class="btn btn-reject btn-sm" onclick="rejectInterviewerById(${iv.id},'${name}')">
                            <i class="fa-solid fa-xmark"></i> Reject</button>
                    </div></td>`;
                tbody.appendChild(row);
            });
        }

        const countEl = document.getElementById('pendingIntCount');
        const badgeEl = document.getElementById('intBadge');
        if (countEl) countEl.textContent = interviewers.length + ' Pending';
        if (badgeEl) badgeEl.textContent = interviewers.length;

    } catch (e) { console.error('Pending interviewers error:', e); }
}

function ensureUrl(url) {
    if (!url || url === '#') return '';
    url = url.trim();
    if (!/^https?:\/\//i.test(url)) return 'https://' + url;
    return url;
}

function openRegProfileModal(row) {
    const d = row.dataset;
    const name = d.name || '—';
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const resumeUrl = d.resume || '';
    const resumeFileName = resumeUrl ? resumeUrl.split('/').pop() : '';

    const detailsHtml = `
        <div class="profile-banner">
            <div class="profile-banner-avatar">${initials}</div>
            <div>
                <h3 style="font-size:15px;">${name}</h3>
                <p style="font-size:12.5px;opacity:.8;">${d.jobtitle || d.domain || '—'}${d.company ? ' · ' + d.company : ''} · ${d.exp || '—'} yrs exp</p>
            </div>
        </div>
        <div class="detail-grid">
            <div class="detail-item"><span>Email</span><b>${d.email || '—'}</b></div>
            <div class="detail-item"><span>Phone</span><b>${d.phone || '—'}</b></div>
            <div class="detail-item"><span>Location</span><b>${d.loc || '—'}</b></div>
            <div class="detail-item"><span>LinkedIn</span><b>${ensureUrl(d.linkedin) ? `<a href="${ensureUrl(d.linkedin)}" target="_blank" rel="noopener noreferrer" style="color:var(--secondary);">View Profile</a>` : '—'}</b></div>
            ${d.qualification ? `<div class="detail-item"><span>Qualification</span><b>${d.qualification}</b></div>` : ''}
            ${d.domain ? `<div class="detail-item"><span>Domain</span><b>${d.domain}</b></div>` : ''}
        </div>
        ${d.bio ? `<div style="background:#F8FAFC;border-radius:8px;padding:12px;margin-bottom:10px;">
            <div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:5px;">Bio</div>
            <p style="font-size:13px;line-height:1.6;">${d.bio}</p>
        </div>` : ''}
        ${d.skills ? `<div style="background:#F8FAFC;border-radius:8px;padding:12px;margin-bottom:10px;">
            <div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:8px;">Skills</div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;">${d.skills.split(',').filter(Boolean).map(s => `<span class="req-tag">${s.trim()}</span>`).join('')}</div>
        </div>` : ''}
        ${d.interviewexp ? `<div style="background:#F0F9FF;border-radius:8px;padding:12px;border-left:3px solid var(--secondary);">
            <div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:5px;">Interview Experience</div>
            <p style="font-size:13px;line-height:1.6;">${d.interviewexp}</p>
        </div>` : ''}`;

    document.getElementById('regProfileContent').innerHTML = wrapDetailsWithResume(detailsHtml, resumeUrl, resumeFileName, { height: '480px' });

    const ivId = d.id;
    document.getElementById('regProfileActions').innerHTML = `
        <button class="btn btn-s" style="flex:1;justify-content:center;" onclick="approveInterviewerById(${ivId},'${name}','${d.domain || ''}','${initials}','${d.loc || ''}');closeOverlay('regProfileModal');"><i class="fa-solid fa-check"></i> Approve</button>
        <button class="btn btn-reject" style="flex:1;justify-content:center;" onclick="rejectInterviewerById(${ivId},'${name}');closeOverlay('regProfileModal');"><i class="fa-solid fa-xmark"></i> Reject</button>
        <button class="btn btn-outline" onclick="closeOverlay('regProfileModal')">Close</button>`;
    openOverlay('regProfileModal');
}

async function approveInterviewerById(id, name, domain, initials, loc) {
    try {
        const res = await secureFetch(`/api/admin/interviewers/${id}/approve`, { method: 'PUT' });
        if (res && res.ok) {
            showToast(`✓ ${name} approved`);
            await loadPendingInterviewers();
            await loadActiveInterviewers();
            await loadAdminStats();
        } else { showToast('Failed to approve', 'error'); }
    } catch (e) { showToast('Error', 'error'); }
}

async function rejectInterviewerById(id, name) {
    try {
        const res = await secureFetch(`/api/admin/interviewers/${id}/reject`, { method: 'PUT' });
        if (res && res.ok) {
            showToast(`${name} rejected`, 'warn');
            await loadPendingInterviewers();
            await loadAdminStats();
        } else { showToast('Failed to reject', 'error'); }
    } catch (e) { showToast('Error', 'error'); }
}


function toggleReschedule(){
    const fields = document.getElementById('rescheduleFields');
    const toggle = document.getElementById('rescheduleToggle');
    const label  = document.getElementById('rescheduleLabel');
    const checked = toggle && toggle.checked;
    if (fields) fields.style.display = checked ? 'block' : 'none';
    if (label) {
        label.style.background   = checked ? '#EFF6FF' : '#F8FAFC';
        label.style.borderColor  = checked ? '#93C5FD' : '#E2E8F0';
        label.style.color        = checked ? 'var(--primary)' : 'inherit';
    }
}
/* ═══════════════════════════════════════
   ACTIVE INTERVIEWERS TABLE
═══════════════════════════════════════ */
async function loadActiveInterviewers() {
    try {
        const res = await secureFetch('/api/admin/interviewers/active');
        if (!res || !res.ok) return;
        let interviewers = [];
        try {
            interviewers = await res.json();
        } catch (e) {
            const txt = await res.text().catch(() => '');
            console.error('Active interviewers: non-JSON response:', txt);
            return;
        }

        const tbody = document.querySelector('#platformInterviewerTable tbody') || document.getElementById('platformInterviewerTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (interviewers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:16px;">No active interviewers yet</td></tr>';
            return;
        }

        interviewers.forEach(iv => {
            const name = iv.fullName || 'Unknown';
            const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            const isActive = iv.user?.status === 'ACTIVE';
            const row = document.createElement('tr');
            const resolvedPhotoUrl = iv.profilePhotoUrl ? (iv.profilePhotoUrl.startsWith('/') || iv.profilePhotoUrl.startsWith('http') ? iv.profilePhotoUrl : '/uploads/' + iv.profilePhotoUrl) : '';
            
            row.setAttribute('data-status', isActive ? 'active' : 'inactive');
            row.setAttribute('data-name', name);
            row.setAttribute('data-domain', iv.domain || '');
            row.setAttribute('data-loc', iv.location || '—');
            row.setAttribute('data-email', iv.user?.email || '—');
            row.setAttribute('data-exp', iv.experience || '—');
            row.setAttribute('data-phone', iv.phone || '—');
            row.setAttribute('data-bio', iv.bio || '—');
            row.setAttribute('data-interviews', iv.interviewsConducted || '0');
            row.setAttribute('data-rating', iv.averageRating > 0 ? iv.averageRating : '—');
            row.setAttribute('data-id', iv.id);
            row.setAttribute('data-resume', iv.resumeUrl || '');
            row.setAttribute('data-linkedin', iv.linkedin || '');
            row.setAttribute('data-jobtitle', iv.jobTitle || '');
            row.setAttribute('data-company', iv.company || '');
            row.setAttribute('data-qualification', iv.qualification || '');
            row.setAttribute('data-skills', (iv.skills || []).join(','));
            row.setAttribute('data-interview-exp', iv.interviewExperience || '');
            row.setAttribute('data-profilephoto', resolvedPhotoUrl);
            
            const avatarHtml = resolvedPhotoUrl 
                ? `<img src="${resolvedPhotoUrl}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` 
                : initials;

            row.innerHTML = `
                <td><div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:34px;height:34px;border-radius:50%;background:#EFF6FF;color:var(--primary);display:grid;place-items:center;font-weight:800;font-size:12px;flex-shrink:0;overflow:hidden;">${avatarHtml}</div>
                    <b>${name}</b></div></td>
                <td style="font-size:12px;color:var(--muted);">${iv.location || '—'}</td>
                <td>${iv.domain || '—'}</td>
                <td>—</td>
                <td><span style="color:#EAB308;font-weight:700;">★ ${iv.averageRating > 0 ? iv.averageRating : '—'}</span></td>
                <td><span class="badge ${isActive ? 'bg-success' : 'bg-danger'} status-badge">${isActive ? 'Active' : 'Inactive'}</span></td>
                <td><div style="display:flex;gap:5px;flex-wrap:wrap;">
                    <button class="btn btn-info btn-sm" onclick="openPlatformProfileModalFromRow(this.closest('tr'))"><i class="fa-solid fa-eye"></i> View</button>
                    <button class="btn ${isActive ? 'btn-deactivate' : 'btn-activate'} btn-sm" onclick="toggleInterviewerStatus(this.closest('tr'))"><i class="fa-solid fa-${isActive ? 'pause' : 'play'}"></i> ${isActive ? 'Deactivate' : 'Activate'}</button>
                    <button class="btn btn-delete-int btn-sm" onclick="deleteInterviewerRow(this.closest('tr'),'${name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-trash"></i></button>
                </div></td>`;
            tbody.appendChild(row);
        });
        syncInterviewerCards();
    } catch (e) { console.error('Active interviewers error:', e); }
}

/* ═══════════════════════════════════════
   ALL INTERVIEWS (REALTIME)
═══════════════════════════════════════ */
let allAdminRequestsCache = [];
let interviewDetailsCache = {};
let assignInterviewerReqId = null;

async function getActiveInterviewersList() {
    try {
        const res = await secureFetch('/api/admin/interviewers/active');
        if (!res || !res.ok) return [];
        const data = await res.json();
        // Normalize: ensure fullName is always resolved
        return data.map(iv => ({
            ...iv,
            fullName: iv.fullName || iv.name
                   || (iv.user && (iv.user.fullName || iv.user.name || iv.user.email))
                   || 'Interviewer',
            domain: iv.domain || 'General'
        }));
    } catch (e) {
        console.error('getActiveInterviewersList error:', e);
        return [];
    }
}

async function loadAllInterviewsTable() {
    try {
        // Reuse cached list if we already fetched it via requests tab.
        const requests = allAdminRequestsCache.length
            ? allAdminRequestsCache
            : await (await secureFetch('/api/interview-requests/all')).json();

        if (!requests || !requests.length) {
            const tbody = document.querySelector('#interviewsTable tbody') || document.getElementById('interviewsTableBody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:16px;">No interviews yet.</td></tr>';
            return;
        }

        const tbody = document.querySelector('#interviewsTable tbody') || document.getElementById('interviewsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        requests.forEach(req => {
            let rowStatus = 'pending';
            if (req.status === 'COMPLETED') rowStatus = 'completed';
            else if (req.status === 'CONFIRMED' || req.status === 'RESCHEDULED') rowStatus = 'upcoming';

            const institute = req.instituteName || '—';
            const interviewerName = req.assignedInterviewerName || '—';
            const domainTags = (req.expertise || []).map(e => `<span class="req-tag">${e}</span>`).join('') || '';

            const dt = req.scheduledDate ? new Date(req.scheduledDate) : (req.startDate ? new Date(req.startDate) : null);
            const dateStr = dt ? dt.toLocaleDateString('en', { month: 'short', day: '2-digit', year: 'numeric' }) : '—';
            const timeStr = dt ? dt.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : '';

            const studentsVal = (req.numberOfStudentsRequired !== null && req.numberOfStudentsRequired !== undefined)
                ? req.numberOfStudentsRequired
                : '—';
            let statusBadgeClass = 'bg-pending';
            let statusBadgeText = 'Pending';
            if (req.status === 'COMPLETED') {
                statusBadgeClass = 'bg-success';
                statusBadgeText = 'Completed';
            } else if (req.status === 'CONFIRMED' || req.status === 'RESCHEDULED') {
                statusBadgeClass = 'bg-blue';
                statusBadgeText = 'Upcoming';
            } else if (req.status === 'CANCELLED') {
                statusBadgeClass = 'bg-danger';
                statusBadgeText = 'Cancelled';
            } else if (req.status === 'AWAITING_CONFIRMATION') {
                statusBadgeClass = 'bg-pending';
                statusBadgeText = 'Awaiting Confirmation';
            }

            const actionObj = {
                institute: institute,
                interviewers: interviewerName,
                domain: (req.expertise && req.expertise.length) ? req.expertise.join(', ') : '—',
                date: dateStr,
                time: timeStr,
                students: studentsVal,
                status: rowStatus,
                venue: req.scheduledVenue || '—',
                departments: req.departmentName || '—'
            };

            const tr = document.createElement('tr');
            tr.setAttribute('data-status', rowStatus);

            // Cache details for this request to avoid risky JSON-in-onclick escaping.
            interviewDetailsCache[req.id] = actionObj;
            tr.innerHTML = `
                <td><b>${institute}</b></td>
                <td>${interviewerName}</td>
                <td>${domainTags || '—'}</td>
                <td style="white-space:nowrap;">${dateStr}${timeStr ? ' · ' + timeStr : ''}</td>
                <td>${studentsVal}</td>
                <td><span class="badge ${statusBadgeClass}">${statusBadgeText}</span></td>
                <td>
                  <button class="btn btn-info btn-sm"
                    onclick="openInterviewDetailsModal(${req.id})">
                    <i class="fa-solid fa-eye"></i> Details
                  </button>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error('loadAllInterviewsTable error:', e);
    }
}

function openInterviewDetailsModal(requestId) {
    const d = interviewDetailsCache[requestId] || {};

    const content = document.getElementById('interviewDetailsContent');
    if (!content) return;

    content.innerHTML = `
        <div class="detail-grid">
            <div class="detail-item"><span>Institute</span><b>${d.institute || '—'}</b></div>
            <div class="detail-item"><span>Department</span><b>${d.departments || '—'}</b></div>
            <div class="detail-item"><span>Interviewers</span><b>${d.interviewers || '—'}</b></div>
            <div class="detail-item"><span>Domain</span><b>${d.domain || '—'}</b></div>
            <div class="detail-item"><span>Date</span><b>${d.date || '—'}</b></div>
            <div class="detail-item"><span>Time</span><b>${d.time || '—'}</b></div>
            <div class="detail-item"><span>Venue</span><b>${d.venue || '—'}</b></div>
            <div class="detail-item"><span>Students Required</span><b>${d.students ?? '—'}</b></div>
        </div>`;

    openOverlay('interviewDetailsModal');
}

/* ═══════════════════════════════════════
   ALL INTERVIEW REQUESTS
═══════════════════════════════════════ */
async function loadAllInterviewRequests() {
    try {
        const res = await secureFetch('/api/interview-requests/all');
        if (!res || !res.ok) return;
        const requests = await res.json();

        // Cache for the "All Interviews" tab to avoid extra requests and keep data consistent.
        allAdminRequestsCache = requests || [];

        // Update sidebar badge
        const instBadge = document.getElementById('instBadge');
        const pending = requests.filter(r => r.status === 'PENDING').length;
        if (instBadge) instBadge.textContent = pending;

        const tbody = document.querySelector('#requestTable tbody') || document.getElementById('requestTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:16px;">No interview requests yet</td></tr>';
            return;
        }

        requests.forEach(req => {
            const statusClass = {
                'PENDING': 'bg-pending', 'CONFIRMED': 'bg-blue',
                'RESCHEDULED': 'bg-blue', 'CANCELLED': 'bg-danger',
                'AWAITING_CONFIRMATION': 'bg-warning', 'COMPLETED': 'bg-success'
            }[req.status] || 'bg-pending';
            const statusLabel = {
                'PENDING': 'Pending', 'CONFIRMED': 'Confirmed',
                'RESCHEDULED': 'Rescheduled', 'CANCELLED': 'Cancelled',
                'AWAITING_CONFIRMATION': 'Awaiting Confirmation',
                'COMPLETED': 'Completed'
            }[req.status] || req.status;

            const expertiseTags = (req.expertise || []).map(e => `<span class="req-tag">${e}</span>`).join('');
            const startDate = req.startDate ? new Date(req.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
            const endDate = req.endDate ? new Date(req.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

            const row = document.createElement('tr');
            row.setAttribute('data-status', req.status.toLowerCase());
            row.setAttribute('data-req-id', req.id);
            row.setAttribute('data-inst', req.instituteName || '');
            row.setAttribute('data-domains', (req.expertise || []).join(', '));
            row.setAttribute('data-depts', req.departmentName || '');
            row.setAttribute('data-start', startDate);
            row.setAttribute('data-end', endDate);
            row.setAttribute('data-contact', req.contactEmail || '');

            const actionBtn = req.status === 'PENDING'
                ? `<button class="btn btn-s btn-sm" onclick="openProcessModal(${req.id})"><i class="fa-solid fa-gear"></i> Process</button>`
                : '';

            row.innerHTML = `
                <td><div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:36px;height:36px;border-radius:8px;background:#EFF6FF;color:var(--primary);display:grid;place-items:center;font-weight:800;font-size:11px;flex-shrink:0;">
                        ${(req.instituteName || 'UN').substring(0, 3).toUpperCase()}
                    </div>
                    <div><b style="display:block;font-size:13px;">${req.instituteName || 'Unknown'}</b>
                    <span style="font-size:11px;color:var(--muted);">Submitted: ${startDate}</span></div>
                </div></td>
                <td>${expertiseTags || '—'}</td>
                <td>${req.departmentName || '—'}</td>
                <td style="font-size:12px;white-space:nowrap;">${startDate} – ${endDate}</td>
                <td><span class="badge ${statusClass}">${statusLabel}</span></td>
                <td><div style="display:flex;gap:5px;flex-wrap:wrap;">
                    ${actionBtn}
                    <button class="btn btn-info btn-sm" onclick="viewApplicants(${req.id})"><i class="fa-solid fa-users"></i> Applicants</button>
                </div></td>`;
            tbody.appendChild(row);
        });

    } catch (e) { console.error('Interview requests error:', e); }
}

/* ═══════════════════════════════════════
   SCHEDULE MODAL
═══════════════════════════════════════ */
// async function openScheduleModal(reqId, instituteName, dept, domains) {
//     const ivs = await getActiveInterviewersList();
//     const interviewerChecklist = ivs.length
//         ? ivs.map(iv => `<label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;"><input type="checkbox" class="schedule-iv-cb" value="${iv.id}"><span>${iv.fullName || 'Interviewer'} <span style="color:var(--muted);font-size:12px;">(${iv.domain || 'General'})</span></span></label>`).join('')
//         : '<div style="color:var(--muted);font-size:12px;">No active interviewers available.</div>';

//     document.getElementById('processInstInfo').innerHTML = `
//         <div class="detail-item"><span>Institute</span><b>${instituteName}</b></div>
//         <div class="detail-item"><span>Department</span><b>${dept}</b></div>
//         <div class="detail-item"><span>Domains</span><b>${domains}</b></div>
//         <div style="margin-top:16px;">
//             <label style="font-size:12px;font-weight:600;">Scheduled Date &amp; Time *</label>
//             <input type="datetime-local" id="schedDate" style="width:100%;margin-top:4px;padding:8px;border:1px solid #E2E8F0;border-radius:6px;">
//         </div>
//         <div style="margin-top:10px;">
//             <label style="font-size:12px;font-weight:600;">Venue / Location</label>
//             <input type="text" id="schedVenue" placeholder="e.g. Online / Campus Hall A" style="width:100%;margin-top:4px;padding:8px;border:1px solid #E2E8F0;border-radius:6px;">
//         </div>
//         <div style="margin-top:10px;">
//             <label style="font-size:12px;font-weight:600;">Meeting Link (if online)</label>
//             <input type="text" id="schedMeetLink" placeholder="https://meet.google.com/..." style="width:100%;margin-top:4px;padding:8px;border:1px solid #E2E8F0;border-radius:6px;">
//         </div>
//         <div style="margin-top:10px;">
//             <label style="font-size:12px;font-weight:600;">Number of Students Required</label>
//             <input type="number" id="schedStudentCount" min="1" value="10" style="width:100%;margin-top:4px;padding:8px;border:1px solid #E2E8F0;border-radius:6px;">
//         </div>
//         <div style="margin-top:10px;">
//             <label style="font-size:12px;font-weight:600;">Assign Interviewers (Multiple)</label>
//             <div style="margin-top:6px;max-height:140px;overflow:auto;border:1px solid #E2E8F0;border-radius:6px;padding:8px;">
//                 ${interviewerChecklist}
//             </div>
//         </div>
//         <div style="margin-top:16px;display:flex;gap:10px;">
//             <button class="btn btn-s" style="flex:1;justify-content:center;" onclick="confirmSchedule(${reqId})">
//                 <i class="fa-solid fa-calendar-check"></i> Confirm Schedule</button>
//             <button class="btn btn-outline" onclick="closeOverlay('processModal')">Cancel</button>
//         </div>`;

//     document.getElementById('interviewerChecklist').innerHTML = '';
//     document.getElementById('interviewerChecklist').style.display = 'none';
//     document.getElementById('noMatchMsg').style.display = 'none';
//     document.getElementById('domainFilterNote').textContent = '';
//     openOverlay('processModal');
// }
async function openProcessModal(reqId) {
    assignInterviewerReqId = null;

    let req = allAdminRequestsCache.find(r => r.id === reqId);
    if (!req) {
        try {
            const r = await secureFetch('/api/interview-requests/all');
            if (r && r.ok) { allAdminRequestsCache = await r.json(); req = allAdminRequestsCache.find(r => r.id === reqId); }
        } catch(e) {}
    }
    if (!req) { showToast('Request not found', 'error'); return; }

    const ivs = await getActiveInterviewersList();
    const requestedDomains = (req.expertise || []).map(d => d.toLowerCase().trim());

    const domainMatches = (ivDomain) => {
        const d = (ivDomain || '').toLowerCase().trim();
        if (!d) return false;
        // 1. Exact match
        if (requestedDomains.includes(d)) return true;
        // 2. One fully contains the other
        if (requestedDomains.some(r => r.includes(d) || d.includes(r))) return true;
        // 3. Keyword overlap — split on non-alpha and check significant words (len > 2)
        const ivWords = d.split(/[^a-z0-9]+/).filter(w => w.length > 2);
        return requestedDomains.some(r => {
            const rWords = r.split(/[^a-z0-9]+/).filter(w => w.length > 2);
            return ivWords.some(w => rWords.includes(w));
        });
    };

    const matchedIvs = ivs.filter(iv => domainMatches(iv.domain));
    const otherIvs   = ivs.filter(iv => !matchedIvs.includes(iv));

    // Populate institute info section (read-only)
    const startDate = req.startDate ? new Date(req.startDate).toLocaleString('en-IN', {day:'2-digit',month:'short',year:'numeric'}) : '—';
    const endDate   = req.endDate   ? new Date(req.endDate).toLocaleString('en-IN',   {day:'2-digit',month:'short',year:'numeric'}) : '—';
    const studentCount = req.registeredStudentsCount ?? req.numberOfStudentsRequired ?? '—';

    document.getElementById('processInstInfo').innerHTML = `
        <div class="detail-item"><span>Institute</span><b>${req.instituteName || '—'}</b></div>
        <div class="detail-item"><span>Department</span><b>${req.departmentName || '—'}</b></div>
        <div class="detail-item"><span>Domains Requested</span><b>${(req.expertise||[]).join(', ')||'—'}</b></div>
        <div class="detail-item"><span>Contact Email</span><b>${req.contactEmail || '—'}</b></div>
        <div class="detail-item"><span>Requested Dates</span><b>${startDate} – ${endDate}</b></div>
        <div class="detail-item" style="background:#EFF6FF;border:1.5px solid #BFDBFE;">
          <span style="color:var(--primary);">Students Count</span>
          <b style="color:var(--primary);font-size:17px;">${studentCount}</b>
        </div>`;

    // Pre-fill student count field
    const studentCountInput = document.getElementById('schedStudentCount');
    if (studentCountInput && studentCount !== '—') studentCountInput.value = studentCount;

    // Populate interviewer checklist
    const checklistEl = document.getElementById('interviewerChecklist');
    const noMatchEl = document.getElementById('noMatchMsg');
    const noteEl = document.getElementById('domainFilterNote');

    const buildIvRow = (iv, isMatched) => `
        <label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:7px;background:${isMatched?'#EFF6FF':'#F8FAFC'};border:1.5px solid ${isMatched?'#BFDBFE':'#E2E8F0'};cursor:pointer;margin-bottom:6px;transition:background .15s;">
            <input type="checkbox" class="schedule-iv-cb" value="${iv.id}" style="width:15px;height:15px;accent-color:var(--primary);flex-shrink:0;" ${isMatched?'checked':''}>
            <span style="font-size:13px;font-weight:600;flex:1;">${iv.fullName || iv.name || (iv.user && (iv.user.fullName || iv.user.name)) || 'Interviewer'}</span>
            <span style="font-size:11.5px;color:var(--secondary);background:${isMatched?'#DBEAFE':'#F1F5F9'};padding:2px 8px;border-radius:20px;font-weight:600;">${iv.domain || 'General'}</span>
        </label>`;

    if (ivs.length) {
        let html = '';
        if (matchedIvs.length) {
            html += matchedIvs.map(iv => buildIvRow(iv, true)).join('');
        }
        if (otherIvs.length) {
            if (matchedIvs.length) {
                html += `<div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:10px 0 6px;padding-top:6px;border-top:1px dashed #E2E8F0;">Other Interviewers</div>`;
            }
            html += otherIvs.map(iv => buildIvRow(iv, false)).join('');
        }
        checklistEl.innerHTML = html;
        checklistEl.style.display = 'block';
        noMatchEl.style.display = 'none';
        noteEl.textContent = matchedIvs.length
            ? `— ${matchedIvs.length} match${matchedIvs.length>1?'es':''} for: ${(req.expertise||[]).join(', ')}`
            : '— no domain match, showing all';
    } else {
        checklistEl.innerHTML = '';
        checklistEl.style.display = 'none';
        noMatchEl.style.display = 'block';
        noteEl.textContent = '';
    }

    const toggle = document.getElementById('rescheduleToggle');
    if (toggle) toggle.checked = false;
    const schedFields = document.getElementById('rescheduleFields');
    if (schedFields) schedFields.style.display = 'none';

    window._currentProcessReqSummary = {
        institute: req.instituteName || '—',
        department: req.departmentName || '—'
    };
    window._currentProcessReqId = reqId;
    openOverlay('processModal');
}

function requestScheduleConfirmation(reqId) {
    const errBox = document.getElementById('scheduleConfirmError');
    if (errBox) {
        errBox.style.display = 'none';
        errBox.textContent = '';
    }

    const id = reqId || window._currentProcessReqId;
    if (id == null || id === '') {
        showToast('No request selected.', 'warn');
        return;
    }

    if (assignInterviewerReqId != null) {
        showToast('Use “Confirm Assignment” in the panel above for this step.', 'warn');
        return;
    }

    const hasScheduleBoxes = document.querySelectorAll('.schedule-iv-cb').length > 0;
    const selectedInterviewerIds = [...document.querySelectorAll('.schedule-iv-cb:checked')]
        .map(cb => parseInt(cb.value, 10)).filter(Number.isFinite);

    if (hasScheduleBoxes && selectedInterviewerIds.length === 0) {
        showToast('Please select at least one interviewer.', 'warn');
        return;
    }

    const isReschedule = document.getElementById('rescheduleToggle')?.checked;
    const newStart = document.getElementById('startDateTime')?.value;
    const newEnd = document.getElementById('endDateTime')?.value;

    if (isReschedule && !newStart) {
        showToast('Please select a new start date/time', 'warn');
        return;
    }

    let req = allAdminRequestsCache.find(r => r.id === id);

    const payload = { assignedInterviewerIds: selectedInterviewerIds };

    if (!isReschedule && req?.startDate) {
        const sd = req.startDate;
        if (typeof sd === 'string') {
            payload.scheduledDate = sd;
        } else if (sd) {
            const d = new Date(sd);
            if (!Number.isNaN(d.getTime())) payload.scheduledDate = d.toISOString();
        }
    }

    if (isReschedule) {
        const sd = toBackendLocalDateTime(newStart);
        const ed = toBackendLocalDateTime(newEnd);
        if (sd) payload.startDate = sd;
        if (ed) payload.endDate = ed;
    }

    const endpoint = isReschedule
        ? `/api/interview-requests/${id}/reschedule`
        : `/api/interview-requests/${id}/schedule`;

    const sum = window._currentProcessReqSummary || {};
    const titleEl = document.getElementById('scheduleConfirmTitle');
    const msgEl = document.getElementById('scheduleConfirmMessage');
    if (titleEl) titleEl.textContent = isReschedule ? 'Confirm reschedule' : 'Confirm schedule';

    const lines = [
        isReschedule
            ? 'You are about to reschedule this interview window. The institute must confirm again.'
            : 'You are about to send this slot for institute confirmation.',
        '',
        `Institute: ${sum.institute || '—'}`,
        `Department: ${sum.department || '—'}`,
        `Interviewers assigned: ${selectedInterviewerIds.length}`
    ];
    if (isReschedule && newStart) {
        const pretty = (v) =>
            new Date(v.length === 16 ? `${v}:00` : v).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short'
            });
        lines.push('', `New window start: ${pretty(newStart)}`);
        if (newEnd) lines.push(`New window end: ${pretty(newEnd)}`);
    }
    lines.push('', 'Proceed?');

    if (msgEl) msgEl.textContent = lines.join('\n');

    _pendingSchedule = { endpoint, payload, isReschedule };
    openOverlay('scheduleConfirmModal');
}

async function executePendingSchedule() {
    if (!_pendingSchedule || _scheduleSubmitting) return;

    const errBox = document.getElementById('scheduleConfirmError');
    if (errBox) {
        errBox.style.display = 'none';
        errBox.textContent = '';
    }

    _scheduleSubmitting = true;
    const submitBtn = document.getElementById('scheduleConfirmSubmitBtn');
    const cancelBtn = document.getElementById('scheduleConfirmCancelBtn');
    const origSubmitHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
    }
    if (cancelBtn) cancelBtn.disabled = true;

    const { endpoint, payload, isReschedule } = _pendingSchedule;

    try {
        const res = await secureFetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res && res.ok) {
            closeOverlay('scheduleConfirmModal');
            closeOverlay('processModal');
            _pendingSchedule = null;
            showToast(
                isReschedule
                    ? 'Rescheduled! Awaiting institute confirmation.'
                    : 'Scheduled! Awaiting institute confirmation.'
            );
            await loadAllInterviewRequests();
            await loadAdminStats();
            await loadRecentActivity();
            return;
        }

        let msg = 'Could not save. Please try again.';
        if (res) {
            const text = ((await res.text()) || '').trim();
            if (text) {
                try {
                    const j = JSON.parse(text);
                    if (typeof j.message === 'string') msg = j.message;
                    else if (typeof j.detail === 'string') msg = j.detail;
                    else if (typeof j.title === 'string') msg = j.title;
                    else if (typeof j.error === 'string') msg = j.error;
                    else msg = text;
                } catch {
                    const plain = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                    if (plain) msg = plain;
                }
            }
        } else {
            msg = 'Session expired — please log in again.';
        }
        if (errBox) {
            errBox.textContent = msg;
            errBox.style.display = 'block';
        }
        showToast(msg, 'error');
    } catch (e) {
        console.error(e);
        const msg = 'Network error — check your connection and try again.';
        if (errBox) {
            errBox.textContent = msg;
            errBox.style.display = 'block';
        }
        showToast(msg, 'error');
    } finally {
        _scheduleSubmitting = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origSubmitHtml;
        }
        if (cancelBtn) cancelBtn.disabled = false;
    }
}

async function openAssignInterviewerModal(reqId, instituteName, dept, domains) {
    assignInterviewerReqId = reqId;
    const ivs = await getActiveInterviewersList();
    const checklist = ivs.length
        ? ivs.map(iv => `<label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;"><input type="checkbox" class="assign-iv-cb" value="${iv.id}"><span>${iv.fullName || 'Interviewer'} <span style="color:var(--muted);font-size:12px;">(${iv.domain || 'General'})</span></span></label>`).join('')
        : '<div style="color:var(--muted);font-size:12px;">No active interviewers available.</div>';

    document.getElementById('processInstInfo').innerHTML = `
        <div class="detail-item"><span>Institute</span><b>${instituteName}</b></div>
        <div class="detail-item"><span>Department</span><b>${dept}</b></div>
        <div class="detail-item"><span>Domains</span><b>${domains}</b></div>
        <div style="margin-top:10px;">
            <label style="font-size:12px;font-weight:600;">Assign Interviewers (Multiple) *</label>
            <div style="margin-top:6px;max-height:140px;overflow:auto;border:1px solid #E2E8F0;border-radius:6px;padding:8px;">
                ${checklist}
            </div>
        </div>
        <div style="margin-top:16px;display:flex;gap:10px;">
            <button class="btn btn-s" style="flex:1;justify-content:center;" onclick="confirmAssignInterviewer()">
                <i class="fa-solid fa-user-check"></i> Confirm Assignment</button>
            <button class="btn btn-outline" onclick="closeOverlay('processModal')">Cancel</button>
        </div>`;
    document.getElementById('interviewerChecklist').innerHTML = '';
    document.getElementById('interviewerChecklist').style.display = 'none';
    document.getElementById('noMatchMsg').style.display = 'none';
    openOverlay('processModal');
}

async function confirmAssignInterviewer() {
    if (!assignInterviewerReqId) return;
    const interviewerIds = [...document.querySelectorAll('.assign-iv-cb:checked')]
        .map(cb => parseInt(cb.value))
        .filter(Number.isFinite);
    if (!interviewerIds.length) {
        showToast('Please select at least one interviewer', 'warn');
        return;
    }
    try {
        const res = await secureFetch(`/api/interview-requests/${assignInterviewerReqId}/assign-interviewer`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interviewerIds: interviewerIds })
        });
        if (res && res.ok) {
            closeOverlay('processModal');
            showToast('Interviewer assigned successfully!');
            await loadAllInterviewRequests();
            await loadAllInterviewsTable();
            await loadRecentActivity();
        } else {
            const err = await res.text();
            showToast(err || 'Failed to assign interviewer', 'error');
        }
    } catch (e) {
        showToast('Error assigning interviewer', 'error');
    }
}



/* ═══════════════════════════════════════
   APPLICANTS VIEWER
═══════════════════════════════════════ */
async function viewApplicants(requestId) {
    try {
        const res = await secureFetch(`/api/applications/interview/${requestId}`);
        if (!res || !res.ok) { showToast('Could not load applicants', 'warn'); return; }
        const apps = await res.json();

        const html = apps.length === 0
            ? '<p style="color:var(--muted);padding:12px 0;">No applicants yet.</p>'
            : `<table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:#F8FAFC;">
                    <th style="padding:8px;text-align:left;">Name</th>
                    <th style="padding:8px;">Email</th>
                    <th style="padding:8px;">Class (Year &amp; Degree)</th>
                </tr></thead><tbody>
                ${apps.map(a => `<tr style="border-top:1px solid #E2E8F0;">
                    <td style="padding:8px;"><b>${a.studentName || '—'}</b></td>
                    <td style="padding:8px;">${a.studentEmail || '—'}</td>
                    <td style="padding:8px;">${a.studentClass || '—'}</td>
                </tr>`).join('')}
                </tbody></table>`;

        document.getElementById('viewDetailsContent').innerHTML = html;
        openOverlay('viewDetailsModal');
    } catch (e) { showToast('Error loading applicants', 'error'); }
}

async function approveStudentApplication(applicationId, requestId) {
    try {
        const res = await secureFetch(`/api/applications/${applicationId}/approve`, { method: 'PUT' });
        if (res && res.ok) {
            showToast('Application approved');
            await viewApplicants(requestId);
            await loadAdminStats();
        } else {
            const errText = res ? await res.text() : '';
            showToast(errText || 'Failed to approve', 'error');
        }
    } catch (e) { showToast('Error approving application', 'error'); }
}

async function rejectStudentApplication(applicationId, requestId) {
    try {
        const res = await secureFetch(`/api/applications/${applicationId}/reject`, { method: 'PUT' });
        if (res && res.ok) {
            showToast('Application rejected', 'warn');
            await viewApplicants(requestId);
            await loadAdminStats();
        } else {
            const errText = res ? await res.text() : '';
            showToast(errText || 'Failed to reject', 'error');
        }
    } catch (e) { showToast('Error rejecting application', 'error'); }
}

/* ═══════════════════════════════════════
   SIDEBAR & NAVIGATION
═══════════════════════════════════════ */
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('active');
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
}

function showPage(id, el) {
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    if (el) el.classList.add('active');
    else document.querySelectorAll('.nav-links a').forEach(a => {
        if (a.getAttribute('onclick') && a.getAttribute('onclick').includes(`'${id}'`)) a.classList.add('active');
    });
    document.querySelectorAll('.content-body').forEach(d => d.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    const titles = {
        dashboard: 'Dashboard', 'inst-req': 'Institute Requests', 'int-req': 'Interviewers',
        interviews: 'All Interviews', records: 'Video Records', reports: 'Reports', settings: 'Settings'
    };
    document.getElementById('pageTitle').innerText = titles[id] || id;
    document.getElementById('breadcrumbCurrent').innerText = titles[id] || id;
    document.getElementById('notifPanel').classList.remove('open');
    closeUserMenu();
    closeSidebar();

    // When you click the Interviewers tab, refresh both pending + active lists
    // so the sidebar badge and the table never drift out of sync.
    if (id === 'int-req') {
        loadPendingInterviewers();
        loadActiveInterviewers();
    }
    if (id === 'inst-req') loadAllInterviewRequests();
    if (id === 'reports') { initReportCharts('interviewer'); loadReportData('interviewer'); }
    if (id === 'settings') { renderDomainTags(); loadAdminProfile(); loadSettingsInstitutes(); }
    if (id === 'interviews') loadAllInterviewsTable();
    if (id === 'records') loadVideoRecords();
}

/* ═══════════════════════════════════════
   USER MENU & NOTIFICATIONS
═══════════════════════════════════════ */
function toggleUserMenu() { document.getElementById('userDropdown').classList.toggle('open'); }
function closeUserMenu() { document.getElementById('userDropdown').classList.remove('open'); }
async function loadNotifications() {
    const listEl = document.getElementById('notifList');
    if (!listEl) return;
    try {
        const res = await secureFetch('/api/interview-requests/all');
        if (!res || !res.ok) { listEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:13px;">No notifications.</div>'; return; }
        const requests = await res.json();
        const recent = [...requests].sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt)).slice(0,6);
        const cfgMap = {
            PENDING:     { bg:'#EFF6FF', color:'var(--primary)',  icon:'fa-building',      title:'New Institute Request' },
            SCHEDULED:   { bg:'#F0FDF4', color:'var(--success)',  icon:'fa-calendar-check', title:'Interview Scheduled' },
            RESCHEDULED: { bg:'#FEF3C7', color:'#92400E',         icon:'fa-rotate',         title:'Rescheduled' },
            CONFIRMED:   { bg:'#F0FDF4', color:'var(--success)',  icon:'fa-circle-check',   title:'Institute Confirmed' },
            CANCELLED:   { bg:'#FFF1F2', color:'var(--danger)',   icon:'fa-circle-xmark',   title:'Cancelled' }
        };
        const timeAgo = dt => {
            const diff = Date.now() - new Date(dt);
            if (diff < 60000) return 'just now';
            if (diff < 3600000) return Math.floor(diff/60000) + ' min ago';
            if (diff < 86400000) return Math.floor(diff/3600000) + ' hr ago';
            return Math.floor(diff/86400000) + 'd ago';
        };
        listEl.innerHTML = recent.length ? recent.map(r => {
            const cfg = cfgMap[r.status] || cfgMap.PENDING;
            return `<div class="notif-item unread" style="cursor:pointer;" onclick="showPage('inst-req',null);closeNotifPanel()">
                <div class="notif-icon" style="background:${cfg.bg};color:${cfg.color};"><i class="fa-solid ${cfg.icon}"></i></div>
                <div><div style="font-size:13px;font-weight:600;">${cfg.title}</div>
                <div style="font-size:12px;color:var(--muted);">${r.instituteName||'Unknown'} · ${r.departmentName||''} • ${timeAgo(r.updatedAt||r.createdAt)}</div></div>
            </div>`;
        }).join('') : '<div style="padding:16px;text-align:center;color:var(--muted);font-size:13px;">No recent activity.</div>';
        const dot = document.getElementById('notifDot');
        if (dot) dot.style.display = recent.some(r=>r.status==='PENDING') ? 'block' : 'none';
    } catch(e) { console.error('Notifications error',e); }
}

function closeNotifPanel() { document.getElementById('notifPanel').classList.remove('open'); }
function toggleNotif() {
    const panel = document.getElementById('notifPanel');
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) loadNotifications();
}
function markAllRead() {
    document.querySelectorAll('.notif-item.unread').forEach(i => i.classList.remove('unread'));
    document.getElementById('notifDot').style.display = 'none';
    showToast('All notifications marked as read');
}
document.addEventListener('click', function (e) {
    if (!e.target.closest('.user-menu-wrap')) closeUserMenu();
    if (!e.target.closest('.notif-wrap')) document.getElementById('notifPanel').classList.remove('open');
});

/* ═══════════════════════════════════════
   MODAL HELPERS
═══════════════════════════════════════ */
function openOverlay(id) { document.getElementById(id).classList.add('open'); }
function closeOverlay(id) { document.getElementById(id).classList.remove('open'); }

/* ═══════════════════════════════════════
   FILTER TABLE
═══════════════════════════════════════ */
function filterTable(tableId, status, groupId, btn) {
    document.querySelectorAll(`#${groupId} .filter-tab`).forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    let visible = 0;
    tbody.querySelectorAll('tr:not(.empty-row)').forEach(r => {
        const rs = (r.getAttribute('data-status') || '').toLowerCase();
        r.style.display = (status === 'all' || rs === status.toLowerCase()) ? '' : 'none';
        if (r.style.display !== 'none') visible++;
    });
    const ex = tbody.querySelector('.empty-row'); if (ex) ex.remove();
    if (visible === 0) {
        const cols = document.querySelector(`#${tableId} thead tr`).cells.length;
        const er = document.createElement('tr'); er.className = 'empty-row';
        er.innerHTML = `<td colspan="${cols}" style="text-align:center;color:var(--muted);padding:16px;">No records found.</td>`;
        tbody.appendChild(er);
    }
}

/* ═══════════════════════════════════════
   INTERVIEWER VIEW TOGGLE
═══════════════════════════════════════ */
function showInterviewerView(view, btn) {
    document.getElementById('int-table-view').style.display = view === 'table' ? 'block' : 'none';
    document.getElementById('int-cards-view').style.display = view === 'cards' ? 'block' : 'none';
    document.querySelectorAll('.view-toggle button').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    else document.getElementById('viewBtn-' + view).classList.add('active');
    if (view === 'cards') syncInterviewerCards();
}

function syncInterviewerCards() {
    const container = document.getElementById('interviewerCardsContainer');
    if (!container) return;
    container.innerHTML = '';
    document.querySelectorAll('#platformInterviewerTable tbody tr').forEach(row => {
        const name = row.dataset.name || '';
        const domain = row.dataset.domain || '';
        const loc = row.dataset.loc || '—';
        const exp = row.dataset.exp || '—';
        const rating = row.dataset.rating || '—';
        const interviews = row.dataset.interviews || '0';
        const status = row.getAttribute('data-status') || 'active';
        const isActive = status === 'active';
        const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2);
        const card = document.createElement('div');
        card.className = 'int-card';
        card.innerHTML = `
            <div class="int-card-avatar" style="background:${isActive ? '#EFF6FF' : '#FEE2E2'};color:${isActive ? 'var(--primary)' : '#991B1B'};">${initials}</div>
            <h4>${name}</h4>
            <p>${domain} · ${loc}</p>
            <div style="margin-top:8px;display:flex;align-items:center;gap:6px;">
                <span class="badge ${isActive ? 'bg-success' : 'bg-danger'}">${isActive ? 'Active' : 'Inactive'}</span>
                <span style="color:#EAB308;font-weight:700;font-size:12px;">★ ${rating}</span>
            </div>
            <div class="int-card-stats">
                <div class="int-stat"><div class="num">${interviews}</div><div class="lbl">Interviews</div></div>
                <div class="int-stat"><div class="num">${exp}yr</div><div class="lbl">Exp</div></div>
            </div>
            <div style="display:flex;gap:5px;margin-top:10px;">
                <button class="btn btn-info btn-sm" style="flex:1;justify-content:center;" onclick="openPlatformProfileModalFromRow(document.querySelector('#platformInterviewerTable [data-name=\\'${name.replace(/'/g, "\\'")}\\']'))"><i class="fa-solid fa-eye"></i> View</button>
                <button class="btn ${isActive ? 'btn-deactivate' : 'btn-activate'} btn-sm" style="flex:1;justify-content:center;" onclick="toggleInterviewerStatus(document.querySelector('#platformInterviewerTable [data-name=\\'${name.replace(/'/g, "\\'")}\\']'))"><i class="fa-solid fa-${isActive ? 'pause' : 'play'}"></i> ${isActive ? 'Deactivate' : 'Activate'}</button>
            </div>`;
        container.appendChild(card);
    });
}

/* ═══════════════════════════════════════
   INTERVIEWER STATUS TOGGLE
═══════════════════════════════════════ */
async function toggleInterviewerStatus(row) {
    const current = row.getAttribute('data-status');
    const isActive = current === 'active';
    const id = row.getAttribute('data-id');
    const name = row.dataset.name || '';
    const endpoint = isActive ? `/api/admin/interviewers/${id}/deactivate` : `/api/admin/interviewers/${id}/activate`;
    try {
        const res = await secureFetch(endpoint, { method: 'PUT' });
        if (!res || !res.ok) { showToast('Failed to update status', 'error'); return; }
        const newStatus = isActive ? 'inactive' : 'active';
        row.setAttribute('data-status', newStatus);
        const badge = row.querySelector('.status-badge');
        if (badge) { badge.className = 'badge ' + (isActive ? 'bg-danger' : 'bg-success') + ' status-badge'; badge.innerText = isActive ? 'Inactive' : 'Active'; }
        const toggleBtn = row.querySelector('.btn-deactivate,.btn-activate');
        if (toggleBtn) {
            toggleBtn.className = 'btn ' + (isActive ? 'btn-activate' : 'btn-deactivate') + ' btn-sm';
            toggleBtn.innerHTML = isActive ? '<i class="fa-solid fa-play"></i> Activate' : '<i class="fa-solid fa-pause"></i> Deactivate';
        }
        showToast(`${name} ${isActive ? 'deactivated' : 'activated'}`, isActive ? 'warn' : 'success');
        syncInterviewerCards();
    } catch (e) { showToast('Error updating status', 'error'); }
}

/* ═══════════════════════════════════════
   DELETE INTERVIEWER
═══════════════════════════════════════ */
function deleteInterviewerRow(row, name) {
    const id = row.getAttribute('data-id');
    deleteCallback = async () => {
        try {
            const res = await secureFetch(`/api/admin/interviewers/${id}`, { method: 'DELETE' });
            if (res && res.ok) {
                row.remove();
                showToast(`${name} deleted`, 'warn');
                syncInterviewerCards();
                loadAdminStats();
            } else {
                showToast('Failed to delete interviewer', 'error');
            }
        } catch (e) { showToast('Error deleting interviewer', 'error'); }
    };
    document.getElementById('deleteMsg').innerText = `Delete interviewer "${name}"? This cannot be undone.`;
    document.getElementById('deleteConfirmBtn').onclick = () => { closeOverlay('deleteModal'); deleteCallback && deleteCallback(); };
    openOverlay('deleteModal');
}

/* ═══════════════════════════════════════
   PLATFORM PROFILE MODAL
═══════════════════════════════════════ */
async function openPlatformProfileModalFromRow(row) {
    if (!row) return;
    const id = row.getAttribute('data-id') || '';
    
    // Fetch dynamic stats from backend
    let details = { interviewsConducted: row.dataset.interviews || '0', completionRate: '—', averageRating: row.dataset.rating || '—', feedbacks: [] };
    try {
        const res = await secureFetch(`/api/admin/interviewers/${id}/details`);
        if (res && res.ok) {
            details = await res.json();
        }
    } catch (e) {
        console.error('Error fetching interviewer details', e);
    }

    const d = {
        id: id,
        name: row.dataset.name || '—', domain: row.dataset.domain || '—',
        interviews: details.interviewsConducted, rating: details.averageRating > 0 ? details.averageRating : '—',
        completion: details.completionRate, feedbacks: details.feedbacks || [],
        email: row.dataset.email || '—', exp: row.dataset.exp || '—',
        location: row.dataset.loc || '—', phone: row.dataset.phone || '—',
        bio: row.dataset.bio || '—', status: row.getAttribute('data-status') || 'active',
        resume: row.getAttribute('data-resume') || '',
        linkedin: row.getAttribute('data-linkedin') || '',
        jobTitle: row.getAttribute('data-jobtitle') || '',
        company: row.getAttribute('data-company') || '',
        qualification: row.getAttribute('data-qualification') || '',
        skills: row.getAttribute('data-skills') || '',
        interviewExp: row.getAttribute('data-interview-exp') || '',
        profilePhotoUrl: row.getAttribute('data-profilephoto') || ''
    };
    const initials = d.name.split(' ').map(n => n[0]).join('').slice(0, 2);
    const isActive = d.status === 'active';
    const avatarHtml = d.profilePhotoUrl ? `<img src="${d.profilePhotoUrl}" alt="${d.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : initials;
    
    document.getElementById('platformProfileContent').innerHTML = `
        <div class="profile-banner">
            <div class="profile-banner-avatar" style="overflow:hidden;">${avatarHtml}</div>
            <div>
                <h3 style="font-size:15px;">${d.name}</h3>
                <p style="font-size:12.5px;opacity:.8;">${d.jobTitle || d.domain}${d.company ? ' · ' + d.company : ''}</p>
            </div>
            <div style="margin-left:auto;text-align:right;">
                <div style="font-size:20px;font-weight:800;">★ ${d.rating}</div>
                <div style="font-size:11px;opacity:.8;">Rating</div>
            </div>
        </div>
        <div class="detail-grid">
            <div class="detail-item"><span>Email</span><b>${d.email}</b></div>
            <div class="detail-item"><span>Phone</span><b>${d.phone}</b></div>
            <div class="detail-item"><span>Location</span><b>${d.location}</b></div>
            <div class="detail-item"><span>Experience</span><b>${d.exp} yrs</b></div>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:10px;">
            <div style="flex:1;text-align:center;background:#F8FAFC;border-radius:9px;padding:11px;">
                <div style="font-size:1.3rem;font-weight:800;color:var(--primary);">${d.interviews}</div>
                <div style="font-size:11.5px;color:var(--muted);">Interviews</div>
            </div>
            <div style="flex:1;text-align:center;background:#F8FAFC;border-radius:9px;padding:11px;">
                <div style="font-size:1.3rem;font-weight:800;color:var(--success);">${d.completion}%</div>
                <div style="font-size:11.5px;color:var(--muted);">Completion</div>
            </div>
            <div style="flex:1;text-align:center;background:#F8FAFC;border-radius:9px;padding:11px;">
                <div style="font-size:1.3rem;font-weight:800;color:var(--warning);">★ ${d.rating}</div>
                <div style="font-size:11.5px;color:var(--muted);">Avg Rating</div>
            </div>
        </div>
        <div style="margin-top:6px;"><span class="badge ${isActive ? 'bg-success' : 'bg-danger'}" style="font-size:12px;">${isActive ? 'Active' : 'Inactive'}</span></div>`;
    document.getElementById('fullProfileBtn').onclick = () => {
        closeOverlay('platformProfileModal');
        openFullProfileModal(d);
    };
    openOverlay('platformProfileModal');
}

/* ═══════════════════════════════════════
   FULL INTERVIEWER PROFILE MODAL
═══════════════════════════════════════ */
function openFullProfileModal(d) {
    const initials = d.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const isActive = d.status === 'active';
    const skillsArr = d.skills ? d.skills.split(',').filter(Boolean) : [];
    const skillsHtml = skillsArr.length
        ? skillsArr.map(s => `<span class="req-tag">${s.trim()}</span>`).join('')
        : '<span style="color:var(--muted);font-size:12px;">No skills listed</span>';

    const resumeUrl = d.resume || '';
    const resumeFileName = resumeUrl ? resumeUrl.split('/').pop() : '';

    const resumeSection = buildResumeEmbedHtml(resumeUrl, resumeFileName, { height: '520px' });
    const avatarHtml = d.profilePhotoUrl ? `<img src="${d.profilePhotoUrl}" alt="${d.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : initials;

    document.getElementById('fullProfileContent').innerHTML = `
        <div class="profile-banner" style="margin-bottom:16px;">
            <div class="profile-banner-avatar" style="overflow:hidden;">${avatarHtml}</div>
            <div>
                <h3 style="font-size:15px;">${d.name}</h3>
                <p style="opacity:.8;font-size:12.5px;">${d.jobTitle || d.domain}${d.company ? ' · ' + d.company : ''}${d.location ? ' · ' + d.location : ''}</p>
                <p style="opacity:.7;font-size:11.5px;margin-top:3px;">${d.email}</p>
            </div>
            <div style="margin-left:auto;text-align:right;">
                <div style="font-size:1.6rem;font-weight:800;">★ ${d.rating}</div>
                <div style="font-size:11px;opacity:.8;">Overall</div>
            </div>
        </div>
        <div class="full-profile-layout">
            <!-- LEFT: info, stats, bio, skills -->
            <div class="full-profile-left">
                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
                    <div style="text-align:center;background:#F8FAFC;border-radius:9px;padding:10px;">
                        <div style="font-size:1.2rem;font-weight:800;color:var(--primary);">${d.interviews}</div>
                        <div style="font-size:11px;color:var(--muted);">Interviews</div>
                    </div>
                    <div style="text-align:center;background:#F8FAFC;border-radius:9px;padding:10px;">
                        <div style="font-size:1.2rem;font-weight:800;color:var(--success);">${d.completion}%</div>
                        <div style="font-size:11px;color:var(--muted);">Completion</div>
                    </div>
                    <div style="text-align:center;background:#F8FAFC;border-radius:9px;padding:10px;">
                        <div style="font-size:1.2rem;font-weight:800;color:var(--secondary);">${d.exp ? d.exp + ' yr' : '—'}</div>
                        <div style="font-size:11px;color:var(--muted);">Experience</div>
                    </div>
                    <div style="text-align:center;background:#F8FAFC;border-radius:9px;padding:10px;">
                        <div style="font-size:1.2rem;font-weight:800;color:var(--warning);">★ ${d.rating}</div>
                        <div style="font-size:11px;color:var(--muted);">Avg Rating</div>
                    </div>
                </div>

                <div style="background:#F8FAFC;border-radius:9px;padding:12px;">
                    <div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:8px;">About</div>
                    <p style="font-size:13px;line-height:1.65;color:var(--dark);">${d.bio || 'No bio provided.'}</p>
                </div>

                ${d.interviewExp ? `<div style="background:#F0F9FF;border-radius:9px;padding:12px;border-left:3px solid var(--secondary);">
                    <div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:6px;">Interview Experience</div>
                    <p style="font-size:13px;line-height:1.6;color:var(--dark);">${d.interviewExp}</p>
                </div>` : ''}

                <div>
                    <div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:8px;">Skills & Domain</div>
                    <div style="display:flex;flex-wrap:wrap;gap:5px;">${skillsHtml}</div>
                </div>

                <div style="margin-top:16px;">
                    <div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:8px;">Student Feedback</div>
                    ${d.feedbacks && d.feedbacks.length > 0 ? 
                        `<div style="display:flex;flex-direction:column;gap:8px;">
                            ${d.feedbacks.map(fb => `
                                <div style="background:#F8FAFC;border-radius:8px;padding:10px;border-left:3px solid #EAB308;">
                                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                                        <b style="font-size:12.5px;">${fb.studentName}</b>
                                        <span style="color:#EAB308;font-weight:700;font-size:12px;">★ ${fb.rating}</span>
                                    </div>
                                    <p style="font-size:12px;color:var(--dark);line-height:1.4;">${fb.feedback || '<i>No feedback text provided.</i>'}</p>
                                </div>
                            `).join('')}
                        </div>` 
                    : '<div style="font-size:13px;color:var(--muted);">No feedback received yet.</div>'}
                </div>

                <div>
                    <div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:8px;">Quick Actions</div>
                    <div style="display:flex;gap:7px;">
                        <a href="https://mail.google.com/mail/?view=cm&fs=1&to=${d.email}" target="_blank" rel="noopener noreferrer" class="btn btn-p" style="flex:1;justify-content:center;text-decoration:none;">
                            <i class="fa-solid fa-envelope"></i> Gmail
                        </a>
                        ${ensureUrl(d.linkedin) ? `<button class="btn btn-info" style="flex:1;justify-content:center;" onclick="window.open('${ensureUrl(d.linkedin)}','_blank')">
                            <i class="fa-brands fa-linkedin"></i> LinkedIn
                        </button>` : ''}
                    </div>
                </div>
            </div>
            <!-- RIGHT: resume (inline preview) + contact -->
            <div class="full-profile-right">
                <div>
                    <div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:8px;">CV / Resume</div>
                    ${resumeSection}
                </div>
                <div>
                    <div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:8px;">Contact & Details</div>
                    <div style="background:#F8FAFC;border-radius:9px;padding:12px;display:flex;flex-direction:column;gap:9px;">
                        <div style="display:flex;gap:10px;align-items:center;font-size:13px;">
                            <i class="fa-solid fa-envelope" style="color:var(--primary);width:16px;flex-shrink:0;"></i>
                            <span>${d.email}</span>
                        </div>
                        <div style="display:flex;gap:10px;align-items:center;font-size:13px;">
                            <i class="fa-solid fa-phone" style="color:var(--secondary);width:16px;flex-shrink:0;"></i>
                            <span>${d.phone || '—'}</span>
                        </div>
                        <div style="display:flex;gap:10px;align-items:center;font-size:13px;">
                            <i class="fa-solid fa-map-marker-alt" style="color:var(--danger);width:16px;flex-shrink:0;"></i>
                            <span>${d.location || '—'}</span>
                        </div>
                        ${d.qualification ? `<div style="display:flex;gap:10px;align-items:center;font-size:13px;">
                            <i class="fa-solid fa-graduation-cap" style="color:var(--warning);width:16px;flex-shrink:0;"></i>
                            <span>${d.qualification}</span>
                        </div>` : ''}
                        ${ensureUrl(d.linkedin) ? `<div style="display:flex;gap:10px;align-items:center;font-size:13px;">
                            <i class="fa-brands fa-linkedin" style="color:#0A66C2;width:16px;flex-shrink:0;"></i>
                            <a href="${ensureUrl(d.linkedin)}" target="_blank" rel="noopener noreferrer" style="color:var(--secondary);">${d.linkedin.replace(/^https?:\/\//,'')}</a>
                        </div>` : ''}
                        <div style="display:flex;gap:10px;align-items:center;font-size:13px;">
                            <i class="fa-solid fa-circle" style="color:${isActive ? 'var(--success)' : 'var(--danger)'};width:16px;flex-shrink:0;font-size:9px;"></i>
                            <span class="badge ${isActive ? 'bg-success' : 'bg-danger'}">${isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <button class="btn btn-outline btn-block" style="margin-top:16px;" onclick="closeOverlay('fullProfileModal')">
            <i class="fa-solid fa-xmark"></i> Close
        </button>`;
    openOverlay('fullProfileModal');
}

/* Resume viewer and downloader */
function viewResume(url) {
    if (!url) { showToast('No resume available', 'warn'); return; }
    window.open(url, '_blank');
}

async function downloadResume(url, filename) {
    if (!url) { showToast('No resume available', 'warn'); return; }
    try {
        showToast('Downloading resume…');
        const res = await secureFetch(url);
        if (!res || !res.ok) throw new Error('Fetch failed');
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename || 'resume.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        showToast('Resume downloaded');
    } catch (e) {
        // Fallback: open in new tab
        window.open(url, '_blank');
        showToast('Opening resume in new tab');
    }
}

/* ═══════════════════════════════════════
   VIEW DETAILS MODAL
═══════════════════════════════════════ */
function openViewDetailsModal(row) {
    const d = row.dataset;
    document.getElementById('viewDetailsContent').innerHTML = `
        <div class="detail-grid">
            <div class="detail-item"><span>Institute</span><b>${d.inst || '—'}</b></div>
            <div class="detail-item"><span>Department</span><b>${d.depts || '—'}</b></div>
            <div class="detail-item"><span>Domains</span><b>${d.domains || '—'}</b></div>
            <div class="detail-item"><span>Contact</span><b>${d.contact || '—'}</b></div>
            <div class="detail-item"><span>Start</span><b>${d.start || '—'}</b></div>
            <div class="detail-item"><span>End</span><b>${d.end || '—'}</b></div>
        </div>`;
    openOverlay('viewDetailsModal');
}

/* ═══════════════════════════════════════
   LOGOUT
═══════════════════════════════════════ */
function openLogoutModal() { openOverlay('logoutModal'); }
function doLogout() { closeOverlay('logoutModal'); logout(); }
function handleLogoutOverlayClick(e) { if (e.target === document.getElementById('logoutModal')) closeOverlay('logoutModal'); }

/* ═══════════════════════════════════════
   CONFIRM DELETE
═══════════════════════════════════════ */
function confirmDelete(type, name) {
    document.getElementById('deleteMsg').innerText = `Delete ${type}: "${name}"? This cannot be undone.`;
    document.getElementById('deleteConfirmBtn').onclick = () => { closeOverlay('deleteModal'); showToast('Deleted', 'warn'); };
    openOverlay('deleteModal');
}

/* ═══════════════════════════════════════
   TOAST
═══════════════════════════════════════ */
function showToast(msg, type = 'success') {
    const map = { success: ['#DCFCE7', '#166534'], warn: ['#FEF3C7', '#92400E'], error: ['#FEE2E2', '#991B1B'] };
    const [bg, col] = map[type] || map.success;
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:22px;right:22px;background:${bg};color:${col};
        padding:11px 18px;border-radius:10px;font-size:13px;font-weight:600;
        z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.14);max-width:280px;line-height:1.4;`;
    t.innerText = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3100);
}

/* ═══════════════════════════════════════
   REPORT TABS
═══════════════════════════════════════ */
function switchReportTab(tab, btn) {
    document.querySelectorAll('#reportTabNav .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('#reports .tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('report-' + tab).classList.add('active');
    initReportCharts(tab);
    loadReportData(tab);
}

function initReportCharts(tab) {
    if (tab === 'interviewer' && !reportChartsInited.interviewer) {
        reportChartsInited.interviewer = true;
        new Chart(document.getElementById('domainChart'), { type: 'bar', data: { labels: ['No data yet'], datasets: [{ data: [0], backgroundColor: '#1E3A8A', borderRadius: 6 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
        new Chart(document.getElementById('completionChart'), { type: 'line', data: { labels: ['No data yet'], datasets: [{ data: [0], borderColor: '#0D9488', backgroundColor: 'rgba(13,148,136,.08)', tension: .4, fill: true }] }, options: { responsive: true, plugins: { legend: { display: false } } } });
    }
    if (tab === 'institute' && !reportChartsInited.institute) {
        reportChartsInited.institute = true;
        new Chart(document.getElementById('instStudentsChart'), { type: 'bar', data: { labels: ['No data yet'], datasets: [{ data: [0], backgroundColor: '#0D9488', borderRadius: 6 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
        new Chart(document.getElementById('instScoreChart'), { type: 'bar', data: { labels: ['No data yet'], datasets: [{ data: [0], backgroundColor: '#1E3A8A', borderRadius: 6 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 10 } } } });
    }
    if (tab === 'student' && !reportChartsInited.student) {
        reportChartsInited.student = true;
        new Chart(document.getElementById('studentScoreDistChart'), { type: 'doughnut', data: { labels: ['No data'], datasets: [{ data: [1], backgroundColor: ['#E5E7EB'], borderWidth: 0 }] }, options: { responsive: true, plugins: { legend: { position: 'bottom' } }, cutout: '60%' } });
        new Chart(document.getElementById('studentTrendChart'), { type: 'line', data: { labels: ['No data'], datasets: [{ data: [0], borderColor: '#1E3A8A', backgroundColor: 'rgba(30,58,138,.07)', tension: .4, fill: true }] }, options: { responsive: true, plugins: { legend: { display: false } } } });
    }
}

/* ═══════════════════════════════════════
   SETTINGS TABS
═══════════════════════════════════════ */
function switchSettingsTab(tab, btn) {
    document.querySelectorAll('#settingsTabNav .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('#settings .tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('settings-' + tab).classList.add('active');
    if (tab === 'domains') { loadPlatformDomains().then(renderDomainTags); }
}

async function loadPlatformDomains() {
    try {
        const res = await secureFetch('/api/domains');
        if (res && res.ok) {
            platformDomains = await res.json();
        }
    } catch(e) { console.error('loadPlatformDomains error', e); }
}

function renderDomainTags() {
    const wrap = document.getElementById('domainTagsWrap');
    if (!wrap) return;
    wrap.innerHTML = platformDomains.length === 0
        ? '<span style="color:var(--muted);font-size:13px;font-style:italic;">No domains added yet.</span>'
        : platformDomains.map(domain =>
            `<span class="domain-tag-item">${domain}
                <button class="remove-tag" onclick="removeDomain('${domain.replace(/'/g, "\\'")}')"><i class="fa-solid fa-xmark"></i></button>
            </span>`).join('');
}

async function addDomain() {
    const input = document.getElementById('newDomainInput');
    const val = input.value.trim();
    if (!val) { showToast('Enter a domain name', 'warn'); return; }
    try {
        const res = await secureFetch('/api/domains', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: val })
        });
        if (res && res.ok) {
            platformDomains.push(val);
            platformDomains.sort();
            input.value = '';
            renderDomainTags();
            showToast(`Domain "${val}" added`);
        } else {
            showToast(await res.text() || 'Failed to add domain', 'error');
        }
    } catch(e) { showToast('Error adding domain', 'error'); }
}

async function removeDomain(domain) {
    if (!confirm(`Remove domain "${domain}"?`)) return;
    try {
        const res = await secureFetch('/api/domains', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: domain })
        });
        if (res && res.ok) {
            platformDomains = platformDomains.filter(d => d !== domain);
            renderDomainTags();
            showToast(`Domain "${domain}" removed`, 'warn');
        } else {
            showToast('Failed to remove domain', 'error');
        }
    } catch(e) { showToast('Error removing domain', 'error'); }
}

/* ═══════════════════════════════════════
   PASSWORD STRENGTH (settings)
═══════════════════════════════════════ */
function checkPassStrength() {
    const v = document.getElementById('newPass').value;
    const el = document.getElementById('passStrength');
    if (!v) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    if (v.length < 6) { el.style.color = '#DC2626'; el.innerText = 'Weak password'; }
    else if (v.length < 10 || !/[A-Z]/.test(v) || !/[0-9]/.test(v)) { el.style.color = '#EAB308'; el.innerText = 'Medium strength'; }
    else { el.style.color = '#16A34A'; el.innerText = 'Strong password ✓'; }
}
function changePassword() {
    const np = document.getElementById('newPass').value, cp = document.getElementById('confirmPass').value;
    if (!np) { showToast('Enter a new password', 'warn'); return; }
    if (np !== cp) { showToast('Passwords do not match', 'error'); return; }
    showToast('Password updated successfully');
    document.getElementById('newPass').value = '';
    document.getElementById('confirmPass').value = '';
    document.getElementById('passStrength').style.display = 'none';
}
/* ═══════════════════════════════════════
   ADMIN PROFILE (Settings → Account)
═══════════════════════════════════════ */
async function loadAdminProfile() {
    try {
        const res = await secureFetch('/api/admin/profile');
        if (!res || !res.ok) return;
        const data = await res.json();

        // Header dropdown
        const nameEl = document.getElementById('headerAdminName');
        const emailEl = document.getElementById('headerAdminEmail');
        if (nameEl) nameEl.textContent = data.fullName || 'Admin';
        if (emailEl) emailEl.textContent = data.email || '';

        // Settings form fields
        const fnEl = document.getElementById('adminFullName');
        const emEl = document.getElementById('adminEmail');
        const phEl = document.getElementById('adminPhone');
        if (fnEl) fnEl.value = data.fullName || '';
        if (emEl) emEl.value = data.email || '';
        if (phEl) phEl.value = data.phone || '';
    } catch (e) { console.error('Admin profile error:', e); }
}

async function saveAdminProfile() {
    const payload = {
        fullName: document.getElementById('adminFullName')?.value || '',
        phone: document.getElementById('adminPhone')?.value || ''
    };
    try {
        const res = await secureFetch('/api/admin/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res && res.ok) {
            showToast('Profile updated');
            await loadAdminProfile();
        } else { showToast('Failed to update profile', 'error'); }
    } catch (e) { showToast('Error', 'error'); }
}

/* ═══════════════════════════════════════
   SETTINGS → INSTITUTES
═══════════════════════════════════════ */
async function loadSettingsInstitutes() {
    try {
        const res = await secureFetch('/api/admin/institutes');
        if (!res || !res.ok) return;
        const institutes = await res.json();

        const tbody = document.getElementById('settingsInstTableBody');
        if (!tbody) return;

        if (!institutes.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:16px;">No institutes registered yet.</td></tr>';
            return;
        }

        tbody.innerHTML = institutes.map(inst => {
            const name = inst.instituteName || inst.name || 'Unknown';
            const joined = inst.createdAt ? new Date(inst.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—';
            const isActive = inst.status !== 'INACTIVE' && inst.status !== 'SUSPENDED';
            const safeName = name.replace(/'/g, "\\'");
            return `<tr data-inst-id="${inst.id}" data-inst-status="${isActive ? 'active' : 'inactive'}">
                <td><b>${name}</b></td>
                <td><span class="badge ${isActive ? 'bg-success' : 'bg-danger'} inst-status-badge">${isActive ? 'Active' : 'Suspended'}</span></td>
                <td>${inst.studentCount ?? '—'}</td>
                <td>${joined}</td>
                <td><div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button class="btn btn-deactivate btn-sm inst-toggle-btn" onclick="toggleInstituteStatus(this.closest('tr'))">
                        <i class="fa-solid fa-pause"></i> Suspend</button>
                    <button class="btn btn-reject btn-sm" onclick="confirmDelete('institute','${safeName}')">
                        <i class="fa-solid fa-trash"></i> Delete</button>
                </div></td>
            </tr>`;
        }).join('');
    } catch (e) { console.error('Settings institutes error:', e); }
}

/* ═══════════════════════════════════════
   VIDEO RECORDS
═══════════════════════════════════════ */
async function loadVideoRecords() {
    try {
        const res = await secureFetch('/api/admin/video-records');
        if (!res || !res.ok) return;
        const records = await res.json();

        const tbody = document.getElementById('recordTableBody');
        if (!tbody) return;

        if (!records.length) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:16px;">No interview records yet.</td></tr>';
            populateRecordFilters([]);
            return;
        }

        tbody.innerHTML = records.map(r => {
            const dateStr = r.scheduledDate
                ? new Date(r.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—';
            const timeStr = r.scheduledDate
                ? new Date(r.scheduledDate).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
                : '';
            
            const badgeClass = r.status === 'reviewed' ? 'bg-success' : 'bg-pending';
            const badgeLabel = r.status === 'reviewed' ? 'Reviewed' : 'Pending Review';
            const scoreHtml = r.score != null ? `<span style="font-weight:700;color:var(--dark);">${r.score}/10</span>` : '—';
            const inst = r.instituteName || '—';
            const dept = r.departmentName || '—';
            const student = r.studentName || '—';
            const stdClass = r.studentClass || '—';
            const interviewer = r.interviewerName || '—';

            return `<tr data-status="${r.status}" data-institute="${inst}" data-interviewer="${interviewer}" data-date="${r.scheduledDate || ''}">
                <td>${inst}</td>
                <td>${dept}</td>
                <td><b>${student}</b></td>
                <td>${stdClass}</td>
                <td>${interviewer}</td>
                <td style="white-space:nowrap;">${dateStr}${timeStr ? ' · ' + timeStr : ''}</td>
                <td>${scoreHtml}</td>
                <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
                <td><button class="btn btn-p btn-sm" onclick="openVideoModal({student:'${student.replace(/'/g,"\\'")}',institute:'${inst.replace(/'/g,"\\'")}',dept:'${dept.replace(/'/g,"\\'")}',year:'${stdClass.replace(/'/g,"\\'")}',interviewer:'${interviewer.replace(/'/g,"\\'")}',date:'${dateStr}',time:'${timeStr}',duration:'—',status:'${r.status}',url:'${r.videoUrl}'})">
                    <i class="fa-solid fa-play"></i> Watch
                </button></td>
            </tr>`;
        }).join('');

        populateRecordFilters(records);
    } catch (e) { console.error('Video records error:', e); }
}

function populateRecordFilters(records) {
    const instSel = document.getElementById('filterInstitute');
    const ivSel = document.getElementById('filterInterviewer');
    if (!instSel || !ivSel) return;

    const institutes = [...new Set(records.map(r => r.instituteName).filter(Boolean))];
    const interviewers = [...new Set(records.map(r => r.assignedInterviewerName || r.interviewerName).filter(Boolean))];

    instSel.innerHTML = '<option value="">All Institutes</option>' +
        institutes.map(i => `<option>${i}</option>`).join('');
    ivSel.innerHTML = '<option value="">All Interviewers</option>' +
        interviewers.map(i => `<option>${i}</option>`).join('');
}

function applyRecordFilters() {
    const inst = (document.getElementById('filterInstitute')?.value || '').toLowerCase();
    const iv = (document.getElementById('filterInterviewer')?.value || '').toLowerCase();
    const date = document.getElementById('filterDate')?.value || '';
    document.querySelectorAll('#recordTable tbody tr').forEach(row => {
        const rInst = (row.dataset.institute || '').toLowerCase();
        const rIv = (row.dataset.interviewer || '').toLowerCase();
        const rDate = row.dataset.date ? row.dataset.date.split('T')[0] : '';
        const ok = (!inst || rInst.includes(inst)) &&
                   (!iv || rIv.includes(iv)) &&
                   (!date || rDate === date);
        row.style.display = ok ? '' : 'none';
    });
}

function clearRecordFilters() {
    const instSel = document.getElementById('filterInstitute');
    const ivSel = document.getElementById('filterInterviewer');
    const dateEl = document.getElementById('filterDate');
    if (instSel) instSel.value = '';
    if (ivSel) ivSel.value = '';
    if (dateEl) dateEl.value = '';
    applyRecordFilters();
}

/* ═══════════════════════════════════════
   REPORTS — DYNAMIC DATA
═══════════════════════════════════════ */
const reportDataLoaded = { interviewer: false, institute: false, student: false };

async function loadReportData(tab) {
    if (reportDataLoaded[tab]) return;
    reportDataLoaded[tab] = true;

    try {
        const res = await secureFetch('/api/admin/reports-data');
        if (!res || !res.ok) return;
        const data = await res.json();

        if (tab === 'interviewer') {
            const ivData = data.interviewer;
            
            setEl('rptCompletionRate', ivData.completionRate + '%');
            setEl('rptAvgRating', ivData.avgRating.toFixed(1));
            setEl('rptAvgSession', ivData.avgSession);
            setEl('rptRecommendRate', ivData.recommendRate + '%');

            const tbody = document.getElementById('topInterviewersBody');
            if (tbody) {
                if (!ivData.topInterviewers.length) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:16px;">No interviewers yet.</td></tr>';
                } else {
                    tbody.innerHTML = ivData.topInterviewers.map(iv => `
                        <tr>
                            <td><b>${iv.name}</b></td>
                            <td>${iv.domain}</td>
                            <td>${iv.interviews}</td>
                            <td><span style="font-weight:600;">${iv.avgScore.toFixed(1)}/10</span></td>
                            <td>${iv.completionPct}%</td>
                            <td><span style="color:#EAB308;font-weight:700;">★ ${iv.rating.toFixed(1)}</span></td>
                        </tr>`).join('');
                }
            }

            // Domain chart
            const reqRes = await secureFetch('/api/interview-requests/all');
            if (reqRes && reqRes.ok) {
                const reqs = await reqRes.json();
                const domainMap = {};
                reqs.forEach(r => (r.expertise || []).forEach(e => {
                    domainMap[e] = (domainMap[e] || 0) + 1;
                }));
                const labels = Object.keys(domainMap);
                const counts = Object.values(domainMap);
                if (labels.length) {
                    const canvas = document.getElementById('domainChart');
                    if (canvas && canvas._chartInstance) canvas._chartInstance.destroy();
                    const chart = new Chart(canvas, {
                        type: 'bar',
                        data: { labels, datasets: [{ data: counts, backgroundColor: '#1E3A8A', borderRadius: 6 }] },
                        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
                    });
                    if (canvas) canvas._chartInstance = chart;
                }
            }
        }

        if (tab === 'institute') {
            const [statsRes, instRes] = await Promise.all([
                secureFetch('/api/admin/stats'),
                secureFetch('/api/admin/institutes')
            ]);
            const stats = statsRes && statsRes.ok ? await statsRes.json() : {};
            const institutes = instRes && instRes.ok ? await instRes.json() : [];
            const instData = data.institute;

            setEl('rptActiveInstitutes', stats.totalInstitutes ?? '—');
            setEl('rptTotalInterviews', stats.confirmedRequests ?? '—');
            setEl('rptStudentsInterviewed', stats.totalStudents ?? '—');
            setEl('rptInstAvgScore', instData.avgScore.toFixed(1) + ' / 10');

            const tbody = document.getElementById('instituteSummaryBody');
            if (tbody) {
                if (!instData.summary.length) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:16px;">No institutes yet.</td></tr>';
                } else {
                    tbody.innerHTML = instData.summary.map(inst => `
                        <tr>
                            <td><b>${inst.name}</b></td>
                            <td>${inst.departments}</td>
                            <td>${inst.sessions}</td>
                            <td>${inst.students}</td>
                            <td><span style="font-weight:600;">${inst.avgScore.toFixed(1)}/10</span></td>
                            <td><span class="badge bg-success">Active</span></td>
                        </tr>`).join('');

                    const names = instData.summary.map(i => i.name.substring(0, 12));
                    const students = instData.summary.map(i => i.students);
                    const scores = instData.summary.map(i => i.avgScore);

                    const sc = document.getElementById('instStudentsChart');
                    if (sc) {
                        if (sc._chartInstance) sc._chartInstance.destroy();
                        sc._chartInstance = new Chart(sc, { type: 'bar', data: { labels: names, datasets: [{ data: students, backgroundColor: '#0D9488', borderRadius: 6 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
                    }
                    const ss = document.getElementById('instScoreChart');
                    if (ss) {
                        if (ss._chartInstance) ss._chartInstance.destroy();
                        ss._chartInstance = new Chart(ss, { type: 'bar', data: { labels: names, datasets: [{ data: scores, backgroundColor: '#1E3A8A', borderRadius: 6 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 10 } } } });
                    }
                }
            }
        }

        if (tab === 'student') {
            const statsRes = await secureFetch('/api/admin/stats');
            const stats = statsRes && statsRes.ok ? await statsRes.json() : {};
            const stData = data.student;

            setEl('rptTotalStudents', stats.totalStudents ?? '—');
            setEl('rptStudentAvgScore', (data.institute.avgScore || 0).toFixed(1) + ' / 10');
            setEl('rptHighScorers', stData.highScorers);
            setEl('rptAvgImprovement', stData.avgImprovement);

            const tbody = document.getElementById('studentPerformanceBody');
            if (tbody) {
                if (!stData.performance.length) {
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:16px;">Student score data not yet available.</td></tr>';
                } else {
                    tbody.innerHTML = stData.performance.map(st => `
                        <tr>
                            <td><b>${st.name}</b></td>
                            <td>${st.institute}</td>
                            <td>${st.dept}</td>
                            <td>${st.interviews}</td>
                            <td><span style="font-weight:600;">${st.avgScore.toFixed(1)}/10</span></td>
                            <td>${st.best.toFixed(1)}/10</td>
                            <td><i class="fa-solid fa-arrow-trend-${st.trend === 'up' ? 'up' : 'down'}" style="color:${st.trend === 'up' ? 'var(--success)' : 'var(--muted)'};"></i></td>
                        </tr>`).join('');
                }
            }
            
            const distCanvas = document.getElementById('studentScoreDistChart');
            if (distCanvas) {
                if (distCanvas._chartInstance) distCanvas._chartInstance.destroy();
                distCanvas._chartInstance = new Chart(distCanvas, {
                    type: 'doughnut',
                    data: { labels: ['0-4', '5-6', '7-8', '9-10'], datasets: [{ data: stData.scoreDist, backgroundColor: ['#EF4444', '#F59E0B', '#3B82F6', '#10B981'] }] },
                    options: { responsive: true, plugins: { legend: { position: 'right' } }, cutout: '70%' }
                });
            }
        }
    } catch (e) { console.error('Report data error:', e); }
}

function openVideoModal(data) {
    const titleEl = document.getElementById('videoModalTitle');
    const playerEl = document.getElementById('videoPlayer');
    const detailsEl = document.getElementById('videoDetails');
    const noVideoMsg = document.getElementById('noVideoMsg');

    if (titleEl) titleEl.textContent = `Interview Recording - ${data.student}`;
    
    if (detailsEl) {
        detailsEl.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
                <div><b>Student:</b> ${data.student} (${data.year})</div>
                <div><b>Interviewer:</b> ${data.interviewer}</div>
                <div><b>Institute:</b> ${data.institute}</div>
                <div><b>Department:</b> ${data.dept}</div>
                <div><b>Date:</b> ${data.date} ${data.time}</div>
                <div><b>Status:</b> ${data.status}</div>
            </div>
        `;
    }

    if (playerEl) {
        if (data.url && data.url !== 'null' && data.url !== 'undefined') {
            let finalUrl = data.url;
            if (!finalUrl.startsWith('/') && !finalUrl.startsWith('http')) {
                finalUrl = '/uploads/' + finalUrl;
            }
            playerEl.src = finalUrl;
            playerEl.style.display = 'block';
            if (noVideoMsg) noVideoMsg.style.display = 'none';
        } else {
            playerEl.src = '';
            playerEl.style.display = 'none';
            if (noVideoMsg) noVideoMsg.style.display = 'block';
        }
    }

    openOverlay('videoModal');
}