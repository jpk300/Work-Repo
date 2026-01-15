const addLunchForm = document.getElementById('addLunchForm');
const newLunchTitle = document.getElementById('newLunchTitle');
const newLunchStartsAt = document.getElementById('newLunchStartsAt');
const newLunchLocation = document.getElementById('newLunchLocation');
const newLunchAddress = document.getElementById('newLunchAddress');
const addLunchBtn = document.getElementById('addLunchBtn');
const addLunchMessage = document.getElementById('addLunchMessage');

const lunchListBody = document.getElementById('lunchListBody');
const lunchListEmpty = document.getElementById('lunchListEmpty');
const lunchListMessage = document.getElementById('lunchListMessage');

function setAddLunchMessage(text, { error } = { error: false }) {
  addLunchMessage.textContent = text || '';
  addLunchMessage.classList.toggle('error', Boolean(error));
}

function toIsoFromDatetimeLocal(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

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

function setLunchListMessage(text, { error } = { error: false }) {
  lunchListMessage.textContent = text || '';
  lunchListMessage.classList.toggle('error', Boolean(error));
}

async function readJsonOrText(res) {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/json')) {
    try {
      return { kind: 'json', data: await res.json() };
    } catch {
      return { kind: 'text', data: await res.text() };
    }
  }
  return { kind: 'text', data: await res.text() };
}

async function fetchLunches() {
  const res = await fetch('/api/lunches');
  if (!res.ok) throw new Error('Failed to load lunches');
  return res.json();
}

async function refreshLunchList() {
  setLunchListMessage('');
  lunchListBody.innerHTML = '';
  lunchListEmpty.hidden = true;

  try {
    const lunches = await fetchLunches();
    const list = Array.isArray(lunches) ? lunches : [];

    if (list.length === 0) {
      lunchListEmpty.hidden = false;
      return;
    }

    for (const l of list) {
      const tr = document.createElement('tr');

      const titleTd = document.createElement('td');
      titleTd.textContent = l.title;

      const dateTd = document.createElement('td');
      dateTd.textContent = formatStartsAt(l.starts_at);

      const locTd = document.createElement('td');
      locTd.textContent = l.location;

      const addrTd = document.createElement('td');
      addrTd.textContent = l.address || '';

      const actionTd = document.createElement('td');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mini-btn danger';
      btn.textContent = 'Remove';
      btn.addEventListener('click', async () => {
        const ok = window.confirm(`Remove "${l.title}"? This will also remove its sign-ups.`);
        if (!ok) return;

        btn.disabled = true;
        setLunchListMessage('Removing...');
        try {
          const res = await fetch(`/api/lunches/${encodeURIComponent(l.id)}`, { method: 'DELETE' });
          const payload = await readJsonOrText(res);
          if (!res.ok) {
            const msg =
              payload.kind === 'json'
                ? payload.data?.error || `Failed to remove lunch (HTTP ${res.status})`
                : `Failed to remove lunch (HTTP ${res.status}): ${String(payload.data || '').slice(0, 200)}`;
            setLunchListMessage(msg, { error: true });
            btn.disabled = false;
            return;
          }
          setLunchListMessage('Lunch removed.');
          await refreshLunchList();
        } catch {
          setLunchListMessage('Failed to remove lunch', { error: true });
          btn.disabled = false;
        }
      });
      actionTd.appendChild(btn);

      tr.appendChild(titleTd);
      tr.appendChild(dateTd);
      tr.appendChild(locTd);
      tr.appendChild(addrTd);
      tr.appendChild(actionTd);
      lunchListBody.appendChild(tr);
    }
  } catch {
    setLunchListMessage('Failed to load lunches', { error: true });
  }
}

addLunchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setAddLunchMessage('');

  const payload = {
    title: newLunchTitle.value,
    starts_at: toIsoFromDatetimeLocal(newLunchStartsAt.value),
    location: newLunchLocation.value,
    address: newLunchAddress.value
  };

  if (!payload.starts_at) {
    setAddLunchMessage('Please enter a valid date/time.', { error: true });
    return;
  }

  addLunchBtn.disabled = true;
  setAddLunchMessage('Adding...');

  try {
    const res = await fetch('/api/lunches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const parsed = await readJsonOrText(res);
    if (!res.ok) {
      const msg =
        parsed.kind === 'json'
          ? parsed.data?.error || `Failed to add lunch (HTTP ${res.status})`
          : `Failed to add lunch (HTTP ${res.status}): ${String(parsed.data || '').slice(0, 200)}`;
      setAddLunchMessage(msg, { error: true });
      addLunchBtn.disabled = false;
      return;
    }

    setAddLunchMessage('Lunch added.');
    addLunchForm.reset();
    addLunchBtn.disabled = false;
    await refreshLunchList();
  } catch {
    setAddLunchMessage('Failed to add lunch', { error: true });
    addLunchBtn.disabled = false;
  }
});

refreshLunchList();
