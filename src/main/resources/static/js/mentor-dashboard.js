/* ===== Uses auth.js: checkAuth(), secureFetch(), logout(), getUserEmail() ===== */

/* ===== STATE ===== */
var loggedMentor = {
    id: null,
    name: '',
    firstName: '',
    lastName: '',
    department: '',
    departmentId: null,
    email: '',
    phone: '',
    designation: '',
    instituteId: null,
    instituteName: ''
};

var departmentStudents = [];

/* ===== HELPERS ===== */
function getInitials(n) {
    return (n || 'M').split(' ').filter(Boolean).map(function(w) { return w[0]; }).join('').toUpperCase().slice(0, 2) || 'M';
}

/* ===== FETCH MENTOR PROFILE ===== */
async function fetchMentorProfile() {
    try {
        const res = await secureFetch("/api/mentor/me");
        if (!res || !res.ok) {
            console.error("Failed to fetch mentor profile, status:", res?.status);
            return;
        }
        const data = await res.json();
        console.log("Mentor data:", data);

        loggedMentor = {
            id: data.id,
            name: (data.firstName || '') + ' ' + (data.lastName || ''),
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            department: data.departmentName || '',
            departmentId: data.departmentId || null,
            email: data.email || '',
            phone: data.phone || '',
            designation: data.designation || 'TPO Coordinator',
            instituteId: data.instituteId || null,
            instituteName: data.instituteName || ''
        };

        localStorage.setItem("mentorDeptId", data.departmentId);
        localStorage.setItem("mentorInstId", data.instituteId);

        initHeader();
        initProfileFields();

    } catch (err) {
        console.error("Error fetching mentor profile:", err);
    }
}

/* ===== FETCH STUDENTS ===== */
async function fetchMyStudents() {
    try {
        const res = await secureFetch("/api/mentor/students");
        if (!res || !res.ok) {
            console.error("Failed to fetch students");
            return [];
        }
        const data = await res.json();
        console.log("Students data:", data);
        return data;
    } catch (err) {
        console.error("Error fetching students:", err);
        return [];
    }
}

/* ===== RENDER ALL STUDENTS TABLE (Students Tab) ===== */
async function renderStudentsTable() {
    const tbody = document.getElementById('allStudentTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading students...</td></tr>';

    departmentStudents = await fetchMyStudents();

    if (!departmentStudents.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--muted);">' +
            '<i class="fa-solid fa-users" style="font-size:2rem;display:block;margin-bottom:10px;opacity:.3;"></i>' +
            'No students registered in your department yet.<br>' +
            '<small>Share the registration link with your students.</small></td></tr>';
        updateAllStats();
        return;
    }

    tbody.innerHTML = departmentStudents.map(function(s) {
        const name = (s.firstName || '') + ' ' + (s.lastName || '');
        const cls = s.studentClass || '—';
        const email = s.email || '—';
        const phone = s.phone || '—';
        const cgpa = s.cgpa ? s.cgpa.toFixed(1) : '—';
        const skills = (s.skills && s.skills.length) ? s.skills.slice(0, 3).join(', ') : '—';
        const safeId = s.id;
        const safeName = name.replace(/'/g, "\\'");
        const safeEmail = email.replace(/'/g, "\\'");

        return `<tr data-status="Not Evaluated" data-class="${cls}" data-name="${name.toLowerCase()}">
            <td><b>${name}</b></td>
            <td>${cls}</td>
            <td style="font-size:12px;">${email}</td>
            <td style="font-size:12px;">${phone}</td>
            <td><b style="color:var(--primary);">${cgpa}</b></td>
            <td style="font-size:12px;color:var(--muted);">${skills}</td>
            <td>
                <button class="btn btn-ghost btn-sm"
                    onclick="openStudentDetailFromData(${safeId},'${safeName}','${cls}','${safeEmail}',${s.cgpa || 0},'${skills}')">
                    <i class="fa-solid fa-eye"></i> View
                </button>
            </td>
        </tr>`;
    }).join('');

    updateAllStats();
    renderReportStudentTable();
}

/* ===== RENDER UPCOMING TABLE (Overview Tab) ===== */
async function renderUpcomingTable() {
    const tbody = document.getElementById('upcomingTableBody');
    if (!tbody) return;

    // Load students if not already loaded
    if (!departmentStudents.length) {
        departmentStudents = await fetchMyStudents();
    }

    if (!departmentStudents.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted);">No students in your department yet.</td></tr>';
        updateAllStats();
        return;
    }

    tbody.innerHTML = departmentStudents.map(function(s) {
        const name = (s.firstName || '') + ' ' + (s.lastName || '');
        const cls = s.studentClass || '—';
        const email = s.email || '—';
        const cgpa = s.cgpa ? s.cgpa.toFixed(1) : '—';
        const safeId = s.id;
        const safeName = name.replace(/'/g, "\\'");
        const safeEmail = email.replace(/'/g, "\\'");

        return `<tr data-class="${cls}" data-name="${name.toLowerCase()}">
            <td><b>${name}</b></td>
            <td>${cls}</td>
            <td style="font-size:12px;">${email}</td>
            <td><b>${cgpa}</b></td>
            <td><span class="badge bg-gray"><i class="fa-solid fa-clock"></i> Not Evaluated</span></td>
            <td>
                <button class="btn btn-ghost btn-sm"
                    onclick="openStudentDetailFromData(${safeId},'${safeName}','${cls}','${safeEmail}',${s.cgpa || 0},'')">
                    <i class="fa-solid fa-eye"></i> View
                </button>
            </td>
        </tr>`;
    }).join('');

    updateAllStats();
}

/* ===== RENDER REPORT STUDENT TABLE ===== */
function renderReportStudentTable() {
    const tbody = document.getElementById('reportStudentTableBody');
    if (!tbody) return;

    if (!departmentStudents.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted);">No students found.</td></tr>';
        return;
    }

    tbody.innerHTML = departmentStudents.map(function(s) {
        const name = (s.firstName || '') + ' ' + (s.lastName || '');
        const cls = s.studentClass || '—';
        const email = s.email || '—';
        const cgpa = s.cgpa ? s.cgpa.toFixed(1) : '—';
        const skills = (s.skills && s.skills.length) ? s.skills.slice(0, 2).join(', ') : '—';
        const safeId = s.id;
        const safeName = name.replace(/'/g, "\\'");
        const safeEmail = email.replace(/'/g, "\\'");

        return `<tr>
            <td><b>${name}</b></td>
            <td>${cls}</td>
            <td style="font-size:12px;">${email}</td>
            <td><b>${cgpa}</b></td>
            <td style="font-size:12px;">${skills}</td>
            <td><span class="badge bg-gray"><i class="fa-solid fa-clock"></i> Not Evaluated</span></td>
            <td>
                <button class="btn btn-ghost btn-sm"
                    onclick="openStudentDetailFromData(${safeId},'${safeName}','${cls}','${safeEmail}',${s.cgpa || 0},'${skills}')">
                    <i class="fa-solid fa-eye"></i> View
                </button>
            </td>
        </tr>`;
    }).join('');
}

/* ===== UPDATE ALL STATS ===== */
function updateAllStats() {
    const total = departmentStudents.length;
    const withSkills = departmentStudents.filter(function(s) { return s.skills && s.skills.length > 0; }).length;

    // Overview stats
    const se = document.getElementById('statTotalStudents');
    const sc = document.getElementById('statScheduled');
    const sco = document.getElementById('statCompleted');
    const sa = document.getElementById('statAvgScore');
    if (se) se.textContent = total;
    if (sc) sc.textContent = '0';
    if (sco) sco.textContent = '0';
    if (sa) sa.textContent = '—';

    // Distribution badge
    const db = document.getElementById('distBadge');
    if (db) db.textContent = total + ' students';

    // Reports stats
    const ra = document.getElementById('reportAvgScore');
    const rt = document.getElementById('reportTotal');
    const rd = document.getElementById('reportDone');
    const rne = document.getElementById('reportNotEval');
    if (ra) ra.textContent = '—';
    if (rt) rt.textContent = total;
    if (rd) rd.textContent = '0';
    if (rne) rne.textContent = total;

    // Activity summary
    const at = document.getElementById('actTotal');
    const aws = document.getElementById('actWithSkills');
    const ane = document.getElementById('actNotEval');
    if (at) at.textContent = total;
    if (aws) aws.textContent = withSkills;
    if (ane) ane.textContent = total;
}

/* ===== OPEN STUDENT DETAIL MODAL ===== */
function openStudentDetailFromData(id, name, cls, email, cgpa, skills) {
    document.getElementById('modalStudentName').textContent = name;
    document.getElementById('modalStudentMeta').innerHTML =
        '<span><i class="fa-solid fa-graduation-cap"></i> ' + cls + '</span>' +
        '<span><i class="fa-solid fa-envelope"></i> ' + (email || '—') + '</span>' +
        (cgpa ? '<span><i class="fa-solid fa-star"></i> CGPA: ' + cgpa + '</span>' : '');

    document.getElementById('modalBanner').innerHTML =
        '<div class="profile-banner" style="background:linear-gradient(135deg,var(--primary),var(--secondary));color:#fff;padding:16px 20px;border-radius:10px;display:flex;align-items:center;gap:14px;margin-bottom:16px;">' +
        '<div style="width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.2);display:grid;place-items:center;font-size:1rem;font-weight:800;">' + getInitials(name) + '</div>' +
        '<div><p style="font-size:15px;font-weight:800;margin-bottom:2px;">' + name + '</p>' +
        '<p style="font-size:12px;opacity:.8;">' + cls + ' · ' + loggedMentor.department + '</p></div></div>';

    document.getElementById('modalScore').textContent = '—';
    document.getElementById('modalAttended').textContent = '0 interviews';
    document.getElementById('modalLastDate').textContent = '—';
    document.getElementById('modalPerfBadge').innerHTML =
        '<span class="badge bg-gray"><i class="fa-solid fa-clock"></i> Not Evaluated Yet</span>';

    // Skills
    const skillsArr = skills ? skills.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
    const skEl = document.getElementById('tabSkillBars');
    if (skillsArr.length) {
        skEl.innerHTML = skillsArr.map(function(sk) {
            return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
                '<span style="font-size:13px;min-width:120px;">' + sk + '</span>' +
                '<span class="badge bg-info">' + sk + '</span></div>';
        }).join('');
    } else {
        skEl.innerHTML = '<p style="color:var(--muted);font-size:13px;">No skills listed yet.</p>';
    }

    document.getElementById('feedbackContent').innerHTML =
        '<p style="color:var(--muted);font-size:13px;padding:10px;">No feedback available yet. Feedback will appear after interviews are completed.</p>';
    document.getElementById('roundsContent').innerHTML =
        '<p style="color:var(--muted);font-size:13px;padding:10px;">No interview rounds yet.</p>';
    document.getElementById('videoContent').innerHTML =
        '<p style="color:var(--muted);font-size:13px;padding:10px;">No recordings available yet.</p>';

    // Reset tabs
    document.querySelectorAll('.modal-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.modal-tab-panel').forEach(function(p) { p.classList.remove('active'); });
    document.querySelector('.modal-tab').classList.add('active');
    document.getElementById('tabOverview').classList.add('active');

    openOverlay('studentDetailModal');
}

/* ===== INIT HEADER ===== */
function initHeader() {
    const ini = getInitials(loggedMentor.name);
    const name = loggedMentor.name || 'Mentor';
    const dept = loggedMentor.department || 'TPO Coordinator';
    const email = loggedMentor.email || '';

    const savedPhoto = localStorage.getItem('mentorProfilePhoto_' + loggedMentor.id);
    const hdr = document.getElementById('headerAvatar');
    if (hdr) {
        if (savedPhoto) {
            hdr.innerHTML = '<img src="' + savedPhoto + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
        } else {
            hdr.textContent = ini;
        }
    }

    const profileImg = document.getElementById('profilePhotoImg');
    const profileTxt = document.getElementById('profileAvatarText');
    if (savedPhoto && profileImg) {
        profileImg.src = savedPhoto;
        profileImg.style.display = 'block';
        if (profileTxt) profileTxt.style.display = 'none';
    } else if (profileTxt) {
        profileTxt.textContent = ini;
    }

    // Update header elements
    const updates = {
        headerMentorName: name.length > 18 ? name.slice(0, 18) + '…' : name,
        headerMentorDept: dept,
        dropMentorName: name,
        dropMentorEmail: email,
        profileHeroName: name,
        profileHeroEmail: email,
        profileHeroSub: dept + ' · TPO Coordinator',
        profileHeroDept: dept
    };

    Object.keys(updates).forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.textContent = updates[id];
    });
}

/* ===== INIT PROFILE FIELDS ===== */
function initProfileFields() {
    const fields = {
        pf_name: loggedMentor.name,
        pf_email: loggedMentor.email,
        pf_phone: loggedMentor.phone,
        pf_designation: loggedMentor.designation,
        pf_dept: loggedMentor.department,
        pf_institute: loggedMentor.instituteName
    };
    Object.keys(fields).forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.value = fields[id] || '';
    });
}

/* ===== GENERATE REGISTRATION LINK ===== */
async function setupGenerateLink() {
    await generateRegLinkInternal('setupLinkArea', 'setupPrimaryBtn', true);
}

async function generateRegLink() {
    await generateRegLinkInternal('regLinkBox', null, false);
}

async function generateRegLinkInternal(areaId, btnId, isSetup) {
    const instId = loggedMentor.instituteId || localStorage.getItem("mentorInstId");
    const deptId = loggedMentor.departmentId || localStorage.getItem("mentorDeptId");

    if (!instId || !deptId) {
        showToast('Institute or department info not found. Please refresh.', 'warn');
        return;
    }

    try {
        const res = await secureFetch(
            `/register/institutes/${instId}/student-registration-link?deptId=${deptId}`
        );

        if (!res || !res.ok) {
            showToast('Failed to generate link. Try again.', 'error');
            return;
        }

        const studentLink = await res.text();

        if (isSetup) {
            const area = document.getElementById(areaId);
            area.innerHTML =
                '<div class="cred-box">' +
                '<span id="setupLinkText" style="font-size:11px;word-break:break-all;">' + studentLink + '</span>' +
                '<button class="btn btn-outline btn-sm" onclick="setupCopyLink()"><i class="fa-solid fa-copy"></i> Copy</button>' +
                '</div>' +
                '<p style="font-size:11.5px;color:var(--muted);margin-top:8px;">' +
                '<i class="fa-solid fa-circle-check" style="color:var(--success);"></i> ' +
                'Share with <b>' + loggedMentor.department + '</b> department students only.</p>';

            if (btnId) {
                const btn = document.getElementById(btnId);
                if (btn) {
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> Done';
                    btn.onclick = function () {
                        sessionStorage.setItem('mentorSetupSeen', 'true');
                        closeOverlay('setupModal');
                    };
                }
            }
        } else {
            const box = document.getElementById(areaId);
            if (box) box.style.display = 'block';
            const linkEl = document.getElementById('regLinkText');
            if (linkEl) linkEl.textContent = studentLink;
        }

    } catch (err) {
        console.error(err);
        showToast('Error generating link.', 'error');
    }
}

function setupCopyLink() {
    const el = document.getElementById('setupLinkText');
    if (!el) return;
    copyToClipboard(el.textContent.trim());
    document.getElementById('copyLinkPreview').textContent = el.textContent.trim();
    closeOverlay('setupModal');
    openOverlay('copyLinkModal');
    sessionStorage.setItem('mentorSetupSeen', 'true');
}

function copyRegLink() {
    const el = document.getElementById('regLinkText');
    if (!el || !el.textContent) return;
    copyToClipboard(el.textContent.trim());
    document.getElementById('copyLinkPreview').textContent = el.textContent.trim();
    openOverlay('copyLinkModal');
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).catch(function() { fallbackCopy(text); });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
}

/* ===== SETUP POPUP ===== */
function checkSetup() {
    if (!sessionStorage.getItem('mentorSetupSeen')) {
        openOverlay('setupModal');
    }
}
function skipSetup() {
    sessionStorage.setItem('mentorSetupSeen', 'true');
    closeOverlay('setupModal');
}

/* ===== NAVIGATION ===== */
function showView(v) {
    document.querySelectorAll('.nav-links a').forEach(function(l) { l.classList.remove('active'); });
    const lnk = document.getElementById('link-' + v);
    if (lnk) lnk.classList.add('active');
    document.querySelectorAll('.content-body').forEach(function(s) { s.classList.remove('active'); });
    const view = document.getElementById('view-' + v);
    if (view) view.classList.add('active');
    const T = { overview: 'Mentor Overview', students: 'Students', reports: 'Performance Reports', profile: 'My Profile' };
    const pt = document.getElementById('page-title');
    const bc = document.getElementById('breadcrumb-cur');
    if (pt) pt.textContent = T[v] || v;
    if (bc) bc.textContent = T[v] || v;
    closeSidebar(); closeUserMenu(); closeNotif();
    if (v === 'reports') { setTimeout(initCharts, 150); renderReportStudentTable(); }
    if (v === 'students') renderStudentsTable();
    if (v === 'overview') renderUpcomingTable();
}

/* ===== SIDEBAR ===== */
function toggleSidebar() {
    const s = document.getElementById('sidebar');
    const o = document.getElementById('sidebarOverlay');
    const b = document.getElementById('hamburger');
    const open = s.classList.toggle('open');
    o.classList.toggle('active', open);
    b.classList.toggle('open', open);
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
    document.getElementById('hamburger').classList.remove('open');
}

/* ===== USER MENU ===== */
function toggleUserMenu() { document.getElementById('userDropdown').classList.toggle('open'); }
function closeUserMenu() { document.getElementById('userDropdown').classList.remove('open'); }
document.addEventListener('click', function(e) {
    if (!e.target.closest('.user-menu-wrap')) closeUserMenu();
    if (!e.target.closest('.notif-wrap')) closeNotif();
});

/* ===== NOTIFICATIONS ===== */
function toggleNotif() { document.getElementById('notifPanel').classList.toggle('open'); }
function closeNotif() { document.getElementById('notifPanel').classList.remove('open'); }
function markAllRead() {
    document.querySelectorAll('.notif-item.unread').forEach(function(i) { i.classList.remove('unread'); });
    const dot = document.getElementById('notifDot');
    if (dot) dot.style.display = 'none';
    closeNotif();
}

/* ===== MODALS ===== */
function openOverlay(id) { document.getElementById(id).classList.add('open'); }
function closeOverlay(id) { document.getElementById(id).classList.remove('open'); }
window.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay') && e.target.id !== 'setupModal')
        closeOverlay(e.target.id);
});

/* ===== FILTERS ===== */
function filterUpcoming() {
    const name = (document.getElementById('upcomingSearch').value || '').toLowerCase();
    const cls = document.getElementById('upcomingClass').value;
    document.querySelectorAll('#upcomingTable tbody tr').forEach(function(r) {
        const rName = (r.dataset.name || '').toLowerCase();
        r.style.display = (rName.includes(name) && (cls === '' || r.dataset.class === cls)) ? '' : 'none';
    });
}
function filterAllStudents() {
    const name = (document.getElementById('allStudentSearch').value || '').toLowerCase();
    const cls = document.getElementById('allClassFilter').value;
    document.querySelectorAll('#allStudentTable tbody tr').forEach(function(r) {
        if (!r.cells || r.cells.length < 2) return;
        const n = r.cells[0].innerText.toLowerCase();
        r.style.display = (n.includes(name) && (cls === '' || r.dataset.class === cls)) ? '' : 'none';
    });
}

/* ===== MODAL TABS ===== */
function switchTab(el, panelId) {
    document.querySelectorAll('.modal-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.modal-tab-panel').forEach(function(p) { p.classList.remove('active'); });
    el.classList.add('active');
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.add('active');
}

/* ===== PROFILE PHOTO ===== */
function handleProfilePhoto(input) {
    if (!input.files || !input.files[0]) return;
    if (input.files[0].size > 3 * 1024 * 1024) { showToast('Photo too large. Max 3 MB.', 'warn'); return; }
    const reader = new FileReader();
    reader.onload = function(ev) {
        const src = ev.target.result;
        const img = document.getElementById('profilePhotoImg');
        const txt = document.getElementById('profileAvatarText');
        if (img) { img.src = src; img.style.display = 'block'; }
        if (txt) txt.style.display = 'none';
        const hdr = document.getElementById('headerAvatar');
        if (hdr) hdr.innerHTML = '<img src="' + src + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
        try { localStorage.setItem('mentorProfilePhoto_' + loggedMentor.id, src); } catch (e) {}
        showToast('Profile photo updated!');
    };
    reader.readAsDataURL(input.files[0]);
}

/* ===== PROFILE EDIT ===== */
var editMode = false;
var editFields = ['pf_name', 'pf_email', 'pf_phone', 'pf_designation'];
function toggleEditMode() {
    editMode = !editMode;
    editFields.forEach(function(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = !editMode;
        el.style.background = editMode ? '#fff' : 'var(--bg)';
        el.style.color = editMode ? 'var(--dark)' : 'var(--muted)';
        el.style.borderColor = editMode ? 'var(--secondary)' : 'var(--border)';
    });
    const ei = document.getElementById('editBtnIcon');
    const et = document.getElementById('editBtnText');
    const pa = document.getElementById('profileActionBar');
    if (ei) ei.className = editMode ? 'fa-solid fa-xmark' : 'fa-solid fa-pen';
    if (et) et.textContent = editMode ? 'Cancel Edit' : 'Edit Profile';
    if (pa) pa.style.display = editMode ? 'flex' : 'none';
    if (!editMode) initProfileFields();
}
function cancelEdit() { editMode = true; toggleEditMode(); }
function saveProfile() {
    const name = (document.getElementById('pf_name').value || '').trim();
    const email = (document.getElementById('pf_email').value || '').trim();
    if (!name || !email) { showToast('Name and email are required.', 'warn'); return; }
    loggedMentor.name = name;
    loggedMentor.email = email;
    loggedMentor.phone = (document.getElementById('pf_phone').value || '').trim();
    loggedMentor.designation = (document.getElementById('pf_designation').value || '').trim();
    initHeader();
    editMode = true;
    toggleEditMode();
    showToast('Profile updated locally. Connect backend API for permanent save.');
}

/* ===== PASSWORD ===== */
function togglePwd(inputId, iconId) {
    const inp = document.getElementById(inputId);
    const ico = document.getElementById(iconId);
    if (inp.type === 'password') { inp.type = 'text'; ico.className = 'fa-solid fa-eye-slash'; }
    else { inp.type = 'password'; ico.className = 'fa-solid fa-eye'; }
    ico.style.cssText = 'position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--muted);cursor:pointer;font-size:13px;';
}
function checkPwdStrength() {
    const val = document.getElementById('pwd_new').value;
    const bars = [document.getElementById('pbar1'), document.getElementById('pbar2'), document.getElementById('pbar3')];
    const hint = document.getElementById('pwdHint');
    bars.forEach(function(b) { if (b) b.className = 'pwd-bar'; });
    if (!val) { if (hint) { hint.textContent = 'Enter a new password'; hint.style.color = ''; } return; }
    let s = 0;
    if (val.length >= 8) s++;
    if (/[A-Z]/.test(val) && /[0-9]/.test(val)) s++;
    if (/[^A-Za-z0-9]/.test(val)) s++;
    if (s === 1) { if (bars[0]) bars[0].classList.add('weak'); if (hint) { hint.textContent = 'Weak'; hint.style.color = 'var(--danger)'; } }
    else if (s === 2) { if (bars[0]) bars[0].classList.add('medium'); if (bars[1]) bars[1].classList.add('medium'); if (hint) { hint.textContent = 'Medium'; hint.style.color = '#D97706'; } }
    else { bars.forEach(function(b) { if (b) b.classList.add('strong'); }); if (hint) { hint.textContent = 'Strong password'; hint.style.color = 'var(--success)'; } }
}
function changePassword() {
    const c = (document.getElementById('pwd_current') || {}).value;
    const n = (document.getElementById('pwd_new') || {}).value;
    const p = (document.getElementById('pwd_confirm') || {}).value;
    if (!c || !n || !p) { showToast('Fill in all password fields.', 'warn'); return; }
    if (n.length < 8) { showToast('New password must be at least 8 characters.', 'warn'); return; }
    if (n !== p) { showToast('Passwords do not match.', 'warn'); return; }
    showToast('Password change requires backend API connection.');
}

/* ===== NOTIF PREFS ===== */
function saveNotifPref(cb, key) {
    const p = JSON.parse(localStorage.getItem('notifPrefs') || '{}');
    p[key] = cb.checked;
    localStorage.setItem('notifPrefs', JSON.stringify(p));
    showToast('Preference saved!');
}

/* ===== LOGOUT ===== */
function openLogout() {
    if (localStorage.getItem('skipLogoutConfirm') === 'true') { confirmLogout(); return; }
    openOverlay('logoutModal');
}
function confirmLogout() {
    const skip = document.getElementById('skipLogout');
    if (skip && skip.checked) localStorage.setItem('skipLogoutConfirm', 'true');
    logout();
}

/* ===== TOAST ===== */
function showToast(msg, type) {
    type = type || 'success';
    const c = { success: ['#DCFCE7', '#166534'], warn: ['#FEF3C7', '#92400E'], error: ['#FEE2E2', '#991B1B'] }[type] || ['#DCFCE7', '#166534'];
    const ico = type === 'error' ? 'circle-xmark' : type === 'warn' ? 'triangle-exclamation' : 'circle-check';
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.cssText = 'position:fixed;bottom:22px;right:22px;background:' + c[0] + ';color:' + c[1] + ';padding:11px 18px;border-radius:10px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.14);display:flex;align-items:center;gap:8px;max-width:300px;';
    t.innerHTML = '<i class="fa-solid fa-' + ico + '"></i>' + msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3500);
}

/* ===== CHARTS ===== */
var chartsInited = false;
function initCharts() {
    if (chartsInited) return;
    if (typeof Chart === 'undefined') {
        console.error('Chart.js not loaded');
        return;
    }
    chartsInited = true;
    const total = departmentStudents.length || 0;
    const SEC = '#0D9488', SUC = '#16A34A', WARN = '#D97706', DAN = '#DC2626', GRAY = '#9CA3AF';
    const GRID = 'rgba(0,0,0,0.05)', LBL = '#6B7280', FONT = { family: 'Inter', size: 12 };

    const dc = document.getElementById('distributionChart');
    if (dc) {
        new Chart(dc, {
            type: 'doughnut',
            data: {
                labels: ['Outstanding/Excellent', 'Good/Average', 'Below Avg/Poor', 'Not Evaluated'],
                datasets: [{ data: [0, 0, 0, total || 1], backgroundColor: [SUC, WARN, DAN, GRAY], borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'right', labels: { color: LBL, font: FONT, padding: 12, boxWidth: 11 } } } }
        });
    }

    const sc = document.getElementById('scoreTrendChart');
    if (sc) {
        new Chart(sc, {
            type: 'line',
            data: {
                labels: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
                datasets: [{ label: 'Dept. Avg Score', data: [0, 0, 0, 0, 0, 0], borderColor: SEC, backgroundColor: 'rgba(13,148,136,0.08)', borderWidth: 2.5, pointBackgroundColor: SEC, pointRadius: 4, tension: 0.4, fill: true }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: GRID }, ticks: { color: LBL, font: FONT } }, y: { min: 0, max: 10, grid: { color: GRID }, ticks: { color: LBL, font: FONT, stepSize: 2 } } } }
        });
    }

    const ic = document.getElementById('interviewBarChart');
    if (ic) {
        new Chart(ic, {
            type: 'bar',
            data: {
                labels: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
                datasets: [
                    { label: 'Completed', data: [0, 0, 0, 0, 0, 0], backgroundColor: SEC, borderRadius: 4, barPercentage: 0.6 },
                    { label: 'Scheduled', data: [0, 0, 0, 0, 0, 0], backgroundColor: 'rgba(13,148,136,0.22)', borderRadius: 4, barPercentage: 0.6 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', align: 'end', labels: { color: LBL, font: FONT, boxWidth: 11, padding: 9 } } }, scales: { x: { grid: { color: GRID }, ticks: { color: LBL, font: FONT } }, y: { min: 0, grid: { color: GRID }, ticks: { color: LBL, font: FONT, stepSize: 1 } } } }
        });
    }
}

/* ===== INIT ===== */
window.addEventListener('DOMContentLoaded', async function() {
    // 1. Check auth
    if (!await checkAuth('MENTOR')) return;

    // 2. Fetch mentor profile from backend
    await fetchMentorProfile();

    // 3. Load students
    departmentStudents = await fetchMyStudents();

    // 4. Render overview table
    await renderUpcomingTable();

    // 5. Update stats
    updateAllStats();

    // 6. Show setup modal if first time
    checkSetup();
});