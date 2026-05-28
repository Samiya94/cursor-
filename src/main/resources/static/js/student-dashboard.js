/* ============================================================
   student-dashboard.js  –  All data fetched from the backend
   ============================================================ */

function getAuthHeaders() {
  var token = localStorage.getItem('accessToken');
  if (!token) return null;
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
}

function getAuthHeadersMultipart() {
  var token = localStorage.getItem('accessToken');
  if (!token) return null;
  return { 'Authorization': 'Bearer ' + token };
}
function getInitials(n) {
  return (n || 'S').split(' ').filter(Boolean).map(function(w){return w[0];}).join('').toUpperCase().slice(0,2) || 'ST';
}
function setVal(id, v) { var el = document.getElementById(id); if (el && v != null) el.value = v; }
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function pad2(n) { return n < 10 ? '0' + n : '' + n; }

var KNOWN_DEGREES = ['BE','BTech','BSc','BCA','MCA','MTech','MBA'];
var STUDENT = {
  name:'', firstName:'', lastName:'', email:'',
  phone:'', department:'', instituteName:'', class:'',
  year:'SY', degree:'MCA', about:'', skills:[], cgpa:null,
  projectName:'', projectBrief:'', projectGithub:''
};
var DASHBOARD_STATS = null;
var MY_INTERVIEWS   = [];
var FEEDBACK_REPORTS = [];
var CURRENT_REPORT = null;
var ratingPending = null, ratingGiven = {}, ratingValue = 0;
var appliedSlots  = {};
var STUDENT_RESUME = {
  url: null,
  fileName: null
};

window.addEventListener('DOMContentLoaded', async function() {
  if (!await checkAuth('STUDENT')) return;
  await loadDashboardStats();
  initStudentUI();
  initNotifications();   // load stored notifs, render panel + badge
  renderUpcomingInterviewCard();
  renderInterviewTimeline();
  await loadFeedbackReports();
  renderFeedbackReports();
  renderSkillMasteryProgress();

  await loadMyApplicationsFromAPI();            // My Interviews tab
  await loadAvailableInterviewsFromAPI();       // Dashboard slot + Apply/Browse tab
  initSkillTags();

  await loadMyResume();
  renderProfileStats();

  // Initial notification sync from freshly loaded data
  try {
    var initAppsRes = await secureFetch('/api/applications/my');
    if (initAppsRes && initAppsRes.ok) {
      var initApps = await initAppsRes.json();
      syncNotificationsFromData(initApps, window.API_INTERVIEW_SLOTS || []);
    }
  } catch(e) { /* silent */ }

  startNotifPolling();
  startRealtimeRefresh();
});

async function loadDashboardStats() {
  try {
    var res = await secureFetch('/api/student/dashboard-stats', { method:'GET' });
    if (!res) return;
    if (!res.ok) return;
    DASHBOARD_STATS = await res.json();
    var cls = DASHBOARD_STATS.studentClass || 'SYMCA';
    STUDENT = {
      firstName:     DASHBOARD_STATS.firstName     || 'Student',
      lastName:      DASHBOARD_STATS.lastName      || '',
      name:          ((DASHBOARD_STATS.firstName||'') + ' ' + (DASHBOARD_STATS.lastName||'')).trim() || 'Student',
      email:         DASHBOARD_STATS.email         || '',
      phone:         DASHBOARD_STATS.phone         || '',
      class:         cls,
      year:          cls.slice(0,2) || 'SY',
      degree:        cls.slice(2)   || 'MCA',
      department:    DASHBOARD_STATS.departmentName  || '',
      instituteName: DASHBOARD_STATS.instituteName   || '',
      about:         DASHBOARD_STATS.about           || '',
      skills:        DASHBOARD_STATS.skills          || [],
      cgpa:          DASHBOARD_STATS.cgpa
    };
    MY_INTERVIEWS = (DASHBOARD_STATS.interviews || []).map(function(iv) {
      return {
        id: iv.interviewRequestId,
        applicationId: iv.applicationId,
        topic: iv.topic,
        expertise: iv.expertise,
        dateTime: iv.dateTime,
        status: iv.status,
        contactPerson: iv.assignedInterviewerName || iv.contactPerson || '',
        remarks: iv.remarks,
        scheduledDate: iv.scheduledDate,
        meetingLink: iv.meetingLink,
        scheduledVenue: iv.scheduledVenue,
        assignedInterviewerName: iv.assignedInterviewerName
      };
    });
    if (DASHBOARD_STATS.projectName) STUDENT.projectName = DASHBOARD_STATS.projectName;
    if (DASHBOARD_STATS.projectBrief) STUDENT.projectBrief = DASHBOARD_STATS.projectBrief;
    if (DASHBOARD_STATS.projectGithub) STUDENT.projectGithub = DASHBOARD_STATS.projectGithub;
    // Seed resume info from dashboard-stats so it's available before loadResumeInfo() runs
    if (DASHBOARD_STATS.resumeFileName) {
      STUDENT_RESUME.url = DASHBOARD_STATS.resumeUrl || null;
      STUDENT_RESUME.fileName = DASHBOARD_STATS.resumeFileName || null;
    }
    try { localStorage.setItem('currentStudent', JSON.stringify(STUDENT)); } catch(e){}
  } catch(e) { console.error('Dashboard load error:', e); }
}

function initStudentUI() {
  var name = STUDENT.name || 'Student';
  var ini  = getInitials(name);
  var cls  = STUDENT.class;
  var fn   = STUDENT.firstName || name.split(' ')[0] || 'Student';
  var ln   = STUDENT.lastName  || name.split(' ').slice(1).join(' ') || '';

  var ha = document.getElementById('headerAvatar'); if(ha) ha.textContent = ini;
  var hn = document.getElementById('headerName');   if(hn) hn.textContent = name;
  var hs = document.getElementById('headerSub');    if(hs) hs.textContent = cls + ' · Student';
  var dn = document.getElementById('dropName');     if(dn) dn.textContent = name;
  var de = document.getElementById('dropEmail');    if(de) de.textContent = STUDENT.email;
  var pa = document.getElementById('phAvatar');     if(pa) pa.textContent = ini;
  var pn = document.getElementById('phName');       if(pn) pn.textContent = name;
  var ps = document.getElementById('phSub');        if(ps) ps.textContent = cls + ' · ' + (STUDENT.department||'Student') + ' · ' + (STUDENT.instituteName||'Institute');
  var pe = document.getElementById('phEmail');      if(pe) pe.textContent = STUDENT.email;

  setVal('pf_fname',    fn);
  setVal('pf_lname',    ln);
  setVal('pf_email_ro', STUDENT.email);
  setVal('pf_phone_ro', STUDENT.phone);
  setVal('pf_dept_ro',  STUDENT.department);
  setVal('pf_inst_ro',  STUDENT.instituteName);

  var ye = document.getElementById('pf_year'), de2 = document.getElementById('pf_degree'), degOther = document.getElementById('pf_degreeOther');
  var classCode = STUDENT.class || 'SYMCA';
  var yearPart = classCode.slice(0, 2);
  var degreePart = classCode.slice(2);
  if (ye) ye.value = ['FY','SY','TY','LY'].indexOf(yearPart) >= 0 ? yearPart : 'SY';
  if (de2) {
    if (KNOWN_DEGREES.indexOf(degreePart) >= 0) {
      de2.value = degreePart;
      if (degOther) degOther.value = '';
      var wrap = document.getElementById('pf_degreeOtherWrap');
      if (wrap) wrap.style.display = 'none';
    } else if (degreePart) {
      de2.value = 'Other';
      if (degOther) degOther.value = degreePart;
      var wrap2 = document.getElementById('pf_degreeOtherWrap');
      if (wrap2) wrap2.style.display = '';
    }
  }
  updateClassCode();

  setVal('pf_projectName', STUDENT.projectName || DASHBOARD_STATS && DASHBOARD_STATS.projectName || '');
  setVal('pf_projectBrief', STUDENT.projectBrief || DASHBOARD_STATS && DASHBOARD_STATS.projectBrief || '');
  setVal('pf_projectGithub', STUDENT.projectGithub || DASHBOARD_STATS && DASHBOARD_STATS.projectGithub || '');
  var ab = document.getElementById('pf_about');
  if (ab) ab.value = STUDENT.about || '';
  var scc= document.getElementById('statsClassCode'); if(scc) scc.textContent = cls;

  fillDashboardStatCards();

  var phAvgScore = document.getElementById('phAvgScore');
  if (phAvgScore) {
    var displayScore = (DASHBOARD_STATS && DASHBOARD_STATS.interviewsTaken > 0 && DASHBOARD_STATS.averageScore != null)
      ? DASHBOARD_STATS.averageScore.toFixed(1)
      : '—';
    phAvgScore.textContent = displayScore;
  }

  updateGreeting();
}

function fillDashboardStatCards() {
  if (!DASHBOARD_STATS) return;
  var cardTaken   = document.querySelector('#view-dashboard .stat-card.c-blue h3');
  var cardScore   = document.querySelector('#view-dashboard .stat-card.c-teal h3');
  var cardPending = document.querySelector('#view-dashboard .stat-card.c-amber h3');
  var cardBest    = document.querySelector('#view-dashboard .stat-card.c-green h3');
  if(cardTaken)   cardTaken.textContent   = pad2(DASHBOARD_STATS.interviewsTaken);
  if(cardScore)   cardScore.textContent   = (DASHBOARD_STATS.interviewsTaken > 0 && DASHBOARD_STATS.averageScore != null) ? DASHBOARD_STATS.averageScore.toFixed(1) : '—';
  if(cardPending) cardPending.textContent = pad2(DASHBOARD_STATS.pendingCount);
  if(cardBest)    cardBest.textContent    = (DASHBOARD_STATS.interviewsTaken > 0 && DASHBOARD_STATS.bestScore != null) ? DASHBOARD_STATS.bestScore.toFixed(1) : '—';

  var perfBest = document.querySelector('#view-performance .stat-card.c-green h3');
  if(perfBest) perfBest.textContent = (DASHBOARD_STATS.interviewsTaken > 0 && DASHBOARD_STATS.bestScore != null) ? DASHBOARD_STATS.bestScore.toFixed(1) : '—';

  var bannerSub = document.querySelector('.wb-left p');
  if(bannerSub) {
    var up  = MY_INTERVIEWS.filter(function(i){ return i.status==='APPROVED'; }).length;
    bannerSub.textContent = 'You have ' + up + ' confirmed interview' + (up !== 1 ? 's' : '') + '.';
  }
}

function updateGreeting() {
  var h = new Date().getHours();
  var g = h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  var fn = STUDENT.firstName||(STUDENT.name||'').split(' ')[0]||'there';
  var el = document.getElementById('welcomeName'); if(el) el.textContent = g+', '+fn+'! 👋';
}

function renderInterviewTable() {
  var tbody = document.getElementById('intTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!MY_INTERVIEWS || MY_INTERVIEWS.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px;">No interview records yet.</td></tr>';
    return;
  }
  MY_INTERVIEWS.forEach(function(iv) {
    var statusCls   = getStatusBadgeClass(iv.status);
    var statusLabel = formatStatus(iv.status);
    var dataStatus  = mapStatusToFilter(iv.status);
    var ini = (iv.contactPerson||'IN').split(' ').filter(function(w){return /^[A-Z]/.test(w);}).map(function(w){return w[0];}).join('').slice(0,2)||'IN';
    var interviewerCell = iv.contactPerson
      ? '<div style="display:flex;align-items:center;gap:8px;"><div style="width:28px;height:28px;border-radius:50%;background:#EFF6FF;color:var(--primary);display:grid;place-items:center;font-weight:700;font-size:11px;">'+ini+'</div>'+escHtml(iv.contactPerson)+'</div>'
      : '<span style="color:var(--muted);font-size:13px;">Assigning…</span>';
    var actionCell = '';
    if (iv.status==='PENDING' || iv.status==='CONFIRMED') {
      actionCell = '<button class="btn btn-ghost btn-sm" onclick="cancelMyInterview('+iv.id+',this)"><i class="fa-solid fa-xmark"></i> Cancel</button>';
    } else {
      actionCell = iv.applicationId
        ? '<button class="btn btn-outline btn-sm" onclick="openReportFlow('+iv.applicationId+')"><i class="fa-solid fa-file-invoice"></i> Report</button>'
        : '';
    }
    var row = document.createElement('tr');
    row.setAttribute('data-status', dataStatus);
    row.setAttribute('data-interview-id', iv.id);
    row.innerHTML =
      '<td><div style="font-weight:700;">'+escHtml(iv.dateTime)+'</div>'+(iv.expertise?'<div style="font-size:12px;color:var(--muted);">'+escHtml(iv.expertise)+'</div>':'')+'</td>'+
      '<td>'+escHtml(iv.topic)+'</td>'+
      '<td>'+interviewerCell+'</td>'+
      '<td><span class="badge '+statusCls+'">'+statusLabel+'</span></td>'+
      '<td><span style="color:var(--muted);">—</span></td>'+
      '<td>'+actionCell+'</td>';
    tbody.appendChild(row);
  });
}

function getStatusBadgeClass(s){var m={CONFIRMED:'bg-success',APPROVED:'bg-success',PENDING:'bg-pending',CANCELLED:'bg-danger',REJECTED:'bg-danger',RESCHEDULED:'bg-info',ACTIVE:'bg-info',INACTIVE:'bg-muted'};return m[s]||'bg-muted';}
function formatStatus(s){var m={CONFIRMED:'Scheduled',APPROVED:'Approved',PENDING:'Pending',CANCELLED:'Cancelled',REJECTED:'Rejected',RESCHEDULED:'Rescheduled',ACTIVE:'Active',INACTIVE:'Inactive'};return m[s]||(s?s.charAt(0)+s.slice(1).toLowerCase():'Unknown');}
function mapStatusToFilter(s){if(s==='APPROVED')return 'scheduled';return 'completed';}

async function cancelMyInterview(id, btn) {
  if (!confirm('Cancel this interview request?')) return;
  try {
    var res = await secureFetch('/api/interview-requests/'+id+'/cancel', {method:'PUT'});
    if (!res || !res.ok) throw new Error('cancel failed');
  } catch(e) { showToast('Could not cancel on server','warn'); }
  var row = btn.closest('tr'); if(row) row.remove();
  MY_INTERVIEWS = MY_INTERVIEWS.filter(function(iv){return iv.id !== id;});
  showToast('Interview cancelled','warn');
}

function filterInts(status, btn) {
  document.querySelectorAll('#intFilterBar .filter-tab').forEach(function(t){t.classList.remove('active');});
  btn.classList.add('active');
  document.querySelectorAll('#intTableBody tr').forEach(function(r){
    r.style.display = (status==='all'||r.dataset.status===status)?'':'none';
  });
}

async function loadFeedbackReports() {
  try {
    var res = await secureFetch('/api/student/feedback/reports');
    if (res && res.ok) FEEDBACK_REPORTS = await res.json();
    else FEEDBACK_REPORTS = [];
  } catch (e) {
    FEEDBACK_REPORTS = [];
  }
}

function renderFeedbackReports() {
  var tbody = document.querySelector('#view-reports table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!FEEDBACK_REPORTS.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px;">No feedback reports yet. Reports appear after your interviewer submits an evaluation.</td></tr>';
    return;
  }
  FEEDBACK_REPORTS.forEach(function(r) {
    var dateStr = r.scheduledDate ? new Date(r.scheduledDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'TBD';
    var score = r.evaluation && r.evaluation.overallScore != null ? r.evaluation.overallScore.toFixed(1) : '—';
    var row = document.createElement('tr');
    row.innerHTML =
      '<td><b>'+escHtml(dateStr)+'</b></td>'+
      '<td>'+escHtml(r.departmentName||'Interview')+'</td>'+
      '<td>'+escHtml(r.interviewerName||'Interviewer')+'</td>'+
      '<td><span style="font-weight:700;color:var(--accent);">'+score+' / 10</span></td>'+
      '<td><span class="badge bg-success">Evaluated</span></td>'+
      '<td><button class="btn btn-outline btn-sm" onclick="openReportFlow('+r.applicationId+')"><i class="fa-solid fa-eye"></i> View</button></td>';
    tbody.appendChild(row);
  });
}

function renderInterviewTimeline() {
  var tl = document.getElementById('studentTimeline');
  if (!tl) return;

  var items = (MY_INTERVIEWS||[]).slice();
  items.sort(function(a, b) {
    var ad = a.scheduledDate ? new Date(a.scheduledDate).getTime() : -1;
    var bd = b.scheduledDate ? new Date(b.scheduledDate).getTime() : -1;
    return (bd - ad);
  });

  // Take a small, readable window (closest future + most recent past).
  items = items.slice(0, 4);

  if (!items.length) {
    tl.innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center;padding:16px 0;">No interview activity yet.</p>';
    return;
  }

  tl.innerHTML = items.map(function(iv) {
    var isPending = iv.status === 'PENDING';
    var ts = iv.scheduledDate ? new Date(iv.scheduledDate).getTime() : null;
    var isDone = !isPending && ts != null && ts <= Date.now();

    var cls = isPending ? 'pending' : (isDone ? 'done' : 'upcoming');
    var badgeClass = isPending ? 'bg-muted' : (isDone ? 'bg-success' : 'bg-pending');
    var badgeText = isPending ? 'Pending' : (isDone ? 'Completed' : 'Upcoming');

    return '<div class="tl-item ' + cls + '">' +
      '<div class="tl-content">' +
        '<div style="display:flex;justify-content:space-between;">' +
          '<b style="font-size:13px;">' + escHtml(iv.topic) + '</b>' +
          '<span class="badge ' + badgeClass + '">' + escHtml(badgeText) + '</span>' +
        '</div>' +
        '<div style="font-size:12px;color:var(--muted);margin-top:3px;">' +
          escHtml(iv.dateTime) +
          (iv.contactPerson ? (' · ' + escHtml(iv.contactPerson)) : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function computeSkillMasteryPercents() {
  if (!FEEDBACK_REPORTS || FEEDBACK_REPORTS.length === 0) {
    return { tech: null, problem: null, comm: null, conf: null, domain: null };
  }

  var techTotal = 0, problemTotal = 0, commTotal = 0, confTotal = 0, domainTotal = 0;
  var count = 0;

  FEEDBACK_REPORTS.forEach(function(r) {
    if (r.evaluation) {
      techTotal += (r.evaluation.technicalScore || 0);
      problemTotal += (r.evaluation.approachScore || 0); // Using approachScore for Problem Solving
      commTotal += (r.evaluation.communicationScore || 0);
      confTotal += (r.evaluation.confidenceScore || 0);
      domainTotal += (r.evaluation.domainScore || 0);
      count++;
    }
  });

  if (count === 0) {
    return { tech: null, problem: null, comm: null, conf: null, domain: null };
  }

  // Scores are out of 10, so multiply by 10 for percentage
  return {
    tech: Math.round((techTotal / count) * 10),
    problem: Math.round((problemTotal / count) * 10),
    comm: Math.round((commTotal / count) * 10),
    conf: Math.round((confTotal / count) * 10),
    domain: Math.round((domainTotal / count) * 10)
  };
}

function renderSkillMasteryProgress() {
  var pct = computeSkillMasteryPercents();
  var set = function(idPct, idFill, v) {
    var ePct = document.getElementById(idPct);
    var eFill = document.getElementById(idFill);
    if (!ePct || !eFill) return;
    if (v == null) {
      ePct.textContent = '—';
      eFill.style.width = '0%';
      return;
    }
    ePct.textContent = v + '%';
    eFill.style.width = v + '%';
  };

  set('sm-tech-pct', 'sm-tech-fill', pct.tech);
  set('sm-domain-pct', 'sm-domain-fill', pct.domain);
  set('sm-problem-pct', 'sm-problem-fill', pct.problem);
  set('sm-comm-pct', 'sm-comm-fill', pct.comm);
  set('sm-conf-pct', 'sm-conf-fill', pct.conf);
}

function renderUpcomingInterviewCard() {
  var box = document.getElementById('upcomingInterviewCard');
  if (!box) return;

  var items = (MY_INTERVIEWS || []).slice();
  var now = Date.now();

  // Prefer future approved items, otherwise show pending.
  var futureApproved = items
    .filter(function(iv) {
      if (iv.status !== 'APPROVED' || !iv.scheduledDate) return false;
      return new Date(iv.scheduledDate).getTime() > now;
    })
    .sort(function(a, b) {
      return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
    });

  var pick = futureApproved[0] || null;
  if (!pick) {
    box.innerHTML = '<span style="color:var(--muted);font-size:13px;">No upcoming interview scheduled.</span>';
    return;
  }

  var venueHtml = '';
  if (pick.scheduledVenue) {
    venueHtml = '<span><i class="fa-solid fa-location-dot" style="color:var(--accent);width:16px;"></i> ' + escHtml(pick.scheduledVenue) + '</span>';
  }
  var linkHtml = '';
  if (pick.meetingLink) {
    linkHtml = '<a href="' + escHtml(pick.meetingLink) + '" target="_blank" rel="noopener" ' +
      'style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:7px 14px;' +
      'background:var(--accent,#0ea5e9);color:#fff;border-radius:8px;font-size:12.5px;font-weight:600;text-decoration:none;">' +
      '<i class="fa-solid fa-video"></i> Join Interview</a>';
  }

  box.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
    '<b style="font-size:14px;">' + escHtml(pick.topic) + '</b>' +
    '<span class="badge bg-success">Confirmed</span>' +
    '</div>' +
    '<div style="font-size:12.5px;color:var(--muted);display:flex;flex-direction:column;gap:5px;">' +
    '<span><i class="fa-solid fa-user" style="color:var(--accent);width:16px;"></i> ' + escHtml(pick.contactPerson || 'Interviewer') + '</span>' +
    '<span><i class="fa-solid fa-calendar" style="color:var(--accent);width:16px;"></i> ' + escHtml(pick.dateTime) + '</span>' +
    venueHtml +
    '</div>' +
    linkHtml;
}

function renderProfileStats() {
  if (!DASHBOARD_STATS) return;
  var totalEl = document.getElementById('msTotalInterviews');
  var avgEl = document.getElementById('msAvgScore');
  var bestDomEl = document.getElementById('msBestDomain');
  var impEl = document.getElementById('msImprovement');
  if (totalEl) totalEl.textContent = DASHBOARD_STATS.interviewsTaken != null ? DASHBOARD_STATS.interviewsTaken : '—';
  if (avgEl) avgEl.textContent = (DASHBOARD_STATS.interviewsTaken > 0 && DASHBOARD_STATS.averageScore != null) ? DASHBOARD_STATS.averageScore.toFixed(1) + ' / 10' : '—';

  // Pick the most frequent topic among approved interviews (best-effort “domain” proxy).
  var approved = (MY_INTERVIEWS || []).filter(function(iv) { return iv.status === 'APPROVED'; });
  var topicCount = {};
  approved.forEach(function(iv) {
    var t = (iv.topic || '').trim();
    if (!t) return;
    topicCount[t] = (topicCount[t] || 0) + 1;
  });
  var best = Object.keys(topicCount).sort(function(a, b) { return topicCount[b] - topicCount[a]; })[0] || null;
  if (bestDomEl) bestDomEl.textContent = best || '—';

  if (impEl) {
    var avg = (DASHBOARD_STATS.interviewsTaken > 0 && DASHBOARD_STATS.averageScore != null) ? DASHBOARD_STATS.averageScore : null;
    var bestScore = (DASHBOARD_STATS.interviewsTaken > 0 && DASHBOARD_STATS.bestScore != null) ? DASHBOARD_STATS.bestScore : null;
    if (avg == null || bestScore == null) impEl.textContent = '—';
    else {
      var diff = bestScore - avg;
      var pct = Math.round((diff / 10) * 100);
      var sign = pct > 0 ? '+' : '';
      impEl.textContent = sign + pct + '% ↑';
    }
  }
}

function updateResumeUI() {
  var hasResume = !!STUDENT_RESUME.url;
  var uploadState = document.getElementById('resumeUploadState');
  var existState = document.getElementById('resumeExistState');
  var replaceBtn = document.getElementById('resumeReplaceBtn');
  if (uploadState) uploadState.style.display = hasResume ? 'none' : 'block';
  if (existState) existState.style.display = hasResume ? 'block' : 'none';
  if (replaceBtn) replaceBtn.style.display = hasResume ? '' : 'none';
}

async function loadMyResume() {
  try {
    var res = await secureFetch('/api/students/me/resume');
    if (!res || !res.ok) {
      STUDENT_RESUME.url = null;
      STUDENT_RESUME.fileName = null;
      updateResumeUI();
      return;
    }
    var data = await res.json();
    STUDENT_RESUME.url = data.resumeUrl || null;
    STUDENT_RESUME.fileName = data.resumeFileName || null;

    if (STUDENT_RESUME.url) {
      var nm = document.getElementById('resumeName');
      var dt = document.getElementById('resumeDate');
      var displayName = data.resumeFileName
        ? decodeURIComponent(data.resumeFileName.replace(/^\d+_/, ''))
        : '—';
      if (nm) nm.textContent = displayName;
      if (dt) {
        if (data.uploadedAt) {
          dt.textContent = 'Uploaded ' + new Date(data.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        } else {
          dt.textContent = data.resumeFileName ? 'Resume available' : 'No resume uploaded';
        }
      }
      mountResumeEmbed('studentProfileResumeEmbed', STUDENT_RESUME.url, STUDENT_RESUME.fileName, { height: '520px' });
    } else {
      mountResumeEmbed('studentProfileResumeEmbed', null, null);
    }
    updateResumeUI();
  } catch (e) {
    console.error('Resume load error:', e);
    STUDENT_RESUME.url = null;
    updateResumeUI();
  }
}

function viewResume() {
  if (!STUDENT_RESUME.url) {
    showToast('Upload a resume first', 'warn');
    return;
  }
  // Use absolute URL to ensure correct origin regardless of page context
  var url = STUDENT_RESUME.url.startsWith('http') ? STUDENT_RESUME.url : window.location.origin + STUDENT_RESUME.url;
  window.open(url, '_blank');
}

function startRealtimeRefresh() {
  // No automatic polling — data is loaded fresh on every login.
  // The dashboard reflects the latest state when the student logs in.
}

function renderAvailableSlots() { renderSlotGrid('dashSlots'); renderSlotGrid('applyGrid'); }

function renderSlotGrid(cId) {
  var c = document.getElementById(cId); if(!c) return;
  c.innerHTML = '';
  var slots = (MY_INTERVIEWS||[]).filter(function(iv){ return iv.status==='PENDING'; });
  if (slots.length === 0) {
    c.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:16px;">No open slots at the moment.</p>';
    return;
  }
  slots.forEach(function(s) {
    var d = document.createElement('div');
    d.className = 'apply-card'+(appliedSlots[s.id]?' applied':'');
    d.setAttribute('data-cat','technical');
    d.innerHTML = buildSlotCardHTML(s);
    c.appendChild(d);
  });
}

function buildSlotCardHTML(s) {
  var applied = appliedSlots[s.id];
  return '<div class="ac-icon" style="background:#EFF6FF;color:#1E3A8A;"><i class="fa-solid fa-microphone-lines"></i></div>'+
    '<div class="ac-title">'+escHtml(s.topic)+'</div>'+
    '<div class="ac-meta"><i class="fa-solid fa-calendar"></i><b>'+escHtml(s.dateTime)+'</b></div>'+
    (s.expertise?'<div class="ac-meta"><i class="fa-solid fa-tags"></i><b>'+escHtml(s.expertise)+'</b></div>':'')+
    (s.contactPerson?'<div class="ac-meta"><i class="fa-solid fa-user-tie"></i><b>'+escHtml(s.contactPerson)+'</b></div>':'')+
    (applied
      ?'<button class="btn" style="width:100%;justify-content:center;background:#DCFCE7;color:#166534;border:1.5px solid #86EFAC;margin-top:2px;" disabled><i class="fa-solid fa-check"></i> Applied!</button>'
      :'<button class="btn btn-s" style="width:100%;justify-content:center;margin-top:2px;" onclick="applySlotById('+s.id+',\''+escHtml(s.topic)+'\',\''+escHtml(s.dateTime)+'\',\''+escHtml(s.contactPerson||'')+'\')"><i class="fa-solid fa-check"></i> Apply</button>');
}

// ── Profile Reminder Modal ────────────────────────────────────────────────────
var profileReminderAcknowledged = false;

function isProfileComplete() {
  var s = STUDENT;
  var hasBasicInfo = !!(s.firstName && s.lastName && s.phone && s.department && s.year && s.degree);
  var hasResume    = !!(STUDENT_RESUME && STUDENT_RESUME.url);
  return { hasBasicInfo: hasBasicInfo, hasResume: hasResume, complete: hasBasicInfo && hasResume };
}

function showProfileReminderModal(onOk) {
  var status = isProfileComplete();
  var icon   = document.getElementById('prModalIcon');
  var title  = document.getElementById('prModalTitle');
  var msg    = document.getElementById('prModalMsg');
  var okBtn  = document.getElementById('prModalOkBtn');

  // If resume is missing — HARD BLOCK: OK redirects to profile, apply never fires
  if (!status.hasResume) {
    var bothMissing = !status.hasBasicInfo;
    icon.style.background = '#FEF2F2';
    icon.style.color      = '#DC2626';
    icon.innerHTML        = bothMissing
      ? '<i class="fa-solid fa-triangle-exclamation"></i>'
      : '<i class="fa-solid fa-file-arrow-up"></i>';
    title.textContent = bothMissing ? 'Profile incomplete & no resume!' : 'Resume required to apply!';
    msg.innerHTML = bothMissing
      ? 'You cannot apply for an interview without completing your profile and uploading a resume.<br><br>' +
        '<ul style="text-align:left;margin:10px 0 0 18px;font-size:13px;line-height:1.9;">' +
        '<li>Fill in your basic details (name, phone, year, degree)</li>' +
        '<li>Upload your latest resume (PDF)</li>' +
        '</ul>' +
        '<br><span style="font-size:12.5px;color:var(--muted);">Click <b>Go to Profile</b> to complete your setup.</span>'
      : 'You cannot apply for an interview without uploading a resume.<br><br>' +
        'Interviewers <b>require a resume</b> to review your application. ' +
        'Please upload your latest PDF resume from <b>My Profile → Resume</b>.<br><br>' +
        '<span style="font-size:12.5px;color:var(--muted);">Once uploaded, you\'ll be able to apply instantly.</span>';
    okBtn.style.background = '#DC2626';
    okBtn.innerHTML        = '<i class="fa-solid fa-user-pen"></i> Go to Profile';
    // OK takes the student to profile, does NOT proceed to apply
    window._prOnOk = function() { showView('profile'); };

  } else {
    // Resume exists — first-time reminder only, then allow apply
    if (status.complete) {
      icon.style.background = '#EFF6FF';
      icon.style.color      = '#1E3A8A';
      icon.innerHTML        = '<i class="fa-solid fa-circle-check"></i>';
      title.textContent     = 'Good to go — just double-check!';
      msg.innerHTML         =
        'Your profile is complete and resume is uploaded! 🎉<br><br>' +
        'Before applying, quickly verify that your <b>details are accurate</b> — ' +
        'correct name, department, phone, and that your latest resume is on file.<br><br>' +
        '<span style="color:var(--muted);font-size:12.5px;">Interviewers see exactly what\'s on your profile.</span>';
      okBtn.style.background = 'var(--primary)';
    } else {
      // Resume uploaded but profile info incomplete — warn, but still let them apply
      icon.style.background = '#FFF7ED';
      icon.style.color      = '#EA580C';
      icon.innerHTML        = '<i class="fa-solid fa-user-pen"></i>';
      title.textContent     = 'Almost there — profile incomplete!';
      msg.innerHTML         =
        'Your resume is uploaded, but some <b>profile fields are missing</b> (name, phone, year or degree).<br><br>' +
        'We recommend completing your profile so interviewers can identify you correctly. ' +
        'You may still apply now, but please update your profile soon.<br><br>' +
        '<span style="font-size:12.5px;color:var(--muted);">Click OK to proceed with your application.</span>';
      okBtn.style.background = '#EA580C';
    }
    okBtn.innerHTML = '<i class="fa-solid fa-check"></i> OK, Got it!';
    window._prOnOk  = onOk || null;
  }

  document.getElementById('profileReminderModal').classList.add('open');
}

function acknowledgeProfileReminder() {
  // Only mark acknowledged if resume is present (otherwise it's a hard block)
  var status = isProfileComplete();
  if (status.hasResume) profileReminderAcknowledged = true;
  document.getElementById('profileReminderModal').classList.remove('open');
  if (typeof window._prOnOk === 'function') {
    window._prOnOk();
    window._prOnOk = null;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

function applySlotById(id, topic, dateTime, contactPerson) {
  if (!profileReminderAcknowledged) {
    showProfileReminderModal(function() { applySlotById(id, topic, dateTime, contactPerson); });
    return;
  }
  appliedSlots[id] = true;
  renderAvailableSlots();
  var tbody = document.getElementById('intTableBody');
  if (tbody) {
    var ini = (contactPerson||'IN').split(' ').filter(function(w){return /^[A-Z]/.test(w);}).map(function(w){return w[0];}).join('').slice(0,2)||'IN';
    var row = document.createElement('tr');
    row.setAttribute('data-status','pending');
    row.innerHTML =
      '<td><div style="font-weight:700;">'+escHtml(dateTime)+'</div></td>'+
      '<td>'+escHtml(topic)+'</td>'+
      '<td>'+(contactPerson?'<div style="display:flex;align-items:center;gap:8px;"><div style="width:28px;height:28px;border-radius:50%;background:#EFF6FF;color:var(--primary);display:grid;place-items:center;font-weight:700;font-size:11px;">'+ini+'</div>'+escHtml(contactPerson)+'</div>':'<span style="color:var(--muted)">Assigning…</span>')+'</td>'+
      '<td><span class="badge bg-pending">Pending</span></td>'+
      '<td style="color:var(--muted);">—</td>'+
      '<td><button class="btn btn-ghost btn-sm" onclick="cancelInterview(this)"><i class="fa-solid fa-xmark"></i> Cancel</button></td>';
    tbody.insertBefore(row, tbody.firstChild);
  }
  showToast('Applied for '+topic+'!');
}

async function loadAvailableInterviewsFromAPI() {
    try {
        var res = await secureFetch('/api/student/available-interviews');
        if (!res || !res.ok) return;
        var interviews = await res.json();

        // Update MY_INTERVIEWS to include API data for the slots display
        // Map API response to the format renderSlotGrid expects
        var apiSlots = interviews.map(function(iv) {
            return {
                id: iv.id,
                topic: iv.departmentName || 'Interview',
                expertise: (iv.expertise || []).join(', '),
                dateTime: iv.scheduledDate ? new Date(iv.scheduledDate).toLocaleString() : 'Date TBD',
                contactPerson: iv.contactPerson || '',
                status: 'CONFIRMED',
                venue: iv.scheduledVenue || '',
                meetingLink: iv.meetingLink || '',
                alreadyApplied: iv.alreadyApplied || false
            };
        });

  // Mark already-applied slots
    apiSlots.forEach(function(s) {
        if (s.alreadyApplied) appliedSlots[s.id] = true;
    });

    // Filter: only show interviews for the student's own department
    var studentDept = (STUDENT.department || '').trim().toLowerCase();
    var filteredSlots = studentDept
        ? apiSlots.filter(function(s) {
            return (s.topic || '').trim().toLowerCase() === studentDept;
        })
        : apiSlots;

    // Store for rendering
    window.API_INTERVIEW_SLOTS = filteredSlots;
    renderAPISlotGrid('dashSlots');
    renderAPISlotGrid('applyGrid');
    } catch(e) {
        console.error('Available interviews error:', e);
    }
}

function renderAPISlotGrid(containerId, slotsOverride) {
    var c = document.getElementById(containerId);
    if (!c) return;
    var slots = slotsOverride || window.API_INTERVIEW_SLOTS || [];
    if (slots.length === 0) {
        c.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:16px;">No interviews available at this time.</p>';
        return;
    }
    c.innerHTML = '';
    slots.forEach(function(s) {
        var applied = appliedSlots[s.id];
        var d = document.createElement('div');
        d.className = 'apply-card' + (applied ? ' applied' : '');
        d.innerHTML =
            '<div class="ac-icon" style="background:#EFF6FF;color:#1E3A8A;"><i class="fa-solid fa-microphone-lines"></i></div>' +
            '<div class="ac-title">' + escHtml(s.topic) + '</div>' +
            '<div class="ac-meta"><i class="fa-solid fa-calendar"></i><b>' + escHtml(s.dateTime) + '</b></div>' +
            (s.expertise ? '<div class="ac-meta"><i class="fa-solid fa-tags"></i><b>' + escHtml(s.expertise) + '</b></div>' : '') +
            (s.venue ? '<div class="ac-meta"><i class="fa-solid fa-location-dot"></i><b>' + escHtml(s.venue) + '</b></div>' : '') +
            (applied
                ? '<button class="btn" style="width:100%;justify-content:center;background:#DCFCE7;color:#166534;border:1.5px solid #86EFAC;margin-top:2px;" disabled><i class="fa-solid fa-check"></i> Applied!</button>'
                : '<button class="btn btn-s" style="width:100%;justify-content:center;margin-top:2px;" onclick="applyToInterview(' + s.id + ', \'' + escHtml(s.topic) + '\')"><i class="fa-solid fa-check"></i> Apply</button>');
        c.appendChild(d);
    });
}

async function applyToInterview(interviewRequestId, topic) {
    if (!profileReminderAcknowledged) {
        showProfileReminderModal(function() { applyToInterview(interviewRequestId, topic); });
        return;
    }
    try {
        var res = await secureFetch('/api/applications/' + interviewRequestId + '/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) {
            appliedSlots[interviewRequestId] = true;
            showToast('You\'re confirmed for ' + topic + '! Check your email for details.');
            renderAPISlotGrid('dashSlots');
            renderAPISlotGrid('applyGrid');
            // Reload dashboard stats so upcoming interview card & interview list refresh immediately
            await loadDashboardStats();
            // Sync notifications
            try {
              var applyRes = await secureFetch('/api/applications/my');
              if (applyRes && applyRes.ok) syncNotificationsFromData(await applyRes.json(), window.API_INTERVIEW_SLOTS || []);
            } catch(e) { /* silent */ }
        } else {
            var err = await res.text();
            showToast(err || 'Could not apply', 'warn');
        }
    } catch(e) {
        showToast('Error applying', 'warn');
    }
}

async function loadMyApplicationsFromAPI() {
    try {
        var res = await secureFetch('/api/applications/my');
        if (!res || !res.ok) return;
        var apps = await res.json();

        var tbody = document.getElementById('intTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (apps.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px;">No applications yet.</td></tr>';
            return;
        }

        apps.forEach(function(app) {
            var row = document.createElement('tr');
            // Data-status drives the UI filter tabs (Scheduled / Pending / Completed)
            var ds = 'completed';
            if (app.applicationStatus === 'PENDING') ds = 'pending';
            else if (app.applicationStatus === 'APPROVED') ds = 'scheduled';
            row.setAttribute('data-status', ds);
            var statusClass = app.applicationStatus === 'APPROVED' ? 'bg-success'
                : app.applicationStatus === 'REJECTED' ? 'bg-danger'
                : 'bg-pending';

            var dateText = 'TBD';
            if (app.scheduledDate) dateText = new Date(app.scheduledDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
            else if (app.appliedAt) dateText = new Date(app.appliedAt).toLocaleDateString('en-IN');

            var interviewerText = app.assignedInterviewerName ? escHtml(app.assignedInterviewerName) : 'Assigning…';

            var actionHtml = '';
            if (app.applicationStatus === 'PENDING') {
                actionHtml = '<button class="btn btn-ghost btn-sm" onclick="withdrawApplication(' + app.applicationId + ', this)"><i class="fa-solid fa-xmark"></i> Withdraw</button>';
            }

            var report = FEEDBACK_REPORTS.find(function(r){ return r.applicationId === app.applicationId; });
            var scoreCell = report && report.evaluation && report.evaluation.overallScore != null
                ? '<span style="font-weight:700;color:var(--accent);">' + report.evaluation.overallScore.toFixed(1) + ' / 10</span>'
                : '<span style="color:var(--muted);">—</span>';
            var reportBtn = app.applicationId && report
                ? ' <button class="btn btn-outline btn-sm" onclick="openReportFlow(' + app.applicationId + ')"><i class="fa-solid fa-eye"></i></button>'
                : '';
            row.innerHTML =
                '<td><div style="font-weight:700;">' + escHtml(dateText) + '</div></td>' +
                '<td>' + escHtml(app.departmentName || '—') + '</td>' +
                '<td><span style="color:var(--muted);">' + interviewerText + '</span></td>' +
                '<td><span class="badge ' + statusClass + '">' + escHtml(app.applicationStatus || 'PENDING') + '</span></td>' +
                '<td>' + scoreCell + '</td>' +
                '<td>' + actionHtml + reportBtn + '</td>';
            tbody.appendChild(row);
        });
    } catch(e) { console.error('My applications error:', e); }
}

async function withdrawApplication(applicationId, btn) {
    if (!confirm('Withdraw this application?')) return;
    try {
        var res = await secureFetch('/api/applications/' + applicationId + '/withdraw', {
            method: 'DELETE'
        });
        if (res.ok) {
            btn.closest('tr').remove();
            showToast('Application withdrawn', 'warn');
            // Refresh both tables: available slots + my interviews
            await loadAvailableInterviewsFromAPI();
            await loadMyApplicationsFromAPI();
        }
    } catch(e) { showToast('Error', 'warn'); }
}

function filterApply(cat, btn) {
  document.querySelectorAll('#view-apply .filter-tab').forEach(function(t){t.classList.remove('active');}); btn.classList.add('active');
  var all = window.API_INTERVIEW_SLOTS || [];
  if (!all.length) return;

  var textOf = function(s) {
    return ((s.topic || '') + ' ' + (s.expertise || '')).toLowerCase();
  };

  var techKeys = ['java', 'spring', 'react', 'python', 'node', 'mysql', 'typescript', 'javascript', 'backend', 'frontend', 'full stack', 'dsa', 'data structure', 'algorithm', 'system design'];
  var hrKeys = ['communication', 'behavioral', 'hr', 'soft', 'presentation'];
  var designKeys = ['system design', 'architecture', 'design'];

  var filtered = all;
  if (cat === 'technical') {
    filtered = all.filter(function(s) { return techKeys.some(function(k) { return textOf(s).includes(k); }); });
  } else if (cat === 'hr') {
    filtered = all.filter(function(s) { return hrKeys.some(function(k) { return textOf(s).includes(k); }); });
  } else if (cat === 'design') {
    filtered = all.filter(function(s) { return designKeys.some(function(k) { return textOf(s).includes(k); }); });
  }

  renderAPISlotGrid('applyGrid', filtered);
}
function cancelInterview(btn) { if(confirm('Cancel this interview request?')) { btn.closest('tr').remove(); showToast('Interview cancelled','warn'); } }
function scrollSlots(id,dir){var c=document.getElementById(id);if(c)c.scrollBy({left:dir*250,behavior:'smooth'});}

async function openReportFlow(applicationId) {
  try {
    var res = await secureFetch('/api/student/feedback/reports/' + applicationId);
    if (!res || !res.ok) { showToast('Could not load report', 'warn'); return; }
    CURRENT_REPORT = await res.json();
  } catch (e) {
    showToast('Could not load report', 'error');
    return;
  }
  if (!CURRENT_REPORT.hasStudentRating) {
    ratingPending = { applicationId: applicationId, interviewer: CURRENT_REPORT.interviewerName || 'Interviewer' };
    ratingValue = 0;
    document.getElementById('ratingInterviewerName').textContent = 'Rate ' + (CURRENT_REPORT.interviewerName || 'your interviewer');
    document.querySelectorAll('.star').forEach(function(s){ s.classList.remove('active'); });
    document.getElementById('ratingText').value = '';
    document.getElementById('ratingLabel').textContent = '';
    openOverlay('ratingModal');
  } else {
    openReport(CURRENT_REPORT);
  }
}
function setRating(v){
  ratingValue=v; var labels=['','Poor','Fair','Good','Very Good','Excellent'];
  document.getElementById('ratingLabel').textContent=labels[v]||'';
  document.querySelectorAll('.star').forEach(function(s){s.classList.toggle('active',parseInt(s.dataset.v)<=v);});
}
async function submitRating(){
  if(!ratingPending || !ratingPending.applicationId) return;
  if(!ratingValue){ showToast('Please select a star rating','warn'); return; }
  try {
    var res = await secureFetch('/api/student/feedback/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId: ratingPending.applicationId,
        rating: ratingValue,
        feedback: document.getElementById('ratingText').value.trim()
      })
    });
    if (!res || !res.ok) throw new Error();
    var res2 = await secureFetch('/api/student/feedback/reports/' + ratingPending.applicationId);
    if (res2 && res2.ok) CURRENT_REPORT = await res2.json();
  } catch (e) {
    showToast('Could not save rating', 'error');
    return;
  }
  ratingPending = null;
  closeOverlay('ratingModal');
  showToast('Rating submitted! Thank you');
  setTimeout(function(){ openReport(CURRENT_REPORT); }, 350);
}
function skipRating(){
  var report = CURRENT_REPORT;
  ratingPending = null;
  closeOverlay('ratingModal');
  if (report) setTimeout(function(){ openReport(report); }, 200);
}

function formatReportDate(r) {
  if (!r || !r.scheduledDate) return 'TBD';
  return new Date(r.scheduledDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function openReport(report) {
  if (!report) return;
  var ev = report.evaluation || {};
  var score = ev.overallScore != null ? parseFloat(ev.overallScore) : 0;
  var name = STUDENT.name || 'Student';
  var cls = STUDENT.class || '';
  var email = STUDENT.email || '—';
  var phone = STUDENT.phone || '—';
  var ini = getInitials(name);
  var perfLabel = ev.overallPerformance || (score >= 8 ? 'Excellent' : score >= 6 ? 'Good' : 'Average');
  var perfColor = score >= 8 ? 'var(--success)' : score >= 6 ? 'var(--warning)' : 'var(--danger)';
  var perfBg = score >= 8 ? '#DCFCE7' : score >= 6 ? '#FEF3C7' : '#FEE2E2';
  var dateStr = formatReportDate(report);
  document.getElementById('rm_studentName').textContent = name;
  document.getElementById('rm_class').textContent = cls;
  document.getElementById('rm_email').textContent = email;
  document.getElementById('rm_phone').textContent = phone;
  document.getElementById('rm_bannerAvatar').textContent = ini;
  document.getElementById('rm_bannerName').textContent = name;
  document.getElementById('rm_bannerSub').textContent = (report.departmentName || 'Interview') + ' · ' + perfLabel;
  document.getElementById('rt-overview').innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;">'+
      '<div style="background:var(--bg);border-radius:var(--r);padding:14px 16px;"><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Overall Score</div><div style="font-size:1.7rem;font-weight:800;color:var(--dark);">'+(score ? score.toFixed(1) : '—')+' / 10</div></div>'+
      '<div style="background:var(--bg);border-radius:var(--r);padding:14px 16px;"><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Interviewer</div><div style="font-size:1rem;font-weight:700;color:var(--dark);">'+escHtml(report.interviewerName||'—')+'</div></div>'+
      '<div style="background:var(--bg);border-radius:var(--r);padding:14px 16px;"><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Date &amp; Time</div><div style="font-size:1rem;font-weight:700;color:var(--dark);">'+escHtml(dateStr)+'</div></div>'+
      '<div style="background:'+perfBg+';border-radius:var(--r);padding:14px 16px;"><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Overall Performance</div><div style="display:flex;align-items:center;gap:6px;"><i class="fa-solid fa-circle-check" style="color:'+perfColor+';"></i><span style="font-size:13px;font-weight:700;color:'+perfColor+';">'+escHtml(perfLabel)+'</span></div></div>'+
    '</div>';
  var rubricRows = [
    ['Technical Problem Solving', ev.technicalScore],
    ['Communication Clarity', ev.communicationScore],
    ['Domain Knowledge', ev.domainScore],
    ['Problem Approach & Logic', ev.approachScore],
    ['Confidence & Presentation', ev.confidenceScore]
  ].filter(function(row){ return row[1] != null; }).map(function(row){
    return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);"><span>'+row[0]+'</span><b>'+row[1]+'/10</b></div>';
  }).join('');
  document.getElementById('rt-feedback').innerHTML =
    '<div style="display:flex;flex-direction:column;gap:14px;">'+
      (rubricRows ? '<div style="background:var(--bg);border-radius:var(--r);padding:14px 16px;"><div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:10px;">Evaluation Rubric</div>'+rubricRows+'</div>' : '')+
      (ev.strengths ? '<div><div style="font-size:11px;font-weight:700;color:var(--success);margin-bottom:6px;">Strengths</div><p style="line-height:1.7;">'+escHtml(ev.strengths)+'</p></div>' : '')+
      (ev.improvements ? '<div><div style="font-size:11px;font-weight:700;color:var(--warning);margin-bottom:6px;">Areas for Improvement</div><p style="line-height:1.7;">'+escHtml(ev.improvements)+'</p></div>' : '')+
      (ev.remarks ? '<div><div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:6px;">Remarks</div><p style="line-height:1.7;">'+escHtml(ev.remarks)+'</p></div>' : '')+
      (report.hasStudentRating ? '<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:var(--r);padding:12px 14px;"><div style="font-size:11px;font-weight:700;color:#92400E;margin-bottom:4px;">Your rating for interviewer</div><div>'+report.studentRating+' / 5 stars</div>'+(report.studentRatingFeedback ? '<p style="margin-top:6px;font-size:13px;">'+escHtml(report.studentRatingFeedback)+'</p>' : '')+'</div>' : '')+
    '</div>';
  if (report.videoUrl) {
    document.getElementById('rt-recording').innerHTML =
      '<video controls style="width:100%;border-radius:var(--r);background:#000;max-height:420px;" src="'+escHtml(report.videoUrl)+'"></video>'+
      '<p style="font-size:12px;color:var(--muted);margin-top:10px;"><i class="fa-solid fa-video"></i> Interview recording · '+escHtml(dateStr)+'</p>';
  } else {
    document.getElementById('rt-recording').innerHTML =
      '<p style="color:var(--muted);padding:24px;text-align:center;">No recording uploaded for this interview yet.</p>';
  }
  document.querySelectorAll('#reportModal .modal-tab').forEach(function(t){t.classList.remove('active');});
  document.querySelectorAll('#reportModal .modal-tab-panel').forEach(function(p){p.classList.remove('active');});
  document.querySelector('#reportModal .modal-tab').classList.add('active');
  document.getElementById('rt-overview').classList.add('active');
  openOverlay('reportModal');
}
function switchReportTab(el, panelId){
  document.querySelectorAll('#reportModal .modal-tab').forEach(function(t){t.classList.remove('active');});
  document.querySelectorAll('#reportModal .modal-tab-panel').forEach(function(p){p.classList.remove('active');});
  el.classList.add('active'); document.getElementById(panelId).classList.add('active');
}

function initSkillTags(){
  var area = document.getElementById('skillArea');
  var inp = document.getElementById('skillInput');
  if (!area || !inp) return;

  // Always clear template/demo chips, then repopulate from backend.
  area.querySelectorAll('.skill-tag').forEach(function(t){ t.remove(); });

  if (!STUDENT.skills || !STUDENT.skills.length) return;
  STUDENT.skills.forEach(function(sk){ area.insertBefore(makeSkillTag(sk), inp); });
}
function makeSkillTag(text){var t=document.createElement('span');t.className='skill-tag';t.innerHTML=text+' <i class="fa-solid fa-xmark" onclick="this.closest(\'.skill-tag\').remove()"></i>';return t;}
function addSkillTag(e){if(e.key!=='Enter')return;e.preventDefault();var inp=document.getElementById('skillInput'),val=inp.value.trim();if(!val)return;document.getElementById('skillArea').insertBefore(makeSkillTag(val),inp);inp.value='';}
function getSkills(){return Array.prototype.map.call(document.querySelectorAll('#skillArea .skill-tag'),function(t){return t.textContent.trim().replace(/[×x\u00d7]$/,'').trim();});}

function checkPwdStrength(val){
  var bars=[document.getElementById('psb1'),document.getElementById('psb2'),document.getElementById('psb3'),document.getElementById('psb4')];
  var label=document.getElementById('pwdStrLabel');if(!bars[0])return;
  var score=0;if(val.length>=8)score++;if(/[A-Z]/.test(val)&&/[a-z]/.test(val))score++;if(/[0-9]/.test(val))score++;if(/[^A-Za-z0-9]/.test(val))score++;
  var cfg=[{c:'transparent',t:''},{c:'#DC2626',t:'Weak'},{c:'#D97706',t:'Fair'},{c:'#0D9488',t:'Good'},{c:'#16A34A',t:'Strong'}];
  bars.forEach(function(b,i){b.style.background=i<score?cfg[score].c:'var(--border)';});
  if(label){label.textContent=val.length?cfg[score].t:'';label.style.color=cfg[score].c;}
}
function togglePwdEye(iId,eId){
  var inp=document.getElementById(iId),ico=document.getElementById(eId);if(!inp||!ico)return;
  var show=inp.type==='password';inp.type=show?'text':'password';
  ico.className='fa-solid '+(show?'fa-eye-slash':'fa-eye');
  ico.style.cssText='position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--muted);cursor:pointer;font-size:13px;';
}
function resolveProfileDegree() {
  var d = document.getElementById('pf_degree');
  if (!d) return 'MCA';
  if (d.value === 'Other') {
    var other = document.getElementById('pf_degreeOther');
    return other ? other.value.trim() : '';
  }
  return d.value;
}

function onDegreeChange() {
  var d = document.getElementById('pf_degree');
  var wrap = document.getElementById('pf_degreeOtherWrap');
  var other = document.getElementById('pf_degreeOther');
  if (!d || !wrap) return;
  var show = d.value === 'Other';
  wrap.style.display = show ? '' : 'none';
  if (!show && other) other.value = '';
  updateClassCode();
}

function updateClassCode(){
  var y=document.getElementById('pf_year');
  var deg=resolveProfileDegree();
  var code=(y?y.value:'SY')+deg;
  var cv=document.getElementById('classCodeVal');if(cv)cv.textContent=code;
  var sc=document.getElementById('statsClassCode');if(sc)sc.textContent=code;
  var hs=document.getElementById('headerSub');if(hs)hs.textContent=code+' · Student';
  var ps=document.getElementById('phSub');if(ps)ps.textContent=code+' · '+(STUDENT.department||'Student')+' · '+(STUDENT.instituteName||'Institute');
}
function saveAcademic(){
  var ye=document.getElementById('pf_year'),de=document.getElementById('pf_degree'),ab=document.getElementById('pf_about');
  var degVal=resolveProfileDegree();
  if(de&&de.value==='Other'&&!degVal){showToast('Please enter your degree.','warn');return;}
  STUDENT.year=ye?ye.value:STUDENT.year;STUDENT.degree=degVal;STUDENT.class=STUDENT.year+STUDENT.degree;
  STUDENT.about=ab?ab.value:STUDENT.about;STUDENT.skills=getSkills();
  var pn = document.getElementById('pf_projectName');
  var pb = document.getElementById('pf_projectBrief');
  var pg = document.getElementById('pf_projectGithub');
  STUDENT.projectName = pn ? pn.value.trim() : '';
  STUDENT.projectBrief = pb ? pb.value.trim() : '';
  STUDENT.projectGithub = pg ? pg.value.trim() : '';
  secureFetch('/api/students/me',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    studentClass:STUDENT.class,cgpa:null,about:STUDENT.about||'',skills:STUDENT.skills||[],
    projectName:STUDENT.projectName,projectBrief:STUDENT.projectBrief,projectGithub:STUDENT.projectGithub
  })})
      .then(function(res){if(!res.ok)throw new Error();try{localStorage.setItem('currentStudent',JSON.stringify(STUDENT));}catch(e){}updateClassCode();showToast('Academic details saved!');})
      .catch(function(){try{localStorage.setItem('currentStudent',JSON.stringify(STUDENT));}catch(e){}updateClassCode();showToast('Saved locally','warn');});
}
function changePassword(){
  var c=document.getElementById('pf_curpwd').value,n=document.getElementById('pf_newpwd').value,p=document.getElementById('pf_confpwd').value;
  if(!c||!n||!p){showToast('Fill in all password fields.','warn');return;}
  if(n.length<8){showToast('New password must be at least 8 characters.','warn');return;}
  if(n!==p){showToast('Passwords do not match.','warn');return;}
  secureFetch('/api/students/me/password',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:c,newPassword:n,confirmPassword:p})})
      .then(function(res){if(!res.ok)throw new Error();document.getElementById('pf_curpwd').value='';document.getElementById('pf_newpwd').value='';document.getElementById('pf_confpwd').value='';checkPwdStrength('');showToast('Password updated successfully!');})
      .catch(function(){showToast('Password update failed','error');});
}
async function handleResumeUpload(input){
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  if (file.size > 5 * 1024 * 1024) { showToast('File too large. Max 5MB.', 'warn'); return; }

  var fd = new FormData();
  fd.append('resume', file);

  try {
    var res = await secureFetch('/api/students/me/resume', { method: 'POST', body: fd });
    if (!res.ok) {
      var txt = await res.text().catch(function(){ return ''; });
      showToast(txt || 'Resume upload failed', 'error');
      return;
    }
    var data = await res.json();
    STUDENT_RESUME.url = data.resumeUrl || null;
    STUDENT_RESUME.fileName = data.resumeFileName || null;

    var nm = document.getElementById('resumeName');
    var dt = document.getElementById('resumeDate');
    var displayName = data.resumeFileName
      ? decodeURIComponent(data.resumeFileName.replace(/^\d+_/, ''))
      : '—';
    if (nm) nm.textContent = displayName;
    if (dt) {
      if (data.uploadedAt) {
        dt.textContent = 'Uploaded ' + new Date(data.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      } else {
        dt.textContent = data.resumeFileName ? 'Resume updated' : 'No resume uploaded';
      }
    }
    mountResumeEmbed('studentProfileResumeEmbed', STUDENT_RESUME.url, STUDENT_RESUME.fileName, { height: '520px' });
    updateResumeUI();
    showToast('Resume uploaded successfully!');
    input.value = '';
  } catch (e) {
    console.error('Resume upload error:', e);
    showToast('Network error uploading resume', 'error');
  }
}

var perfInited=false;
function initPerfCharts(){
  if (typeof Chart === 'undefined') { console.error('Chart.js not loaded'); return; }

  // Recreate charts on every refresh/tab open (real-time friendly).
  ['perfChart', 'radarChart', 'domainChart'].forEach(function(id) {
    var canvas = document.getElementById(id);
    if (!canvas || !Chart.getChart) return;
    var inst = Chart.getChart(canvas);
    if (inst) inst.destroy();
  });

  var SEC='#0D9488',PRI='#1E3A8A',WARN='#D97706',GRID='rgba(0,0,0,0.04)',LBL='#94A3B8';
  var completed=(MY_INTERVIEWS||[]).filter(function(iv){return iv.status==='APPROVED';}).slice(-8);
  var hasData = completed.length > 0;

  // Build per-interview score data (use averageScore as baseline since per-interview score may not exist)
  var lineLabels = hasData ? completed.map(function(_,i){return 'Int '+(i+1);}) : [];
  var baseScore=(DASHBOARD_STATS&&DASHBOARD_STATS.averageScore!=null)?DASHBOARD_STATS.averageScore:null;
  var lineData = hasData && baseScore != null ? completed.map(function(){ return baseScore; }) : [];

  // Update performance stat cards.
  var interviewsDone = (DASHBOARD_STATS&&DASHBOARD_STATS.interviewsTaken!=null)?DASHBOARD_STATS.interviewsTaken:0;
  var best = (DASHBOARD_STATS&&DASHBOARD_STATS.bestScore!=null&&interviewsDone>0)?DASHBOARD_STATS.bestScore:null;
  var avg  = (DASHBOARD_STATS&&DASHBOARD_STATS.averageScore!=null&&interviewsDone>0)?DASHBOARD_STATS.averageScore:null;
  var streak = completed.length;

  var impEl = document.getElementById('perfImprovement');
  var bestEl = document.getElementById('perfBestScore');
  var streakEl = document.getElementById('perfStreak');
  var doneEl = document.getElementById('perfInterviewsDone');

  if (bestEl) bestEl.textContent = best != null ? best.toFixed(1) : '—';
  if (streakEl) streakEl.textContent = streak > 0 ? streak : '—';
  if (doneEl) doneEl.textContent = interviewsDone > 0 ? interviewsDone : '—';
  if (impEl) {
    if (best == null || avg == null) { impEl.textContent = '—'; }
    else {
      var diff = best - avg;
      var pct = Math.round((diff / 10) * 100);
      var sign = pct > 0 ? '+' : '';
      impEl.textContent = sign + pct + '% ↑';
    }
  }

  // Score Trend chart
  var perfChartCanvas = document.getElementById('perfChart');
  if (perfChartCanvas) {
    var perfChartParent = perfChartCanvas.parentElement;
    if (!hasData || lineData.length === 0) {
      perfChartCanvas.style.display = 'none';
      var noDataMsg = perfChartParent.querySelector('.chart-empty-msg');
      if (!noDataMsg) {
        noDataMsg = document.createElement('div');
        noDataMsg.className = 'chart-empty-msg';
        noDataMsg.style.cssText = 'text-align:center;padding:32px 16px;color:var(--muted);font-size:13px;';
        noDataMsg.innerHTML = '<i class="fa-solid fa-chart-line" style="font-size:1.8rem;display:block;margin-bottom:8px;opacity:.3;"></i>Score trend will appear after your first completed interview.';
        perfChartParent.appendChild(noDataMsg);
      }
    } else {
      perfChartCanvas.style.display = '';
      var existingMsg = perfChartParent.querySelector('.chart-empty-msg');
      if (existingMsg) existingMsg.remove();
      new Chart(perfChartCanvas,{type:'line',data:{labels:lineLabels,datasets:[{label:'Score',data:lineData,borderColor:SEC,backgroundColor:'rgba(13,148,136,0.06)',tension:0.4,fill:true,pointBackgroundColor:SEC,pointRadius:4,borderWidth:2.5}]},options:{plugins:{legend:{display:false}},scales:{y:{min:0,max:10,grid:{color:GRID},ticks:{color:LBL}},x:{grid:{color:GRID},ticks:{color:LBL}}}}});
    }
  }

  var mastery = computeSkillMasteryPercents();
  var radarData = [
    mastery.tech != null ? mastery.tech : 0,
    mastery.problem != null ? mastery.problem : 0,
    mastery.comm != null ? mastery.comm : 0,
    mastery.conf != null ? mastery.conf : 0,
    mastery.domain != null ? mastery.domain : 0
  ];

  new Chart(document.getElementById('radarChart'),{type:'radar',data:{labels:['Technical','Problem Solving','Communication','Confidence','Domain'],datasets:[{data:radarData,backgroundColor:'rgba(13,148,136,0.1)',borderColor:SEC,pointBackgroundColor:SEC,pointRadius:4}]},options:{plugins:{legend:{display:false}},scales:{r:{min:0,max:100,ticks:{display:false},grid:{color:'rgba(0,0,0,0.06)'},pointLabels:{color:LBL,font:{size:11}}}}}});

  // Domain chart — only show after interviews, no "General" placeholder
  var domainChartCanvas = document.getElementById('domainChart');
  if (domainChartCanvas) {
    var domainParent = domainChartCanvas.parentElement;
    var domainMap={};(MY_INTERVIEWS||[]).forEach(function(iv){if(iv.expertise){iv.expertise.split(',').forEach(function(e){var k=e.trim();if(k)domainMap[k]=(domainMap[k]||0)+1;});}});
    var dLabels=Object.keys(domainMap).slice(0,5),dData=dLabels.map(function(k){return Math.min(10,5+domainMap[k]);});
    if(!dLabels.length) {
      domainChartCanvas.style.display = 'none';
      var domainEmpty = domainParent.querySelector('.chart-empty-msg');
      if (!domainEmpty) {
        domainEmpty = document.createElement('div');
        domainEmpty.className = 'chart-empty-msg';
        domainEmpty.style.cssText = 'text-align:center;padding:32px 16px;color:var(--muted);font-size:13px;';
        domainEmpty.innerHTML = '<i class="fa-solid fa-chart-bar" style="font-size:1.8rem;display:block;margin-bottom:8px;opacity:.3;"></i>Domain scores will appear after you complete interviews across different topics.';
        domainParent.appendChild(domainEmpty);
      }
    } else {
      domainChartCanvas.style.display = '';
      var existingDomainMsg = domainParent.querySelector('.chart-empty-msg');
      if (existingDomainMsg) existingDomainMsg.remove();
      new Chart(domainChartCanvas,{type:'bar',data:{labels:dLabels,datasets:[{label:'Activity',data:dData,backgroundColor:[SEC,PRI,WARN,'#7C3AED','#DC2626'],borderRadius:6}]},options:{plugins:{legend:{display:false}},scales:{y:{min:0,max:10,grid:{color:GRID},ticks:{color:LBL}},x:{grid:{display:false},ticks:{color:LBL}}}}});
    }
  }
}

var pageTitles={dashboard:'Dashboard',apply:'Apply / Browse',myinterviews:'My Interviews',reports:'Feedback Reports',performance:'Performance',profile:'My Profile'};
function showView(v){
  document.querySelectorAll('.nav-links a').forEach(function(l){l.classList.remove('active');});
  var lnk=document.getElementById('link-'+v);if(lnk)lnk.classList.add('active');
  document.querySelectorAll('.content-body').forEach(function(s){s.classList.remove('active');});
  document.getElementById('view-'+v).classList.add('active');
  document.getElementById('page-title').textContent=pageTitles[v]||v;
  document.getElementById('breadcrumb-cur').textContent=pageTitles[v]||v;
  closeNotif();closeUserMenu();
  if(v==='performance')setTimeout(initPerfCharts,100);
  if(v==='myinterviews')loadMyApplicationsFromAPI();
  closeSidebar();window.scrollTo({top:0,behavior:'smooth'});
}

function toggleSidebar(){var s=document.getElementById('sidebar'),o=document.getElementById('sidebarOverlay'),b=document.getElementById('hamburger'),open=s.classList.toggle('open');o.classList.toggle('active',open);b.classList.toggle('open',open);}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sidebarOverlay').classList.remove('active');document.getElementById('hamburger').classList.remove('open');}
/* ============================================================
   NOTIFICATION SYSTEM  –  Realtime, driven by actual API data
   ============================================================
   Storage key: 'studentNotifs_<email>'
   Each notif: { id, type, title, sub, icon, iconBg, iconColor, ts, read }
   Types: slot_available | app_approved | app_rejected | app_pending |
          interview_scheduled | feedback_ready
   ============================================================ */

var NOTIF_STORE_KEY = 'studentNotifs_default';
var NOTIF_LIST      = [];          // in-memory list (newest first)
var NOTIF_PREV_SNAP = {};          // id → status, used to detect changes

function notifStoreKey() {
  return 'studentNotifs_' + (STUDENT.email || 'default');
}

function loadNotifFromStorage() {
  try {
    var raw = localStorage.getItem(notifStoreKey());
    NOTIF_LIST = raw ? JSON.parse(raw) : [];
  } catch(e) { NOTIF_LIST = []; }
}

function saveNotifToStorage() {
  try { localStorage.setItem(notifStoreKey(), JSON.stringify(NOTIF_LIST.slice(0, 50))); } catch(e) {}
}

function timeAgo(ts) {
  var diff = Date.now() - ts;
  var m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return m + 'm ago';
  var h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  var d = Math.floor(h / 24);
  return d === 1 ? 'Yesterday' : d + 'd ago';
}

function buildNotifItem(n) {
  var unreadCls = n.read ? '' : ' unread notif-item-new';
  return '<div class="notif-item' + unreadCls + '" data-nid="' + n.id + '" onclick="readNotif(this)">' +
    '<div class="notif-icon" style="background:' + n.iconBg + ';color:' + n.iconColor + ';"><i class="' + n.icon + '"></i></div>' +
    '<div style="flex:1;min-width:0;">' +
      '<div class="notif-txt">' + escHtml(n.title) + '</div>' +
      '<div class="notif-sub">' + escHtml(n.sub) + ' · ' + timeAgo(n.ts) + '</div>' +
    '</div>' +
  '</div>';
}

function renderNotifPanel() {
  var list = document.getElementById('notifList');
  if (!list) return;

  if (!NOTIF_LIST.length) {
    list.innerHTML =
      '<div class="notif-empty"><i class="fa-regular fa-bell-slash"></i>' +
      '<p>No notifications yet.<br>We\'ll notify you when something happens.</p></div>';
  } else {
    list.innerHTML = NOTIF_LIST.map(buildNotifItem).join('');
  }

  // Badge
  var unread = NOTIF_LIST.filter(function(n) { return !n.read; }).length;
  var badge = document.getElementById('notifBadge');
  if (badge) {
    if (unread > 0) {
      badge.style.display = '';
      badge.textContent = unread > 9 ? '9+' : unread;
    } else {
      badge.style.display = 'none';
    }
  }
}

function readNotif(el) {
  var nid = el.getAttribute('data-nid');
  var n = NOTIF_LIST.find(function(x){ return x.id === nid; });
  if (n && !n.read) {
    n.read = true;
    saveNotifToStorage();
    renderNotifPanel();
  }
}

function pushNotif(n) {
  // Deduplicate by id
  if (NOTIF_LIST.find(function(x){ return x.id === n.id; })) return false;
  NOTIF_LIST.unshift(n);
  saveNotifToStorage();
  return true;
}

// Derive notifications from the current MY_INTERVIEWS / available slots snapshot
function syncNotificationsFromData(apps, availableSlots) {
  var changed = false;

  // 1. Application status changes (approved / rejected / confirmed)
  (apps || []).forEach(function(app) {
    var key = 'app_' + app.applicationId + '_' + app.applicationStatus;
    var prev = NOTIF_PREV_SNAP['app_' + app.applicationId];

    if (prev !== app.applicationStatus) {
      NOTIF_PREV_SNAP['app_' + app.applicationId] = app.applicationStatus;

      var dept = app.departmentName || 'Interview';
      var dateStr = app.scheduledDate
        ? new Date(app.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        : '';

      if (app.applicationStatus === 'APPROVED') {
        changed |= pushNotif({
          id: key, type: 'app_approved', read: false, ts: Date.now(),
          title: 'Interview Confirmed',
          sub: dept + (dateStr ? ' — ' + dateStr : ' — check your email for details'),
          icon: 'fa-solid fa-calendar-check',
          iconBg: '#F0FDFA', iconColor: 'var(--accent)'
        });
      } else if (app.applicationStatus === 'REJECTED') {
        changed |= pushNotif({
          id: key, type: 'app_rejected', read: false, ts: Date.now(),
          title: 'Application Not Selected',
          sub: dept + ' — better luck next time',
          icon: 'fa-solid fa-circle-xmark',
          iconBg: '#FEF2F2', iconColor: 'var(--danger)'
        });
      }
    }

    // Feedback available: APPROVED + scheduledDate is in the past
    if (app.applicationStatus === 'APPROVED' && app.scheduledDate) {
      var pastTs = new Date(app.scheduledDate).getTime();
      if (pastTs < Date.now()) {
        var fbKey = 'feedback_' + app.applicationId;
        if (!NOTIF_PREV_SNAP[fbKey]) {
          NOTIF_PREV_SNAP[fbKey] = true;
          changed |= pushNotif({
            id: fbKey, type: 'feedback_ready', read: false, ts: pastTs,
            title: 'Feedback Report Ready',
            sub: (app.departmentName || 'Interview') + ' report available',
            icon: 'fa-solid fa-star',
            iconBg: '#FEF3C7', iconColor: 'var(--warning)'
          });
        }
      }
    }
  });

  // 2. New interview slots available
  (availableSlots || []).forEach(function(s) {
    var slotKey = 'slot_' + s.id;
    if (!NOTIF_PREV_SNAP[slotKey]) {
      NOTIF_PREV_SNAP[slotKey] = true;
      var dateStr = s.dateTime || '';
      changed |= pushNotif({
        id: slotKey, type: 'slot_available', read: false, ts: Date.now(),
        title: 'New Interview Slot Available',
        sub: (s.topic || 'Interview') + (dateStr ? ' — ' + dateStr : ''),
        icon: 'fa-solid fa-bullhorn',
        iconBg: '#EFF6FF', iconColor: 'var(--primary)'
      });
    }
  });

  if (changed) renderNotifPanel();
}

// Called once on page load after data is ready
function initNotifications() {
  NOTIF_STORE_KEY = notifStoreKey();
  loadNotifFromStorage();
  renderNotifPanel();
}

// Poll every 30s to detect status changes
function startNotifPolling() {
  if (window.__notifPollingStarted) return;
  window.__notifPollingStarted = true;
  setInterval(async function() {
    try {
      var res = await secureFetch('/api/applications/my');
      if (!res || !res.ok) return;
      var apps = await res.json();
      var slots = window.API_INTERVIEW_SLOTS || [];
      syncNotificationsFromData(apps, slots);
    } catch(e) { /* silent */ }
  }, 30000);
}

function toggleNotif(){
  var p = document.getElementById('notifPanel');
  p.classList.toggle('open');
  // Re-render timestamps when opened
  if (p.classList.contains('open')) renderNotifPanel();
}
function closeNotif(){document.getElementById('notifPanel').classList.remove('open');}
function markAllRead(){
  NOTIF_LIST.forEach(function(n){ n.read = true; });
  saveNotifToStorage();
  renderNotifPanel();
  closeNotif();
  showToast('All notifications marked as read');
}
document.addEventListener('click',function(e){if(!e.target.closest('.notif-wrap'))closeNotif();if(!e.target.closest('.user-menu-wrap'))closeUserMenu();});
function toggleUserMenu(){document.getElementById('userDropdown').classList.toggle('open');}
function closeUserMenu(){document.getElementById('userDropdown').classList.remove('open');}

function openOverlay(id){document.getElementById(id).classList.add('open');}
function closeOverlay(id){document.getElementById(id).classList.remove('open');}
window.addEventListener('click',function(e){if(e.target.classList.contains('modal-overlay')&&e.target.id!=='ratingModal')closeOverlay(e.target.id);});

function openLogout(){openOverlay('logoutModal');}
function confirmLogout(){if(document.getElementById('skipLogout')?.checked){localStorage.setItem('skipLogoutConfirm','true');}logout();}

function showToast(msg,type){
  type=type||'success';
  var c={success:['#DCFCE7','#166534'],warn:['#FEF3C7','#92400E'],error:['#FEE2E2','#991B1B']}[type]||['#DCFCE7','#166534'];
  var ico=type==='error'?'circle-xmark':type==='warn'?'triangle-exclamation':'circle-check';
  var t=document.createElement('div');t.className='toast';t.style.cssText='background:'+c[0]+';color:'+c[1]+';';
  t.innerHTML='<i class="fa-solid fa-'+ico+'"></i>'+msg;document.body.appendChild(t);setTimeout(function(){t.remove();},3000);
}