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
const adminOutput = document.getElementById('adminOutput');

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

function openSignup(lunch) {
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
    meta.innerHTML = `${formatStartsAt(lunch.starts_at)}<br/>${lunch.location}`;

    const badges = document.createElement('div');
    badges.className = 'badges';

    const remainingBadge = document.createElement('span');
    remainingBadge.className = `badge ${lunch.remaining > 0 ? 'ok' : 'full'}`;
    remainingBadge.textContent = `${lunch.remaining} / ${lunch.capacity} spots left`;

    const usedBadge = document.createElement('span');
    usedBadge.className = 'badge';
    usedBadge.textContent = `${lunch.used} signed up`;

    badges.appendChild(remainingBadge);
    badges.appendChild(usedBadge);

    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = lunch.remaining > 0 ? 'Sign up' : 'Full';
    btn.disabled = lunch.remaining <= 0;
    btn.addEventListener('click', () => openSignup(lunch));

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(badges);
    card.appendChild(btn);

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

async function refreshAdminView() {
  const id = adminLunch.value;
  if (!id) return;

  adminOutput.textContent = 'Loading...';

  const res = await fetch(`/api/lunches/${encodeURIComponent(id)}/signups`);
  const data = await res.json();

  if (!res.ok) {
    adminOutput.textContent = JSON.stringify(data, null, 2);
    return;
  }

  adminOutput.textContent = JSON.stringify(data, null, 2);
}

closeDialog.addEventListener('click', () => {
  dialog.close();
});

dialog.addEventListener('click', (e) => {
  const rect = dialog.getBoundingClientRect();
  const clickedInDialog =
    e.clientX >= rect.left &&
    e.clientX <= rect.right &&
    e.clientY >= rect.top &&
    e.clientY <= rect.bottom;

  if (!clickedInDialog) dialog.close();
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();

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

    setMessage('Signed up successfully.');
    await load();
    setTimeout(() => dialog.close(), 700);
  } catch {
    setMessage('Signup failed', { error: true });
    submitBtn.disabled = false;
  }
});

async function load() {
  const lunches = await fetchLunches();
  renderLunches(lunches);
  renderAdminLunchOptions(lunches);
}

refreshAdmin.addEventListener('click', refreshAdminView);
adminLunch.addEventListener('change', refreshAdminView);

load().then(refreshAdminView).catch(() => {
  lunchesEl.innerHTML = '<div class="card">Failed to load lunches.</div>';
});
