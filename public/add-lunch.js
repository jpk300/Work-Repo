const addLunchForm = document.getElementById('addLunchForm');
const editLunchId = document.getElementById('editLunchId');
const newLunchTitle = document.getElementById('newLunchTitle');
const newLunchStartsAt = document.getElementById('newLunchStartsAt');
const newLunchLocation = document.getElementById('newLunchLocation');
const newLunchAddress = document.getElementById('newLunchAddress');
const addLunchBtn = document.getElementById('addLunchBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const addLunchMessage = document.getElementById('addLunchMessage');

const lunchListBody = document.getElementById('lunchListBody');
const lunchListEmpty = document.getElementById('lunchListEmpty');
const lunchListMessage = document.getElementById('lunchListMessage');

function setAddLunchMessage(text, { error } = { error: false }) {
  addLunchMessage.textContent = text || '';
  addLunchMessage.classList.toggle('error', Boolean(error));
}

function toLocalIsoWithOffset(datetimeLocalValue) {
  if (!datetimeLocalValue) return '';
  const d = new Date(datetimeLocalValue);
  if (Number.isNaN(d.getTime())) return '';

  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  const ss = pad(d.getSeconds());

  const offsetMinutes = -d.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const offH = pad(Math.floor(abs / 60));
  const offM = pad(abs % 60);

  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}${sign}${offH}:${offM}`;
}

function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function clearEditMode() {
  editLunchId.value = '';
  addLunchBtn.textContent = 'Add';
  cancelEditBtn.hidden = true;
}

function enterEditMode(lunch) {
  editLunchId.value = lunch.id;
  newLunchTitle.value = lunch.title || '';
  newLunchStartsAt.value = toDatetimeLocalValue(lunch.starts_at);
  newLunchLocation.value = lunch.location || '';
  newLunchAddress.value = lunch.address || '';
  addLunchBtn.textContent = 'Save';
  cancelEditBtn.hidden = false;
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
  const res = await fetch('/api/lunches?include_deleted=1');
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
      if (l.deleted_at) tr.classList.add('row-deleted');

      const titleTd = document.createElement('td');
      titleTd.textContent = l.title;

      const dateTd = document.createElement('td');
      dateTd.textContent = formatStartsAt(l.starts_at);

      const locTd = document.createElement('td');
      locTd.textContent = l.location;

      const addrTd = document.createElement('td');
      addrTd.textContent = l.address || '';

      const statusTd = document.createElement('td');
      statusTd.textContent = l.deleted_at ? 'Deleted' : 'Active';

      const actionTd = document.createElement('td');

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'mini-btn';
      editBtn.textContent = 'Edit';
      editBtn.disabled = Boolean(l.deleted_at);
      editBtn.addEventListener('click', () => {
        enterEditMode(l);
        setAddLunchMessage('Editing lunch. Click Save to apply changes.');
        setLunchListMessage('');
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'mini-btn danger';
      removeBtn.textContent = 'Remove';
      removeBtn.hidden = Boolean(l.deleted_at);
      removeBtn.addEventListener('click', async () => {
        const ok = window.confirm(`Remove "${l.title}"? This will hide it from the main page.`);
        if (!ok) return;

        removeBtn.disabled = true;
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
            removeBtn.disabled = false;
            return;
          }
          setLunchListMessage('Lunch removed.');
          await refreshLunchList();
        } catch {
          setLunchListMessage('Failed to remove lunch', { error: true });
          removeBtn.disabled = false;
        }
      });

      const restoreBtn = document.createElement('button');
      restoreBtn.type = 'button';
      restoreBtn.className = 'mini-btn';
      restoreBtn.textContent = 'Restore';
      restoreBtn.hidden = !l.deleted_at;
      restoreBtn.addEventListener('click', async () => {
        const ok = window.confirm(`Restore "${l.title}"?`);
        if (!ok) return;

        restoreBtn.disabled = true;
        setLunchListMessage('Restoring...');
        try {
          const res = await fetch(`/api/lunches/${encodeURIComponent(l.id)}/restore`, { method: 'POST' });
          const payload = await readJsonOrText(res);
          if (!res.ok) {
            const msg =
              payload.kind === 'json'
                ? payload.data?.error || `Failed to restore lunch (HTTP ${res.status})`
                : `Failed to restore lunch (HTTP ${res.status}): ${String(payload.data || '').slice(0, 200)}`;
            setLunchListMessage(msg, { error: true });
            restoreBtn.disabled = false;
            return;
          }
          setLunchListMessage('Lunch restored.');
          await refreshLunchList();
        } catch {
          setLunchListMessage('Failed to restore lunch', { error: true });
          restoreBtn.disabled = false;
        }
      });

      actionTd.appendChild(editBtn);
      actionTd.appendChild(document.createTextNode(' '));
      actionTd.appendChild(removeBtn);
      actionTd.appendChild(restoreBtn);

      tr.appendChild(titleTd);
      tr.appendChild(dateTd);
      tr.appendChild(locTd);
      tr.appendChild(addrTd);
      tr.appendChild(statusTd);
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
    starts_at: toLocalIsoWithOffset(newLunchStartsAt.value),
    location: newLunchLocation.value,
    address: newLunchAddress.value
  };

  if (!payload.starts_at) {
    setAddLunchMessage('Please enter a valid date/time.', { error: true });
    return;
  }

  addLunchBtn.disabled = true;
  const isEdit = Boolean(editLunchId.value);
  setAddLunchMessage(isEdit ? 'Saving...' : 'Adding...');

  try {
    const url = isEdit ? `/api/lunches/${encodeURIComponent(editLunchId.value)}` : '/api/lunches';
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
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

    setAddLunchMessage(isEdit ? 'Lunch updated.' : 'Lunch added.');
    addLunchForm.reset();
    clearEditMode();
    addLunchBtn.disabled = false;
    await refreshLunchList();
  } catch {
    setAddLunchMessage('Failed to add lunch', { error: true });
    addLunchBtn.disabled = false;
  }
});

cancelEditBtn.addEventListener('click', () => {
  addLunchForm.reset();
  clearEditMode();
  setAddLunchMessage('');
});

refreshLunchList();
