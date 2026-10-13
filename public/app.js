// DepotDesk Oberfläche: bewusst ohne Framework und Build-Schritt (siehe docs/architecture.md).

const AUTH_HEADER = 'X-DepotDesk-User';
const USER_KEY = 'depotdesk.user';
const DEFAULT_USER = 'j.berger';
const DEFAULT_FILTERS = {
  q: '',
  status: 'active',
  depot: '',
  type: '',
  priority: '',
  dueFrom: '',
  dueTo: '',
  overdue: false,
  mine: false,
};

const state = {
  userId: readStoredUser(),
  me: null,
  meta: null,
  filters: { ...DEFAULT_FILTERS },
  sort: 'dueDate',
  order: 'asc',
  page: 1,
  pageSize: 50,
  total: 0,
  selectedId: null,
};

const $ = (selector) => document.querySelector(selector);
const filtersForm = $('#filters');

// ---------------------------------------------------------------------------
// Formatierung
// ---------------------------------------------------------------------------

const dateTimeFormat = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  dateStyle: 'medium',
  timeStyle: 'short',
});
const currency = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const number = new Intl.NumberFormat('de-DE');

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const formatDate = (isoDate) => (isoDate ? isoDate.split('-').reverse().join('.') : '–');
const formatDateTime = (iso) => (iso ? dateTimeFormat.format(new Date(iso)) : '–');
const statusChip = (status) => `<span class="chip status-${status}">${esc(state.meta.statuses[status])}</span>`;
const priorityChip = (priority) => `<span class="chip prio-${priority}">${esc(state.meta.priorities[priority])}</span>`;
const option = (value, label, selected = false) =>
  `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(label)}</option>`;

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function api(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json', [AUTH_HEADER]: state.userId };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(payload.error?.message ?? `Fehler ${res.status}`);
    error.details = payload.error?.details;
    throw error;
  }
  return payload;
}

function listParams() {
  const f = state.filters;
  const params = new URLSearchParams();
  if (f.q) params.set('q', f.q);
  if (f.status === 'active') params.set('status', state.meta.activeStatuses.join(','));
  else if (f.status !== 'all') params.set('status', f.status);
  for (const key of ['depot', 'type', 'priority', 'dueFrom', 'dueTo']) if (f[key]) params.set(key, f[key]);
  if (f.overdue) params.set('overdue', 'true');
  if (f.mine) params.set('assignee', 'me');
  params.set('sort', state.sort);
  params.set('order', state.order);
  params.set('page', String(state.page));
  params.set('pageSize', String(state.pageSize));
  return params;
}

// ---------------------------------------------------------------------------
// URL-Zustand: Filter, Sortierung und Seite sind teilbar
// ---------------------------------------------------------------------------

function readUrl() {
  const params = new URLSearchParams(location.search);
  for (const key of Object.keys(DEFAULT_FILTERS)) {
    if (!params.has(key)) continue;
    state.filters[key] = typeof DEFAULT_FILTERS[key] === 'boolean' ? params.get(key) === 'true' : params.get(key);
  }
  state.sort = params.get('sort') ?? state.sort;
  state.order = params.get('order') ?? state.order;
  state.page = Number(params.get('page') ?? 1) || 1;
  state.pageSize = Number(params.get('pageSize') ?? 50) || 50;
  state.selectedId = params.get('auftrag');
}

function writeUrl() {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state.filters)) {
    if (value !== DEFAULT_FILTERS[key]) params.set(key, String(value));
  }
  if (state.sort !== 'dueDate') params.set('sort', state.sort);
  if (state.order !== 'asc') params.set('order', state.order);
  if (state.page !== 1) params.set('page', String(state.page));
  if (state.pageSize !== 50) params.set('pageSize', String(state.pageSize));
  if (state.selectedId) params.set('auftrag', state.selectedId);
  const query = params.toString();
  history.replaceState(null, '', query ? `?${query}` : location.pathname);
}

// ---------------------------------------------------------------------------
// Laden und Rendern
// ---------------------------------------------------------------------------

async function init() {
  const [demoUsers, meta] = await Promise.all([fetch('/api/demo-users').then((r) => r.json()), api('/meta')]);
  state.meta = meta;
  if (!demoUsers.some((u) => u.id === state.userId)) state.userId = DEFAULT_USER;

  $('#user-select').innerHTML = demoUsers
    .map((u) => option(u.id, `${u.name} (${u.roleLabel}${u.depot ? `, ${u.depot}` : ''})`, u.id === state.userId))
    .join('');

  readUrl();
  bindEvents();
  await loadSession();
}

async function loadSession() {
  state.me = await api('/me');
  const depots = await api('/depots');
  const allDepots = depots.length > 1;

  const f = filtersForm.elements;
  f.status.innerHTML =
    option('active', 'Alle aktiven') +
    option('all', 'Alle Status') +
    Object.entries(state.meta.statuses).map(([k, v]) => option(k, v)).join('');
  f.depot.innerHTML = option('', 'Alle Werke') + depots.map((d) => option(d.code, d.name)).join('');
  f.depot.hidden = !allDepots;
  if (!allDepots) state.filters.depot = '';
  f.type.innerHTML = option('', 'Alle Typen') + Object.entries(state.meta.types).map(([k, v]) => option(k, v)).join('');
  f.priority.innerHTML =
    option('', 'Alle Prioritäten') + Object.entries(state.meta.priorities).map(([k, v]) => option(k, v)).join('');

  const isTechnician = state.me.role === 'technician';
  filtersForm.querySelector('[data-role="technician"]').hidden = !isTechnician;
  if (!isTechnician) state.filters.mine = false;
  $('#new-order').hidden = !state.me.permissions.includes('work_orders:create');

  syncForm();
  await Promise.all([loadOrders(), loadStats()]);
  if (state.selectedId) openDetail(state.selectedId);
}

function syncForm() {
  const f = filtersForm.elements;
  for (const [key, value] of Object.entries(state.filters)) {
    if (!f[key]) continue;
    if (f[key].type === 'checkbox') f[key].checked = value;
    else f[key].value = value;
  }
  $('#page-size').value = String(state.pageSize);
}

async function loadStats() {
  const stats = await api('/stats');
  $('#kpis').innerHTML = `
    <button class="kpi" data-kpi="active"><strong>${number.format(stats.active)}</strong> aktiv</button>
    <button class="kpi warn" data-kpi="overdue"><strong>${number.format(stats.overdue)}</strong> überfällig</button>
    <button class="kpi" data-kpi="waiting_parts"><strong>${number.format(stats.byStatus.waiting_parts)}</strong> warten auf Teile</button>`;
}

async function loadOrders() {
  writeUrl();
  const tbody = $('#orders tbody');
  tbody.classList.add('loading');
  try {
    const result = await api(`/work-orders?${listParams()}`);
    state.total = result.total;
    tbody.innerHTML = result.items.map(renderRow).join('');
    $('#empty').hidden = result.items.length > 0;
    renderPager(result);
    renderSortIndicators();
  } catch (error) {
    toast(error.message, true);
  } finally {
    tbody.classList.remove('loading');
  }
}

function renderRow(wo) {
  return `
    <tr data-id="${esc(wo.id)}" class="${wo.id === state.selectedId ? 'selected' : ''}" tabindex="0">
      <td class="mono">${esc(wo.id)}</td>
      <td class="mono">${esc(wo.vehicle.fleetNumber)}</td>
      <td class="title-cell">${esc(wo.title)}</td>
      <td>${esc(state.meta.types[wo.type])}</td>
      <td>${priorityChip(wo.priority)}</td>
      <td>${statusChip(wo.status)}</td>
      <td>${esc(wo.depot)}</td>
      <td>${esc(wo.assignee?.name ?? '–')}</td>
      <td class="${wo.overdue ? 'overdue' : ''}">${formatDate(wo.dueDate)}</td>
    </tr>`;
}

function renderPager({ page, pageSize, total }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  $('#range').textContent = `${number.format(from)}–${number.format(to)} von ${number.format(total)} Aufträgen`;
  $('#prev').disabled = page <= 1;
  $('#next').disabled = to >= total;
}

function renderSortIndicators() {
  for (const th of document.querySelectorAll('th[data-sort]')) {
    th.dataset.active = th.dataset.sort === state.sort ? state.order : '';
  }
}

// ---------------------------------------------------------------------------
// Detailansicht
// ---------------------------------------------------------------------------

async function openDetail(id) {
  state.selectedId = id;
  writeUrl();
  for (const row of document.querySelectorAll('#orders tbody tr')) row.classList.toggle('selected', row.dataset.id === id);
  try {
    const wo = await api(`/work-orders/${encodeURIComponent(id)}`);
    await renderDetail(wo);
    $('#drawer').hidden = false;
  } catch (error) {
    closeDetail();
    toast(error.message, true);
  }
}

function closeDetail() {
  state.selectedId = null;
  $('#drawer').hidden = true;
  for (const row of document.querySelectorAll('#orders tbody tr.selected')) row.classList.remove('selected');
  writeUrl();
}

async function renderDetail(wo) {
  $('#drawer-id').textContent = `${wo.id} · ${state.meta.types[wo.type]}`;
  $('#drawer-title').textContent = wo.title;

  const technicians = wo.canAssign ? await api(`/technicians?depot=${encodeURIComponent(wo.depot)}`) : [];
  const parts = wo.parts.length
    ? `<table class="parts">
        <thead><tr><th>Teil</th><th>Bezeichnung</th><th class="num">Menge</th><th class="num">Einzelpreis</th></tr></thead>
        <tbody>${wo.parts
          .map(
            (p) => `<tr><td class="mono">${esc(p.partNumber)}</td><td>${esc(p.description)}</td>
              <td class="num">${p.quantity}</td><td class="num">${currency.format(p.unitPriceEur)}</td></tr>`,
          )
          .join('')}</tbody>
        <tfoot><tr><td colspan="3">Summe Ersatzteile</td><td class="num">${currency.format(wo.partsTotalEur)}</td></tr></tfoot>
      </table>`
    : '<p class="muted">Keine Ersatzteile erfasst.</p>';

  $('#drawer-body').innerHTML = `
    <div class="chips">${statusChip(wo.status)} ${priorityChip(wo.priority)} ${wo.overdue ? '<span class="chip overdue-chip">Überfällig</span>' : ''}</div>
    <dl class="facts">
      <dt>Fahrzeug</dt><dd>${esc(wo.vehicle.fleetNumber)} <span class="muted">(${esc(wo.vehicle.series)})</span></dd>
      <dt>Werk</dt><dd>${esc(wo.depot)}</dd>
      <dt>Zuständig</dt><dd>${esc(wo.assignee?.name ?? 'nicht zugewiesen')}</dd>
      <dt>Fällig</dt><dd>${formatDate(wo.dueDate)}</dd>
      <dt>Geplanter Start</dt><dd>${formatDateTime(wo.plannedStart)}</dd>
      <dt>Erstellt</dt><dd>${formatDateTime(wo.createdAt)} von ${esc(wo.createdBy.name)}</dd>
      <dt>Abgeschlossen</dt><dd>${formatDateTime(wo.completedAt)}</dd>
      <dt>Arbeitszeit</dt><dd>${number.format(wo.laborHours)} h</dd>
    </dl>
    <h3>Beschreibung</h3>
    <p class="description">${esc(wo.description) || '<span class="muted">Keine Beschreibung.</span>'}</p>
    <h3>Ersatzteile</h3>
    ${parts}
    ${
      wo.allowedTransitions.length
        ? `<h3>Status ändern</h3>
           <input id="status-comment" placeholder="Kommentar (optional)" maxlength="500" />
           <div class="transitions">${wo.allowedTransitions
             .map((s) => `<button class="${s === 'cancelled' ? 'danger' : 'primary'}" data-transition="${s}">${esc(state.meta.statuses[s])}</button>`)
             .join('')}</div>`
        : ''
    }
    ${
      wo.canAssign
        ? `<h3>Zuweisen</h3>
           <select id="assignee-select">${option('', 'nicht zugewiesen')}${technicians
             .map((t) => option(t.id, t.name, t.id === wo.assignee?.id))
             .join('')}</select>`
        : ''
    }`;

  for (const button of document.querySelectorAll('[data-transition]')) {
    button.addEventListener('click', () => changeStatus(wo.id, button.dataset.transition));
  }
  $('#assignee-select')?.addEventListener('change', (event) => assign(wo.id, event.target.value || null));
}

async function changeStatus(id, status) {
  try {
    const comment = $('#status-comment')?.value.trim() || undefined;
    const wo = await api(`/work-orders/${encodeURIComponent(id)}/status`, { method: 'POST', body: { status, comment } });
    toast(`${wo.id}: ${state.meta.statuses[wo.status]}`);
    await Promise.all([renderDetail(wo), loadOrders(), loadStats()]);
  } catch (error) {
    toast(error.message, true);
  }
}

async function assign(id, assigneeId) {
  try {
    const wo = await api(`/work-orders/${encodeURIComponent(id)}/assign`, { method: 'POST', body: { assigneeId } });
    toast(`${wo.id} zugewiesen: ${wo.assignee?.name ?? 'niemand'}`);
    await Promise.all([renderDetail(wo), loadOrders()]);
  } catch (error) {
    toast(error.message, true);
  }
}

// ---------------------------------------------------------------------------
// Neuer Auftrag
// ---------------------------------------------------------------------------

async function openCreateDialog() {
  const form = $('#create-form');
  form.reset();
  $('#create-error').hidden = true;
  const [vehicles, technicians] = await Promise.all([api('/vehicles'), api('/technicians')]);
  const multiDepot = new Set(vehicles.map((v) => v.depot)).size > 1;
  form.elements.vehicleId.innerHTML = vehicles
    .map((v) => option(v.id, `${v.fleetNumber} · ${v.series}${multiDepot ? ` · ${v.depot}` : ''}`))
    .join('');
  form.elements.type.innerHTML = Object.entries(state.meta.types).map(([k, v]) => option(k, v)).join('');
  form.elements.priority.innerHTML = Object.entries(state.meta.priorities)
    .map(([k, v]) => option(k, v, k === 'normal'))
    .join('');
  form.elements.assigneeId.innerHTML =
    option('', 'später zuweisen') +
    technicians.map((t) => option(t.id, multiDepot ? `${t.name} (${t.depot})` : t.name)).join('');
  const inOneWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  form.elements.dueDate.value = inOneWeek.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
  $('#create-dialog').showModal();
}

async function submitCreate(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  try {
    const wo = await api('/work-orders', { method: 'POST', body: { ...data, assigneeId: data.assigneeId || null } });
    $('#create-dialog').close();
    toast(`${wo.id} angelegt`);
    await Promise.all([loadOrders(), loadStats()]);
    openDetail(wo.id);
  } catch (error) {
    const details = error.details?.map((d) => `${d.path}: ${d.message}`).join(', ');
    $('#create-error').textContent = details ? `${error.message} (${details})` : error.message;
    $('#create-error').hidden = false;
  }
}

// ---------------------------------------------------------------------------
// Ereignisse
// ---------------------------------------------------------------------------

function bindEvents() {
  let searchTimer;
  filtersForm.addEventListener('input', (event) => {
    const field = event.target;
    state.filters[field.name] = field.type === 'checkbox' ? field.checked : field.value;
    state.page = 1;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadOrders, field.type === 'search' ? 250 : 0);
  });
  filtersForm.addEventListener('submit', (event) => event.preventDefault());
  filtersForm.addEventListener('reset', (event) => {
    event.preventDefault();
    state.filters = { ...DEFAULT_FILTERS };
    state.page = 1;
    syncForm();
    loadOrders();
  });

  $('#kpis').addEventListener('click', (event) => {
    const kpi = event.target.closest('[data-kpi]')?.dataset.kpi;
    if (!kpi) return;
    state.filters = { ...DEFAULT_FILTERS, overdue: kpi === 'overdue', status: kpi === 'waiting_parts' ? kpi : 'active' };
    state.page = 1;
    syncForm();
    loadOrders();
  });

  $('#orders thead').addEventListener('click', (event) => {
    const sort = event.target.closest('th[data-sort]')?.dataset.sort;
    if (!sort) return;
    state.order = state.sort === sort && state.order === 'asc' ? 'desc' : 'asc';
    state.sort = sort;
    state.page = 1;
    loadOrders();
  });

  const tbody = $('#orders tbody');
  tbody.addEventListener('click', (event) => {
    const id = event.target.closest('tr[data-id]')?.dataset.id;
    if (id) openDetail(id);
  });
  tbody.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.dataset.id) openDetail(event.target.dataset.id);
  });

  $('#prev').addEventListener('click', () => {
    state.page -= 1;
    loadOrders();
  });
  $('#next').addEventListener('click', () => {
    state.page += 1;
    loadOrders();
  });
  $('#page-size').addEventListener('change', (event) => {
    state.pageSize = Number(event.target.value);
    state.page = 1;
    loadOrders();
  });

  $('#drawer-close').addEventListener('click', closeDetail);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('#drawer').hidden && !$('#create-dialog').open) closeDetail();
  });

  $('#user-select').addEventListener('change', async (event) => {
    state.userId = event.target.value;
    storeUser(state.userId);
    state.page = 1;
    closeDetail();
    await loadSession();
  });

  $('#new-order').addEventListener('click', openCreateDialog);
  $('#create-form').addEventListener('submit', submitCreate);
  $('#create-cancel').addEventListener('click', () => $('#create-dialog').close());
}

let toastTimer;
function toast(message, isError = false) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3500);
}

function readStoredUser() {
  try {
    return localStorage.getItem(USER_KEY) ?? DEFAULT_USER;
  } catch {
    return DEFAULT_USER;
  }
}

function storeUser(userId) {
  try {
    localStorage.setItem(USER_KEY, userId);
  } catch {
    // Ohne localStorage startet die Oberfläche einfach mit dem Standardnutzer
  }
}

init().catch((error) => toast(error.message, true));
