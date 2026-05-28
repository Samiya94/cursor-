// ── Load domains from admin settings into interviewer registration select ──
(async function loadDomainSelect() {
    const select = document.getElementById('domainSelect');
    if (!select) return;
    try {
        const res = await fetch('/api/domains');
        if (!res.ok) throw new Error('failed');
        const domains = await res.json();
        select.innerHTML = '<option value="">Select Domain</option>'
            + domains.map(d => `<option value="${d}">${d}</option>`).join('')
            + '<option value="Other">Other</option>';
    } catch(e) {
        // fallback: keep the loading option but make it selectable
        select.innerHTML = '<option value="">Select Domain</option><option value="Other">Other</option>';
        console.error('Could not load domains', e);
    }
})();

function toggleDomainOther() {
    const sel = document.getElementById('domainSelect');
    const wrap = document.getElementById('domainOtherWrap');
    const input = document.getElementById('domainOther');
    if (!sel || !wrap) return;
    const show = sel.value === 'Other';
    wrap.style.display = show ? '' : 'none';
    if (!show && input) input.value = '';
}

function toggleQualificationOther() {
    const sel = document.getElementById('qualificationSelect');
    const wrap = document.getElementById('qualificationOtherWrap');
    const input = document.getElementById('qualificationOther');
    if (!sel || !wrap) return;
    const show = sel.value === 'Other';
    wrap.style.display = show ? '' : 'none';
    if (!show && input) input.value = '';
}

// Validate registration link (ONLY for TPO registration page)

const params = new URLSearchParams(window.location.search);
const instId = params.get("inst");
const token = params.get("token");

// If this page is opened via registration link
if(instId && token){

  fetch("http://localhost:8080/register/validate-registration", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ instId, token })
  })
  .then(res => res.json())
  .then(valid => {
    if(!valid){
      alert("Invalid or expired registration link");
      window.location.href = "login.html";
    } else {
      console.log("Valid registration link");
    }
  })
  .catch(err => {
    console.error(err);
    alert("Server error while validating link");
  });

}

/* ── Tab Switch ── */
/* ── TOGGLE PASSWORD VISIBILITY ── */
function togglePw(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon  = document.getElementById(iconId);
  const isHidden = input.type === 'password';
  input.type     = isHidden ? 'text' : 'password';
  icon.className = isHidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
}

function switchTab(role){
  document.querySelectorAll('.tab-btn').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+role).classList.add('active');
  document.querySelectorAll('.form-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('panel-'+role).classList.add('active');
  // scroll card top
  document.querySelector('.reg-card').scrollIntoView({behavior:'smooth',block:'start'});
}

/* ── Tag Input (departments / skills) ── */
function addTag(e, wrapId, inputId){
  if(e.key==='Enter'||e.key===','){
    e.preventDefault();
    const input=document.getElementById(inputId);
    const val=input.value.replace(',','').trim();
    if(!val)return;
    const wrap=document.getElementById(wrapId);
    const chip=document.createElement('div');
    chip.className='tag-chip';
    chip.innerHTML=`${val}<button type="button" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>`;
    wrap.insertBefore(chip,input);
    input.value='';
  }
}


/* ── Photo Preview ── */
function previewPhoto(input){
  const file=input.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    const img=document.getElementById('photo-preview-img');
    const circle=document.getElementById('photo-circle');
    img.src=e.target.result;
    circle.classList.add('has-img');
    document.getElementById('photo-filename').textContent=file.name;
  };
  reader.readAsDataURL(file);
}

function showResumeFilename(input){
  const file=input.files[0];
  const el=document.getElementById('resume-filename');
  if(!file||!el)return;
  const maxMB=5;
  if(file.size>maxMB*1024*1024){
    el.textContent='File too large (max 5 MB)';
    el.style.color='#dc2626';
    input.value='';
    return;
  }
  el.textContent=file.name;
  el.style.color='var(--success,#16a34a)';
}


/* ── Password Strength ── */
function checkStrength(inputId, barId, textId){
  const val=document.getElementById(inputId).value;
  const bar=document.getElementById(barId);
  const txt=document.getElementById(textId);
    let score=0;
  if(val.length>=6)score++;
  if(/[A-Z]/.test(val))score++;
  if(/[0-9]/.test(val))score++;
  if(/[^A-Za-z0-9]/.test(val))score++;
  const levels=[
    {w:'0%',bg:'transparent',t:''},
    {w:'25%',bg:'#DC2626',t:'Weak'},
    {w:'50%',bg:'#EAB308',t:'Fair'},
    {w:'75%',bg:'#0D9488',t:'Good'},
    {w:'100%',bg:'#16A34A',t:'Strong'},
  ];
  const l=levels[score]||levels[0];
  bar.style.width=l.w;
  bar.style.background=l.bg;
  txt.textContent=l.t?`Strength: ${l.t}`:'';
  txt.style.color=l.bg;
}

/* ── Interviewer Success Screen ── */
function showInterviewerSuccess(name) {
  const panel = document.getElementById('panel-interviewer');
  if (!panel) return;

  // Extract first name for personalised greeting
  const firstName = (name || '').split(' ')[0] || 'there';

  panel.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 48px 32px;
      gap: 0;
    ">
      <!-- animated tick circle -->
      <div style="
        width: 72px; height: 72px; border-radius: 50%;
        background: #DCFCE7; display: flex; align-items: center;
        justify-content: center; margin-bottom: 20px;
        animation: popIn .4s cubic-bezier(.175,.885,.32,1.275) both;
      ">
        <i class="fa-solid fa-circle-check" style="font-size:36px; color:#16A34A;"></i>
      </div>

      <h2 style="font-size:22px; font-weight:800; color:var(--dark,#0F172A); margin-bottom:8px;">
        You're registered, ${firstName}!
      </h2>

      <p style="font-size:15px; color:#64748B; margin-bottom:28px; max-width:360px; line-height:1.6;">
        Your application has been received. Our admin team will review your profile and
        <strong style="color:var(--dark,#0F172A);">notify you by email</strong> once your account is approved.
      </p>

      <a href="/login" style="
        display:inline-flex; align-items:center; gap:8px;
        background:var(--primary,#1E3A8A); color:#fff;
        padding:12px 28px; border-radius:8px;
        font-size:14px; font-weight:700; text-decoration:none;
        transition: opacity .2s;
      " onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
        <i class="fa-solid fa-right-to-bracket"></i> Go to Login
      </a>



    </div>

    <style>
      @keyframes popIn {
        0%   { transform: scale(0.5); opacity: 0; }
        100% { transform: scale(1);   opacity: 1; }
      }
    </style>
  `;

  // Scroll to the success card smoothly
  panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ── Form Submit ── */
async function handleSubmit(e, role){
  e.preventDefault();

  const form = e.target;

  // Terms check
  const terms = form.querySelector('input[type="checkbox"]');
  if(!terms.checked){
    showToast('Please accept the Terms & Conditions.','error');
    return;
  }

  // Password match check
  let password, confirmPassword;

  if(role==='institute'){
    password = document.getElementById('inst-password').value;
    confirmPassword = document.getElementById('inst-confirm-password').value;
  } else {
    password = document.getElementById('int-password').value;
    confirmPassword = document.getElementById('int-confirm-password').value;
  }

  if(password.length < 6){
    showToast('Password must be at least 6 characters long.','error');
    return;
  }

  if(password !== confirmPassword){
    showToast('Passwords do not match.','error');
    return;
  }

  // Disable submit button
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
  }

  try {

    // =========================
    // INSTITUTE (JSON)
    // =========================
    if(role === 'institute'){

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      const response = await fetch(`/register/institute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });

      if(response.ok){
        showSuccessModal("Institute Registered!", "Your institute has been registered successfully. You can now log in.");
        form.reset();
      } else {
        const errorText = await response.text();
        showToast(errorText || 'Registration failed.','error');
      }
      
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }

    }

    // =========================
    // INTERVIEWER (FormData)
    // =========================
    if(role === 'interviewer'){

      const domainSel = form.querySelector('[name="domain"]');
      const qualSel = form.querySelector('[name="qualification"]');

      if (domainSel && domainSel.value === 'Other') {
        const custom = (document.getElementById('domainOther') || {}).value.trim();
        if (!custom) {
          showToast('Please enter your primary domain / expertise.', 'error');
          return;
        }
      }
      if (qualSel && qualSel.value === 'Other') {
        const custom = (document.getElementById('qualificationOther') || {}).value.trim();
        if (!custom) {
          showToast('Please enter your highest qualification.', 'error');
          return;
        }
      }

      const formData = new FormData(form);

      // Capture name before we do anything else (form.reset() will clear it)
      const fullName = form.querySelector('input[name="fullName"]')
                         ? form.querySelector('input[name="fullName"]').value.trim()
                         : '';

      if (domainSel && domainSel.value === 'Other') {
        formData.set('domain', document.getElementById('domainOther').value.trim());
      }
      if (qualSel && qualSel.value === 'Other') {
        formData.set('qualification', document.getElementById('qualificationOther').value.trim());
      }
      formData.delete('domainOther');
      formData.delete('qualificationOther');

      // Skills fix
      const skills = Array.from(document.querySelectorAll('#skills-tags-wrap .tag-chip'))
        .map(tag => tag.textContent.replace('×','').trim());

      formData.delete("skills");

      skills.forEach(skill => {
        formData.append("skills", skill);
      });

      const response = await fetch(`/register/interviewer`, {
        method: "POST",
        body: formData   // NO headers
      });

      if(response.ok){
        const firstName = (fullName || '').split(' ')[0] || 'there';
        showSuccessModal(
            `You're registered, ${firstName}!`,
            "Your application has been received. Our admin team will review your profile and notify you by email once your account is approved."
        );
        form.reset();
      } else {
        const errorText = await response.text();
        showToast(errorText || 'Interviewer registration failed.','error');
      }
      
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    }

  } catch (error) {
    console.error(error);
    showToast('Server error.','error');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  }
}

function showToast(msg,type='success'){
  const t=document.getElementById('toast');
  const m=document.getElementById('toast-msg');
  t.className='toast '+type;
  m.textContent=msg;
  t.querySelector('i').className=type==='success'?'fa-solid fa-circle-check':'fa-solid fa-circle-exclamation';
  void t.offsetWidth;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),4000);
}

function showSuccessModal(title, msg) {
  const modal = document.getElementById('successModal');
  if (!modal) return;
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalMsg').textContent = msg;
  modal.classList.add('show');
}