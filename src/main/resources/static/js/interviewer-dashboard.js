function getAuthHeadersMultipart() {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;
  return { Authorization: 'Bearer ' + token };
}

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
  reviews: JSON.parse(localStorage.getItem('interviewerReviews') || '[]'),
  mediaStream: null,
  mediaRecorder: null,
  recordedChunks: []
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
  renderSlotAlertBanner();
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
      let url = iv.profilePhotoUrl;
      if (!url.startsWith('http') && !url.startsWith('/')) {
        url = '/uploads/' + url;
      }
      document.getElementById('profilePicLg').innerHTML = `<img src="${url}" alt="Profile">`;
      document.getElementById('headerAvatar').innerHTML = `<img src="${url}" alt="Profile" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      const initials = getInitials(iv.fullName || 'Interviewer');
      setText('headerAvatarText', initials);
      setText('profilePicText', initials);
    }

    const cvNameEl  = document.getElementById('cvName');
    const cvDateEl  = document.getElementById('cvDate');
    if (iv.resumeUrl) {
      const rawFile = iv.resumeFileName || iv.resumeUrl;
      const friendlyName = friendlyResumeName(rawFile.split('/').pop());
      if (cvNameEl) cvNameEl.textContent = friendlyName;
      if (cvDateEl && iv.createdAt) {
        cvDateEl.textContent = 'Uploaded ' + new Date(iv.createdAt).toLocaleDateString();
      } else if (cvDateEl) {
        cvDateEl.textContent = 'Uploaded during registration';
      }
      mountResumeEmbed('interviewerProfileResumeEmbed', iv.resumeUrl, iv.resumeFileName, { height: '420px' });
    } else {
      if (cvNameEl) cvNameEl.textContent = 'No CV uploaded';
      if (cvDateEl) cvDateEl.textContent = '—';
      mountResumeEmbed('interviewerProfileResumeEmbed', null, null);
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
    renderSlotAlertBanner();
    renderNotifications();
    renderScheduleTables();
    renderLiveStudent();
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
    resumeUrl: student.resumeUrl || null,
    resumeFileName: student.resumeFileName || null,
    skills: student.skills || [],
    about: student.about || '',
    profilePhotoUrl: student.profilePhotoUrl || null,
    videoUrl: student.videoUrl || null,
    applicationId: student.applicationId || null,
    instituteConfirmed: interview.instituteConfirmed === true,
    projectName: student.projectName || '',
    projectBrief: student.projectBrief || '',
    projectGithub: student.projectGithub || '',
    evaluationSubmitted: !!student.evaluationSubmitted
  };
}

function renderProjectDetailsHtml(s) {
  if (!s || (!s.projectName && !s.projectBrief && !s.projectGithub)) {
    return '<p style="color:var(--muted);">No project details provided.</p>';
  }
  let html = '';
  if (s.projectName) {
    html += '<div><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Project Name</div><b>' + escHtml(s.projectName) + '</b></div>';
  }
  if (s.projectBrief) {
    html += '<div style="margin-top:10px;"><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Brief</div><p style="line-height:1.6;margin:0;">' + escHtml(s.projectBrief) + '</p></div>';
  }
  if (s.projectGithub) {
    html += '<div style="margin-top:10px;"><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">GitHub</div><a href="' + escHtml(s.projectGithub) + '" target="_blank" rel="noopener" style="color:var(--primary);word-break:break-all;">' + escHtml(s.projectGithub) + '</a></div>';
  }
  return html;
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function chooseCurrentLiveStudent() {
  const now = Date.now();
  const candidates = APP.scheduleStudents.filter(s =>
    (s.status === 'APPROVED' || s.status === 'PENDING') && !isCompleted(s.key) && !s.evaluationSubmitted
  );
  candidates.sort((a, b) => {
    const ad = a.scheduledDate ? a.scheduledDate.getTime() : Number.MAX_SAFE_INTEGER;
    const bd = b.scheduledDate ? b.scheduledDate.getTime() : Number.MAX_SAFE_INTEGER;
    return Math.abs(ad - now) - Math.abs(bd - now);
  });
  APP.currentLiveStudent = candidates[0] || null;
}

// ── Returns a live countdown string like "in 2h 15m" or "15m ago" ──
function countdownLabel(date) {
  if (!date) return '';
  const diff = date.getTime() - Date.now();
  const abs  = Math.abs(diff);
  const mins = Math.floor(abs / 60000);
  const hrs  = Math.floor(mins / 60);
  const days = Math.floor(hrs  / 24);
  if (days > 0)      return diff > 0 ? `in ${days}d ${hrs % 24}h`   : `${days}d ago`;
  if (hrs  > 0)      return diff > 0 ? `in ${hrs}h ${mins % 60}m`   : `${hrs}h ago`;
  if (mins > 0)      return diff > 0 ? `in ${mins}m`                : `${mins}m ago`;
  return diff > 0 ? 'starting now' : 'just now';
}

// ── Renders a <span> whose text is updated every second by the ticker ──
function countdownSpan(date, extraStyle) {
  if (!date) return '';
  const ts  = date instanceof Date ? date.getTime() : new Date(date).getTime();
  const st  = extraStyle ? ` style="${extraStyle}"` : '';
  return `<span data-countdown-ts="${ts}"${st}>${countdownLabel(date instanceof Date ? date : new Date(date))}</span>`;
}

// ── Venue / link cell helper ──
function venueCell(iv) {
  if (iv && iv.meetingLink) {
    return `<a href="${iv.meetingLink}" target="_blank" rel="noopener" class="btn btn-s btn-sm" style="font-size:11px;padding:3px 8px;"><i class="fa-solid fa-video"></i> Join</a>`;
  }
  if (iv && iv.scheduledVenue) return `<span style="font-size:12px;">${iv.scheduledVenue}</span>`;
  return '<span style="color:var(--muted);font-size:12px;">TBD</span>';
}

// ── Alert banner on Live view: today's slot OR next upcoming slot ──
function renderSlotAlertBanner() {
  const banner = document.getElementById('slotAlertBanner');
  if (!banner) return;
  const now  = new Date();
  const todayStr = now.toDateString();

  // Interviews with a scheduledDate (interview-level, not student-level)
  const interviewSlots = APP.interviews.map(iv => ({
    iv,
    date: iv.scheduledDate ? new Date(iv.scheduledDate) : null
  })).filter(x => x.date);

  // Sort by date ascending
  interviewSlots.sort((a, b) => a.date - b.date);

  const todaySlots   = interviewSlots.filter(x => x.date.toDateString() === todayStr);
  const futureSlots  = interviewSlots.filter(x => x.date > now);
  const nextSlot     = todaySlots[0] || futureSlots[0];

  if (!nextSlot) { banner.style.display = 'none'; return; }

  const { iv, date } = nextSlot;
  const isToday  = date.toDateString() === todayStr;
  const bgColor  = isToday ? '#FFF7ED' : '#F0F9FF';
  const border   = isToday ? '#FB923C' : '#38BDF8';
  const icon     = isToday ? 'fa-fire' : 'fa-calendar-check';
  const iconCol  = isToday ? '#EA580C' : '#0284C7';
  const label    = isToday ? 'TODAY' : date.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
  const timeFmt  = date.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
  const confirmed = iv.instituteConfirmed;
  const meetBtn  = iv.meetingLink
    ? `<a href="${iv.meetingLink}" target="_blank" rel="noopener" class="btn btn-s btn-sm" style="white-space:nowrap;"><i class="fa-solid fa-video"></i> Join Meeting</a>`
    : (iv.scheduledVenue ? `<span style="font-size:12px;color:#374151;"><i class="fa-solid fa-map-pin" style="margin-right:4px;"></i>${iv.scheduledVenue}</span>` : '');
  const confirmedBadge = confirmed
    ? `<span class="badge bg-success" style="font-size:11px;"><i class="fa-solid fa-circle-check"></i> Institute Confirmed</span>`
    : `<span class="badge bg-pending" style="font-size:11px;"><i class="fa-solid fa-clock"></i> Awaiting Confirmation</span>`;

  banner.style.display = 'block';
  banner.innerHTML = `
    <div style="background:${bgColor};border:1.5px solid ${border};border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
      <div style="width:40px;height:40px;background:${border};border-radius:10px;display:grid;place-items:center;flex-shrink:0;">
        <i class="fa-solid ${icon}" style="color:#fff;font-size:1.1rem;"></i>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:11px;font-weight:800;letter-spacing:.05em;color:${iconCol};text-transform:uppercase;margin-bottom:3px;">
          ${isToday ? '🔥 Interview ' : '📅 Upcoming — '}${label} · ${timeFmt}
          <span style="font-weight:600;color:#6B7280;margin-left:8px;">(${countdownSpan(date)})</span>
        </div>
        <div style="font-size:14px;font-weight:700;color:#111827;">${iv.departmentName || 'Interview'} &nbsp;@&nbsp; ${iv.instituteName || '—'}</div>
        <div style="margin-top:5px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          ${confirmedBadge}
          ${meetBtn}
        </div>
      </div>
      <button onclick="showView('schedule')" class="btn btn-outline btn-sm" style="white-space:nowrap;flex-shrink:0;">
        <i class="fa-solid fa-calendar-alt"></i> View Full Schedule
      </button>
    </div>`;
}

// ── Bell notifications — one card per interview slot ──
function renderNotifications() {
  const list = document.getElementById('notifList');
  if (!list) return;

  const now     = new Date();
  const todayStr = now.toDateString();

  // Deduplicate by interview id — show upcoming/unconfirmed slots
  const upcoming = APP.interviews.filter(iv => {
    const d = iv.scheduledDate ? new Date(iv.scheduledDate) : null;
    return d && d >= now; // future or today
  }).sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));

  list.innerHTML = '';

  if (!upcoming.length) {
    list.innerHTML = '<div class="notif-item"><div><div style="font-size:13px;color:var(--muted);">No upcoming interview slots.</div></div></div>';
    document.getElementById('notifDot').style.display = 'none';
    setText('notifFooterText', 'No new notifications');
    return;
  }

  upcoming.slice(0, 5).forEach(iv => {
    const d = new Date(iv.scheduledDate);
    const isToday = d.toDateString() === todayStr;
    const timeFmt = d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
    const dateFmt = isToday ? 'Today' : d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
    const confirmed = iv.instituteConfirmed;
    const bgIcon   = isToday ? '#FFF7ED' : '#EFF6FF';
    const colIcon  = isToday ? '#EA580C' : 'var(--primary)';
    const icon     = isToday ? 'fa-fire' : 'fa-calendar-check';
    const students = APP.studentsByInterview[iv.id] ? APP.studentsByInterview[iv.id].length : iv.studentCount || 0;
    const confirmedBit = confirmed
      ? `<i class="fa-solid fa-circle-check" style="color:var(--success);font-size:10px;margin-right:3px;"></i> Confirmed`
      : `<i class="fa-solid fa-clock" style="color:#92400E;font-size:10px;margin-right:3px;"></i> Awaiting confirmation`;

    list.innerHTML += `
      <div class="notif-item unread" onclick="showView('schedule')" style="cursor:pointer;">
        <div class="notif-icon" style="background:${bgIcon};color:${colIcon};flex-shrink:0;">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div style="min-width:0;">
          <div style="font-size:13px;font-weight:700;">${isToday ? '🔥 Interview TODAY' : 'Upcoming Interview'}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px;">${iv.departmentName || '—'} @ ${iv.instituteName || '—'}</div>
          <div style="font-size:11.5px;margin-top:3px;display:flex;gap:8px;flex-wrap:wrap;">
            <span><i class="fa-regular fa-clock" style="margin-right:3px;"></i>${dateFmt}, ${timeFmt} (${countdownSpan(d)})</span>
            <span>· ${students} student${students !== 1 ? 's' : ''}</span>
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">${confirmedBit}</div>
        </div>
      </div>`;
  });

  setText('notifFooterText', upcoming.length + ' upcoming slot' + (upcoming.length !== 1 ? 's' : ''));
  document.getElementById('notifDot').style.display = '';
}

// ── Helper: build venue/link cell for a student row (pass the parent interview) ──
function getInterviewForStudent(s) {
  return APP.interviews.find(iv => iv.id === s.interviewId) || null;
}

function renderScheduleTables() {
  setText('scheduleTodayBadge', new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }));
  const todayBody  = document.getElementById('scheduleTodayBody');
  const weekBody   = document.getElementById('scheduleWeekBody');
  const futureBody = document.getElementById('scheduleFutureBody');
  if (!todayBody || !weekBody) return;

  const now     = new Date();
  const todayStr = now.toDateString();
  const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7);

  const today  = APP.scheduleStudents.filter(s => s.scheduledDate && s.scheduledDate.toDateString() === todayStr);
  const week   = APP.scheduleStudents.filter(s => s.scheduledDate && s.scheduledDate > now && s.scheduledDate <= weekEnd);

  todayBody.innerHTML = today.length
    ? today.map((s, idx) => {
        const iv = getInterviewForStudent(s);
        return `<tr>
          <td><div style="display:flex;align-items:center;gap:10px;">
            <div style="width:34px;height:34px;border-radius:8px;background:#DBEAFE;color:#1E40AF;display:grid;place-items:center;font-weight:800;font-size:12px;">${s.initials}</div>
            <div><b style="font-size:13px;">${s.name}</b><div style="font-size:12px;color:var(--muted);">${s.email || '—'}</div></div>
          </div></td>
          <td><span class="badge bg-info">${s.domain}</span></td>
          <td>${s.institute}</td>
          <td style="white-space:nowrap;font-weight:600;">${s.scheduledDate ? s.scheduledDate.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : 'TBD'}
            <div style="font-size:11px;color:var(--muted);font-weight:400;">${s.scheduledDate ? countdownSpan(s.scheduledDate) : ''}</div>
          </td>
          <td>${venueCell(iv)}</td>
          <td>${s.instituteConfirmed ? '<span class="badge bg-success"><i class="fa-solid fa-circle-check"></i> Confirmed</span>' : '<span class="badge bg-pending"><i class="fa-solid fa-clock"></i> Awaiting</span>'}</td>
          <td><span class="badge ${isCompleted(s.key) ? 'bg-success' : 'bg-pending'}">${isCompleted(s.key) ? 'Completed' : 'Upcoming'}</span></td>
          <td><button class="btn btn-info btn-sm" onclick="openStudentModal(${idx}, true)"><i class="fa-solid fa-eye"></i> View</button></td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px;">No students assigned for today.</td></tr>';

  weekBody.innerHTML = week.length
    ? week.map((s, idx) => {
        const iv = getInterviewForStudent(s);
        return `<tr>
          <td><b>${s.scheduledDate.toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}</b></td>
          <td>${s.name}</td>
          <td><span class="badge bg-info">${s.domain}</span></td>
          <td>${s.institute}</td>
          <td style="white-space:nowrap;">${s.scheduledDate.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
            <div style="font-size:11px;color:var(--muted);">${countdownSpan(s.scheduledDate)}</div>
          </td>
          <td>${venueCell(iv)}</td>
          <td>${s.instituteConfirmed ? '<span class="badge bg-success"><i class="fa-solid fa-circle-check"></i> Confirmed</span>' : '<span class="badge bg-pending"><i class="fa-solid fa-clock"></i> Awaiting</span>'}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:20px;">No students scheduled this week.</td></tr>';

  // Future slots — interview-level (grouped per interview, not per student)
  if (futureBody) {
    const futureInterviews = APP.interviews
      .filter(iv => iv.scheduledDate && new Date(iv.scheduledDate) > now)
      .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));

    const setText2 = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setText2('futureSlotsCount', futureInterviews.length + ' slot' + (futureInterviews.length !== 1 ? 's' : ''));

    futureBody.innerHTML = futureInterviews.length
      ? futureInterviews.map(iv => {
          const d = new Date(iv.scheduledDate);
          const students = APP.studentsByInterview[iv.id] ? APP.studentsByInterview[iv.id].length : iv.studentCount || 0;
          const statusBadge = iv.status === 'CONFIRMED'
            ? `<span class="badge bg-success">Confirmed</span>`
            : iv.status === 'AWAITING_CONFIRMATION'
              ? `<span class="badge bg-pending">Awaiting</span>`
              : `<span class="badge bg-info">${iv.status || '—'}</span>`;
          return `<tr>
            <td><b>${d.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}</b>
              <div style="font-size:11px;color:var(--muted);">${d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })} · ${countdownSpan(d)}</div>
            </td>
            <td><span class="badge bg-info">${iv.departmentName || '—'}</span></td>
            <td>${iv.instituteName || '—'}</td>
            <td><span class="badge bg-pending" style="background:#F3F4F6;color:#374151;">${students} student${students !== 1 ? 's' : ''}</span></td>
            <td>${venueCell(iv)}</td>
            <td>${statusBadge}</td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px;">No future slots assigned.</td></tr>';
  }
}

function renderLiveStudent() {
  const s = APP.currentLiveStudent;
  document.getElementById('proceedBtn').disabled = !s;
  if (!s) {
    mountResumeEmbed('liveResumeEmbed', null, null);
    mountResumeEmbed('liveResumeEmbed2', null, null);
    return;
  }
  setText('live-avatar', s.initials); setText('live-avatar2', s.initials); setText('eval-avatar', s.initials);
  setText('live-name', s.name); setText('live-name2', s.name); setText('eval-name', s.name);
  setText('live-degree', s.className + ' · ' + s.institute);
  const resumeLabel = s.resumeUrl ? friendlyResumeName(s.resumeFileName) : 'No resume uploaded';
  setText('live-resume-name', resumeLabel);
  setText('live-resume-name2', resumeLabel);
  mountResumeEmbed('liveResumeEmbed', s.resumeUrl, s.resumeFileName, { height: '460px' });
  mountResumeEmbed('liveResumeEmbed2', s.resumeUrl, s.resumeFileName, { height: '360px' });
  const projectsHtml = renderProjectDetailsHtml(s);
  const projEl = document.getElementById('info-projects');
  if (projEl) projEl.innerHTML = projectsHtml;
  const projLive = document.getElementById('info-projects-live');
  if (projLive) projLive.innerHTML = projectsHtml;
  if (s.profilePhotoUrl) {
    const photoUrl = s.profilePhotoUrl.startsWith('http') ? s.profilePhotoUrl : '/uploads/' + s.profilePhotoUrl;
    const avatarImg = '<img src="' + photoUrl + '" alt="' + s.name + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
    ['live-avatar','live-avatar2','eval-avatar'].forEach(function(id) { const el = document.getElementById(id); if (el) el.innerHTML = avatarImg; });
  } else {
    ['live-avatar','live-avatar2','eval-avatar'].forEach(function(id) { const el = document.getElementById(id); if (el) el.textContent = s.initials; });
  }
  document.getElementById('live-domains').innerHTML = `<span class="badge bg-info">${s.domain}</span>`;
  document.getElementById('live-domains2').innerHTML = `<span class="badge bg-info">${s.domain}</span>`;
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;
  const completed = APP.scheduleStudents.filter(s => isCompleted(s.key));
  const merged = [...completed].sort((a, b) => (b.scheduledDate || 0) - (a.scheduledDate || 0));
  list.innerHTML = merged.map(s => `<div class="history-card" data-institute="${(s.institute || '').toLowerCase()}"><div class="history-card-header"><div style="display:flex;align-items:center;gap:13px;"><div style="width:42px;height:42px;border-radius:10px;background:#DBEAFE;color:#1E40AF;display:grid;place-items:center;font-weight:800;">${s.initials}</div><div><b style="font-size:15px;">${s.name}</b><div style="font-size:12px;color:var(--muted);margin-top:2px;"><i class="fa-solid fa-calendar"></i> ${s.scheduledDate ? s.scheduledDate.toLocaleDateString() : '—'} &nbsp;|&nbsp;<i class="fa-solid fa-building"></i> ${s.institute}</div></div></div><div style="display:flex;align-items:center;gap:10px;"><span class="badge bg-success">Completed</span><button class="btn btn-info btn-sm" onclick="openVideoModal('${(s.name || '').replace(/'/g, "\\'")}','${s.scheduledDate ? s.scheduledDate.toLocaleDateString() : '—'}', ${JSON.stringify(s.applicationId)}, ${JSON.stringify(s.interviewId)}, ${s.videoUrl ? '\'' + s.videoUrl.replace(/'/g, '%27') + '\'' : 'null'})"><i class="fa-solid fa-play"></i> Watch</button></div></div><div class="history-card-body"><div class="history-meta"><span>Domain</span><b>${s.domain}</b></div><div class="history-meta"><span>CGPA</span><b>${s.cgpa}</b></div><div class="history-meta"><span>Status</span><b>Evaluation Submitted</b></div></div></div>`).join('');
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

  // Full server refresh every 30s (picks up new assignments etc.)
  setInterval(refreshInterviewerDashboard, 30000);

  // 1-second live ticker — updates countdown text in-place + auto-advances slot
  setInterval(function () {
    // 1. Tick every countdown label already in the DOM
    document.querySelectorAll('[data-countdown-ts]').forEach(el => {
      const ts = parseInt(el.getAttribute('data-countdown-ts'), 10);
      el.textContent = countdownLabel(new Date(ts));
    });

    // 2. Check if the currently-shown slot has passed — if so, pick the next one
    const interviews = APP.interviews || [];
    const now = new Date();
    const upcoming = interviews
      .filter(iv => iv.scheduledDate && new Date(iv.scheduledDate) > now)
      .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));

    // Re-render banner only when the "next" slot changes (avoid DOM thrash every second)
    const nextId = upcoming.length ? upcoming[0].id : null;
    if (nextId !== APP._lastBannerSlotId) {
      APP._lastBannerSlotId = nextId;
      renderSlotAlertBanner();
      renderNotifications();
      renderScheduleTables();
      chooseCurrentLiveStudent();
      renderLiveStudent();
    }
  }, 1000);
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
function closeOverlay(id) { document.getElementById(id).classList.remove('open'); if (id === 'resumeViewerModal') { const frame = document.getElementById('resumeViewerFrame'); const obj = document.getElementById('resumeViewerObject'); if (frame) frame.src = ''; if (obj) obj.data = ''; } if (id === 'videoModal') { const videoEl = document.getElementById('vmVideoPlayer'); if (videoEl) { videoEl.pause(); videoEl.src = ''; videoEl.load(); } } }
function scrollToSection(id) { setTimeout(() => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 200); }
function setStep(n) { for (let i = 1; i <= 3; i++) { const s = document.getElementById('step' + i); s.classList.remove('active', 'done'); if (i < n) s.classList.add('done'); else if (i === n) s.classList.add('active'); } for (let i = 1; i <= 2; i++) document.getElementById('div' + i).classList.toggle('done', i < n); }
function goToPhase2() { if (!APP.currentLiveStudent) return showToast('No students are available for interview yet.', 'warn'); document.getElementById('phase-info').classList.remove('active'); document.getElementById('phase-live').classList.add('active'); setStep(2); }
async function startSession() {
  if (!APP.currentLiveStudent) return;
  document.getElementById('startBtn').disabled = true;
  document.getElementById('endBtn').disabled = false;
  APP.seconds = 0;
  APP.recordedChunks = [];
  APP.timerInterval = setInterval(() => {
    APP.seconds++;
    const h = String(Math.floor(APP.seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((APP.seconds % 3600) / 60)).padStart(2, '0');
    const s = String(APP.seconds % 60).padStart(2, '0');
    setText('liveClock', `${h}:${m}:${s}`);
  }, 1000);
  try {
    APP.mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const videoEl = document.getElementById('sessionWebcam');
    const placeholder = document.getElementById('webcamPlaceholder');
    if (videoEl) {
      videoEl.srcObject = APP.mediaStream;
      videoEl.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
    APP.mediaRecorder = new MediaRecorder(APP.mediaStream, { mimeType: mime });
    APP.mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) APP.recordedChunks.push(e.data); };
    APP.mediaRecorder.start(1000);
    showToast('Webcam and recording started');
  } catch (e) {
    console.error(e);
    showToast('Could not access webcam. Check browser permissions.', 'warn');
  }
}
async function stopWebcamAndUpload() {
  const s = APP.currentLiveStudent;
  if (APP.mediaRecorder && APP.mediaRecorder.state !== 'inactive') {
    await new Promise((resolve) => {
      APP.mediaRecorder.onstop = resolve;
      APP.mediaRecorder.stop();
    });
  }
  if (APP.mediaStream) {
    APP.mediaStream.getTracks().forEach(t => t.stop());
    APP.mediaStream = null;
  }
  const videoEl = document.getElementById('sessionWebcam');
  const placeholder = document.getElementById('webcamPlaceholder');
  if (videoEl) { videoEl.srcObject = null; videoEl.style.display = 'none'; }
  if (placeholder) placeholder.style.display = '';
  if (!s || !APP.recordedChunks.length) return;
  const blob = new Blob(APP.recordedChunks, { type: 'video/webm' });
  const formData = new FormData();
  formData.append('video', blob, 'interview_' + s.applicationId + '.webm');
  try {
    const uploadHeaders = getAuthHeadersMultipart() || {};
    const res = await fetch(`/api/interviewer/assigned-interviews/${s.interviewId}/students/${s.applicationId}/upload-video`, {
      method: 'POST',
      headers: uploadHeaders,
      body: formData
    });
    if (res.ok) {
      const data = await res.json();
      s.videoUrl = data.videoUrl || s.videoUrl;
      showToast('Interview recording saved');
    } else {
      showToast('Recording upload failed', 'warn');
    }
  } catch (e) {
    console.error(e);
    showToast('Recording upload error', 'error');
  }
  APP.recordedChunks = [];
  APP.mediaRecorder = null;
}
async function confirmEndSession() {
  closeOverlay('endConfirmModal');
  clearInterval(APP.timerInterval);
  document.getElementById('endBtn').disabled = true;
  setText('evalDuration', document.getElementById('liveClock').innerText);
  await stopWebcamAndUpload();
  document.getElementById('phase-live').classList.remove('active');
  document.getElementById('phase-eval').classList.add('active');
  setStep(3);
}
async function submitEvalAndNext() {
  const perf = document.getElementById('overallPerformance').value;
  if (!perf) return showToast('Please select Overall Performance before submitting.', 'warn');
  if (!APP.currentLiveStudent) return;
  const s = APP.currentLiveStudent;
  const payload = {
    applicationId: s.applicationId,
    technicalScore: parseInt(document.getElementById('v1').innerText, 10),
    communicationScore: parseInt(document.getElementById('v2').innerText, 10),
    domainScore: parseInt(document.getElementById('v3').innerText, 10),
    approachScore: parseInt(document.getElementById('v4').innerText, 10),
    confidenceScore: parseInt(document.getElementById('v5').innerText, 10),
    overallPerformance: perf,
    strengths: document.getElementById('strengthsField').value.trim(),
    improvements: document.getElementById('improvField') ? document.getElementById('improvField').value.trim() : '',
    remarks: document.getElementById('remarksField').value.trim()
  };
  try {
    const res = await secureFetch('/api/interviewer/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res || !res.ok) {
      const err = res ? await res.text() : 'Failed';
      showToast(err || 'Could not save evaluation', 'error');
      return;
    }
  } catch (e) {
    showToast('Could not save evaluation', 'error');
    return;
  }
  APP.completed[s.key] = true;
  localStorage.setItem('interviewerCompleted', JSON.stringify(APP.completed));
  s.evaluationSubmitted = true;
  const comment = (payload.remarks || payload.strengths || 'Interview completed successfully.').trim();
  APP.reviews.unshift({ student: s.name, institute: s.institute, domain: s.domain, date: new Date().toLocaleDateString(), comment: comment, rating: mapPerformanceToRating(perf) });
  APP.reviews = APP.reviews.slice(0, 25);
  localStorage.setItem('interviewerReviews', JSON.stringify(APP.reviews));
  clearInterval(APP.timerInterval);
  APP.seconds = 0;
  setText('liveClock', '00:00:00');
  document.getElementById('overallPerformance').value = '';
  document.getElementById('strengthsField').value = '';
  if (document.getElementById('improvField')) document.getElementById('improvField').value = '';
  document.getElementById('remarksField').value = '';
  setText('evalDuration', '00:00:00');
  document.getElementById('startBtn').disabled = false;
  document.getElementById('endBtn').disabled = true;
  chooseCurrentLiveStudent();
  await loadAssignedInterviews();
  renderLiveStudent();
  renderHistory();
  renderProfileStats();
  renderProfileReviews();
  document.getElementById('phase-eval').classList.remove('active');
  document.getElementById('phase-live').classList.remove('active');
  document.getElementById('phase-info').classList.add('active');
  setStep(1);
  if (APP.currentLiveStudent) {
    showToast('Evaluation submitted! Next up: ' + APP.currentLiveStudent.name);
  } else {
    showToast('Evaluation submitted. All assigned students are done!');
  }
}

function openStudentModal(idx, fromToday) {
  const source = fromToday ? APP.scheduleStudents.filter(s => s.scheduledDate && s.scheduledDate.toDateString() === new Date().toDateString()) : APP.scheduleStudents;
  const s = source[idx];
  if (!s) return;
  const detailsHtml =
    `<div class="student-modal-banner"><div class="student-modal-avatar">${s.initials}</div><div><h3 style="font-size:15px;">${s.name}</h3><p style="font-size:13px;opacity:.85;margin-top:3px;">${s.className}</p><p style="font-size:12px;opacity:.7;margin-top:2px;">${s.email} · ${s.institute}</p></div></div>` +
    `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:15px;">` +
    `<div style="background:#F8FAFC;padding:10px;border-radius:var(--r);border-left:3px solid var(--secondary);"><div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;">Class</div><b>${s.className}</b></div>` +
    `<div style="background:#F8FAFC;padding:10px;border-radius:var(--r);border-left:3px solid var(--secondary);"><div style="font-size:10.5px;color:var(--muted);text-transform:uppercase;">Slot</div><b style="font-size:12.5px;">${s.scheduledText}</b></div></div>` +
    `<div style="margin-bottom:13px;"><div style="font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:6px;">Domain</div><div style="display:flex;flex-wrap:wrap;gap:6px;"><span class="badge bg-info">${s.domain}</span></div></div>`;
  document.getElementById('studentModalContent').innerHTML = wrapDetailsWithResume(detailsHtml, s.resumeUrl, s.resumeFileName, { height: '480px' });
  openOverlay('studentModal');
}

function updateHistCount() { const cards = document.querySelectorAll('#historyList .history-card'); let v = 0; cards.forEach(c => { if (c.style.display !== 'none') v++; }); setText('histCount', `${v} record${v !== 1 ? 's' : ''}`); }
function applyHistFilters() { const instVal = (document.getElementById('histInstFilter').value || '').toLowerCase().trim(); let visible = 0; document.querySelectorAll('#historyList .history-card').forEach(card => { const ok = !instVal || (card.getAttribute('data-institute') || '').toLowerCase().includes(instVal); card.style.display = ok ? 'block' : 'none'; if (ok) visible++; }); document.getElementById('historyEmpty').style.display = visible === 0 ? 'block' : 'none'; updateHistCount(); }
function clearHistFilters() { document.getElementById('histInstFilter').value = ''; applyHistFilters(); }
// ================================================================
// CHANGES TO: interviewer-dashboard.js
//
// 1. In normalizeStudent() — add videoUrl field (one line)
// 2. In renderHistory() — pass applicationId and videoUrl to openVideoModal()
// 3. Replace openVideoModal() — new version with upload logic
// 4. Add new helper functions: handleVideoFileDrop, handleVideoFileSelected,
//    submitVideoUpload, downloadCurrentVideo
// ================================================================


// ── CHANGE 1: In normalizeStudent(), add videoUrl after profilePhotoUrl ──
// Find this block:
//    profilePhotoUrl: student.profilePhotoUrl || null,
//    instituteConfirmed: interview.instituteConfirmed === true
// Replace with:
//    profilePhotoUrl: student.profilePhotoUrl || null,
//    videoUrl: student.videoUrl || null,           // ← ADD THIS LINE
//    applicationId: student.applicationId || null,  // already stored in key but explicit is safer
//    instituteConfirmed: interview.instituteConfirmed === true


// ── CHANGE 2: In renderHistory(), update the Watch button onclick ──
// Find:
//   onclick="openVideoModal('${(s.name || '').replace(/'/g, "\\'")}','${s.scheduledDate ? s.scheduledDate.toLocaleDateString() : '—'}')"
// Replace with:
//   onclick="openVideoModal('${(s.name || '').replace(/'/g, "\\'")}','${s.scheduledDate ? s.scheduledDate.toLocaleDateString() : '—'}', ${JSON.stringify(s.applicationId)}, ${JSON.stringify(s.interviewId)}, ${JSON.stringify(s.videoUrl)})"


// ── CHANGE 3: Replace the existing openVideoModal function ──
// Find (line ~601):
//   function openVideoModal(s, d) { setText('vm-student', s); setText('vm-date', d); setText('videoModalTitle', `Recording — ${s}`); openOverlay('videoModal'); }
// Replace with the full block below:

/** State for the video upload modal */
const VIDEO_MODAL = {
  applicationId: null,
  interviewId: null,
  selectedFile: null,
  currentVideoUrl: null
};

function openVideoModal(studentName, date, applicationId, interviewId, existingVideoUrl) {
  setText('vm-student', studentName);
  setText('vm-date', date);
  setText('videoModalTitle', 'Recording — ' + studentName);

  VIDEO_MODAL.applicationId = applicationId;
  VIDEO_MODAL.interviewId = interviewId;
  VIDEO_MODAL.selectedFile = null;
  VIDEO_MODAL.currentVideoUrl = existingVideoUrl || null;

  // Reset upload area
  const progressWrap = document.getElementById('vmUploadProgress');
  if (progressWrap) progressWrap.style.display = 'none';
  const uploadBtn = document.getElementById('vmUploadBtn');
  const fileInput = document.getElementById('vmFileInput');
  if (fileInput) fileInput.value = '';
  // Reset file card
  const fileCard = document.getElementById('vmFileCard');
  if (fileCard) fileCard.style.display = 'none';
  const uploadArea = document.getElementById('vmUploadArea');
  const btnText = document.getElementById('vmUploadBtnText');
  if (existingVideoUrl) {
    // Video exists: enable Replace button, hide upload drag area
    if (uploadBtn) uploadBtn.disabled = false;
    if (btnText) btnText.textContent = 'Replace Recording';
    if (uploadArea) uploadArea.style.display = 'none';
  } else {
    // No video: disable Save button until file selected, show upload drag area
    if (uploadBtn) uploadBtn.disabled = true;
    if (btnText) btnText.textContent = 'Save Recording';
    if (uploadArea) uploadArea.style.display = '';
  }

  // Show existing video or placeholder
  const playerWrap = document.getElementById('vmPlayerWrap');
  const placeholder = document.getElementById('vmPlaceholder');
  const downloadBtn = document.getElementById('vmDownloadBtn');
  const statusEl = document.getElementById('vm-status');

  if (existingVideoUrl) {
    const videoEl = document.getElementById('vmVideoPlayer');
    if (videoEl) { videoEl.src = existingVideoUrl; videoEl.load(); }
    if (playerWrap) playerWrap.style.display = '';
    if (placeholder) placeholder.style.display = 'none';
    if (downloadBtn) downloadBtn.style.display = '';
    if (statusEl) statusEl.textContent = 'Uploaded';
  } else {
    if (playerWrap) playerWrap.style.display = 'none';
    if (placeholder) placeholder.style.display = '';
    if (downloadBtn) downloadBtn.style.display = 'none';
    if (statusEl) statusEl.textContent = 'Not uploaded';
  }

  openOverlay('videoModal');
}

function handleVideoFileDrop(event) {
  event.preventDefault();
  document.getElementById('vmUploadArea').style.borderColor = '#CBD5E1';
  const file = event.dataTransfer.files[0];
  if (file) handleVideoFileSelected(file);
}

function handleVideoFileSelected(file) {
  if (!file) return;
  const allowedExts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
  const ext = file.name.split('.').pop().toLowerCase();

  if (!allowedExts.includes(ext)) {
    showToast('Unsupported file type. Please upload MP4, WebM, MOV, AVI, or MKV.', 'error');
    return;
  }

  VIDEO_MODAL.selectedFile = file;

  // Hide upload area, show file card
  const uploadArea = document.getElementById('vmUploadArea');
  if (uploadArea) uploadArea.style.display = 'none';

  const fileCard = document.getElementById('vmFileCard');
  if (fileCard) fileCard.style.display = '';

  const fileNameEl = document.getElementById('vmSelectedFileName');
  if (fileNameEl) fileNameEl.textContent = file.name;

  const fileSizeEl = document.getElementById('vmSelectedFileSize');
  if (fileSizeEl) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    fileSizeEl.textContent = mb + ' MB · Ready to upload';
  }

  // Reset progress bar
  const pctEl = document.getElementById('vmUploadPct');
  const bar = document.getElementById('vmProgressBar');
  if (pctEl) pctEl.textContent = '0%';
  if (bar) bar.style.width = '0%';

  const uploadBtn = document.getElementById('vmUploadBtn');
  if (uploadBtn) uploadBtn.disabled = false;
  // Change button text so user knows clicking it will upload
  const btnText2 = document.getElementById('vmUploadBtnText');
  if (btnText2) btnText2.textContent = 'Upload Now';
}

function clearSelectedVideo() {
  VIDEO_MODAL.selectedFile = null;
  // Reset file input
  const fileInput = document.getElementById('vmFileInput');
  if (fileInput) fileInput.value = '';
  // Hide file card, show upload area
  const fileCard = document.getElementById('vmFileCard');
  if (fileCard) fileCard.style.display = 'none';
  const uploadArea = document.getElementById('vmUploadArea');
  if (uploadArea) uploadArea.style.display = '';
  // Restore button state based on whether a video already exists
  const uploadBtn = document.getElementById('vmUploadBtn');
  const btnText = document.getElementById('vmUploadBtnText');
  if (VIDEO_MODAL.currentVideoUrl) {
    if (uploadBtn) uploadBtn.disabled = false;
    if (btnText) btnText.textContent = 'Replace Recording';
  } else {
    if (uploadBtn) uploadBtn.disabled = true;
    if (btnText) btnText.textContent = 'Save Recording';
  }
}

function handleUploadBtnClick() {
  // If no file selected yet (Replace mode), show the upload area and trigger file picker
  if (!VIDEO_MODAL.selectedFile) {
    const uploadArea = document.getElementById('vmUploadArea');
    if (uploadArea) uploadArea.style.display = '';
    document.getElementById('vmFileInput').click();
  } else {
    submitVideoUpload();
  }
}

async function submitVideoUpload() {
  if (!VIDEO_MODAL.selectedFile || !VIDEO_MODAL.applicationId || !VIDEO_MODAL.interviewId) {
    showToast('Please select a video file first.', 'error');
    return;
  }

  const token = getToken();
  const formData = new FormData();
  formData.append('video', VIDEO_MODAL.selectedFile);

  const uploadBtn = document.getElementById('vmUploadBtn');
  const bar = document.getElementById('vmProgressBar');
  const pctEl = document.getElementById('vmUploadPct');
  if (uploadBtn) {
    uploadBtn.disabled = true;
    // Swap icon to spinner without destroying vmUploadBtnText span
    const icon = uploadBtn.querySelector('i');
    if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
    const btnText = document.getElementById('vmUploadBtnText');
    if (btnText) btnText.textContent = 'Uploading…';
  }

  try {
    // Use XMLHttpRequest to track upload progress
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/interviewer/assigned-interviews/${VIDEO_MODAL.interviewId}/students/${VIDEO_MODAL.applicationId}/upload-video`);
      xhr.setRequestHeader('Authorization', 'Bearer ' + token);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          if (bar) bar.style.width = pct + '%';
          if (pctEl) pctEl.textContent = pct + '%';
        }
        // Show progress bar in file card on first progress event
        const progressWrap = document.getElementById('vmUploadProgress');
        if (progressWrap) progressWrap.style.display = '';
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          VIDEO_MODAL.currentVideoUrl = data.videoUrl;

          // Update player
          const videoEl = document.getElementById('vmVideoPlayer');
          const playerWrap = document.getElementById('vmPlayerWrap');
          const placeholder = document.getElementById('vmPlaceholder');
          const downloadBtn = document.getElementById('vmDownloadBtn');
          const statusEl = document.getElementById('vm-status');
          if (videoEl) videoEl.src = data.videoUrl;
          if (playerWrap) playerWrap.style.display = '';
          if (placeholder) placeholder.style.display = 'none';
          if (downloadBtn) downloadBtn.style.display = '';
          if (statusEl) statusEl.textContent = 'Uploaded';
          if (pctEl) pctEl.textContent = '100%';

          // Hide the file card now that upload is done
          const fileCard = document.getElementById('vmFileCard');
          if (fileCard) fileCard.style.display = 'none';
          // Update button label to Replace for future uploads
          const btnText = document.getElementById('vmUploadBtnText');
          if (btnText) btnText.textContent = 'Replace Recording';

          // Update in-memory data so the history card reflects it without reload
          const student = APP.scheduleStudents.find(s => s.applicationId == VIDEO_MODAL.applicationId);
          if (student) student.videoUrl = data.videoUrl;

          showToast('Video uploaded successfully!', 'success');
          resolve();
        } else {
          reject(new Error(xhr.responseText || 'Upload failed'));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });
  } catch (e) {
    showToast('Upload failed: ' + e.message, 'error');
    if (bar) bar.style.width = '0%';
    if (pctEl) pctEl.textContent = 'Error';
  } finally {
    if (uploadBtn) {
      uploadBtn.disabled = false;
      // Restore the icon WITHOUT destroying vmUploadBtnText span
      const icon = uploadBtn.querySelector('i');
      if (icon) { icon.className = 'fa-solid fa-cloud-arrow-up'; }
      else {
        const i = document.createElement('i');
        i.className = 'fa-solid fa-cloud-arrow-up';
        uploadBtn.prepend(i);
      }
    }
  }
}

function downloadCurrentVideo() {
  if (!VIDEO_MODAL.currentVideoUrl) return;
  const a = document.createElement('a');
  a.href = VIDEO_MODAL.currentVideoUrl;
  a.download = '';
  a.click();
}


function viewStudentResume() {
  if (!APP.currentLiveStudent || !APP.currentLiveStudent.resumeUrl) {
    return showToast('No resume uploaded for this student.', 'warn');
  }
  const resumeUrl = APP.currentLiveStudent.resumeUrl;
  // Build absolute URL to ensure iframe/object and download link work correctly
  const absUrl = resumeUrl.startsWith('http') ? resumeUrl : window.location.origin + resumeUrl;
  const studentName = APP.currentLiveStudent.name || 'Candidate';
  const fileName = APP.currentLiveStudent.resumeFileName
    ? decodeURIComponent(APP.currentLiveStudent.resumeFileName.replace(/^\d+_/, ''))
    : 'Resume';
  document.getElementById('resumeViewerTitle').textContent = studentName + ' — ' + fileName;
  document.getElementById('resumeDownloadLink').href = absUrl;
  // Set both object[data] (primary) and iframe[src] (fallback)
  const obj = document.getElementById('resumeViewerObject');
  const frame = document.getElementById('resumeViewerFrame');
  if (obj) obj.data = absUrl;
  if (frame) frame.src = absUrl + '#toolbar=1&navpanes=0';
  openOverlay('resumeViewerModal');
}
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