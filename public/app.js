const lunchesEl = document.getElementById('lunches');
const dialog = document.getElementById('signupDialog');
const signupForm = document.getElementById('signupForm');
const dialogTitle = document.getElementById('dialogTitle');
const closeDialog = document.getElementById('closeDialog');
const lunchIdInput = document.getElementById('lunchId');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const teamInput = document.getElementById('team');
const formMessage = document.getElementById('formMessage');
const submitBtn = document.getElementById('submitBtn');

const adminLunch = document.getElementById('adminLunch');
const refreshAdmin = document.getElementById('refreshAdmin');
const adminLunchTitle = document.getElementById('adminLunchTitle');
const adminLunchMeta = document.getElementById('adminLunchMeta');
const adminSpotsBadge = document.getElementById('adminSpotsBadge');
const adminProgressBar = document.getElementById('adminProgressBar');
const adminTableBody = document.getElementById('adminTableBody');
const adminEmpty = document.getElementById('adminEmpty');

const cancelLunch = document.getElementById('cancelLunch');
const cancelEmail = document.getElementById('cancelEmail');
const cancelBtn = document.getElementById('cancelBtn');
const cancelMessage = document.getElementById('cancelMessage');

let lunchById = new Map();

function formatStartsAt(iso) {
  try {
    return new Date(iso).toLocaleString([], {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

async function fetchLunches() {
  const res = await fetch('/api/lunches');
  if (!res.ok) throw new Error('Failed to load lunches');
  return res.json();
}

function setMessage(text, { error } = { error: false }) {
  formMessage.textContent = text || '';
  formMessage.classList.toggle('error', Boolean(error));
}

function setCancelMessage(text, { error } = { error: false }) {
  cancelMessage.textContent = text || '';
  cancelMessage.classList.toggle('error', Boolean(error));
}

function isAllowedEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return email.trim().toLowerCase().endsWith('@wwt.com');
}

function openSignup(lunch) {
  if (lunch && lunch.is_past) return;
  dialogTitle.textContent = `Sign up: ${lunch.title}`;
  lunchIdInput.value = lunch.id;
  setMessage('');
  signupForm.reset();
  nameInput.focus();
  dialog.showModal();
}

function renderLunches(lunches) {
  lunchesEl.innerHTML = '';

  for (const lunch of lunches) {
    const card = document.createElement('div');
    card.className = 'card';

    const title = document.createElement('h3');
    title.textContent = lunch.title;

    const meta = document.createElement('div');
    meta.className = 'meta';
    const addressLine = lunch.address && String(lunch.address).trim().length > 0 ? `<br/>${lunch.address}` : '';
    meta.innerHTML = `${formatStartsAt(lunch.starts_at)}<br/>${lunch.location}${addressLine}`;

    const badges = document.createElement('div');
    badges.className = 'badges';

    if (lunch.is_past) {
      const pastBadge = document.createElement('span');
      pastBadge.className = 'badge past';
      pastBadge.textContent = 'Date Past';
      badges.appendChild(pastBadge);
    }

    const remainingBadge = document.createElement('span');
    remainingBadge.className = `badge ${lunch.remaining > 0 ? 'ok' : 'full'}`;
    remainingBadge.textContent = `${lunch.remaining} / ${lunch.capacity} spots left`;

    const usedBadge = document.createElement('span');
    usedBadge.className = 'badge';
    usedBadge.textContent = `${lunch.used} signed up`;

    badges.appendChild(remainingBadge);
    badges.appendChild(usedBadge);

    const waitlistBadge = document.createElement('span');
    waitlistBadge.className = 'badge';
    waitlistBadge.textContent = `${lunch.waitlist ?? 0} waitlisted`;
    badges.appendChild(waitlistBadge);

    const progress = document.createElement('div');
    progress.className = 'progress';
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    const capacity = Number(lunch.capacity || 0);
    const used = Number(lunch.used || 0);
    const pct = capacity > 0 ? Math.max(0, Math.min(100, (used / capacity) * 100)) : 0;
    progressBar.style.width = `${pct}%`;
    progress.appendChild(progressBar);

    let btn = null;
    if (!lunch.is_past) {
      btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = lunch.remaining > 0 ? 'Sign up' : 'Join waitlist';
      btn.addEventListener('click', () => openSignup(lunch));
    }

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(badges);
    card.appendChild(progress);
    if (btn) card.appendChild(btn);

    lunchesEl.appendChild(card);
  }
}

function renderAdminLunchOptions(lunches) {
  adminLunch.innerHTML = '';
  for (const lunch of lunches) {
    const opt = document.createElement('option');
    opt.value = lunch.id;
    opt.textContent = `${lunch.title} (${formatStartsAt(lunch.starts_at)})`;
    adminLunch.appendChild(opt);
  }
}

function renderCancelLunchOptions(lunches) {
  cancelLunch.innerHTML = '';
  for (const lunch of lunches) {
    const opt = document.createElement('option');
    opt.value = lunch.id;
    opt.textContent = `${lunch.title} (${formatStartsAt(lunch.starts_at)})`;
    cancelLunch.appendChild(opt);
  }
}

function formatSignedUpAt(iso) {
  try {
    return new Date(iso + 'Z').toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

async function refreshAdminView() {
  const id = adminLunch.value;
  if (!id) return;

  adminLunchTitle.textContent = 'Loading...';
  adminLunchMeta.textContent = '';
  adminSpotsBadge.textContent = '';
  if (adminProgressBar) adminProgressBar.style.width = '0%';
  adminTableBody.innerHTML = '';
  adminEmpty.hidden = true;

  const res = await fetch(`/api/lunches/${encodeURIComponent(id)}/signups`);
  const data = await res.json();

  if (!res.ok) {
    adminLunchTitle.textContent = 'Failed to load sign-ups';
    adminLunchMeta.textContent = data && data.error ? data.error : '';
    return;
  }

  const lunch = data.lunch;
  const signups = Array.isArray(data.signups) ? data.signups : [];
  const capacity = Number(data.capacity || 0);
  const used = signups.filter((s) => s && s.status === 'confirmed').length;
  const remaining = Math.max(0, capacity - used);

  adminLunchTitle.textContent = lunch.title;
  const addressLine = lunch.address && String(lunch.address).trim().length > 0 ? ` • ${lunch.address}` : '';
  adminLunchMeta.textContent = `${formatStartsAt(lunch.starts_at)} • ${lunch.location}${addressLine}`;

  adminSpotsBadge.className = `badge ${remaining > 0 ? 'ok' : 'full'}`;
  adminSpotsBadge.textContent = `${used} / ${capacity} filled (${remaining} left)`;

  if (adminProgressBar) {
    const pct = capacity > 0 ? Math.max(0, Math.min(100, (used / capacity) * 100)) : 0;
    adminProgressBar.style.width = `${pct}%`;
  }

  if (signups.length === 0) {
    adminEmpty.hidden = false;
    return;
  }

  adminTableBody.innerHTML = '';
  let waitlistIndex = 0;
  for (const s of signups) {
    const tr = document.createElement('tr');
    if (s.status === 'cancelled') tr.classList.add('row-cancelled');

    const nameTd = document.createElement('td');
    nameTd.textContent = s.name;

    const emailTd = document.createElement('td');
    emailTd.textContent = s.email;

    const teamTd = document.createElement('td');
    teamTd.textContent = s.team;

    const statusTd = document.createElement('td');
    let normalizedStatus;
    if (s.status === 'waitlist') {
      waitlistIndex += 1;
      normalizedStatus = `Waitlist (#${waitlistIndex})`;
    } else if (s.status === 'cancelled') {
      normalizedStatus = 'Cancelled';
    } else {
      normalizedStatus = 'Confirmed';
    }
    statusTd.textContent = normalizedStatus;

    const createdTd = document.createElement('td');
    createdTd.textContent = formatSignedUpAt(s.created_at);

    tr.appendChild(nameTd);
    tr.appendChild(emailTd);
    tr.appendChild(teamTd);
    tr.appendChild(statusTd);
    tr.appendChild(createdTd);

    adminTableBody.appendChild(tr);
  }
}

closeDialog.addEventListener('click', () => {
  dialog.close();
});

dialog.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close();
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!isAllowedEmail(emailInput.value)) {
    setMessage('Please use your @wwt.com email address.', { error: true });
    return;
  }

  submitBtn.disabled = true;
  setMessage('Submitting...');

  try {
    const lunchId = lunchIdInput.value;

    const payload = {
      name: nameInput.value,
      email: emailInput.value,
      team: teamInput.value
    };

    const res = await fetch(`/api/lunches/${encodeURIComponent(lunchId)}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || 'Signup failed', { error: true });
      submitBtn.disabled = false;
      return;
    }

    const lunchTitle = data.lunchTitle || 'this lunch';
    if (data.status === 'waitlist') {
      if (data.waitlistPosition) {
        setMessage(`You're #${data.waitlistPosition} on the waitlist for ${lunchTitle}.`);
      } else {
        setMessage(`You're on the waitlist for ${lunchTitle}.`);
      }
    } else {
      setMessage(`You're confirmed for ${lunchTitle}.`);
    }
    await load();
    if (adminLunch && lunchId) {
      adminLunch.value = lunchId;
      await refreshAdminView();
    }
    setTimeout(() => dialog.close(), 700);
  } catch {
    setMessage('Signup failed', { error: true });
    submitBtn.disabled = false;
  }
});

cancelBtn.addEventListener('click', async () => {
  setCancelMessage('');
  cancelBtn.disabled = true;

  if (!isAllowedEmail(cancelEmail.value)) {
    setCancelMessage('Please use your @wwt.com email address.', { error: true });
    cancelBtn.disabled = false;
    return;
  }

  try {
    const lunchId = cancelLunch.value;
    const email = cancelEmail.value;

    const res = await fetch(`/api/lunches/${encodeURIComponent(lunchId)}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    if (!res.ok) {
      setCancelMessage(data.error || 'Cancel failed', { error: true });
      cancelBtn.disabled = false;
      return;
    }

    if (data.promoted && data.promoted.email) {
      setCancelMessage(`Cancelled. Promoted from waitlist: ${data.promoted.email}`);
    } else {
      setCancelMessage('Cancelled.');
    }

    cancelEmail.value = '';

    await load();
    adminLunch.value = lunchId;
    await refreshAdminView();
    cancelBtn.disabled = false;
  } catch {
    setCancelMessage('Cancel failed', { error: true });
    cancelBtn.disabled = false;
  }
});

async function load() {
  const lunches = await fetchLunches();
  lunchById = new Map((Array.isArray(lunches) ? lunches : []).map((l) => [l.id, l]));
  renderLunches(lunches);
  renderAdminLunchOptions(lunches);
  renderCancelLunchOptions(lunches);
}

refreshAdmin.addEventListener('click', refreshAdminView);
adminLunch.addEventListener('change', refreshAdminView);

cancelLunch.addEventListener('change', () => {
  setCancelMessage('');
  const lunch = lunchById.get(cancelLunch.value);
  if (lunch && lunch.is_past) {
    cancelBtn.disabled = true;
    setCancelMessage('This lunch is in the past and can no longer be changed.', { error: true });
  } else {
    cancelBtn.disabled = false;
  }
});

load().then(refreshAdminView).catch(() => {
  lunchesEl.innerHTML = '<div class="card">Failed to load lunches.</div>';
});
