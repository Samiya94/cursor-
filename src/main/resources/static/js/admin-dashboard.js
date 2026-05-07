/* ═══════════════════════════════════════
   STATE
═══════════════════════════════════════ */
let currentProcessRow = null;
let deleteCallback = null;
let mainChartInstance = null;
let pieChartInstance = null;
const reportChartsInited = { interviewer: false, institute: false, student: false };

let platformDomains = [];

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
                labels: ['Confirmed', 'Pending', 'Cancelled'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#16A34A', '#EAB308', '#DC2626'],
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
            const total = data.totalRequests ?? 0;
            const cancelled = total - confirmed - pending;
            pieChartInstance.data.datasets[0].data = [confirmed, pending, Math.max(0, cancelled)];
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
                row.setAttribute('data-linkedin', iv.linkedin || '#');
                row.setAttribute('data-loc', iv.location || '');
                row.innerHTML = `
                    <td><div style="display:flex;align-items:center;gap:10px;">
                        <div style="width:34px;height:34px;border-radius:50%;background:#EFF6FF;color:var(--primary);display:grid;place-items:center;font-weight:800;font-size:12px;">${initials}</div>
                        <b>${name}</b></div></td>
                    <td style="font-size:12px;color:var(--muted);">${email}</td>
                    <td>${iv.domain || '—'}</td>
                    <td>${iv.experience || '—'}</td>
                    <td>${iv.location || '—'}</td>
                    <td><span class="badge bg-pending">Pending</span></td>
                    <td><div style="display:flex;gap:5px;">
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
    if (fields) fields.style.display = document.getElementById('rescheduleToggle').checked ? 'block' : 'none';
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
            row.setAttribute('data-status', isActive ? 'active' : 'inactive');
            row.setAttribute('data-name', name);
            row.setAttribute('data-domain', iv.domain || '');
            row.setAttribute('data-loc', iv.location || '—');
            row.setAttribute('data-email', iv.user?.email || '—');
            row.setAttribute('data-exp', iv.experience || '—');
            row.setAttribute('data-phone', iv.phone || '—');
            row.setAttribute('data-bio', iv.bio || '—');
            row.setAttribute('data-interviews', '0');
            row.setAttribute('data-rating', '—');
            row.setAttribute('data-id', iv.id);
            row.innerHTML = `
                <td><div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:34px;height:34px;border-radius:50%;background:#EFF6FF;color:var(--primary);display:grid;place-items:center;font-weight:800;font-size:12px;flex-shrink:0;">${initials}</div>
                    <b>${name}</b></div></td>
                <td style="font-size:12px;color:var(--muted);">${iv.location || '—'}</td>
                <td>${iv.domain || '—'}</td>
                <td>—</td>
                <td><span style="color:#EAB308;font-weight:700;">★ —</span></td>
                <td><span class="badge ${isActive ? 'bg-success' : 'bg-danger'} status-badge">${isActive ? 'Active' : 'Inactive'}</span></td>
                <td><div style="display:flex;gap:5px;flex-wrap:wrap;">
                    <button class="btn btn-info btn-sm" onclick="openPlatformProfileModalFromRow(this.closest('tr'))"><i class="fa-solid fa-eye"></i> View</button>
                    <button class="btn btn-deactivate btn-sm" onclick="toggleInterviewerStatus(this.closest('tr'))"><i class="fa-solid fa-pause"></i> Deactivate</button>
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
        return await res.json();
    } catch (e) {
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
            const isUpcoming = req.status === 'CONFIRMED' || req.status === 'RESCHEDULED';
            const rowStatus = isUpcoming ? 'upcoming' : 'completed';

            const institute = req.instituteName || '—';
            const interviewerName = req.assignedInterviewerName || '—';
            const domainTags = (req.expertise || []).map(e => `<span class="req-tag">${e}</span>`).join('') || '';

            const dt = req.scheduledDate ? new Date(req.scheduledDate) : (req.startDate ? new Date(req.startDate) : null);
            const dateStr = dt ? dt.toLocaleDateString('en', { month: 'short', day: '2-digit', year: 'numeric' }) : '—';
            const timeStr = dt ? dt.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : '';

            const studentsVal = (req.numberOfStudentsRequired !== null && req.numberOfStudentsRequired !== undefined)
                ? req.numberOfStudentsRequired
                : '—';
            const statusBadgeClass = isUpcoming ? 'bg-blue' : 'bg-success';
            const statusBadgeText = isUpcoming ? 'Upcoming' : 'Completed';

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
                'PENDING': 'bg-pending', 'CONFIRMED': 'bg-success',
                'RESCHEDULED': 'bg-blue', 'CANCELLED': 'bg-danger', 'AWAITING_CONFIRMATION': 'bg-purple'
            }[req.status] || 'bg-pending';
            const statusLabel = {
                'PENDING': 'Pending', 'CONFIRMED': 'Confirmed',
                'RESCHEDULED': 'Rescheduled', 'CANCELLED': 'Cancelled',
                'AWAITING_CONFIRMATION': 'Awaiting Confirmation'
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

            const canAssign = (req.status === 'CONFIRMED' || req.status === 'RESCHEDULED');
            const actionBtn = req.status === 'PENDING'
            ? `<button class="btn btn-s btn-sm" onclick="openProcessModal(${req.id})"><i class="fa-solid fa-gear"></i> Process</button>`
            : `<button class="btn btn-info btn-sm" onclick="openRescheduleModal(${req.id})"><i class="fa-solid fa-rotate"></i> Reschedule</button>`;
            const assignBtn = canAssign
                ? `<button class="btn btn-s btn-sm" onclick="openAssignInterviewerModal(${req.id},'${req.instituteName || ''}','${req.departmentName || ''}','${(req.expertise || []).join(', ')}')\"><i class="fa-solid fa-user-check"></i> Assign Interviewers</button>`
                : '';
           const instConfirmedBadge = (req.status === 'CONFIRMED' || req.status === 'AWAITING_CONFIRMATION')
            ? (req.instituteConfirmed
                ? `<span class="badge bg-success"><i class="fa-solid fa-circle-check"></i> Inst. Confirmed</span>`
                : `<span class="badge bg-pending"><i class="fa-solid fa-clock"></i> Awaiting Confirmation</span>`)
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
                <td><span class="badge ${statusClass}">${statusLabel}</span>${instConfirmedBadge ? '<br/>' + instConfirmedBadge : ''}</td>
                <td><div style="display:flex;gap:5px;flex-wrap:wrap;">
                    ${actionBtn}
                    ${assignBtn}
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
    let req = allAdminRequestsCache.find(r => r.id === reqId);
    if (!req) {
        try {
            const r = await secureFetch('/api/interview-requests/all');
            if (r && r.ok) { allAdminRequestsCache = await r.json(); req = allAdminRequestsCache.find(r => r.id === reqId); }
        } catch(e) {}
    }
    if (!req) { showToast('Request not found', 'error'); return; }

    const ivs = await getActiveInterviewersList();
    const requestedDomains = (req.expertise || []).map(d => d.toLowerCase());
    const matchedIvs = ivs.filter(iv => {
        const ivDomain = (iv.domain || '').toLowerCase();
        return requestedDomains.some(d => ivDomain.includes(d) || d.includes(ivDomain));
    });
    const otherIvs = ivs.filter(iv => !matchedIvs.includes(iv));

    // Populate institute info section (read-only)
    const startDate = req.startDate ? new Date(req.startDate).toLocaleString('en-IN', {day:'2-digit',month:'short',year:'numeric'}) : '—';
    const endDate   = req.endDate   ? new Date(req.endDate).toLocaleString('en-IN',   {day:'2-digit',month:'short',year:'numeric'}) : '—';
    const studentCount = req.registeredStudentsCount ?? req.numberOfStudentsRequired ?? '—';

    document.getElementById('processInstInfo').innerHTML = `
        <div class="detail-item"><span>Institute</span><b>${req.instituteName || '—'}</b></div>
        <div class="detail-item"><span>Department</span><b>${req.departmentName || '—'}</b></div>
        <div class="detail-item"><span>Domains Requested</span><b>${(req.expertise||[]).join(', ')||'—'}</b></div>
        <div class="detail-item"><span>Contact Email</span><b>${req.contactEmail || '—'}</b></div>
        <div class="detail-item"><span>Preferred Window</span><b>${startDate} – ${endDate}</b></div>
        <div class="detail-item" style="background:#EFF6FF;border:1.5px solid #BFDBFE;">
          <span style="color:var(--primary);">Registered Students</span>
          <b style="color:var(--primary);font-size:17px;">${studentCount}</b>
        </div>`;

    // Pre-fill student count field
    const studentCountInput = document.getElementById('schedStudentCount');
    if (studentCountInput && studentCount !== '—') studentCountInput.value = studentCount;

    // Populate interviewer checklist
    const buildChecklist = (list, labelText) => list.map(iv => `
        <label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;padding:6px 8px;border-radius:6px;background:${matchedIvs.includes(iv)?'#EFF6FF':'#F8FAFC'};cursor:pointer;">
            <input type="checkbox" class="schedule-iv-cb" value="${iv.id}" style="margin-top:2px;accent-color:var(--primary);" ${matchedIvs.includes(iv)?'checked':''}>
            <span style="font-size:13px;">${iv.fullName || 'Interviewer'} <span style="color:var(--muted);font-size:11.5px;">(${iv.domain || 'General'})</span></span>
        </label>`).join('');

    const checklistEl = document.getElementById('interviewerChecklist');
    const noMatchEl = document.getElementById('noMatchMsg');
    const noteEl = document.getElementById('domainFilterNote');

    if (ivs.length) {
        let html = '';
        if (matchedIvs.length) {
            html += `<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">✓ Matching Domain</div>`;
            html += buildChecklist(matchedIvs, 'Matching');
        }
        if (otherIvs.length) {
            html += `<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:8px 0 6px;">Other Interviewers</div>`;
            html += buildChecklist(otherIvs, 'Other');
        }
        checklistEl.innerHTML = html;
        checklistEl.style.display = 'block';
        noMatchEl.style.display = 'none';
        noteEl.textContent = matchedIvs.length
            ? `— ${matchedIvs.length} matching for: ${(req.expertise||[]).join(', ')}`
            : '';
    } else {
        checklistEl.innerHTML = '';
        checklistEl.style.display = 'none';
        noMatchEl.style.display = 'block';
        noteEl.textContent = '';
    }

    // Reset scheduling fields
    const schedDate = document.getElementById('schedDate');
    const schedVenue = document.getElementById('schedVenue');
    const schedMeetLink = document.getElementById('schedMeetLink');
    if (schedDate) schedDate.value = '';
    if (schedVenue) schedVenue.value = '';
    if (schedMeetLink) schedMeetLink.value = '';

    const toggle = document.getElementById('rescheduleToggle');
    if (toggle) toggle.checked = false;
    const schedFields = document.getElementById('rescheduleFields');
    if (schedFields) schedFields.style.display = 'none';

    window._currentProcessReqId = reqId;
    openOverlay('processModal');
}

async function confirmSchedule(reqId) {
    const id = reqId || window._currentProcessReqId;
    const dateVal = document.getElementById('schedDate')?.value;
    if (!dateVal) { showToast('Please select a date and time', 'warn'); return; }

    const selectedInterviewerIds = [...document.querySelectorAll('.schedule-iv-cb:checked')]
        .map(cb => parseInt(cb.value)).filter(Number.isFinite);

    const isReschedule = document.getElementById('rescheduleToggle')?.checked;
    const newStart = document.getElementById('startDateTime')?.value;
    const newEnd   = document.getElementById('endDateTime')?.value;

    const payload = {
        scheduledDate: new Date(dateVal).toISOString(),
        scheduledVenue: document.getElementById('schedVenue')?.value || '',
        meetingLink: document.getElementById('schedMeetLink')?.value || '',
        assignedInterviewerIds: selectedInterviewerIds,
        numberOfStudentsRequired: parseInt(document.getElementById('schedStudentCount')?.value || '10'),
        ...(isReschedule && newStart ? { startDate: new Date(newStart).toISOString() } : {}),
        ...(isReschedule && newEnd   ? { endDate:   new Date(newEnd).toISOString()   } : {})
    };

    try {
        const endpoint = isReschedule
            ? `/api/interview-requests/${id}/reschedule`
            : `/api/interview-requests/${id}/schedule`;
        const res = await secureFetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res && res.ok) {
            closeOverlay('processModal');
            showToast(isReschedule ? 'Rescheduled! Awaiting institute confirmation.' : 'Scheduled! Awaiting institute confirmation.');
            await loadAllInterviewRequests();
            await loadAdminStats();
            await loadRecentActivity();
        } else {
            showToast(await res.text() || 'Failed to schedule', 'error');
        }
    } catch (e) { showToast('Error scheduling', 'error'); }
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

async function openRescheduleModal(reqId) {
    document.getElementById('processInstInfo').innerHTML = `
        <div style="margin-bottom:10px;"><b>Rescheduling Interview #${reqId}</b></div>
        <div style="margin-top:10px;">
            <label style="font-size:12px;font-weight:600;">New Date &amp; Time *</label>
            <input type="datetime-local" id="schedDate" style="width:100%;margin-top:4px;padding:8px;border:1px solid #E2E8F0;border-radius:6px;">
        </div>
        <div style="margin-top:10px;">
            <label style="font-size:12px;font-weight:600;">Venue</label>
            <input type="text" id="schedVenue" placeholder="e.g. Online / Campus Hall A" style="width:100%;margin-top:4px;padding:8px;border:1px solid #E2E8F0;border-radius:6px;">
        </div>
        <div style="margin-top:10px;">
            <label style="font-size:12px;font-weight:600;">Meeting Link</label>
            <input type="text" id="schedMeetLink" placeholder="https://meet.google.com/..." style="width:100%;margin-top:4px;padding:8px;border:1px solid #E2E8F0;border-radius:6px;">
        </div>
        <div style="margin-top:16px;display:flex;gap:10px;">
            <button class="btn btn-s" style="flex:1;justify-content:center;" onclick="confirmReschedule(${reqId})">
                <i class="fa-solid fa-rotate"></i> Confirm Reschedule</button>
            <button class="btn btn-outline" onclick="closeOverlay('processModal')">Cancel</button>
        </div>`;

    document.getElementById('interviewerChecklist').innerHTML = '';
    document.getElementById('interviewerChecklist').style.display = 'none';
    document.getElementById('noMatchMsg').style.display = 'none';
    openOverlay('processModal');
}

async function confirmReschedule(reqId) {
    const dateVal = document.getElementById('schedDate')?.value;
    if (!dateVal) { showToast('Please select a new date', 'warn'); return; }

    const payload = {
        scheduledDate: new Date(dateVal).toISOString(),
        scheduledVenue: document.getElementById('schedVenue')?.value || '',
        meetingLink: document.getElementById('schedMeetLink')?.value || ''
    };

    try {
        const res = await secureFetch(`/api/interview-requests/${reqId}/reschedule`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res && res.ok) {
            closeOverlay('processModal');
            showToast('Interview rescheduled!');
            await loadAllInterviewRequests();
            await loadRecentActivity();
        } else {
            showToast('Failed to reschedule', 'error');
        }
    } catch (e) { showToast('Error', 'error'); }
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
                    <th style="padding:8px;text-align:left;">Student</th>
                    <th style="padding:8px;">Email</th>
                    <th style="padding:8px;">CGPA</th>
                    <th style="padding:8px;">Class</th>
                    <th style="padding:8px;">Status</th>
                    <th style="padding:8px;">Action</th>
                </tr></thead><tbody>
                ${apps.map(a => `<tr style="border-top:1px solid #E2E8F0;">
                    <td style="padding:8px;"><b>${a.studentName || '—'}</b></td>
                    <td style="padding:8px;">${a.studentEmail || '—'}</td>
                    <td style="padding:8px;">${a.cgpa ?? '—'}</td>
                    <td style="padding:8px;">${a.studentClass || '—'}</td>
                    <td style="padding:8px;">
                        <span class="badge ${a.applicationStatus === 'APPROVED' ? 'bg-success' : a.applicationStatus === 'REJECTED' ? 'bg-danger' : 'bg-pending'}">
                            ${a.applicationStatus}
                        </span>
                    </td>
                    <td style="padding:8px;">
                        ${a.applicationStatus === 'PENDING'
                            ? `<div style="display:flex;gap:6px;flex-wrap:wrap;">
                                <button class="btn btn-s btn-sm btn-approve" onclick="approveStudentApplication(${a.applicationId}, ${requestId})">
                                    <i class="fa-solid fa-check"></i> Approve
                                </button>
                                <button class="btn btn-s btn-sm btn-reject" onclick="rejectStudentApplication(${a.applicationId}, ${requestId})">
                                    <i class="fa-solid fa-xmark"></i> Reject
                                </button>
                              </div>`
                            : '<span style="color:var(--muted);font-size:12px;">—</span>'}
                    </td>
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
function toggleNotif() { document.getElementById('notifPanel').classList.toggle('open'); }
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
        const status = row.getAttribute('data-status') || 'active';
        const isActive = status === 'active';
        const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2);
        const card = document.createElement('div');
        card.className = 'int-card';
        card.innerHTML = `
            <div class="int-card-avatar" style="background:${isActive ? '#EFF6FF' : '#FEE2E2'};color:${isActive ? 'var(--primary)' : '#991B1B'};">${initials}</div>
            <h4>${name}</h4>
            <p>${domain} · ${loc}</p>
            <div style="margin-top:8px;"><span class="badge ${isActive ? 'bg-success' : 'bg-danger'}">${isActive ? 'Active' : 'Inactive'}</span></div>
            <div class="int-card-stats">
                <div class="int-stat"><div class="num">${exp}</div><div class="lbl">Exp (yrs)</div></div>
            </div>`;
        container.appendChild(card);
    });
}

/* ═══════════════════════════════════════
   INTERVIEWER STATUS TOGGLE
═══════════════════════════════════════ */
function toggleInterviewerStatus(row) {
    const current = row.getAttribute('data-status');
    const isActive = current === 'active';
    const newStatus = isActive ? 'inactive' : 'active';
    row.setAttribute('data-status', newStatus);
    const badge = row.querySelector('.status-badge');
    if (badge) { badge.className = 'badge ' + (isActive ? 'bg-danger' : 'bg-success') + ' status-badge'; badge.innerText = isActive ? 'Inactive' : 'Active'; }
    const toggleBtn = row.querySelector('.btn-deactivate,.btn-activate');
    if (toggleBtn) {
        toggleBtn.className = 'btn ' + (isActive ? 'btn-activate' : 'btn-deactivate') + ' btn-sm';
        toggleBtn.innerHTML = isActive ? '<i class="fa-solid fa-play"></i> Activate' : '<i class="fa-solid fa-pause"></i> Deactivate';
    }
    showToast(`${row.dataset.name || ''} ${isActive ? 'deactivated' : 'activated'}`, isActive ? 'warn' : 'success');
    syncInterviewerCards();
}

/* ═══════════════════════════════════════
   PLATFORM PROFILE MODAL
═══════════════════════════════════════ */
function openPlatformProfileModalFromRow(row) {
    if (!row) return;
    const d = {
        name: row.dataset.name || '—', domain: row.dataset.domain || '—',
        interviews: row.dataset.interviews || '0', rating: row.dataset.rating || '—',
        email: row.dataset.email || '—', exp: row.dataset.exp || '—',
        location: row.dataset.loc || '—', phone: row.dataset.phone || '—',
        bio: row.dataset.bio || '—', status: row.getAttribute('data-status') || 'active',
    };
    const initials = d.name.split(' ').map(n => n[0]).join('').slice(0, 2);
    const isActive = d.status === 'active';
    document.getElementById('platformProfileContent').innerHTML = `
        <div class="profile-banner">
            <div class="profile-banner-avatar">${initials}</div>
            <div><h3 style="font-size:15px;">${d.name}</h3><p style="font-size:12.5px;opacity:.8;">${d.domain}</p></div>
        </div>
        <div class="detail-grid">
            <div class="detail-item"><span>Email</span><b>${d.email}</b></div>
            <div class="detail-item"><span>Phone</span><b>${d.phone}</b></div>
            <div class="detail-item"><span>Location</span><b>${d.location}</b></div>
            <div class="detail-item"><span>Experience</span><b>${d.exp} yrs</b></div>
        </div>
        <div style="margin-top:10px;background:#F8FAFC;border-radius:9px;padding:12px;">
            <p style="font-size:13px;color:var(--muted);">${d.bio}</p>
        </div>
        <div style="margin-top:10px;"><span class="badge ${isActive ? 'bg-success' : 'bg-danger'}">${isActive ? 'Active' : 'Inactive'}</span></div>`;
    document.getElementById('fullProfileBtn').onclick = () => closeOverlay('platformProfileModal');
    openOverlay('platformProfileModal');
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
    if (tab === 'domains') renderDomainTags();
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

function addDomain() {
    const input = document.getElementById('newDomainInput');
    const val = input.value.trim();
    if (!val) { showToast('Enter a domain name', 'warn'); return; }
    if (platformDomains.some(d => d.toLowerCase() === val.toLowerCase())) { showToast('Domain already exists', 'warn'); return; }
    platformDomains.push(val);
    input.value = '';
    renderDomainTags();
    showToast(`Domain "${val}" added`);
}

function removeDomain(domain) {
    if (confirm(`Remove domain "${domain}"?`)) {
        platformDomains = platformDomains.filter(d => d !== domain);
        renderDomainTags();
        showToast(`Domain "${domain}" removed`, 'warn');
    }
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
        const res = await secureFetch('/api/interview-requests/all');
        if (!res || !res.ok) return;
        const requests = await res.json();

        const tbody = document.getElementById('recordTableBody');
        if (!tbody) return;

        // Build confirmed/rescheduled interviews as "records"
        const records = requests.filter(r => r.status === 'CONFIRMED' || r.status === 'RESCHEDULED');

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
            const status = r.status === 'CONFIRMED' ? 'pending review' : 'reviewed';
            const badgeClass = status === 'reviewed' ? 'bg-success' : 'bg-pending';
            const badgeLabel = status === 'reviewed' ? 'Reviewed' : 'Pending Review';
            const interviewer = r.assignedInterviewerName || r.interviewerName || '—';
            const inst = r.instituteName || '—';
            const dept = r.departmentName || '—';
            return `<tr data-status="${status}" data-institute="${inst}" data-interviewer="${interviewer}" data-date="${r.scheduledDate || ''}">
                <td>${inst}</td>
                <td>${dept}</td>
                <td>—</td>
                <td>—</td>
                <td>${interviewer}</td>
                <td style="white-space:nowrap;">${dateStr}${timeStr ? ' · ' + timeStr : ''}</td>
                <td>—</td>
                <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
                <td><button class="btn btn-p btn-sm" onclick="openVideoModal({student:'—',institute:'${inst.replace(/'/g,"\\'")}',dept:'${dept.replace(/'/g,"\\'")}',year:'—',interviewer:'${interviewer.replace(/'/g,"\\'")}',date:'${dateStr}',time:'${timeStr}',duration:'—',status:'${status}'})">
                    <i class="fa-solid fa-play"></i> ${status === 'reviewed' ? 'View' : 'Review'}</button></td>
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
        if (tab === 'interviewer') {
            const [statsRes, ivRes] = await Promise.all([
                secureFetch('/api/admin/stats'),
                secureFetch('/api/admin/interviewers/active')
            ]);
            const stats = statsRes && statsRes.ok ? await statsRes.json() : {};
            const ivs = ivRes && ivRes.ok ? await ivRes.json() : [];

            // Stats cards — derived from real data
            const total = stats.totalRequests || 0;
            const confirmed = stats.confirmedRequests || 0;
            const rate = total > 0 ? Math.round((confirmed / total) * 100) + '%' : '—';
            setEl('rptCompletionRate', rate);
            setEl('rptAvgRating', '—');
            setEl('rptAvgSession', '—');
            setEl('rptRecommendRate', '—');

            // Top interviewers table
            const tbody = document.getElementById('topInterviewersBody');
            if (tbody) {
                if (!ivs.length) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:16px;">No interviewers yet.</td></tr>';
                } else {
                    tbody.innerHTML = ivs.slice(0, 10).map(iv => {
                        const name = iv.fullName || '—';
                        return `<tr>
                            <td><b>${name}</b></td>
                            <td>${iv.domain || '—'}</td>
                            <td>—</td><td>—</td><td>—</td>
                            <td><span style="color:#EAB308;font-weight:700;">★ —</span></td>
                        </tr>`;
                    }).join('');
                }
            }

            // Domain chart from interview requests
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

            setEl('rptActiveInstitutes', stats.totalInstitutes ?? '—');
            setEl('rptTotalInterviews', stats.confirmedRequests ?? '—');
            setEl('rptStudentsInterviewed', stats.totalStudents ?? '—');
            setEl('rptInstAvgScore', '—');

            const tbody = document.getElementById('instituteSummaryBody');
            if (tbody) {
                if (!institutes.length) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:16px;">No institutes yet.</td></tr>';
                } else {
                    tbody.innerHTML = institutes.map(inst => {
                        const name = inst.instituteName || inst.name || '—';
                        const joined = inst.createdAt ? new Date(inst.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—';
                        return `<tr>
                            <td><b>${name}</b></td>
                            <td>—</td><td>—</td>
                            <td>${inst.studentCount ?? '—'}</td>
                            <td>—</td>
                            <td><span class="badge bg-success">Active</span></td>
                        </tr>`;
                    }).join('');

                    // Charts
                    const names = institutes.map(i => (i.instituteName || i.name || '').substring(0, 12));
                    const counts = institutes.map(i => i.studentCount || 0);
                    const sc = document.getElementById('instStudentsChart');
                    if (sc) new Chart(sc, { type: 'bar', data: { labels: names, datasets: [{ data: counts, backgroundColor: '#0D9488', borderRadius: 6 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
                    const ss = document.getElementById('instScoreChart');
                    if (ss) new Chart(ss, { type: 'bar', data: { labels: names, datasets: [{ data: names.map(() => 0), backgroundColor: '#1E3A8A', borderRadius: 6 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 10 } } } });
                }
            }
        }

        if (tab === 'student') {
            const statsRes = await secureFetch('/api/admin/stats');
            const stats = statsRes && statsRes.ok ? await statsRes.json() : {};

            setEl('rptTotalStudents', stats.totalStudents ?? '—');
            setEl('rptStudentAvgScore', '—');
            setEl('rptHighScorers', '—');
            setEl('rptAvgImprovement', '—');

            const tbody = document.getElementById('studentPerformanceBody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:16px;">Student score data not yet available.</td></tr>';
        }
    } catch (e) { console.error('Report data error:', e); }
}