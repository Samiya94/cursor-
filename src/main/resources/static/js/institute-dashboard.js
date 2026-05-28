const dashboardEl = document.getElementById("dashboard");
async function loadDashboard() {

  try {
    // Use secureFetch so expired tokens are refreshed automatically
    const response = await secureFetch("/api/institute-dashboard", {
      method: "GET"
    });

    if (!response) return; // secureFetch already handled redirect

    // 401 is handled automatically by secureFetch (token refresh + redirect)
    if (response.status === 403) {
  dashboardEl.innerText = "Access Denied (Insufficient permissions)";
  return;
}

    if (!response.ok) {
      dashboardEl.innerText = "Access Denied";
      return;
    }

    // /api/institute-dashboard returns plain text "Welcome Institute" — just verify access, don't parse as JSON
    // The actual dashboard data is loaded by the sections below (departments, interviews, etc.)
  } catch (err) {
    console.error(err);
  }
}


// window.addEventListener("load", loadDashboard);

const API_BASE = "/departments";
/* ═══════════════════════════ STATE ═══════════════════════════ */
let loggedInstitute = {
  id: null,
  instituteName: '',
  email: ''
};

let dashboardState = {
  departments: [],
  interviews: []
};

function syncRegistry(){
  const list = JSON.parse(localStorage.getItem('institutes')) || [];

  if(!list.find(i => String(i.id) === String(loggedInstitute.id))){
    list.push({
      id: loggedInstitute.id,
      instituteName: loggedInstitute.instituteName,
      email: loggedInstitute.email
    });
    localStorage.setItem('institutes', JSON.stringify(list));
  }
}

function getInstituteId() {
  return loggedInstitute.id || localStorage.getItem("instituteId");
}

function getDeptKey() {
  return 'instituteDepts_' + getInstituteId();
}

function getSetupKey() {
  const id = getInstituteId();
  if (!id || id === 'null' || id === 'undefined') return null;
  return 'instituteSetupDone_' + id;
}

function getTpoKey() {
  return 'tpoCoordinators_' + getInstituteId();
}
// dashboardState.departments = data;
const palette   = ['#3B82F6','#10B981','#8B5CF6','#F59E0B','#EF4444','#0D9488','#6366F1','#EC4899'];


function getTpo(){ return JSON.parse(localStorage.getItem(getTpoKey()))||[]; }
function getLegacy(){ return JSON.parse(localStorage.getItem('departments'))||[]; }
function getStatus(n){ return localStorage.getItem('reqStatus_'+n)||'Pending'; }
function setStatus(n,s){ localStorage.setItem('reqStatus_'+n,s); }
function saveDepts(){ localStorage.setItem(getDeptKey(),JSON.stringify(departments)); }

function normalizeStatusValue(raw) {
  const value = String(raw || '').trim().toUpperCase();
  if (!value) return 'PENDING';
  if (value === 'CANCEL') return 'CANCELLED';
  return value;
}

function formatStatusLabel(raw) {
  const value = normalizeStatusValue(raw);
  const labels = {
    PENDING: 'Pending',
    CONFIRMED: 'Confirmed',
    RESCHEDULED: 'Rescheduled',
    CANCELLED: 'Cancelled',
    AWAITING_CONFIRMATION: 'Awaiting Confirmation',
    REJECTED: 'Rejected'
  };
  return labels[value] || 'Pending';
}

function getDeptInterviewByName(deptName) {
  const rows = (dashboardState.interviews || []).filter(i => (i.departmentName || i.name) === deptName);
  if (!rows.length) return null;
  rows.sort((a, b) => {
    const aT = new Date(a.scheduledDate || a.startDate || 0).getTime();
    const bT = new Date(b.scheduledDate || b.startDate || 0).getTime();
    return bT - aT;
  });
  return rows[0];
}

function formatInterviewSlot(interview) {
  if (!interview) return 'Not Scheduled';
  const base = interview.scheduledDate || interview.startDate;
  if (!base) return 'Not Scheduled';
  const dt = new Date(base);
  const date = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const venue = interview.scheduledVenue ? ` · ${interview.scheduledVenue}` : '';
  return `${date}, ${time}${venue}`;
}

/* ═══════════════ HEADER INFO ═══════════════ */
function initHeader(){
  const name = loggedInstitute.instituteName||loggedInstitute.name||'Institute';
  const short = name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,3)||'AI';
  const avatarEl = document.getElementById('headerAvatar');
  const savedLogo = localStorage.getItem(getLogoKey ? getLogoKey() : 'instituteLogo_'+getInstituteId());
  if (savedLogo) {
    avatarEl.innerHTML = `<img src="${savedLogo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  } else {
    avatarEl.textContent = short;
  }
  document.getElementById('headerInstName').textContent = name.length>20?name.slice(0,20)+'…':name;
  document.getElementById('dropInstName').textContent  = name;
  document.getElementById('dropInstEmail').textContent = loggedInstitute.email||'';
}

async function fetchInstituteDetails() {
    try {
        const res = await secureFetch("/api/institutes/me");
        if (!res || !res.ok) return;

        const data = await res.json();

        loggedInstitute = {
            id: data.id,
            instituteName: data.instituteName,
            email: data.user?.email || data.email || '',
            city: data.city,
            website: data.website || ''
        };

        // Store only the ID
        localStorage.setItem("instituteId", data.id);

        initHeader();

        // Pre-fill website in settings if not already saved in branding
        const brandingKey = 'instituteBranding_' + data.id;
        const saved = JSON.parse(localStorage.getItem(brandingKey) || '{}');
        if (!saved.website && data.website) {
            saved.website = data.website;
            localStorage.setItem(brandingKey, JSON.stringify(saved));
        }
    } catch (err) {
        console.error("Error fetching institute:", err);
    }
}
/* ═══════════════ NAVIGATION ═══════════════ */
function showView(v){
  document.querySelectorAll('.nav-links a').forEach(l=>l.classList.remove('active'));
  document.getElementById('link-'+v).classList.add('active');
  document.querySelectorAll('.content-body').forEach(s=>s.classList.remove('active'));
  document.getElementById('view-'+v).classList.add('active');
  const titles={overview:'Institute Overview',departments:'Departments',
    requests:'Interview Requests',schedule:'Schedule Interview',settings:'Settings'};
  document.getElementById('page-title').textContent    = titles[v]||v;
  document.getElementById('breadcrumb-cur').textContent = titles[v]||v;
  const fresh=JSON.parse(localStorage.getItem(getDeptKey()))||[];
  if(fresh.length) departments=fresh;
  if(v==='overview'){renderOverview();}
  if(v==='departments'){renderDeptCards();}
  if(v==='requests'){renderReqStats();renderReqTable();}
  if(v==='schedule'){renderDeptCheckboxes();}
  if(v==='settings'){renderSettingsTable();}
  closeSidebar(); closeUserMenu();
}

/* ═══════════════ SIDEBAR / USER MENU ═══════════════ */
function toggleSidebar(){
  const s=document.getElementById('sidebar');
  const o=document.getElementById('sidebarOverlay');
  const b=document.getElementById('hamburger');
  const open=s.classList.toggle('open');
  o.classList.toggle('active',open);
  b.classList.toggle('open',open);
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
  document.getElementById('hamburger').classList.remove('open');
}
function toggleUserMenu(){ document.getElementById('userDropdown').classList.toggle('open'); }
function closeUserMenu(){ document.getElementById('userDropdown').classList.remove('open'); }
document.addEventListener('click',e=>{
  if(!e.target.closest('.user-menu-wrap')) closeUserMenu();
});

/* ═══════════════ MODAL HELPERS ═══════════════ */
function openOverlay(id){ document.getElementById(id).classList.add('open'); }
function closeOverlay(id){ document.getElementById(id).classList.remove('open'); }
window.addEventListener('click',e=>{
  if(e.target.classList.contains('modal-overlay')&&e.target.id!=='setupModal') closeOverlay(e.target.id);
});

/* ═══════════════ FIRST-TIME SETUP ═══════════════ */
let setupDepts=[];
function renderSetupTags(){
  const c=document.getElementById('setupDeptTags');
  document.getElementById('setupCount').textContent=setupDepts.length;
  if(!setupDepts.length){
    c.innerHTML='<span style="color:var(--muted);font-size:12px;align-self:center;">No departments added yet…</span>';
    return;
  }
  c.innerHTML=setupDepts.map((n,i)=>`
    <span class="tag-item"><i class="fa-solid fa-sitemap" style="font-size:9px;"></i>${n}
      <i class="fa-solid fa-xmark" onclick="removeSetupDept(${i})"></i>
    </span>`).join('');
}
function addSetupDept(){
  const inp=document.getElementById('setupDeptInput');
  const n=inp.value.trim(); if(!n)return;
  if(!setupDepts.find(d=>d.toLowerCase()===n.toLowerCase())) setupDepts.push(n);
  inp.value=''; renderSetupTags();
}
function removeSetupDept(i){ setupDepts.splice(i,1); renderSetupTags(); }
async function saveSetup(){

  if(!setupDepts.length){
    showToast('Add at least one department or skip.','warn');
    return;
  }

  try {
    for (let name of setupDepts) {

      const res = await secureFetch(API_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name,
          instituteId: Number(getInstituteId())
        })
      });

      if (!res.ok) {
        throw new Error("Failed to save department: " + name);
      }
    }

    // AFTER saving → reload from backend
    await fetchDepartments();

    const setupKey = getSetupKey(); if(setupKey) localStorage.setItem(setupKey,'true');
    closeOverlay('setupModal');

    showToast('Departments saved successfully!');

    console.log("Institute ID:", getInstituteId());

  } catch(err){
    console.error(err);
    showToast('Error saving departments','error');
  }
}
function skipSetup(){ 
  const key = getSetupKey();
  if(key) localStorage.setItem(key,'true');
  closeOverlay('setupModal');
}
function checkSetup(){
  // If institute already has at least one department saved in the backend, never show the popup
  if(departments && departments.length > 0) return;
  // No departments yet → show the setup popup
  setupDepts=[];
  renderSetupTags();
  openOverlay('setupModal');
}

/* ═══════════════ DEPT MANAGEMENT ═══════════════ */
async function addDept(){
  const inp = document.getElementById('newDeptInput');
  const n = inp.value.trim();

  if(!n){
    showToast('Enter a department name.','warn');
    return;
  }

  try {
    const res = await secureFetch(API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: n,
        instituteId: Number(getInstituteId())   
      })
    });

    if(!res.ok) throw new Error("Failed");

    const data = await res.json();

    // ✅ Update UI (keep your existing flow)
    departments.push({
      id: data.id,
      name: data.name,
      coordinator: 'Not Assigned'
    });

    saveDepts();
    renderAll();

    inp.value='';
    showToast(`Department "${n}" added.`);

  } catch(err){
    console.error(err);
    showToast("Backend error, saved locally","warn");

    // fallback (your old logic)
    departments.push({name:n,coordinator:'Not Assigned'});
    saveDepts();
    renderAll();
  }
}

async function fetchDepartments(){

  try {
    const res = await secureFetch(`${API_BASE}/institute/${getInstituteId()}`, {
      method: "GET",
      headers: {
      }
    });

    if (!res) return; // secureFetch handled auth failure

    if (res.status === 403) {
      showToast("Access Denied", "error");
      return;
    }

    const data = await res.json();
    dashboardState.departments = data; 

    // Get existing local data (IMPORTANT FIX)
    const localDepts = JSON.parse(localStorage.getItem(getDeptKey())) || [];

    // Merge backend + local (DON'T lose coordinator, schedule, etc.)
    departments = data.map(d => {
      const local = localDepts.find(ld => ld.name === d.name) || {};
     

      return {
        id: d.id,
        name: d.name,
        coordinator: local.coordinator || 'Not Assigned',
        timeSlot: local.timeSlot,
        startDate: local.startDate,
        expertise: local.expertise,
        contactPerson: local.contactPerson
      };
    });
     dashboardState.departments = departments;

    saveDepts();
    // renderAll() is called from the main init after interviews are also loaded

  } catch(err){
    console.error("Backend error", err);
  }
}

async function fetchCoordinators() {

  try {
    const res = await secureFetch(`/api/institutes/${getInstituteId()}/mentors`, {
      headers: {
      }
    });

    if (!res.ok) throw new Error("Failed to fetch coordinators");

    const data = await res.json();

    // Convert into map for easy usage
    const map = {};
    data.forEach(c => {
      map[c.departmentName] = {
        coordinatorName: c.coordinatorName,
        email: c.email,
        phone: c.phone,
        designation: c.designation
      };
    });

    return map;

  } catch (err) {
    console.error(err);
    return {};
  }
}

async function deleteDeptFromBackend(id){

  try {
    const res = await secureFetch(`${API_BASE}/${id}`, {
      method: "DELETE",
      headers: {
      }
    });

    if (!res) return; // secureFetch handled auth failure

    if (res.status === 403) {
      showToast("Access Denied", "error");
      return;
    }

    if(!res.ok) throw new Error("Delete failed");

    await fetchDepartments(); // reload from backend
    showToast("Department deleted successfully");

  } catch(err){
    console.error(err);
    showToast("Delete failed","error");
  }
}

let _delIdx=null;
function promptDel(i){
  _delIdx=i;
  document.getElementById('deleteDeptText').textContent=
    `Remove "${departments[i]?.name}"? This cannot be undone.`;
  openOverlay('deleteDeptModal');
}
function confirmDeleteDept(){
  if(_delIdx === null) return;

  const dept = departments[_delIdx];

  // If department has ID → delete from backend
  if(dept.id){
    deleteDeptFromBackend(dept.id);
  } else {
    // fallback (old local data)
    departments.splice(_delIdx,1);
    renderAll();
  }

  _delIdx = null;
  closeOverlay('deleteDeptModal');
}

async function renderSettingsTable(){
  const tbody=document.getElementById('deptTable');
  const tpoMap=await fetchCoordinators();
  
  if(!departments.length){
    tbody.innerHTML='<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:24px;">No departments added yet.</td></tr>';
    return;
  }
  tbody.innerHTML=departments.map((d,i)=>{
    const tpo=tpoMap[d.name];
    const coord=tpo?.coordinatorName||d.coordinator||'Not Assigned';
    return `<tr>
      <td><b>${d.name}</b></td>
      <td><span class="badge ${tpo?'bg-success':'bg-pending'}">${tpo?'<i class="fa-solid fa-circle-check"></i> '+coord:'<i class="fa-solid fa-clock"></i> Awaiting'}</span></td>
      <td><button class="btn btn-danger-outline btn-sm" onclick="promptDel(${i})"><i class="fa-solid fa-trash"></i> Remove</button></td>
    </tr>`;
  }).join('');
}

/* ═══════════════ DEPT CARDS ═══════════════ */
async function renderDeptCards(){
  const grid=document.getElementById('deptCardsGrid');
  if(!grid)return;
  const tpoMap = await fetchCoordinators();
  const leg=getLegacy(); const legMap={};
  leg.forEach(d=>{legMap[d.departmentName||d.name]=d;});

  if(!departments.length){
    grid.innerHTML='<p style="color:var(--muted);font-size:13.5px;grid-column:1/-1;padding:20px 0;">No departments yet. Add them in <strong>Settings</strong>.</p>';
    return;
  }
  grid.innerHTML='';
  departments.forEach((dept,idx)=>{
    const color=palette[idx%palette.length];
    const tpo=tpoMap[dept.name]||null;
    const l=legMap[dept.name]||{};
    const coord=tpo?.coordinatorName||l.coordinatorName||dept.coordinator||'Not Assigned';
    const email=tpo?.email||l.email||'—';
    const phone=tpo?.phone||l.phone||'—';
    const desg =tpo?.designation||l.designation||'TPO Coordinator';
    const isReg=!!tpo;
    const regBadge=isReg
      ?`<span class="badge bg-success"><i class="fa-solid fa-circle-check"></i> Coordinator Registered</span>`
      :`<span class="badge bg-pending"><i class="fa-solid fa-clock"></i> Awaiting Registration</span>`;
    const initials=coord!=='Not Assigned'?coord.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,3):'N/A';

    const card=document.createElement('div');
    card.className='dept-card';
    card.style.cssText=`border-left:5px solid ${color};background:linear-gradient(to bottom right,${color}10,#fff);`;
    card.innerHTML=`
      <div class="dept-card-top">
        <div>
          <div class="dept-card-title">${dept.name}</div>
          <div style="margin-top:6px;">${regBadge}</div>
        </div>
        <i class="fa-solid fa-users-rectangle" style="color:${color};opacity:.6;font-size:18px;"></i>
      </div>
      <div class="coord-meta">TPO Coordinator</div>
      <div class="coord-name">${coord}</div>
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:6px;">
          <span>Progress</span><span style="color:${color}">0%</span>
        </div>
        <div class="prog-bar-wrap"><div class="prog-bar-fill" style="width:0%;background:${color};"></div></div>
      </div>`;
    card.onclick=()=>loadDeptDetail(dept.name,coord,initials,email,phone,desg,color);
    grid.appendChild(card);
  });
}

function loadDeptDetail(name,coord,initials,email,phone,desg,color){
  const d=document.getElementById('deptDetailInline');
  d.style.display='block';
  document.getElementById('det-title').innerHTML=`<i class="fa-solid fa-sitemap" style="color:${color};"></i> ${name}`;
  document.getElementById('det-icon').textContent=initials;
  document.getElementById('det-coord-name').textContent=coord;
  document.getElementById('det-coord-desg').textContent=desg||'TPO Coordinator';
  document.getElementById('det-coord-email').innerHTML=`<i class="fa-solid fa-envelope"></i> ${email}`;
  document.getElementById('det-coord-phone').innerHTML=`<i class="fa-solid fa-phone"></i> ${phone}`;
  document.getElementById('det-total').textContent='—';
  document.getElementById('det-comp').textContent='—';
  document.getElementById('det-sched').textContent='—';
  document.getElementById('det-pend').textContent='—';
  document.getElementById('det-perc-text').textContent='0%';
  document.getElementById('det-perc-bar').style.width='0%';

  // Load registered students and fix stats for this department
  const dept = departments.find(dep => dep.name === name);
  if (dept && dept.id) {
    // --- Fix interview counts for this specific department ---
    const interviews = (dashboardState.interviews || []).filter(i =>
      (i.departmentName || i.name || '').toLowerCase() === name.toLowerCase()
    );
    let completed = 0, scheduled = 0, pending = 0;
    interviews.forEach(i => {
      const s = normalizeStatusValue(i.status);
      if (s === 'COMPLETED') completed++;
      else if (s === 'CONFIRMED' || s === 'RESCHEDULED' || s === 'AWAITING_CONFIRMATION') scheduled++;
      else if (s === 'PENDING') pending++;
    });
    document.getElementById('det-comp').textContent = completed;
    document.getElementById('det-sched').textContent = scheduled;
    document.getElementById('det-pend').textContent = pending;

    // --- Fetch and set total registered students for this dept ---
    secureFetch(`/departments/${dept.id}/students`)
      .then(r => r.ok ? r.json() : [])
      .then(students => {
        document.getElementById('det-total').textContent = students.length;
        const total = students.length;
        const doneCount = completed;
        const pct = total ? Math.round((doneCount / total) * 100) : 0;
        document.getElementById('det-perc-text').textContent = pct + '%';
        document.getElementById('det-perc-bar').style.width = pct + '%';

        // --- Render student table with Name, Email, Class, Phone, Action ---
        let studentSection = document.getElementById('deptStudentSection');
        if (!studentSection) {
          studentSection = document.createElement('div');
          studentSection.id = 'deptStudentSection';
          studentSection.style.marginTop = '16px';
          d.querySelector('.data-card').appendChild(studentSection);
        }
        if (!students.length) {
          studentSection.innerHTML = '<p style="color:var(--muted);font-size:13px;">No students registered yet.</p>';
          return;
        }
        studentSection.innerHTML = `
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:10px;letter-spacing:.05em;">
            <i class="fa-solid fa-users"></i> Registered Students (${students.length})
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
              <thead>
                <tr style="background:#F8FAFC;">
                  <th style="padding:9px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);border-bottom:2px solid var(--border);">Name</th>
                  <th style="padding:9px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);border-bottom:2px solid var(--border);">Email</th>
                  <th style="padding:9px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);border-bottom:2px solid var(--border);">Class</th>
                  <th style="padding:9px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);border-bottom:2px solid var(--border);">Phone</th>
                  <th style="padding:9px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);border-bottom:2px solid var(--border);">Action</th>
                </tr>
              </thead>
              <tbody>
                ${students.map(s => {
                  const sName = ((s.firstName||'') + ' ' + (s.lastName||'')).trim();
                  const sEmail = s.email || '—';
                  const sCls = s.studentClass || '—';
                  const sPhone = s.phone || '—';
                  const sSkills = (s.skills && s.skills.length) ? s.skills.join(', ') : '—';
                  const safeName = sName.replace(/'/g,"\\'");
                  const safeEmail = sEmail.replace(/'/g,"\\'");
                  const safeSkills = sSkills.replace(/'/g,"\\'");
                  const safeResume = (s.resumeUrl || '').replace(/'/g, "\\'");
                  const safeResumeFile = (s.resumeFileName || '').replace(/'/g, "\\'");
                  return `<tr style="border-bottom:1px solid #F1F5F9;transition:background .15s;" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background=''">
                    <td style="padding:9px 10px;font-weight:700;">${sName || '—'}</td>
                    <td style="padding:9px 10px;color:var(--muted);font-size:12px;">${sEmail}</td>
                    <td style="padding:9px 10px;">${sCls}</td>
                    <td style="padding:9px 10px;font-size:12px;">${sPhone}</td>
                    <td style="padding:9px 10px;">
                      <button class="btn btn-ghost btn-sm"
                        onclick="openInstStudentDetail(${s.id||0},'${safeName}','${sCls}','${safeEmail}','${safeSkills}','${sPhone}','${name}','${safeResume}','${safeResumeFile}')">
                        <i class="fa-solid fa-eye"></i> View
                      </button>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`;
      })
      .catch(() => {
        const ss = document.getElementById('deptStudentSection');
        if (ss) ss.innerHTML = '<p style="color:var(--muted);">Could not load students.</p>';
      });
  }

  d.scrollIntoView({behavior:'smooth',block:'start'});
}
function hideDeptDetail(){
  document.getElementById('deptDetailInline').style.display='none';
  const ss = document.getElementById('deptStudentSection');
  if (ss) ss.remove();
}

/* ═══════════════ OVERVIEW ═══════════════ */
async function renderOverview(){
  const tpoMap = await fetchCoordinators();
  const leg=getLegacy(); const legMap={};
  leg.forEach(d=>{legMap[d.departmentName||d.name]=d;});

  const interviews = dashboardState.interviews || [];

  let total = interviews.length;
  let pending = 0;
  let confirmed = 0;
  let cancelled = 0;
  let rescheduled = 0;

  interviews.forEach(i => {
    const s = normalizeStatusValue(i.status);

    if (s === 'PENDING') pending++;
    else if (s === 'COMPLETED') confirmed++;
    else if (s === 'CANCELLED') cancelled++;
    else if (s === 'CONFIRMED' || s === 'RESCHEDULED') rescheduled++;
  });

  document.getElementById('ovDepts').textContent=departments.length;
  document.getElementById('ovReqs').textContent=total;
  document.getElementById('ovConfirmed').textContent=confirmed;
  document.getElementById('ovPending').textContent=pending;

  // Total students across all departments (fetch in background, update when ready)
  const ovStudentsEl = document.getElementById('ovStudents');
  if (ovStudentsEl) {
    ovStudentsEl.textContent = '…';
    (async () => {
      let totalStudents = 0;
      await Promise.all(departments.map(async dept => {
        if (!dept.id) return;
        try {
          const r = await secureFetch(`/departments/${dept.id}/students`, {});
          if (r.ok) totalStudents += (await r.json()).length;
        } catch(e) {}
      }));
      ovStudentsEl.textContent = totalStudents;
    })();
  }

  // Update nav badge for AWAITING_CONFIRMATION requests
  updateReqNavBadge();

  // status summary
  const summary=document.getElementById('ovStatusSummary');
  if(!departments.length){
    summary.innerHTML='<p style="color:var(--muted);font-size:13.5px;">No departments found. Add some in <strong>Settings</strong>.</p>';
  } else {
    const statuses=[['Pending',pending,'#D97706'],['Confirmed',confirmed,'var(--secondary)'],
      ['Rescheduled',rescheduled,'#8B5CF6'],['Cancel',cancelled,'var(--danger)']];
    summary.innerHTML=statuses.map(([s,c,col])=>{
      const pct=total?((c/total)*100).toFixed(0):0;
      return `<div class="status-row">
        <div class="status-row-top">
          <span style="display:flex;align-items:center;gap:7px;">
            <span style="width:10px;height:10px;border-radius:50%;background:${col};display:inline-block;"></span>${s}
          </span>
          <span style="color:${col};">${c} dept${c!==1?'s':''}</span>
        </div>
        <div class="prog-bar-wrap"><div class="prog-bar-fill" style="width:${pct}%;background:${col};"></div></div>
      </div>`;
    }).join('');
  }

  // overview dept grid
  const grid=document.getElementById('ovDeptGrid');
  if(!departments.length){
    grid.innerHTML='<p style="color:var(--muted);font-size:13.5px;">No departments added yet.</p>';
    return;
  }
  grid.innerHTML='';
    //Fetch student counts for all depts in parallel
  const studentCounts = {};
  await Promise.all(departments.map(async (dept) => {
    if (dept.id) {
      try {
        const r = await secureFetch(`/departments/${dept.id}/students`, {});
        studentCounts[dept.name] = r.ok ? (await r.json()).length : 0;
      } catch(e) { studentCounts[dept.name] = 0; }
    } else { studentCounts[dept.name] = 0; }
  }));
  departments.forEach((dept,idx)=>{
    const color=palette[idx%palette.length];
    const deptName = dept.departmentName || dept.name;

    const tpo = tpoMap[deptName] || null;
    const l = legMap[deptName] || {};

    const coord = tpo?.coordinatorName || l.coordinatorName || dept.coordinator || 'Not Assigned';

    // ✅ FIX: get status from backend interviews, not localStorage
    const deptInterview = getDeptInterviewByName(deptName);
    const status = deptInterview ? deptInterview.status : null;
    const slot = formatInterviewSlot(deptInterview);

    const isReg = !!tpo;
    

    const card=document.createElement('div');
    card.className='ov-dept-card';
    card.style.cssText=`border-left:4px solid ${color};background:linear-gradient(to bottom right,${color}0d,#fff);`;
    card.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <b style="font-size:13.5px;">${dept.name}</b>
        <i class="fa-solid fa-users-rectangle" style="color:${color};opacity:.6;font-size:14px;"></i>
      </div>
      <div style="margin-bottom:8px;">
        ${isReg
          ?`<span class="badge bg-success" style="font-size:10.5px;"><i class="fa-solid fa-circle-check"></i> Registered</span>`
          :`<span class="badge bg-pending" style="font-size:10.5px;"><i class="fa-solid fa-clock"></i> Awaiting</span>`}
      </div>
      <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px;">Coordinator</div>
      
      <div style="font-weight:700;font-size:13px;margin-bottom:10px;">${coord}</div>
      

      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;background:#F0F9FF;border-radius:7px;padding:6px 10px;">
        <i class="fa-solid fa-users" style="color:var(--primary);font-size:12px;"></i>
        <span style="font-size:12px;font-weight:700;color:var(--primary);">${studentCounts[deptName] ?? 0} Registered Student${(studentCounts[deptName]??0)!==1?'s':''}</span>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:11.5px;font-weight:600;color:var(--muted);">Request</span>
        ${status ? statusBadge(status) : '<span class="badge bg-pending"><i class="fa-solid fa-clock"></i> Not Scheduled</span>'}
      </div>
      <div style="margin-top:8px;font-size:11.5px;color:var(--muted);">
        <i class="fa-solid fa-calendar"></i> ${slot}
      </div>`;
    card.onclick = () => openDeptModal(
      { ...dept, departmentName: deptName },
      tpo,
      l,
      color
    );
    grid.appendChild(card);
  });
}

function openDeptModal(dept,tpo,l,color){
  const coord=tpo?.coordinatorName||l.coordinatorName||dept.coordinator||'Not Assigned';
  const email=tpo?.email||l.email||'—';
  const phone=tpo?.phone||l.phone||'—';
  const desg =tpo?.designation||l.designation||'TPO Coordinator';
  const deptInterview = getDeptInterviewByName(dept.name);
  const timeSlot = formatInterviewSlot(deptInterview);
  const expertise=dept.expertise||l.expertise||'—';
  const isReg=!!tpo;

  const status = deptInterview ? deptInterview.status : null;

  document.getElementById('deptDetailTitle').innerHTML=
    `<i class="fa-solid fa-sitemap" style="color:${color};"></i> ${dept.name}`;
  document.getElementById('deptDetailBody').innerHTML=`
    <div class="modal-stat-grid">
      <div class="modal-stat-box">
        <div class="ms-label"><i class="fa-solid fa-user-tie"></i> TPO Coordinator</div>
        <div class="ms-value">${coord}</div>
        <div class="ms-sub"><i class="fa-solid fa-envelope"></i> ${email}</div>
        <div class="ms-sub"><i class="fa-solid fa-phone"></i> ${phone}</div>
        <div class="ms-sub"><i class="fa-solid fa-briefcase"></i> ${desg}</div>
      </div>
      <div class="modal-stat-box">
        <div class="ms-label"><i class="fa-solid fa-calendar"></i> Interview Slot</div>
        <div class="ms-value" style="font-size:13px;">${timeSlot}</div>
        <div class="ms-label" style="margin-top:12px;"><i class="fa-solid fa-code"></i> Expertise</div>
        <div class="ms-value" style="font-size:13px;">${expertise}</div>
      </div>
    </div>
    <div style="background:var(--bg);border-radius:var(--radius-sm);padding:12px 14px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border:1px solid var(--border);">
      <span style="font-size:13px;font-weight:700;">Request Status</span>${status ? statusBadge(status) : '<span class="badge bg-pending"><i class="fa-solid fa-clock"></i> Not Scheduled</span>'}
    </div>
    <div style="background:var(--bg);border-radius:var(--radius-sm);padding:12px 14px;display:flex;justify-content:space-between;align-items:center;border:1px solid var(--border);">
      <span style="font-size:13px;font-weight:700;">Coordinator Registration</span>
      ${isReg
        ?`<span class="badge bg-success"><i class="fa-solid fa-circle-check"></i> Registered</span>`
        :`<span class="badge bg-pending"><i class="fa-solid fa-clock"></i> Awaiting</span>`}
    </div>
    <div style="display:flex;gap:10px;margin-top:18px;">
      <button class="btn btn-p" style="flex:1;justify-content:center;" onclick="showView('schedule');closeOverlay('deptDetailModal');">
        <i class="fa-solid fa-calendar-plus"></i> Schedule
      </button>
      <button class="btn btn-ghost" style="flex:1;justify-content:center;" onclick="closeOverlay('deptDetailModal');">
        <i class="fa-solid fa-xmark"></i> Close
      </button>
    </div>`;
  openOverlay('deptDetailModal');
}

/* ═══════════════ REQUESTS ═══════════════ */
/* ✅ FIX: renderReqStats now reads from dashboardState.interviews (backend data)
   instead of looping departments + localStorage — same source as renderOverview */
function renderReqStats(){
  const interviews = dashboardState.interviews || [];

  const today = new Date().toISOString().slice(0, 10);

  let total      = interviews.length;
  let pending    = 0;
  let confirmed  = 0;
  let canceled   = 0;
  let rescheduled= 0;
  let todayCount = 0;

  interviews.forEach(i => {
    const s = normalizeStatusValue(i.status);
    const sd = (i.startDate || i.timeSlot || "").slice(0, 10);

    if      (s === 'PENDING')     pending++;
    else if (s === 'COMPLETED')   confirmed++;
    else if (s === 'CANCELLED')   canceled++;
    else if (s === 'CONFIRMED' || s === 'RESCHEDULED') rescheduled++;

    if (sd && sd === today) todayCount++;
  });

  const rate = total ? Math.round((confirmed / total) * 100) : 0;

  document.getElementById('rscTotal').textContent    = total;
  document.getElementById('rscPending').textContent  = pending;
  document.getElementById('rscConfirmed').textContent= confirmed;
  document.getElementById('rscCanceled').textContent = canceled;
  document.getElementById('rscToday').textContent    = todayCount;
  document.getElementById('rscRate').textContent     = rate + '%';
}

function populateDeptFilter(){
  const sel=document.getElementById('fDept');
  if(!sel)return;
  const cur=sel.value;
  sel.innerHTML='<option value="">All Departments</option>';
  const leg=getLegacy(); const legMap={};
  leg.forEach(d=>{legMap[d.departmentName||d.name]=d;});
  departments.forEach(d=>{
    const iv = getDeptInterviewByName(d.name);
    if(!iv) return;
    sel.innerHTML+=`<option value="${d.name}">${d.name}</option>`;
  });
  sel.value=cur;
}

// dashboardState.interviews = await fetchInterviewRequests();

async function fetchInterviewRequests() {

  try {
    const res = await secureFetch("/api/interview-requests", {});

    if (!res.ok) throw new Error("Failed");

    interviewRequests = await res.json();
    dashboardState.interviews = interviewRequests;

    // ✅ Always refresh both stats and overview after fetching
    renderReqStats();
    renderOverview();
    return interviewRequests;

  } catch (err){
    console.error(err);
    interviewRequests = [];
    dashboardState.interviews = [];
    return [];
  }
}

async function renderReqTable(){ 
  await fetchInterviewRequests();
  if (!interviewRequests.length) {
  console.warn("No interview requests found");
}
  populateDeptFilter(); 
  await applyFilters(); }

async function applyFilters(){
  const tbody=document.getElementById('reqTableBody');
  if(!tbody)return;
  const fS=(document.getElementById('fStatus')?.value||'').trim();
  const fD=(document.getElementById('fDept')?.value||'').trim();
  const fDate=(document.getElementById('fDate')?.value||'').trim();
  const fQ=(document.getElementById('fSearch')?.value||'').trim().toLowerCase();
  const leg=getLegacy(); const legMap={};
  leg.forEach(d=>{legMap[d.departmentName||d.name]=d;});
  const tpoMap = await fetchCoordinators();

  const sched=dashboardState.interviews;

  tbody.innerHTML='';
  if(!sched.length){
    tbody.innerHTML=`<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:28px;">
      No interviews scheduled yet. <a href="javascript:void(0)" onclick="showView('schedule')" style="color:var(--primary);font-weight:700;">Schedule one →</a>
    </td></tr>`;
    renderChips(fS,fD,fDate,fQ);
    document.getElementById('reqCount').textContent='';
    return;
  }

  let visible=0;
  sched.forEach(d=>{
    const deptName = d.departmentName || d.name;

    const l = legMap[deptName] || {};
    const tpo = tpoMap[deptName] || null;

    const coord=tpo?.coordinatorName||l.coordinatorName||d.coordinator||'Not Assigned';
    const exp = Array.isArray(d.expertise) ? d.expertise.join(', ') : (d.expertise || l.expertise || '—');
    const slot = formatInterviewSlot(d);
    const sd = (d.scheduledDate || d.startDate || '');

    // ✅ Use backend status directly from the interview object
    const s = normalizeStatusValue(d.status || getStatus(deptName));

    if(fS && formatStatusLabel(s) !== fS) return;
    if (fD && deptName !== fD) return;

    if(fDate){const slotDate=sd?sd.slice(0,10):slot.slice(0,10);if(!slotDate.startsWith(fDate))return;}
    if (fQ && !(deptName + ' ' + coord + ' ' + exp).toLowerCase().includes(fQ)) return;
    visible++;

    const normalized = normalizeStatusValue(s);

    const showConfirm = (normalized === 'AWAITING_CONFIRMATION') && !d.instituteConfirmed;
    const showRescheduleDecision = (normalized === 'RESCHEDULED') && !d.instituteConfirmed;
    const showViewDetails = (normalized === 'CONFIRMED') && d.instituteConfirmed;

    const actionCell = showConfirm
      ? `<button class="btn btn-s btn-sm" onclick="promptConfirmRequest(${d.id},'${deptName.replace(/'/g,"\\'")}')">
            <i class="fa-solid fa-check"></i> Confirm Slot
        </button>`
      : showRescheduleDecision
        ? `<div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-s btn-sm" onclick="promptConfirmRescheduleRequest(${d.id},'${deptName.replace(/'/g,"\\'")}')">
              <i class="fa-solid fa-circle-check"></i> Confirm
            </button>
            <button class="btn btn-ghost btn-sm" style="border:1.5px solid #FCA5A5;color:var(--danger);" onclick="promptRejectRescheduleRequest(${d.id},'${deptName.replace(/'/g,"\\'")}')">
              <i class="fa-solid fa-circle-xmark"></i> Reject
            </button>
          </div>`
        : showViewDetails
          ? `<button class="btn btn-info btn-sm" onclick="openInterviewViewModal(${d.id})">
              <i class="fa-solid fa-eye"></i> View Details
            </button>`
          : '<span style="color:var(--muted);font-size:12px;">—</span>';

    const tr = document.createElement('tr');
    tr.innerHTML = `<td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:28px;height:28px;border-radius:7px;background:#EFF6FF;display:grid;place-items:center;flex-shrink:0;">
            <i class="fa-solid fa-sitemap" style="color:var(--primary);font-size:11px;"></i>
          </div>
          <b style="font-size:13.5px;">${deptName}</b>
        </div>
      </td>
      <td style="font-size:13px;color:var(--dark);font-weight:500;">
        <div style="display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-clock" style="color:var(--secondary);font-size:11px;"></i>
          ${slot}
        </div>
      </td>
      <td>${statusBadge(s)}</td>
      <td>${actionCell}</td>`;
    tbody.appendChild(tr);
  });

  if(!visible) tbody.innerHTML=`<tr><td colspan="4" style="text-align:center;padding:28px;color:var(--muted);">
    No results match your filters. <a href="javascript:void(0)" onclick="resetFilters()" style="color:var(--primary);font-weight:700;">Reset filters</a>
  </td></tr>`;

  document.getElementById('reqCount').textContent=
    visible===sched.length?`Showing all ${sched.length} department${sched.length!==1?'s':''}`
    :`Showing ${visible} of ${sched.length} department${sched.length!==1?'s':''}`;
  renderChips(fS,fD,fDate,fQ);
}

function renderChips(fS,fD,fDate,fQ){
  const c=document.getElementById('activeChips');
  const chips=[];
  if(fS)chips.push({l:'Status: '+fS,clear:()=>{document.getElementById('fStatus').value='';applyFilters();}});
  if(fD)chips.push({l:'Dept: '+fD,clear:()=>{document.getElementById('fDept').value='';applyFilters();}});
  if(fDate)chips.push({l:'Date: '+fDate,clear:()=>{document.getElementById('fDate').value='';applyFilters();}});
  if(fQ)chips.push({l:'Search: "'+fQ+'"',clear:()=>{document.getElementById('fSearch').value='';applyFilters();}});
  window.__chipClears=chips.map(ch=>ch.clear);
  c.innerHTML=chips.map((ch,i)=>`<span class="chip">${ch.l}<i class="fa-solid fa-xmark" onclick="__chipClears[${i}]()"></i></span>`).join('');
}

function resetFilters(){
  ['fStatus','fDept','fDate','fSearch'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  applyFilters();
}

/* ═══════════════ STATUS BADGE ═══════════════ */
function statusBadge(s){
  const label = formatStatusLabel(s);
  const map = {Pending:'bg-pending',Confirmed:'bg-success',Rescheduled:'bg-purple',Cancelled:'bg-cancel','Awaiting Confirmation':'bg-info',Rejected:'bg-cancel'};
  const ico = {Pending:'fa-clock',Confirmed:'fa-circle-check',Rescheduled:'fa-rotate',Cancelled:'fa-ban','Awaiting Confirmation':'fa-hourglass-half',Rejected:'fa-circle-xmark'};
  return `<span class="badge ${map[label]||'bg-pending'}"><i class="fa-solid ${ico[label]||'fa-clock'}"></i> ${label}</span>`;
}

/* ═══════════════ SCHEDULE FORM ═══════════════ */
function renderDeptCheckboxes(){
  const grid=document.getElementById('deptCbGrid');
  if(!grid)return;
  if(!departments.length){
    grid.innerHTML='<p style="color:var(--muted);font-size:13px;">No departments yet. Add them in Settings first.</p>';
    return;
  }
  grid.innerHTML=departments.map(d=>{
    const sid='dcb_'+d.name.replace(/\s+/g,'_');
    return `<div class="cb-item" id="w_${sid}" onclick="toggleCbDept('${sid}')">
      <input type="checkbox" id="${sid}" value="${d.name}" onchange="syncDeptTags()">
      <label for="${sid}">${d.name}</label>
    </div>`;
  }).join('');
  syncDeptTags();
}

function toggleCbDept(id){
  const cb=document.getElementById(id);
  cb.checked=!cb.checked;
  document.getElementById('w_'+id).classList.toggle('checked',cb.checked);
  syncDeptTags();
}
function syncDeptTags(){
  const checked=[...document.querySelectorAll('#deptCbGrid input:checked')];
  document.getElementById('deptCbTags').innerHTML=checked.map(cb=>`
    <span class="tag-item"><i class="fa-solid fa-sitemap" style="font-size:9px;"></i>${cb.value}
      <i class="fa-solid fa-xmark" onclick="uncheckDept('${cb.id}')"></i>
    </span>`).join('');
}
function uncheckDept(id){
  const cb=document.getElementById(id); if(cb){cb.checked=false;}
  document.getElementById('w_'+id)?.classList.remove('checked');
  syncDeptTags();
}
async function updateStatus(id, status) {
  const normalizedStatus = normalizeStatusValue(status);

  await secureFetch(`/api/interview-requests/${id}/status?status=${encodeURIComponent(normalizedStatus)}`, {
    method: "PUT",
    headers: {
    }
  });

  await fetchInterviewRequests();
  await renderReqTable();
  await renderOverview();
}

function toggleCb(el){
  const cb=el.querySelector('input[type="checkbox"]');
  cb.checked=!cb.checked;
  el.classList.toggle('checked',cb.checked);
  syncExpTags();
}
function syncExpTags(){
  const checked=[...document.querySelectorAll('#expertiseCbGrid input:checked')];
  document.getElementById('expTags').innerHTML=checked.map(cb=>`
    <span class="tag-item">${cb.value}
      <i class="fa-solid fa-xmark" onclick="uncheckExp('${cb.id}')"></i>
    </span>`).join('');
}
function uncheckExp(id){
  const cb=document.getElementById(id); if(cb){cb.checked=false;}
  cb?.closest('.cb-item')?.classList.remove('checked');
  syncExpTags();
}

async function loadDomainsIntoGrid() {
    const grid = document.getElementById('expertiseCbGrid');
    if (!grid) return;
    try {
        const res = await secureFetch('/api/domains');
        if (!res.ok) return;
        const domains = await res.json();
        if (!domains || !domains.length) return;
        // Keep any existing custom items already in the grid
        const existing = [...grid.querySelectorAll('input')].map(i => i.value.toLowerCase());
        domains.forEach(name => {
            if (existing.includes(name.toLowerCase())) return;
            const id = 'exp_' + name.replace(/[^a-z0-9]/gi, '_');
            const item = document.createElement('div');
            item.className = 'cb-item';
            item.setAttribute('onclick', "toggleCb(this)");
            item.innerHTML = `<input type="checkbox" id="${id}" value="${name}" onchange="syncExpTags()"><label for="${id}">${name}</label>`;
            grid.appendChild(item);
        });
    } catch(e) { console.error('loadDomainsIntoGrid error', e); }
}

function addCustomDomain(){
  const inp=document.getElementById('customDomainInput');
  const n=inp.value.trim(); if(!n)return;
  const all=[...document.querySelectorAll('#expertiseCbGrid input')];
  const ex=all.find(cb=>cb.value.toLowerCase()===n.toLowerCase());
  if(ex){ex.checked=true;ex.closest('.cb-item')?.classList.add('checked');syncExpTags();inp.value='';return;}
  const id='exp_custom_'+Date.now();
  const item=document.createElement('div');
  item.className='cb-item checked';
  item.onclick=function(){toggleCb(this);};
  item.innerHTML=`<input type="checkbox" id="${id}" value="${n}" checked onchange="syncExpTags()"><label for="${id}">${n}</label>`;
  document.getElementById('expertiseCbGrid').appendChild(item);
  syncExpTags(); inp.value='';
}
function getSelectedDepts(){ return [...document.querySelectorAll('#deptCbGrid input:checked')].map(c=>c.value); }
function getSelectedExp(){   return [...document.querySelectorAll('#expertiseCbGrid input:checked')].map(c=>c.value); }

async function handleSchedSubmit(e){
  e.preventDefault();


  const depts = getSelectedDepts();
  const exp = getSelectedExp();

  const start = document.getElementById('startDT').value;
  const end   = document.getElementById('endDT').value;
  const cp    = document.getElementById('contactPerson').value;
  const ce    = document.getElementById('contactEmail').value;
  const rem   = document.getElementById('schedRemarks').value;

  // ✅ KEEP YOUR VALIDATION EXACTLY AS IT IS
  if(!depts.length || !exp.length || !start || !end || !cp || !ce){
    showToast('Fill all required fields','warn');
    return;
  }

  try {

    for (let dept of depts) {

      const payload = {
        departmentName: dept,
        expertise: exp,
        startDate: start,
        endDate: end,
        contactPerson: cp,
        contactEmail: ce,
        remarks: rem,
        registeredStudentsCount: await getRegisteredStudentCountForDept(dept)
      };

      const res = await secureFetch("/api/interview-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to send request");
      }
    }

    showToast("Interview request submitted successfully!", "success");

    // switch to requests tab
    showView('requests');

    // reload fresh data from backend
    await fetchDepartments();
    await fetchInterviewRequests();
    // await renderReqStats();
    // await renderReqTable();
    await renderAll();

    // optional UI cleanup (you can keep yours too)
    document.querySelectorAll('#deptCbGrid input:checked')
      .forEach(cb => {
        cb.checked = false;
        cb.closest('.cb-item')?.classList.remove('checked');
      });

    syncDeptTags();

    document.querySelectorAll('#expertiseCbGrid input:checked')
      .forEach(cb => {
        cb.checked = false;
        cb.closest('.cb-item')?.classList.remove('checked');
      });

    syncExpTags();

    document.getElementById('schedForm').reset();

  } catch (err){
    console.error(err);
    showToast("Error submitting request","error");
  }
}
/* ═══════════════ REGISTRATION LINK ═══════════════ */
async function genRegLink(){

  try {
    const res = await secureFetch(`/register/institutes/${getInstituteId()}/registration-link`, {
      method: "GET",
      headers: {
      }
    });

    if (!res) return; // secureFetch handled auth failure

    if (res.status === 403) {
      showToast("Access Denied (Not authorized)", "error");
      return;
    }

    if (!res.ok) {
      throw new Error("Failed to generate link");
    }

    const link = await res.text();

    document.getElementById('genLinkText').textContent = link;
    document.getElementById('genLinkBox').style.display = 'block';

  } catch(err){
    console.error(err);
    showToast("Failed to generate link","error");
  }
}
function copyGenLink(){
  const link=document.getElementById('genLinkText').textContent;
  navigator.clipboard.writeText(link).then(()=>{
    document.getElementById('copyLinkPreview').textContent=link;
    openOverlay('copyLinkModal');
  });
}

/* ═══════════════ STATUS CONFIRM ═══════════════ */
let _pendStatus=null,_pendDropdown=null,_prevStatus=null,_newStatus=null;
let _pendingInstituteAction = null; // { id, type: 'confirm-slot' | 'confirm-reschedule' | 'reject-reschedule' }
function handleStatusChange(sel){
  _prevStatus=sel.dataset.previous||'Pending';
  _newStatus=sel.value;
  _pendDropdown=sel;
  document.getElementById('statusModalTitle').textContent='Confirm Status Change';
  document.getElementById('statusModalText').textContent=`Change status to "${_newStatus}"?`;
  openOverlay('statusModal');
}
function confirmStatus(){
  if (_pendingInstituteAction) {
    const { id, type } = _pendingInstituteAction;
    _pendingInstituteAction = null;
    closeOverlay('statusModal');
    if (type === 'confirm-slot') return confirmInstituteRequest(id);
    if (type === 'confirm-reschedule') return confirmRescheduledRequest(id);
    if (type === 'reject-reschedule') return rejectRescheduledRequest(id);
    return;
  }
  if(_pendDropdown) _pendDropdown.dataset.previous=_newStatus;
  if(_pendStatus){ setStatus(_pendStatus,_newStatus); renderReqTable(); renderOverview(); renderReqStats(); }
  _pendStatus=null; _pendDropdown=null;
  closeOverlay('statusModal');
}
function cancelStatus(){
  _pendingInstituteAction = null;
  if(_pendDropdown) _pendDropdown.value=_prevStatus;
  _pendStatus=null; _pendDropdown=null;
  closeOverlay('statusModal');
}

function promptConfirmRequest(requestId, deptName) {
  const iv = (dashboardState.interviews||[]).find(i => i.id === requestId);
  const slot = iv ? formatInterviewSlot(iv) : 'Not available';

  _pendingInstituteAction = { id: requestId, type: 'confirm-slot' };
  document.getElementById('statusModalTitle').textContent = 'Confirm Interview Slot';
  document.getElementById('statusModalText').innerHTML = `
    <div style="text-align:left;margin-bottom:14px;">
      <div style="display:grid;gap:10px;">
        <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:11px 14px;">
          <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#15803D;margin-bottom:3px;display:flex;align-items:center;gap:5px;">
            <i class="fa-solid fa-sitemap" style="font-size:10px;"></i> Department
          </div>
          <div style="font-weight:700;font-size:14px;color:#1F2937;">${deptName}</div>
        </div>
        <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:11px 14px;">
          <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#1D4ED8;margin-bottom:3px;display:flex;align-items:center;gap:5px;">
            <i class="fa-solid fa-calendar-check" style="font-size:10px;"></i> Scheduled Slot
          </div>
          <div style="font-weight:700;font-size:14px;color:#1F2937;">${slot}</div>
        </div>
      </div>
    </div>
    <p style="font-size:13px;color:#6B7280;">Are you sure you want to confirm this interview slot?</p>`;
  openOverlay('statusModal');
}

function promptConfirmRescheduleRequest(requestId, deptName) {
  const iv = (dashboardState.interviews||[]).find(i => i.id === requestId);
  const slot = iv ? formatInterviewSlot(iv) : 'Not available';
  _pendingInstituteAction = { id: requestId, type: 'confirm-reschedule' };
  document.getElementById('statusModalTitle').textContent = 'Confirm Rescheduled Interview';
  document.getElementById('statusModalText').innerHTML = `
    <div style="text-align:left;margin-bottom:14px;">
      <div style="display:grid;gap:10px;">
        <div style="background:#F5F3FF;border:1px solid #DDD6FE;border-radius:8px;padding:11px 14px;">
          <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6D28D9;margin-bottom:3px;display:flex;align-items:center;gap:5px;">
            <i class="fa-solid fa-rotate" style="font-size:10px;"></i> Rescheduled Slot
          </div>
          <div style="font-weight:800;font-size:14px;color:#1F2937;">${slot}</div>
          <div style="font-weight:700;font-size:12.5px;color:#6B7280;margin-top:3px;">${deptName}</div>
        </div>
      </div>
    </div>
    <p style="font-size:13px;color:#6B7280;">Confirm this rescheduled interview slot?</p>`;
  openOverlay('statusModal');
}

function promptRejectRescheduleRequest(requestId, deptName) {
  const iv = (dashboardState.interviews||[]).find(i => i.id === requestId);
  const slot = iv ? formatInterviewSlot(iv) : 'Not available';
  _pendingInstituteAction = { id: requestId, type: 'reject-reschedule' };
  document.getElementById('statusModalTitle').textContent = 'Reject Rescheduled Interview';
  document.getElementById('statusModalText').innerHTML = `
    <div style="text-align:left;margin-bottom:14px;">
      <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:11px 14px;">
        <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#B91C1C;margin-bottom:3px;display:flex;align-items:center;gap:5px;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:10px;"></i> Reject Reschedule
        </div>
        <div style="font-weight:800;font-size:14px;color:#1F2937;">${slot}</div>
        <div style="font-weight:700;font-size:12.5px;color:#6B7280;margin-top:3px;">${deptName}</div>
      </div>
    </div>
    <p style="font-size:13px;color:#6B7280;">Rejecting will mark this request as <b>Rejected</b>.</p>`;
  openOverlay('statusModal');
}

async function confirmInstituteRequest(requestId) {
  try {
    const res = await secureFetch(`/api/interview-requests/${requestId}/confirm`, { method: 'PUT' });
    if (!res || !res.ok) {
      const msg = res ? await res.text() : 'Failed to confirm request';
      showToast(msg || 'Failed to confirm request', 'error');
      return;
    }
    showToast('Interview slot confirmed successfully.');
    addNotification(`Interview slot confirmed for the requested department.`, 'success');
    await fetchInterviewRequests();
    await renderAll();
  } catch (e) {
    console.error(e);
    showToast('Error confirming request', 'error');
  }
}

async function confirmRescheduledRequest(requestId) {
  try {
    const res = await secureFetch(`/api/interview-requests/${requestId}/confirm`, { method: 'PUT' });
    if (!res || !res.ok) {
      const msg = res ? await res.text() : 'Failed to confirm reschedule';
      showToast(msg || 'Failed to confirm reschedule', 'error');
      return;
    }
    showToast('Rescheduled interview confirmed.');
    addNotification(`Rescheduled interview slot confirmed.`, 'success');
    await fetchInterviewRequests();
    await renderAll();
  } catch (e) {
    console.error(e);
    showToast('Error confirming reschedule', 'error');
  }
}

async function rejectRescheduledRequest(requestId) {
  try {
    const res = await secureFetch(`/api/interview-requests/${requestId}/reject-reschedule`, { method: 'PUT' });
    if (!res || !res.ok) {
      const msg = res ? await res.text() : 'Failed to reject reschedule';
      showToast(msg || 'Failed to reject reschedule', 'error');
      return;
    }
    showToast('Rescheduled interview rejected.', 'warn');
    addNotification(`Rescheduled interview slot rejected.`, 'warn');
    await fetchInterviewRequests();
    await renderAll();
  } catch (e) {
    console.error(e);
    showToast('Error rejecting reschedule', 'error');
  }
}

/* ═══════════════ BRANDING / LOGO ═══════════════ */
function getLogoKey() {
  return 'instituteLogo_' + getInstituteId();
}

function getBrandingKey() {
  return 'instituteBranding_' + getInstituteId();
}

function initBranding(){
  const name=loggedInstitute.instituteName||loggedInstitute.name||'Institute';
  const inp=document.getElementById('instDisplayName');
  if(inp) inp.value=name;
  const saved=JSON.parse(localStorage.getItem(getBrandingKey())||'{}');
  // Website: prefer saved branding, fallback to fetched API value
  const websiteVal = saved.website || loggedInstitute.website || '';
  if(websiteVal) document.getElementById('instWebsite').value=websiteVal;
  if(saved.displayName){ if(inp) inp.value=saved.displayName; }
  document.getElementById('logoInstNameDisplay').textContent=saved.displayName||name;
  const logo=localStorage.getItem(getLogoKey());
  if(logo) applyLogoPreview(logo);
}

function applyLogoPreview(src){
  const img=document.getElementById('logoPreviewImg');
  const icon=document.getElementById('logoPlaceholderIcon');
  const rmBtn=document.getElementById('removeLogoBtn');
  img.src=src; img.style.display='block';
  icon.style.display='none';
  rmBtn.style.display='inline-flex';
  // Also update the header avatar
  const avatarEl = document.getElementById('headerAvatar');
  if (avatarEl) avatarEl.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
}

function handleLogoUpload(e){
  const file=e.target.files[0];
  if(!file)return;
  if(file.size>2*1024*1024){showToast('File too large. Max 2 MB.','warn');return;}
  const reader=new FileReader();
  reader.onload=ev=>{
    localStorage.setItem(getLogoKey(),ev.target.result);
    applyLogoPreview(ev.target.result);
    showToast('Logo uploaded successfully!');
  };
  reader.readAsDataURL(file);
  e.target.value='';
}

function removeLogo(){
  localStorage.removeItem(getLogoKey());
  const img=document.getElementById('logoPreviewImg');
  const icon=document.getElementById('logoPlaceholderIcon');
  const rmBtn=document.getElementById('removeLogoBtn');
  img.src=''; img.style.display='none';
  icon.style.display='';
  rmBtn.style.display='none';
  // Restore text initials in header avatar
  const name = loggedInstitute.instituteName||loggedInstitute.name||'Institute';
  const short = name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,3)||'AI';
  const avatarEl = document.getElementById('headerAvatar');
  if (avatarEl) { avatarEl.innerHTML = ''; avatarEl.textContent = short; }
  showToast('Logo removed.');
}

function saveBranding(){
  const displayName=(document.getElementById('instDisplayName').value||'').trim();
  const website   =(document.getElementById('instWebsite').value||'').trim();
  if(!displayName){showToast('Enter an institute display name.','warn');return;}
  const saved={displayName,website};
  localStorage.setItem(getBrandingKey(),JSON.stringify(saved));
  document.getElementById('logoInstNameDisplay').textContent=displayName;
  // update header too
  document.getElementById('headerInstName').textContent=displayName.length>20?displayName.slice(0,20)+'…':displayName;
  document.getElementById('dropInstName').textContent=displayName;
  showToast('Branding saved successfully!');
}


function changePassword(){
  const cur=document.getElementById('curPass').value;
  const np=document.getElementById('newPass').value;
  const cp=document.getElementById('confirmPass').value;
  if(!cur){showToast('Enter current password.','warn');return;}
  if(np.length<8){showToast('New password must be at least 8 characters.','warn');return;}
  if(np!==cp){showToast('Passwords do not match.','warn');return;}
  showToast('Password updated successfully!');
  document.getElementById('curPass').value='';
  document.getElementById('newPass').value='';
  document.getElementById('confirmPass').value='';
}

/* ═══════════════ LOGOUT ═══════════════ */
function openLogout(){
  if(localStorage.getItem('skipLogoutConfirm')==='true'){confirmLogout();return;}
  openOverlay('logoutModal');
}
function confirmLogout() {
    if (document.getElementById('skipLogout')?.checked) {
        localStorage.setItem('skipLogoutConfirm', 'true');
    }
    logout(); // uses auth.js logout function
}

/* ═══════════════ TOAST ═══════════════ */
/* ═══════════════ INSTITUTE STUDENT DETAIL MODAL ═══════════════ */
function instSwitchTab(tabEl, panelId) {
  document.querySelectorAll('#instStudentDetailModal .modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#instStudentDetailModal .modal-tab-panel').forEach(p => p.classList.remove('active'));
  tabEl.classList.add('active');
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');
}

function instGetInitials(n) {
  return (n || 'S').split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'S';
}

function instFmtDate(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function instFmtDateTime(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function instPerfBadge(perf) {
  if (!perf) return '—'; // no interview yet — just show a dash, not a badge
  const p = perf.replace(/[^a-zA-Z]/g, '').trim().toUpperCase();
  const map = {
    'EXCELLENT': { bg: '#DCFCE7', color: '#15803D', icon: 'fa-star',         label: 'Excellent' },
    'GOOD':      { bg: '#CFFAFE', color: '#0E7490', icon: 'fa-thumbs-up',    label: 'Good' },
    'AVERAGE':   { bg: '#FEF9C3', color: '#A16207', icon: 'fa-minus-circle', label: 'Average' },
    'POOR':      { bg: '#FEE2E2', color: '#DC2626', icon: 'fa-thumbs-down',  label: 'Poor' },
  };
  const s = map[p];
  if (!s) return '—';
  return `<span style="display:inline-flex;align-items:center;gap:5px;background:${s.bg};color:${s.color};font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px;">
    <i class="fa-solid ${s.icon}"></i> ${s.label}
  </span>`;
}

function openInstVideoLightbox(url) {
  const lb = document.getElementById('instVideoLightbox');
  const vid = document.getElementById('instVideoPlayer');
  if (!lb || !vid) return;
  vid.src = url;
  lb.style.display = 'flex';
}

function closeInstVideo() {
  const lb = document.getElementById('instVideoLightbox');
  const vid = document.getElementById('instVideoPlayer');
  if (vid) { vid.pause(); vid.src = ''; }
  if (lb) lb.style.display = 'none';
}

async function openInstStudentDetail(id, name, cls, email, skills, phone, deptName, resumeUrl, resumeFileName) {
  // Reset to Overview tab
  document.querySelectorAll('#instStudentDetailModal .modal-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
  document.querySelectorAll('#instStudentDetailModal .modal-tab-panel').forEach((p, i) => p.classList.toggle('active', i === 0));

  // Banner — combine class + dept as "FYIT" (no separator)
  const classLabel = cls && cls !== '—' ? cls : '';
  const deptLabel  = deptName || '';
  const combined   = (classLabel + deptLabel) || '—';

  // Header
  document.getElementById('instModalStudentName').textContent = name;
  document.getElementById('instModalStudentMeta').innerHTML =
    `<span><i class="fa-solid fa-graduation-cap" style="color:var(--secondary);margin-right:4px;"></i>${combined}</span>` +
    `<span><i class="fa-solid fa-envelope" style="color:var(--secondary);margin-right:4px;"></i>${email || '—'}</span>`;

  document.getElementById('instModalBanner').innerHTML =
    `<div style="background:linear-gradient(135deg,var(--primary) 0%,#1e40af 55%,var(--secondary) 100%);padding:16px 22px;display:flex;align-items:center;gap:14px;">
      <div style="width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.22);border:2px solid rgba(255,255,255,.35);display:grid;place-items:center;font-size:1rem;font-weight:800;color:#fff;flex-shrink:0;">${instGetInitials(name)}</div>
      <div>
        <div style="font-size:16px;font-weight:800;color:#fff;">${name}</div>
        <div style="font-size:12px;color:rgba(255,255,255,.75);margin-top:2px;">${combined}</div>
      </div>
    </div>`;

  // Placeholders while loading
  document.getElementById('instModalScore').textContent = '…';
  document.getElementById('instModalAttended').textContent = '…';
  document.getElementById('instModalLastDate').textContent = '…';
  document.getElementById('instModalPerfBadge').innerHTML = '';
  document.getElementById('instFeedbackContent').innerHTML = '<p style="color:var(--muted);font-size:13px;padding:8px 0;">Loading…</p>';
  document.getElementById('instRoundsContent').innerHTML = '<p style="color:var(--muted);font-size:13px;padding:8px 0;">Loading…</p>';
  document.getElementById('instVideoContent').innerHTML = '<p style="color:var(--muted);font-size:13px;padding:8px 0;">Loading…</p>';

  openOverlay('instStudentDetailModal');

  // Fetch real feedback/interview data for this student
  let reports = [];
  try {
    const res = await secureFetch(`/api/institute/students/${id}/feedback-reports`);
    if (res && res.ok) reports = await res.json();
  } catch (e) { /* silently fall through to empty state */ }

  // ── OVERVIEW TAB ──────────────────────────────────────────────
  const completed = reports.filter(r => r.evaluation);
  const attended  = reports.length;
  let avgScore = '—', lastDate = '—', bestPerf = null;
  if (completed.length) {
    // Calculate average — prefer overallScore, else compute from individual scores
    const scores = completed.map(r => {
      const ev = r.evaluation;
      if (ev.overallScore != null) return ev.overallScore;
      // compute from individual scores if available
      const parts = [ev.technicalScore, ev.communicationScore, ev.domainScore, ev.approachScore, ev.confidenceScore].filter(s => s != null);
      return parts.length ? (parts.reduce((a, b) => a + b, 0) / parts.length) : null;
    }).filter(s => s != null);

    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    avgScore = avg != null ? avg.toFixed(1) + ' / 10' : '—';

    const sorted = [...completed].sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate));
    lastDate = instFmtDate(sorted[0].scheduledDate);

    // Try overallPerformance string from any evaluation (most recent first)
    for (const r of sorted) {
      if (r.evaluation?.overallPerformance) { bestPerf = r.evaluation.overallPerformance; break; }
    }
    // Fallback: derive from computed average score
    if (!bestPerf && avg != null) {
      if (avg >= 8.5)      bestPerf = 'EXCELLENT';
      else if (avg >= 6.5) bestPerf = 'GOOD';
      else if (avg >= 4.5) bestPerf = 'AVERAGE';
      else                 bestPerf = 'POOR';
    }
  }
  document.getElementById('instModalScore').textContent = avgScore;
  document.getElementById('instModalAttended').textContent = attended + (attended === 1 ? ' interview' : ' interviews');
  document.getElementById('instModalLastDate').textContent = lastDate;
  document.getElementById('instModalPerfBadge').innerHTML = instPerfBadge(bestPerf);

  // ── FEEDBACK TAB ─────────────────────────────────────────────
  const fbEl = document.getElementById('instFeedbackContent');
  if (!completed.length) {
    fbEl.innerHTML = '<p style="color:var(--muted);font-size:13px;">No feedback available yet. Feedback will appear after interviews are completed.</p>';
  } else {
    fbEl.innerHTML = completed.map(r => {
      const ev = r.evaluation;
      const score = ev.overallScore != null ? `<span style="background:var(--primary);color:#fff;font-size:12px;font-weight:700;padding:2px 10px;border-radius:20px;">${ev.overallScore}/10</span>` : '';
      return `<div style="border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;">
          <span style="font-size:12px;font-weight:700;background:var(--bg);padding:2px 8px;border-radius:6px;color:var(--dark);">${r.domainName || r.departmentName || deptName || '—'}</span>
          <span style="font-size:12px;color:var(--muted);">${instFmtDate(r.scheduledDate)}</span>
          ${score}
        </div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:6px;"><i class="fa-solid fa-user" style="margin-right:4px;"></i>${r.interviewerName || '—'}</div>
        ${ev.strengths    ? `<div style="font-size:13px;margin-bottom:4px;"><b style="color:var(--success);">Strengths:</b> ${ev.strengths}</div>` : ''}
        ${ev.improvements ? `<div style="font-size:13px;margin-bottom:4px;"><b style="color:#D97706;">Improvements:</b> ${ev.improvements}</div>` : ''}
        ${ev.remarks      ? `<div style="font-size:13px;"><b style="color:var(--muted);">Remarks:</b> ${ev.remarks}</div>` : ''}
      </div>`;
    }).join('');
  }

  // ── INTERVIEWS TAB ────────────────────────────────────────────
  const rnEl = document.getElementById('instRoundsContent');
  if (!reports.length) {
    rnEl.innerHTML = '<p style="color:var(--muted);font-size:13px;">No interview rounds yet.</p>';
  } else {
    rnEl.innerHTML = reports.map((r, idx) => {
      const status = (r.applicationStatus || '').replace(/_/g, ' ');
      const statusCls = status.includes('CONFIRM') ? 'bg-success' : status.includes('COMPLET') ? 'bg-info' : 'bg-gray';
      const score = r.evaluation?.overallScore != null
        ? `<div style="font-size:13px;color:var(--dark);margin-top:4px;"><i class="fa-solid fa-star" style="color:#F59E0B;margin-right:4px;"></i>Score: <b>${r.evaluation.overallScore}/10</b></div>` : '';
      return `<div style="display:flex;gap:14px;padding:14px 0;border-bottom:1px solid var(--border);">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--primary);color:#fff;display:grid;place-items:center;font-weight:700;font-size:13px;flex-shrink:0;">${idx + 1}</div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
            <span style="font-size:13px;font-weight:700;color:var(--dark);">${r.domainName || r.departmentName || deptName || '—'}</span>
            <span class="badge ${statusCls}" style="font-size:11px;">${status}</span>
          </div>
          <div style="font-size:12.5px;color:var(--muted);"><i class="fa-regular fa-calendar" style="margin-right:4px;"></i>${instFmtDateTime(r.scheduledDate)}</div>
          <div style="font-size:12.5px;color:var(--muted);margin-top:2px;"><i class="fa-solid fa-user" style="margin-right:4px;"></i>${r.interviewerName || '—'}</div>
          ${score}
        </div>
      </div>`;
    }).join('');
  }

  // ── RECORDING TAB ─────────────────────────────────────────────
  const vidEl = document.getElementById('instVideoContent');
  const withVideo = reports.filter(r => r.videoUrl);
  if (!withVideo.length) {
    vidEl.innerHTML = '<p style="color:var(--muted);font-size:13px;">No recordings available yet.</p>';
  } else {
    vidEl.innerHTML = withVideo.map((r, idx) => {
      const score = r.evaluation?.overallScore != null
        ? `<div style="font-size:12.5px;color:var(--muted);margin-top:2px;"><i class="fa-solid fa-star" style="color:#F59E0B;margin-right:4px;"></i>Score: <b>${r.evaluation.overallScore}/10</b></div>` : '';
      return `<div style="display:flex;gap:14px;padding:14px 0;border-bottom:1px solid var(--border);align-items:center;">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--primary);color:#fff;display:grid;place-items:center;font-weight:700;font-size:13px;flex-shrink:0;">${idx + 1}</div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
            <i class="fa-solid fa-video" style="color:var(--primary);"></i>
            <span style="font-size:13px;font-weight:700;color:var(--dark);">${r.domainName || r.departmentName || deptName || '—'}</span>
            <span style="font-size:12px;color:var(--muted);">· ${instFmtDate(r.scheduledDate)}</span>
          </div>
          <div style="font-size:12.5px;color:var(--muted);"><i class="fa-solid fa-user" style="margin-right:4px;"></i>${r.interviewerName || '—'}</div>
          ${score}
        </div>
        <button class="btn btn-sm btn-p" onclick="openInstVideoLightbox('${r.videoUrl}')" style="flex-shrink:0;">
          <i class="fa-solid fa-play"></i> Watch
        </button>
      </div>`;
    }).join('');
  }

  mountResumeEmbed('instStudentResumeEmbed', resumeUrl || null, resumeFileName || null, { height: '520px' });
}

/* ═══════════════ NOTIFICATIONS ═══════════════ */
function getNotifKey() { return 'instituteNotifs_' + getInstituteId(); }

function loadNotifications() { return JSON.parse(localStorage.getItem(getNotifKey()) || '[]'); }
function saveNotifications(list) { localStorage.setItem(getNotifKey(), JSON.stringify(list)); }

function addNotification(message, type = 'info') {
  const list = loadNotifications();
  list.unshift({ id: Date.now(), message, type, time: new Date().toISOString(), read: false });
  // Keep only last 50
  if (list.length > 50) list.splice(50);
  saveNotifications(list);
  renderNotifPanel();
  updateNotifBadge();
}

function updateNotifBadge() {
  const list = loadNotifications();
  const unread = list.filter(n => !n.read).length;
  const badge = document.getElementById('notifBadge');
  if (badge) {
    badge.textContent = unread > 9 ? '9+' : unread;
    badge.style.display = unread > 0 ? 'flex' : 'none';
  }
}

function updateReqNavBadge() {
  const interviews = dashboardState.interviews || [];
  const awaitingCount = interviews.filter(i =>
    normalizeStatusValue(i.status) === 'AWAITING_CONFIRMATION' && !i.instituteConfirmed
  ).length;
  const badge = document.getElementById('reqNavBadge');
  if (badge) {
    badge.textContent = awaitingCount > 9 ? '9+' : awaitingCount;
    badge.style.display = awaitingCount > 0 ? 'inline-flex' : 'none';
  }
  // Also add a notification for each new awaiting request
  if (awaitingCount > 0) {
    const key = 'lastAwaitingCount_' + getInstituteId();
    const prev = parseInt(localStorage.getItem(key) || '0', 10);
    if (awaitingCount > prev) {
      addNotification(
        `${awaitingCount - prev} new interview slot${awaitingCount - prev > 1 ? 's' : ''} scheduled by admin — please confirm.`,
        'request'
      );
    }
    localStorage.setItem(key, String(awaitingCount));
  }
}

function renderNotifPanel() {
  const list = loadNotifications();
  const listEl = document.getElementById('notifList');
  if (!listEl) return;
  if (!list.length) {
    listEl.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:16px;text-align:center;">No notifications yet.</p>';
    return;
  }
  const typeIcon = { request: 'fa-calendar-check', info: 'fa-circle-info', success: 'fa-circle-check', warn: 'fa-triangle-exclamation' };
  const typeColor = { request: 'var(--secondary)', info: 'var(--primary)', success: 'var(--success)', warn: '#D97706' };
  listEl.innerHTML = list.map(n => {
    const dt = new Date(n.time);
    const timeStr = dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' · ' +
      dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return `<div class="notif-item ${n.read ? 'read' : ''}" onclick="markNotifRead(${n.id})">
      <div class="notif-icon" style="color:${typeColor[n.type]||typeColor.info};">
        <i class="fa-solid ${typeIcon[n.type]||typeIcon.info}"></i>
      </div>
      <div class="notif-body">
        <div class="notif-msg">${n.message}</div>
        <div class="notif-time">${timeStr}</div>
      </div>
      ${!n.read ? '<div class="notif-dot"></div>' : ''}
    </div>`;
  }).join('');
}

function markNotifRead(id) {
  const list = loadNotifications();
  const n = list.find(x => x.id === id);
  if (n) { n.read = true; saveNotifications(list); renderNotifPanel(); updateNotifBadge(); }
  // If it's a request notification, jump to requests view
  if (n && n.type === 'request') { closeNotifPanel(); showView('requests'); }
}

function clearNotifications() {
  saveNotifications([]);
  renderNotifPanel();
  updateNotifBadge();
}

function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;
  const isOpen = panel.classList.toggle('open');
  if (isOpen) { renderNotifPanel(); markAllNotifRead(); }
}

function closeNotifPanel() {
  const panel = document.getElementById('notifPanel');
  if (panel) panel.classList.remove('open');
}

function markAllNotifRead() {
  const list = loadNotifications();
  list.forEach(n => n.read = true);
  saveNotifications(list);
  updateNotifBadge();
}

document.addEventListener('click', e => {
  if (!e.target.closest('#notifWrap')) closeNotifPanel();
});

function showToast(msg,type='success'){
  const cols={success:['#DCFCE7','#166534'],warn:['#FEF3C7','#92400E'],error:['#FEE2E2','#991B1B']};
  const[bg,col]=cols[type]||cols.success;
  const t=document.createElement('div');
  t.className='toast';
  t.style.cssText=`background:${bg};color:${col};`;
  t.innerHTML=`<i class="fa-solid fa-${type==='error'?'circle-xmark':type==='warn'?'triangle-exclamation':'circle-check'}"></i>${msg}`;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),3000);
}

async function getRegisteredStudentCountForDept(deptName) {
  try {
    const dept = departments.find(d => d.name === deptName);
    if (!dept || !dept.id) return 0;
    const res = await secureFetch(`/departments/${dept.id}/students`, {});
    if (!res.ok) return 0;
    const students = await res.json();
    return students.length;
  } catch(e) { return 0; }
}

async function loadDeptStudents(deptId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '<p style="color:var(--muted);font-size:12px;">Loading students...</p>';
  try {
    const res = await secureFetch(`/departments/${deptId}/students`, {});
    if (!res.ok) throw new Error("Failed");
    const students = await res.json();
    if (!students.length) {
      container.innerHTML = '<p style="color:var(--muted);">No students registered yet.</p>';
      return;
    }
    container.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12.5px;">
      <thead><tr style="background:#F8FAFC;">
        <th style="padding:8px;text-align:left;">Name</th>
        <th style="padding:8px;text-align:left;">Email</th>
        <th style="padding:8px;text-align:left;">Class (Year &amp; Degree)</th>
      </tr></thead><tbody>
      ${students.map(s => `<tr style="border-bottom:1px solid #F1F5F9;">
        <td style="padding:8px;font-weight:600;">${s.firstName||''} ${s.lastName||''}</td>
        <td style="padding:8px;color:var(--muted);">${s.email||'—'}</td>
        <td style="padding:8px;">${s.studentClass||'—'}</td>
      </tr>`).join('')}
      </tbody></table></div>`;
  } catch(e) {
    container.innerHTML = '<p style="color:var(--muted);">Could not load students.</p>';
  }
}

function openInterviewViewModal(requestId) {
  const iv = (dashboardState.interviews||[]).find(i => i.id === requestId);
  if (!iv) return;
  const slot = formatInterviewSlot(iv);
  const deptName = iv.departmentName || '—';
  const statusHtml = statusBadge(iv.status);

  const modalHtml = `
    <div class="modal-overlay open" id="ivViewModal" onclick="if(event.target===this)document.getElementById('ivViewModal').remove()">
      <div class="modal" style="max-width:440px;width:95%;">
        <div class="modal-header" style="border-bottom:1px solid var(--border);padding-bottom:14px;margin-bottom:0;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;border-radius:9px;background:#EFF6FF;display:grid;place-items:center;flex-shrink:0;">
              <i class="fa-solid fa-calendar-check" style="color:var(--primary);font-size:15px;"></i>
            </div>
            <div>
              <h3 style="font-size:15px;font-weight:800;color:var(--dark);line-height:1.2;">Interview Details</h3>
              <p style="font-size:11.5px;color:var(--muted);margin-top:1px;">Confirmed interview slot information</p>
            </div>
          </div>
          <button class="modal-close" onclick="document.getElementById('ivViewModal').remove()" style="background:var(--bg);border:none;width:30px;height:30px;border-radius:6px;cursor:pointer;display:grid;place-items:center;color:var(--muted);font-size:16px;transition:var(--transition);"
            onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='var(--bg)'">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div style="padding:20px;display:grid;gap:12px;">

          <div style="border-radius:var(--radius-sm);border:1.5px solid #BFDBFE;overflow:hidden;">
            <div style="background:#EFF6FF;padding:8px 14px;border-bottom:1px solid #BFDBFE;display:flex;align-items:center;gap:6px;">
              <i class="fa-solid fa-sitemap" style="color:var(--primary);font-size:11px;"></i>
              <span style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--primary);">Department</span>
            </div>
            <div style="background:var(--card);padding:12px 14px;">
              <span style="font-weight:700;font-size:15px;color:var(--dark);">${deptName}</span>
            </div>
          </div>

          <div style="border-radius:var(--radius-sm);border:1.5px solid #BBF7D0;overflow:hidden;">
            <div style="background:#F0FDF4;padding:8px 14px;border-bottom:1px solid #BBF7D0;display:flex;align-items:center;gap:6px;">
              <i class="fa-solid fa-clock" style="color:#16A34A;font-size:11px;"></i>
              <span style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#16A34A;">Scheduled Slot</span>
            </div>
            <div style="background:var(--card);padding:12px 14px;">
              <span style="font-weight:700;font-size:14px;color:var(--dark);">${slot}</span>
            </div>
          </div>

          <div style="border-radius:var(--radius-sm);border:1.5px solid var(--border);overflow:hidden;">
            <div style="background:var(--bg);padding:8px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:6px;">
              <i class="fa-solid fa-circle-half-stroke" style="color:var(--muted);font-size:11px;"></i>
              <span style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);">Status</span>
            </div>
            <div style="background:var(--card);padding:12px 14px;">
              ${statusHtml}
            </div>
          </div>

        </div>
        <div style="padding:0 20px 20px;">
          <button class="btn btn-ghost" style="width:100%;justify-content:center;border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:10px;font-weight:600;font-size:13.5px;" onclick="document.getElementById('ivViewModal').remove()">
            <i class="fa-solid fa-xmark" style="font-size:11px;"></i> Close
          </button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/* ═══════════════ RENDER ALL ═══════════════ */
async function renderAll(){
  await Promise.all([
    renderOverview(),
    renderDeptCards(),
    renderSettingsTable()
  ]);

  renderDeptCheckboxes();
  renderReqStats();
  renderReqTable();
  renderDeptChart();
}

/* ═══════════════ INIT ═══════════════ */
window.addEventListener('DOMContentLoaded', async () => {
  // Check if user is logged in and is INSTITUTE role
  if (!await checkAuth('INSTITUTE')) return;

  // 1. get institute FIRST
  await fetchInstituteDetails();

  // 2. now safe to sync
  syncRegistry();

  // 3. load dashboard API
  await loadDashboard();

  // 4. UI setup
  initHeader();
  initBranding();
  updateNotifBadge();
  renderNotifPanel();

  // 5. load domains from admin settings, then departments
  await loadDomainsIntoGrid();
  await fetchDepartments();

  // 6. fetch interview requests so dashboardState.interviews is populated before rendering
  await fetchInterviewRequests();

  // 7. render everything (now has both departments + interviews)
  await renderAll();

  // 8. check setup modal
  await checkSetup();
});

async function renderDeptChart() {

  try {
    const res = await secureFetch(`/departments/stats/${getInstituteId()}`, {
      headers: {
      }
    });

    if (!res.ok) throw new Error("Failed to fetch stats");

    const data = await res.json();

    const chart = document.getElementById("deptChart");
    chart.innerHTML = "";

    if (!data.length) {
      chart.innerHTML = "<p style='color:var(--muted)'>No data available</p>";
      return;
    }

    const max = Math.max(...data.map(d => d.studentCount), 1);

    data.forEach((d, index) => {
      const height = (d.studentCount / max) * 100;

      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.height = height + "%";
      bar.setAttribute("data-value", d.studentCount);
      bar.setAttribute("data-label", d.name);

      chart.appendChild(bar);
    });

  } catch (err) {
    console.error(err);
  }
}