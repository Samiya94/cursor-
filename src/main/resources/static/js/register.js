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
  if(val.length>=8)score++;
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

  if(password !== confirmPassword){
    showToast('Passwords do not match.','error');
    return;
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
        showToast('Institute registered successfully!','success');
        form.reset();
      }

    }

    // =========================
    // INTERVIEWER (FormData)
    // =========================
    if(role === 'interviewer'){

      const formData = new FormData(form);

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
        showToast('Interviewer registered successfully!','success');
        form.reset();
      } else {
        const errorText = await response.text();
        showToast(errorText || 'Interviewer registration failed.','error');
        return;
      }
    }

    // Redirect
    setTimeout(() => {
      window.location.href = "/login";
    }, 2000);

  } catch (error) {
    console.error(error);
    showToast('Server error.','error');
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