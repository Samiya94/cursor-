const APP = {
  profile: null,
  interviews: [],
  studentsByInterview: {},
  currentLiveStudent: null,
  scheduleStudents: [],
  timerInterval: null,
  seconds: 0,
  realtimeStarted: false,
  completed: JSON.parse(localStorage.getItem('interviewerCompleted') || '{}'),
  reviews: JSON.parse(localStorage.getItem('interviewerReviews') || '[]')
};

window.addEventListener('DOMContentLoaded', async function () {
  if (!await checkAuth('INTERVIEWER')) return;
  bindOutsideClickClose();
  await refreshInterviewerDashboard();
  startRealtimeRefresh();
});

async function refreshInterviewerDashboard() {
  await loadInterviewerProfile();
  await loadAssignedInterviews();
  renderNotifications();
  renderScheduleTables();
  renderHistory();
  renderProfileReviews();
  renderLiveStudent();
}

async function loadInterviewerProfile() {
  try {
    const res = await secureFetch('/api/interviewer/me');
    if (!res || !res.ok) return;
    APP.profile = await res.json();
    const iv = APP.profile || {};
    setText('headerName', iv.fullName || 'Interviewer');
    setText('headerSub', iv.jobTitle || iv.domain || '—');
    setText('userMenuName', iv.fullName || 'Interviewer');
    setText('userMenuEmail', iv.email || '');
    setText('profileName', iv.fullName || 'Interviewer');
    setText('profileHeadline', [iv.jobTitle, iv.domain].filter(Boolean).join(' · ') || '—');
    setText('profileId', iv.id ? '#' + iv.id : '—');
    setText('profileEmail', iv.email || '');
    setText('pfInterviewerId', iv.id ? '#' + iv.id : '—');
    const nameParts = (iv.fullName || '').trim().split(/\s+/).filter(Boolean);
    setText('pfFirstName', nameParts[0] || '—');
    setText('pfLastName', nameParts.length > 1 ? nameParts.slice(1).join(' ') : '—');
    setText('pfEmail', iv.email || '—');
    setText('pfPhone', iv.phone || '—');
    const jobTitleInput = document.getElementById('jobTitle');
    if (jobTitleInput) jobTitleInput.value = iv.jobTitle || '';
    const linkedinInput = document.getElementById('pfLinkedin');
    if (linkedinInput) linkedinInput.value = iv.linkedin || '';
    const expInput = document.getElementById('pfExperienceYears');
    if (expInput) {
      const parsedExp = parseInt(String(iv.experience || '').replace(/[^\d]/g, ''), 10);
      expInput.value = Number.isFinite(parsedExp) ? String(parsedExp) : '';
    }
    const bioArea = document.getElementById('pfBio');
    if (bioArea) bioArea.value = iv.bio || '';
    fillSkills(iv.skills || []);
    if (iv.profilePhotoUrl) {
      const url = iv.profilePhotoUrl.startsWith('http') ? iv.profilePhotoUrl : '/uploads/' + iv.profilePhotoUrl;
      document.getElementById('profilePicLg').innerHTML = `<img src="${url}" alt="Profile">`;
      document.getElementById('headerAvatar').innerHTML = `<img src="${url}" alt="Profile" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      const initials = getInitials(iv.fullName || 'Interviewer');
      setText('headerAvatarText', initials);
      setText('profilePicText', initials);
    }
  } catch (e) { console.error('Profile error:', e); }
}

async function loadAssignedInterviews() {
  try {
    const res = await secureFetch('/api/interviewer/assigned-interviews');
    if (!res || !res.ok) return;
    APP.interviews = await res.json();
    const studentFetches = APP.interviews.map(async iv => {
      const rs = await secureFetch(`/api/interviewer/assigned-interviews/${iv.id}/students`);
      APP.studentsByInterview[iv.id] = (rs && rs.ok) ? await rs.json() : [];
    });
    await Promise.all(studentFetches);
    APP.scheduleStudents = APP.interviews.flatMap(iv => (APP.studentsByInterview[iv.id] || []).map(s => normalizeStudent(iv, s)));
    chooseCurrentLiveStudent();
    renderProfileStats();
  } catch (e) { console.error('Assigned interviews error:', e); }
}

function normalizeStudent(interview, student) {
  const dt = interview.scheduledDate ? new Date(interview.scheduledDate) : null;
  const key = String(student.applicationId || interview.id + '_' + student.studentEmail);
  return {
    key,
    interviewId: interview.id,
    name: student.studentName || 'Student',
    email: student.studentEmail || '',
    initials: getInitials(student.studentName || 'ST'),
    institute: interview.instituteName || '—',
    domain: interview.departmentName || 'Interview',
    domains: [interview.departmentName || 'Interview'],
    status: student.applicationStatus || 'PENDING',
    scheduledDate: dt,
    scheduledText: dt ? dt.toLocaleString() : 'TBD',
    className: student.studentClass || '—',
    cgpa: student.cgpa ?? '—',
    resumeUrl: null,
    instituteConfirmed: interview.instituteConfirmed === true
  };
}

function chooseCurrentLiveStudent() {
  const now = Date.now();
  const candidates = APP.scheduleStudents.filter(s => s.status === 'APPROVED' || s.status === 'PENDING');
  candidates.sort((a, b) => {
    const ad = a.scheduledDate ? a.scheduledDate.getTime() : Number.MAX_SAFE_INTEGER;
    const bd = b.scheduledDate ? b.scheduledDate.getTime() : Number.MAX_SAFE_INTEGER;
    return Math.abs(ad - now) - Math.abs(bd - now);
  });
  APP.currentLiveStudent = candidates[0] || null;
}

function renderNotifications() {
  const list = document.getElementById('notifList');
  if (!list) return;
  const upcoming = APP.scheduleStudents.filter(s => !isCompleted(s.key) && (s.status === 'APPROVED' || s.status === 'PENDING'));
  list.innerHTML = '';
  if (!upcoming.length) {
    list.innerHTML = '<div class="notif-item"><div><div style="font-size:13px;">No pending student assignments.</div></div></div>';
    document.getElementById('notifDot').style.display = 'none';
    setText('notifFooterText', 'No new notifications');
    return;
  }
  upcoming.slice(0, 4).forEach(s => {
    list.innerHTML += `<div class="notif-item unread"><div class="notif-icon" style="background:#EFF6FF;color:var(--primary);"><i class="fa-solid fa-user-check"></i></div><div><div style="font-size:13px;font-weight:600;">Student Assigned</div><div style="font-size:12px;color:var(--muted);">${s.name} · ${s.scheduledText}</div></div></div>`;
  });
  setText('notifFooterText', upcoming.length + ' pending assignment(s)');
  document.getElementById('notifDot').style.display = '';
}

function renderScheduleTables() {
  setText('scheduleTodayBadge', new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }));
  const todayBody = document.getElementById('scheduleTodayBody');
  const weekBody = document.getElementById('scheduleWeekBody');
  if (!todayBody || !weekBody) return;

  const now = new Date();
  const today = APP.scheduleStudents.filter(s => s.scheduledDate && s.scheduledDate.toDateString() === now.toDateString());
  const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7);
  const week = APP.scheduleStudents.filter(s => s.scheduledDate && s.scheduledDate > now && s.scheduledDate <= weekEnd);

  todayBody.innerHTML = today.length ? today.map((s, idx) => `<tr><td><div style="display:flex;align-items:center;gap:10px;"><div style="width:34px;height:34px;border-radius:8px;background:#DBEAFE;color:#1E40AF;display:grid;place-items:center;font-weight:800;font-size:12px;">${s.initials}</div><div><b style="font-size:13px;">${s.name}</b><div style="font-size:12px;color:var(--muted);">${s.email || '—'}</div></div></div></td><td><span class="badge bg-info">${s.domain}</span></td><td>${s.institute}</td><td style="white-space:nowrap;">${s.scheduledDate ? s.scheduledDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'TBD'}</td><td>${s.instituteConfirmed ? '<span class="badge bg-success"><i class="fa-solid fa-circle-check"></i> Confirmed</span>' : '<span class="badge bg-pending"><i class="fa-solid fa-clock"></i> Awaiting</span>'}</td><td><span class="badge ${isCompleted(s.key) ? 'bg-success' : 'bg-pending'}">${isCompleted(s.key) ? 'Completed' : 'Upcoming'}</span></td><td><button class="btn btn-info btn-sm" onclick="openStudentModal(${idx}, true)"><i class="fa-solid fa-eye"></i> View</button></td></tr>`).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:20px;">No students assigned for today.</td></tr>';

  weekBody.innerHTML = week.length ? week.map((s, idx) => `<tr><td>${s.scheduledDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td><td>${s.name}</td><td><span class="badge bg-info">${s.domain}</span></td><td>${s.institute}</td><td>${s.scheduledDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td><td>${s.instituteConfirmed ? '<span class="badge bg-success"><i class="fa-solid fa-circle-check"></i> Confirmed</span>' : '<span class="badge bg-pending"><i class="fa-solid fa-clock"></i> Awaiting</span>'}</td></tr>`).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px;">No students scheduled this week.</td></tr>';
}

function renderLiveStudent() {
  const s = APP.currentLiveStudent;
  document.getElementById('proceedBtn').disabled = !s;
  if (!s) return;
  setText('live-avatar', s.initials); setText('live-avatar2', s.initials); setText('eval-avatar', s.initials);
  setText('live-name', s.name); setText('live-name2', s.name); setText('eval-name', s.name);
  setText('live-degree', s.className); setText('info-name', s.name); setText('info-studentId', s.email || '—');
  setText('info-institute', s.institute); setText('info-program', s.domain); setText('info-year', s.className); setText('info-cgpa', s.cgpa);
  setText('live-resume-name', s.resumeUrl ? 'Resume available' : 'No resume uploaded');
  setText('live-resume-name2', s.resumeUrl ? 'Resume available' : 'No resume uploaded');
  document.getElementById('live-resume-btn').disabled = !s.resumeUrl;
  document.getElementById('live-resume-btn2').disabled = !s.resumeUrl;
  document.getElementById('live-domains').innerHTML = `<span class="badge bg-info">${s.domain}</span>`;
  document.getElementById('live-domains2').innerHTML = `<span class="badge bg-info">${s.domain}</span>`;
  document.getElementById('info-domains').innerHTML = `<span class="badge bg-info">${s.domain}</span>`;
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;
  const completed = APP.scheduleStudents.filter(s => isCompleted(s.key));
  const merged = [...completed].sort((a, b) => (b.scheduledDate || 0) - (a.scheduledDate || 0));
  list.innerHTML = merged.map(s => `<div class="history-card" data-institute="${(s.institute || '').toLowerCase()}"><div class="history-card-header"><div style="display:flex;align-items:center;gap:13px;"><div style="width:42px;height:42px;border-radius:10px;background:#DBEAFE;color:#1E40AF;display:grid;place-items:center;font-weight:800;">${s.initials}</div><div><b style="font-size:15px;">${s.name}</b><div style="font-size:12px;color:var(--muted);margin-top:2px;"><i class="fa-solid fa-calendar"></i> ${s.scheduledDate ? s.scheduledDate.toLocaleDateString() : '—'} &nbsp;|&nbsp;<i class="fa-solid fa-building"></i> ${s.institute}</div></div></div><div style="display:flex;align-items:center;gap:10px;"><span class="badge bg-success">Completed</span><button class="btn btn-info btn-sm" onclick="openVideoModal('${(s.name || '').replace(/'/g, "\\'")}','${s.scheduledDate ? s.scheduledDate.toLocaleDateString() : '—'}')"><i class="fa-solid fa-play"></i> Watch</button></div></div><div class="history-card-body"><div class="history-meta"><span>Domain</span><b>${s.domain}</b></div><div class="history-meta"><span>CGPA</span><b>${s.cgpa}</b></div><div class="history-meta"><span>Status</span><b>Evaluation Submitted</b></div></div></div>`).join('');
  populateInstituteFilter(merged);
  applyHistFilters();
}

function populateInstituteFilter(items) {
  const sel = document.getElementById('histInstFilter');
  if (!sel) return;
  const current = sel.value;
  const uniq = [...new Set(items.map(i => i.institute).filter(Boolean))];
  sel.innerHTML = '<option value="">All Institutes</option>' + uniq.map(i => `<option>${i}</option>`).join('');
  sel.value = current;
}

function renderProfileStats() {
  const total = APP.scheduleStudents.length;
  const completed = APP.scheduleStudents.filter(s => isCompleted(s.key)).length;
  setText('profTotalInterviews', total);
  setText('profCompleted', completed);
  setText('profAvgDuration', completed ? '45 min' : '—');
  setText('profOntime', total ? Math.round((completed / total) * 100) + '%' : '—');
}

function renderProfileReviews() {
  const reviews = APP.reviews;
  const list = document.getElementById('reviewList');
  if (!list) return;
  if (!reviews.length) {
    list.innerHTML = 'No reviews yet.';
    setText('reviewsAvgBadge', '—');
    setText('reviewsPositivePct', '—');
    setText('reviewsCount', '0');
    setText('reviewsRating', '—');
    setText('profileRating', '—');
    setText('profileStars', '—');
    return;
  }
  const avg = reviews.reduce((a, r) => a + r.rating, 0) / reviews.length;
  const positive = Math.round((reviews.filter(r => r.rating >= 4).length / reviews.length) * 100);
  setText('reviewsAvgBadge', avg.toFixed(1) + ' Avg');
  setText('reviewsPositivePct', positive + '%');
  setText('reviewsCount', String(reviews.length));
  setText('reviewsRating', '★ ' + avg.toFixed(1));
  setText('profileRating', avg.toFixed(1));
  const starsEl = document.getElementById('profileStars');
  if (starsEl) {
    starsEl.innerHTML = '★★★★★'.slice(0, Math.round(avg)) + '<span style="color:#D1D5DB;">' + '★★★★★'.slice(Math.round(avg)) + '</span>';
  }
  list.innerHTML = reviews.slice(0, 5).map(r => `<div class="review-item"><div style="display:flex;justify-content:space-between;align-items:center;"><b style="font-size:13.5px;">${r.student}</b><div class="review-stars">${'★'.repeat(r.rating)}${'<span style="color:#D1D5DB;">' + '★'.repeat(5 - r.rating) + '</span>'}</div></div><div style="font-size:11.5px;color:var(--muted);margin-top:3px;">${r.domain} · ${r.institute} · ${r.date}</div><div style="font-size:13px;color:var(--dark);margin-top:7px;line-height:1.6;">${r.comment}</div></div>`).join('');
}

function startRealtimeRefresh() {
  if (APP.realtimeStarted) return;
  APP.realtimeStarted = true;
  setInterval(refreshInterviewerDashboard, 30000);
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebarOverlay').classList.toggle('show'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('show'); }
function closeAllDropdowns() { document.getElementById('userDropdown').classList.remove('open'); document.getElementById('notifPanel').classList.remove('open'); }
function toggleUserMenu() { document.getElementById('userDropdown').classList.toggle('open'); document.getElementById('notifPanel').classList.remove('open'); }
function closeUserMenu() { document.getElementById('userDropdown').classList.remove('open'); }
function toggleNotif() { document.getElementById('notifPanel').classList.toggle('open'); document.getElementById('userDropdown').classList.remove('open'); }
function markAllRead() { document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread')); document.getElementById('notifDot').style.display = 'none'; showToast('All notifications marked as read'); document.getElementById('notifPanel').classList.remove('open'); }
function bindOutsideClickClose() { document.addEventListener('click', function (e) { if (!e.target.closest('#notifWrap')) document.getElementById('notifPanel').classList.remove('open'); if (!e.target.closest('#userMenuWrap')) document.getElementById('userDropdown').classList.remove('open'); }); }

function showView(v) {
  document.querySelectorAll('.nav-links a').forEach(l => l.classList.remove('active'));
  const lnk = document.getElementById('link-' + v); if (lnk) lnk.classList.add('active');
  document.querySelectorAll('.content-body').forEach(s => s.classList.remove('active'));
  document.getElementById('view-' + v).classList.add('active');
  const T = { live: 'Live Interview', schedule: 'Schedule', history: 'History', profile: 'Profile' };
  setText('page-title', T[v] || v); setText('breadcrumb-sub', T[v] || v);
  closeSidebar(); closeAllDropdowns();
  if (v === 'history') applyHistFilters();
}

function openOverlay(id) { document.getElementById(id).classList.add('open'); }
function closeOverlay(id) { document.getElementById(id).classList.remove('open'); }
function scrollToSection(id) { setTimeout(() => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 200); }
function setStep(n) { for (let i = 1; i <= 3; i++) { const s = document.getElementById('step' + i); s.classList.remove('active', 'done'); if (i < n) s.classList.add('done'); else if (i === n) s.classList.add('active'); } for (let i = 1; i <= 2; i++) document.getElementById('div' + i).classList.toggle('done', i < n); }
function goToPhase2() { if (!APP.currentLiveStudent) return showToast('No students are available for interview yet.', 'warn'); document.getElementById('phase-info').classList.remove('active'); document.getElementById('phase-live').classList.add('active'); setStep(2); }
function startSession() { document.getElementById('startBtn').disabled = true; document.getElementById('endBtn').disabled = false; APP.seconds = 0; APP.timerInterval = setInterval(() => { APP.seconds++; const h = String(Math.floor(APP.seconds / 3600)).padStart(2, '0'); const m = String(Math.floor((APP.seconds % 3600) / 60)).padStart(2, '0'); const s = String(APP.seconds % 60).padStart(2, '0'); setText('liveClock', `${h}:${m}:${s}`); }, 1000); }
function confirmEndSession() { closeOverlay('endConfirmModal'); clearInterval(APP.timerInterval); document.getElementById('endBtn').disabled = true; setText('evalDuration', document.getElementById('liveClock').innerText); document.getElementById('phase-live').classList.remove('active'); document.getElementById('phase-eval').classList.add('active'); setStep(3); }
function submitEvalAndNext() {
  const perf = document.getElementById('overallPerformance').value;
  if (!perf) return showToast('Please select Overall Performance before submitting.', 'warn');
  if (!APP.currentLiveStudent) return;
  APP.completed[APP.currentLiveStudent.key] = true;
  localStorage.setItem('interviewerCompleted', JSON.stringify(APP.completed));
  const comment = (document.getElementById('remarksField').value || document.getElementById('strengthsField').value || 'Interview completed successfully.').trim();
  APP.reviews.unshift({ student: APP.currentLiveStudent.name, institute: APP.currentLiveStudent.institute, domain: APP.currentLiveStudent.domain, date: new Date().toLocaleDateString(), comment: comment, rating: mapPerformanceToRating(perf) });
  APP.reviews = APP.reviews.slice(0, 25);
  localStorage.setItem('interviewerReviews', JSON.stringify(APP.reviews));
  clearInterval(APP.timerInterval);
  APP.seconds = 0;
  setText('liveClock', '00:00:00');
  document.getElementById('startBtn').disabled = false;
  document.getElementById('endBtn').disabled = true;
  chooseCurrentLiveStudent();
  renderLiveStudent();
  renderHistory();
  renderProfileStats();
  renderProfileReviews();
  document.getElementById('phase-eval').classList.remove('active');
  document.getElementById('phase-live').classList.remove('active');
  document.getElementById('phase-info').classList.add('active');
  setStep(1);
  showToast('Evaluation submitted and history updated.');
}

function openStudentModal(idx, fromToday) {
  const source = fromToday ? APP.scheduleStudents.filter(s => s.scheduledDate && s.scheduledDate.toDateString() === new Date().toDateString()) : APP.scheduleStudents;
  const s = source[idx];
  if (!s) return;
  document.getElementById('studentModalContent').innerHTML = `<div class="student-modal-banner"><div class="student-modal-avatar">${s.initials}</div><div><h3 style="font-size:15px;">${s.name}</h3><p style="font-size:13px;opacity:.85;margin-top:3px;">${s.className}</p><p style="font-size:12px;opacity:.7;margin-top:2px;">${s.email} · ${s.institute}</p></div></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:15px;"><div style="background:#F8FAFC;padding:10px;border-radius:var(--r);border-left:3px solid var(--secondary);"><div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;">CGPA</div><b>${s.cgpa}</b></div><div style="background:#F8FAFC;padding:10px;border-radius:var(--r);border-left:3px solid var(--secondary);"><div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;">Class</div><b>${s.className}</b></div><div style="background:#F8FAFC;padding:10px;border-radius:var(--r);border-left:3px solid var(--secondary);"><div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;">Slot</div><b style="font-size:12.5px;">${s.scheduledText}</b></div></div><div style="margin-bottom:13px;"><div style="font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:6px;">Domain</div><div style="display:flex;flex-wrap:wrap;gap:6px;"><span class="badge bg-info">${s.domain}</span></div></div>`;
  openOverlay('studentModal');
}

function updateHistCount() { const cards = document.querySelectorAll('#historyList .history-card'); let v = 0; cards.forEach(c => { if (c.style.display !== 'none') v++; }); setText('histCount', `${v} record${v !== 1 ? 's' : ''}`); }
function applyHistFilters() { const instVal = (document.getElementById('histInstFilter').value || '').toLowerCase().trim(); let visible = 0; document.querySelectorAll('#historyList .history-card').forEach(card => { const ok = !instVal || (card.getAttribute('data-institute') || '').toLowerCase().includes(instVal); card.style.display = ok ? 'block' : 'none'; if (ok) visible++; }); document.getElementById('historyEmpty').style.display = visible === 0 ? 'block' : 'none'; updateHistCount(); }
function clearHistFilters() { document.getElementById('histInstFilter').value = ''; applyHistFilters(); }
function openVideoModal(s, d) { setText('vm-student', s); setText('vm-date', d); setText('videoModalTitle', `Recording — ${s}`); openOverlay('videoModal'); }

function viewStudentResume() { if (!APP.currentLiveStudent || !APP.currentLiveStudent.resumeUrl) return showToast('No resume uploaded for this student.', 'warn'); window.open(APP.currentLiveStudent.resumeUrl, '_blank'); }
function handleProfilePic(input) { if (!input.files || !input.files[0]) return; const reader = new FileReader(); reader.onload = function (e) { document.getElementById('profilePicLg').innerHTML = `<img src="${e.target.result}" alt="Profile">`; document.getElementById('headerAvatar').innerHTML = `<img src="${e.target.result}" alt="Profile" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`; }; reader.readAsDataURL(input.files[0]); showToast('Profile photo updated!'); }
function handleCvUpload(input) { if (!input.files || !input.files[0]) return; const name = input.files[0].name; const el = document.getElementById('cvFileName'); setText('cvFileNameText', name + ' — ready to upload'); el.style.display = 'flex'; setText('cvName', name); setText('cvDate', new Date().toLocaleDateString()); document.getElementById('cvViewBtn').disabled = false; showToast('CV selected: ' + name); }
function saveProfile() { showToast('Profile details updated in UI. Backend update endpoint can be added next.'); }
function removeSkill(icon) { icon.closest('.skill-tag').remove(); }
function addSkill(e) { if (e.key !== 'Enter') return; const input = document.getElementById('skillInput'); const val = input.value.trim(); if (!val) return; const tag = document.createElement('span'); tag.className = 'skill-tag'; tag.innerHTML = `${val} <i class="fa-solid fa-xmark" onclick="removeSkill(this)"></i>`; document.getElementById('skillTagArea').insertBefore(tag, input); input.value = ''; }
function checkPassStrength() { const v = document.getElementById('newPass').value; const el = document.getElementById('passStrength'); if (!v) { el.style.display = 'none'; return; } el.style.display = 'block'; if (v.length < 6) { el.style.color = '#DC2626'; el.innerText = 'Weak password'; } else if (v.length < 10 || !/[A-Z]/.test(v) || !/[0-9]/.test(v)) { el.style.color = '#EAB308'; el.innerText = 'Medium strength'; } else { el.style.color = '#16A34A'; el.innerText = 'Strong password'; } }
function changePassword() { const np = document.getElementById('newPass').value; const cp = document.getElementById('confirmPass').value; if (!np) return showToast('Enter a new password.', 'warn'); if (np !== cp) return showToast('Passwords do not match.', 'error'); showToast('Password updated successfully!'); document.getElementById('newPass').value = ''; document.getElementById('confirmPass').value = ''; document.getElementById('passStrength').style.display = 'none'; }
function confirmLogout() { closeOverlay('logoutOverlay'); logout(); }
function showToast(msg, type = 'success') { const map = { success: ['#DCFCE7', '#166534'], warn: ['#FEF3C7', '#92400E'], error: ['#FEE2E2', '#991B1B'] }; const colors = map[type] || map.success; const t = document.createElement('div'); t.className = 'toast'; t.style.cssText = `background:${colors[0]};color:${colors[1]};`; t.innerText = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3000); }

function fillSkills(skills) {
  const area = document.getElementById('skillTagArea');
  const input = document.getElementById('skillInput');
  if (!area || !input) return;
  area.querySelectorAll('.skill-tag').forEach(x => x.remove());
  skills.forEach(skill => {
    const tag = document.createElement('span');
    tag.className = 'skill-tag';
    tag.innerHTML = `${skill} <i class="fa-solid fa-xmark" onclick="removeSkill(this)"></i>`;
    area.insertBefore(tag, input);
  });
}
function mapPerformanceToRating(perf) { if (perf.includes('Excellent')) return 5; if (perf.includes('Very Good')) return 5; if (perf.includes('Good')) return 4; if (perf.includes('Average')) return 3; if (perf.includes('Needs')) return 2; return 1; }
function isCompleted(key) { return !!APP.completed[key]; }
function getInitials(name) { return (name || '').split(' ').filter(Boolean).map(x => x[0]).join('').slice(0, 2).toUpperCase() || 'IV'; }
function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }