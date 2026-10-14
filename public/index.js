/* Campus Guardian frontend prototype. Detection integration will be added separately. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE = {
    incidents: 'cg-incidents-v2', cameras: 'cg-cameras-v2', theme: 'cg-theme-v2',
    sound: 'cg-sound-v2', autoclear: 'cg-autoclear-v2'
  };
  const defaults = [
    { name: 'Main Gate', source: 'Camera slot 1', connected: true },
    { name: 'Campus Premises', source: 'Camera slot 2', connected: true },
    { name: 'Gate 2', source: '', connected: false },
    { name: 'Parking Area', source: '', connected: false }
  ];
  const pageInfo = {
    dashboard: ['Dashboard', 'Four monitoring points in one view.'],
    cameras: ['Cameras', 'Manage camera names and source details.'],
    history: ['History', 'Review incidents and snapshots by camera.'],
    settings: ['Settings', 'Choose how the dashboard behaves during the demo.']
  };
  let cameras = loadJSON(STORAGE.cameras, defaults).map((camera, index) => ({ ...defaults[index], ...camera }));
  let incidents = loadJSON(STORAGE.incidents, []);
  let selectedHistoryCamera = 0;
  let selectedCamera = 0;
  let activeIncidentId = null;
  let toastTimer;
  let clearAlertTimer;
  let audioContext;
  let drawerMode = 'incident';

  function loadJSON(key, fallback) {
    try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
    catch (_) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { showToast('Browser storage is full. Remove older demo data or use smaller snapshots.'); return false; }
  }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
  function cameraName(index) { return cameras[index]?.name || `Screen ${index + 1}`; }
  function saveCameras() { save(STORAGE.cameras, cameras); }
  function saveIncidents() { save(STORAGE.incidents, incidents); updateHistoryCount(); }
  // Incident records and camera settings are stored locally, so a page refresh
  // does not erase the demo history. The active alert itself remains temporary.

  // Theme is a setting, and the selected mode survives refreshes.
  function applyTheme(theme) {
    const light = theme === 'light';
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    $('#theme-icon').textContent = light ? '☀' : '☾';
    $('#theme-label').textContent = light ? 'Use dark mode' : 'Use light mode';
    save(STORAGE.theme, light ? 'light' : 'dark');
  }
  applyTheme(loadJSON(STORAGE.theme, null) || localStorage.getItem(STORAGE.theme) || 'dark');
  $('#themeToggle').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));

  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }
  function navigate(page) {
    if (!pageInfo[page]) return;
    $$('.page-view').forEach(view => { view.hidden = view.id !== `page-${page}`; });
    $$('.nav-item[data-page]').forEach(button => button.classList.toggle('active', button.dataset.page === page));
    $('#page-title').textContent = pageInfo[page][0];
    $('#page-subtitle').textContent = pageInfo[page][1];
    closeSidebar();
    if (page === 'cameras') renderCameraManagement();
    if (page === 'history') renderHistoryPage();
  }
  $$('[data-page]').forEach(button => button.addEventListener('click', event => {
    event.preventDefault(); navigate(button.dataset.page);
  }));
  function openSidebar() {
    $('#sidebar').classList.add('open'); $('#sidebar').setAttribute('aria-hidden', 'false');
    $('#sidebar-backdrop').hidden = false;
  }
  function closeSidebar() {
    $('#sidebar').classList.remove('open'); $('#sidebar').setAttribute('aria-hidden', 'true');
    $('#sidebar-backdrop').hidden = true;
  }
  $('#open-sidebar').addEventListener('click', openSidebar);
  $('#close-sidebar').addEventListener('click', closeSidebar);
  $('#sidebar-backdrop').addEventListener('click', closeSidebar);

  function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    $('#clock').textContent = time;
    $$('.feed-time, #modal-feed-time').forEach(node => { node.textContent = time; });
  }
  updateClock(); setInterval(updateClock, 1000);

  function renderDashboard() {
    $('#dashboard-cameras').innerHTML = cameras.map((camera, index) => `
      <article class="panel camera-card ${camera.connected ? '' : 'not-connected'}" tabindex="0" role="button" aria-label="Open ${escapeHtml(camera.name)} full view" data-open-camera="${index}">
        <div class="camera-header"><div><h2><span class="camera-number">0${index + 1}</span>${escapeHtml(camera.name)}</h2><p>${camera.source ? escapeHtml(camera.source) : 'Source not configured'}</p></div>
          <span class="camera-status ${camera.connected ? 'connected' : ''}"><span class="status-dot ${camera.connected ? '' : 'amber'}"></span>${camera.connected ? 'READY FOR FEED' : 'NOT CONNECTED'}</span></div>
        <div class="video-frame" id="video-frame-${index}"><div class="feed-placeholder"><span class="camera-symbol">▣</span><strong>${camera.connected ? 'Live feed will appear here' : 'Camera not connected'}</strong><span>${camera.connected ? 'Waiting for camera integration.' : 'This slot is reserved for a future camera.'}</span></div><span class="feed-label">SCREEN 0${index + 1}</span><time class="feed-time">--:--:--</time><span class="open-feed-hint">Open full view ↗</span></div>
        <div class="camera-footer"><span><span class="status-dot ${camera.connected ? '' : 'amber'}"></span>${camera.connected ? 'Source saved' : 'Demo placeholder'}</span><span class="camera-last-event">${lastIncidentFor(index) ? `Last incident: ${escapeHtml(lastIncidentFor(index).time)}` : 'No incidents yet'}</span></div>
      </article>`).join('');
    $$('[data-open-camera]').forEach(tile => {
      tile.addEventListener('click', () => openCamera(Number(tile.dataset.openCamera)));
      tile.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openCamera(Number(tile.dataset.openCamera)); } });
    });
    updateClock();
  }
  function lastIncidentFor(index) { return incidents.find(item => Number(item.camera) === index); }

  function renderCameraManagement() {
    $('#camera-management').innerHTML = cameras.map((camera, index) => `
      <article class="panel camera-manage-row"><div class="manage-number">0${index + 1}</div><div class="manage-info"><h3>${escapeHtml(camera.name)}</h3><p>${camera.source ? escapeHtml(camera.source) : 'No source note added'}</p><span class="manage-status"><span class="status-dot ${camera.connected ? '' : 'amber'}"></span>${camera.connected ? 'Ready for integration' : 'Placeholder slot'}</span></div><button class="button secondary" data-edit-camera="${index}">Edit details</button></article>`).join('');
    $$('[data-edit-camera]').forEach(button => button.addEventListener('click', () => {
      const index = Number(button.dataset.editCamera); $('#camera-select').value = String(index);
      $('#camera-name-input').value = cameras[index].name; $('#camera-source-input').value = cameras[index].source || '';
      $('#camera-name-input').focus();
    }));
  }
  $('#camera-select').addEventListener('change', () => {
    const camera = cameras[Number($('#camera-select').value)];
    $('#camera-name-input').value = camera.name; $('#camera-source-input').value = camera.source || '';
  });
  $('#camera-form').addEventListener('submit', event => {
    event.preventDefault();
    const index = Number($('#camera-select').value);
    const name = $('#camera-name-input').value.trim();
    if (!name) { showToast('Enter a name for this camera.'); return; }
    cameras[index].name = name;
    cameras[index].source = $('#camera-source-input').value.trim();
    saveCameras(); renderCameraManagement(); renderDashboard(); renderHistoryPage();
    $('#camera-name-input').value = cameras[index].name;
    showToast(`Saved details for ${name}.`);
  });

  function openCamera(index) {
    selectedCamera = index;
    const camera = cameras[index];
    $('#modal-camera-name').textContent = camera.name;
    $('#modal-camera-status').textContent = camera.connected ? 'Ready for live feed integration' : 'Not connected · placeholder screen';
    $('#modal-feed-label').textContent = `SCREEN 0${index + 1}`;
    $('#modal-source-note').textContent = camera.source ? `Source: ${camera.source}` : 'Source not configured';
    const last = lastIncidentFor(index);
    $('#modal-last-detected').textContent = last ? `Last detected: ${last.time}` : 'Last detected: No incidents yet';
    const modalFeed = $('#modal-feed');
    modalFeed.querySelector('.feed-placeholder')?.remove();
    const placeholder = document.createElement('div');
    placeholder.className = 'feed-placeholder modal-placeholder';
    placeholder.innerHTML = `<span class="camera-symbol">▣</span><strong>${camera.connected ? 'Live feed will appear here' : 'Camera not connected'}</strong><span>${camera.connected ? 'Ready for the later camera integration.' : 'This slot is reserved for a future camera.'}</span>`;
    modalFeed.prepend(placeholder);
    $('#camera-modal').hidden = false;
    document.body.classList.add('modal-open');
  }
  function closeCameraModal() { $('#camera-modal').hidden = true; document.body.classList.remove('modal-open'); }
  $('#close-camera-modal').addEventListener('click', closeCameraModal);
  $('#modal-back-dashboard').addEventListener('click', closeCameraModal);
  $('#modal-history-btn').addEventListener('click', () => { closeCameraModal(); openHistoryDrawer(selectedCamera); });

  function renderHistoryPage() {
    $('#history-tabs').innerHTML = cameras.map((camera, index) => `<button class="history-tab ${selectedHistoryCamera === index ? 'active' : ''}" role="tab" aria-selected="${selectedHistoryCamera === index}" data-history-camera="${index}">Screen ${index + 1}<small>${escapeHtml(camera.name)}</small></button>`).join('');
    $$('[data-history-camera]').forEach(button => button.addEventListener('click', () => {
      selectedHistoryCamera = Number(button.dataset.historyCamera); renderHistoryPage();
    }));
    const cameraIncidents = incidents.filter(item => Number(item.camera) === selectedHistoryCamera);
    $('#history-camera-name').textContent = cameraName(selectedHistoryCamera);
    $('#history-camera-count').textContent = `${cameraIncidents.length} incident${cameraIncidents.length === 1 ? '' : 's'} saved`;
    $('#history-list').innerHTML = cameraIncidents.length ? cameraIncidents.map(item => `
      <article class="record-item"><div class="record-main"><strong>${escapeHtml(item.message)}</strong><small>${escapeHtml(item.time)} · ${escapeHtml(item.id)} · ${escapeHtml(item.people)} people</small><span class="record-status ${item.acknowledged ? 'reviewed' : ''}">${item.acknowledged ? 'Reviewed' : 'Needs review'}</span></div><div class="record-actions"><button class="button secondary" data-history-incident="${escapeHtml(item.id)}">View details</button><button class="text-button" data-snapshot-incident="${escapeHtml(item.id)}">View snapshot</button></div></article>`).join('') : '<div class="empty-state panel">No incidents saved for this camera yet.</div>';
    $$('[data-history-incident]').forEach(button => button.addEventListener('click', () => viewIncident(button.dataset.historyIncident)));
    $$('[data-snapshot-incident]', $('#history-list')).forEach(button => button.addEventListener('click', () => openSnapshot(button.dataset.snapshotIncident)));
    renderSnapshots(cameraIncidents);
    updateHistoryCount();
  }
  function renderSnapshots(cameraIncidents) {
    const withSnapshots = cameraIncidents.filter(item => item.snapshot);
    $('#history-snapshots').innerHTML = withSnapshots.length ? withSnapshots.map(item => `<article class="evidence-card"><button class="snapshot-thumb" data-snapshot-incident="${escapeHtml(item.id)}" aria-label="Open snapshot for ${escapeHtml(item.id)}"><img src="${escapeHtml(item.snapshot)}" alt="Snapshot for ${escapeHtml(item.id)}"></button><div class="evidence-meta"><strong>${escapeHtml(item.id)}</strong><small>${escapeHtml(item.time)}</small><button class="text-button" data-snapshot-incident="${escapeHtml(item.id)}">View snapshot ↗</button></div></article>`).join('') : '<div class="empty-state panel">No snapshots saved for this camera yet.</div>';
    $$('[data-snapshot-incident]').forEach(button => button.addEventListener('click', () => openSnapshot(button.dataset.snapshotIncident)));
  }
  $('#history-view-snapshots').addEventListener('click', () => {
    const section = $('#snapshot-section'); section.hidden = !section.hidden;
    $('#history-view-snapshots').textContent = section.hidden ? 'View snapshots' : 'Hide snapshots';
    if (!section.hidden) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  function updateHistoryCount() {
    const count = $('#history-count'); count.textContent = incidents.length; count.hidden = incidents.length === 0;
  }

  function openDrawer(mode = 'incident') {
    drawerMode = mode;
    $('#alert-drawer').classList.add('open'); $('#alert-drawer').setAttribute('aria-hidden', 'false');
    $('#drawer-backdrop').hidden = false;
  }
  function closeDrawer() {
    $('#alert-drawer').classList.remove('open'); $('#alert-drawer').setAttribute('aria-hidden', 'true'); $('#drawer-backdrop').hidden = true;
  }
  $('#close-drawer').addEventListener('click', closeDrawer);
  $('#drawer-backdrop').addEventListener('click', closeDrawer);
  function openHistoryDrawer(cameraIndex) {
    selectedHistoryCamera = cameraIndex;
    $('#drawer-kicker').textContent = 'CAMERA HISTORY';
    $('#drawer-title').textContent = cameraName(cameraIndex);
    $('#drawer-empty').hidden = true; $('#drawer-incident').hidden = true;
    let historyContent = $('#drawer-history');
    if (!historyContent) { historyContent = document.createElement('div'); historyContent.id = 'drawer-history'; historyContent.className = 'drawer-history'; $('#alert-drawer').appendChild(historyContent); }
    const items = incidents.filter(item => Number(item.camera) === cameraIndex);
    historyContent.hidden = false;
    historyContent.innerHTML = items.length ? items.map(item => `<article class="drawer-history-item"><strong>${escapeHtml(item.message)}</strong><small>${escapeHtml(item.time)} · ${escapeHtml(item.id)}</small><div><button class="text-button" data-drawer-view="${escapeHtml(item.id)}">Details</button><button class="text-button" data-drawer-snapshot="${escapeHtml(item.id)}">Snapshot</button></div></article>`).join('') : '<div class="empty-state">No incidents have been saved for this camera yet.</div>';
    $$('[data-drawer-view]', historyContent).forEach(button => button.addEventListener('click', () => viewIncident(button.dataset.drawerView)));
    $$('[data-drawer-snapshot]', historyContent).forEach(button => button.addEventListener('click', () => openSnapshot(button.dataset.drawerSnapshot)));
    openDrawer('history');
  }
  function beep() {
    if (!$('#sound-toggle').checked) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext; if (!AudioCtx) return;
      audioContext ||= new AudioCtx(); if (audioContext.state === 'suspended') audioContext.resume();
      const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + .02); gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + .24);
      oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + .25);
    } catch (_) { /* Browser may require a user interaction before sound is allowed. */ }
  }
  function demoSnapshot(cameraIndex, incidentId, time) {
    const safeName = escapeHtml(cameraName(cameraIndex));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="#1a2228"/><path d="M0 410 L960 410 M0 320 L960 320 M160 0 L160 540 M320 0 L320 540 M480 0 L480 540 M640 0 L640 540 M800 0 L800 540" stroke="#34454d" stroke-width="2"/><rect x="26" y="24" width="908" height="492" fill="none" stroke="#d94b55" stroke-width="3" stroke-dasharray="12 8"/><text x="48" y="66" fill="#f4f6f7" font-size="24" font-family="Arial">CAMPUS GUARDIAN · DEMO EVIDENCE</text><text x="48" y="104" fill="#e5b4b7" font-size="20" font-family="Arial">${safeName} · ${escapeHtml(time)}</text><circle cx="380" cy="245" r="40" fill="none" stroke="#e14b55" stroke-width="5"/><path d="M380 285 L380 385 M380 320 L325 355 M380 320 L435 355 M380 385 L345 445 M380 385 L420 445" stroke="#e14b55" stroke-width="12" stroke-linecap="round" fill="none"/><circle cx="570" cy="245" r="40" fill="none" stroke="#e4b86e" stroke-width="5"/><path d="M570 285 L570 385 M570 320 L525 355 M570 320 L620 350 M570 385 L540 445 M570 385 L605 445" stroke="#e4b86e" stroke-width="12" stroke-linecap="round" fill="none"/><text x="48" y="480" fill="#aab7be" font-size="18" font-family="Arial">Illustrative placeholder — not a real camera capture</text><text x="48" y="505" fill="#aab7be" font-size="15" font-family="Arial">${escapeHtml(incidentId)}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }
  function createIncident(data = {}) {
    const now = new Date();
    const camera = Math.max(0, Math.min(3, Number.isFinite(Number(data.camera)) ? Number(data.camera) : 0));
    const id = data.id || `CG-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Date.now()).slice(-5)}`;
    const time = data.timestamp || now.toLocaleString();
    const incident = { id, time, camera, cameraName: cameraName(camera), people: data.people ?? 'Not provided', message: data.message || 'Potential violent movement detected. Please review the incident.', severity: data.severity || 'NEEDS REVIEW', snapshot: data.snapshot || null, acknowledged: false };
    if (!incident.snapshot && data.demo === true) incident.snapshot = demoSnapshot(camera, id, time);
    incidents.unshift(incident); activeIncidentId = incident.id; saveIncidents();
    renderDashboard(); renderHistoryPage(); showIncidentInDrawer(incident); $('#drawer-kicker').textContent = 'INCIDENT NOTIFICATION'; $('#drawer-title').textContent = 'Alert details';
    $('#drawer-history')?.setAttribute('hidden', ''); $('#drawer-empty').hidden = true; $('#drawer-incident').hidden = false;
    openDrawer('incident'); beep();
    if ($('#autoclear-toggle').checked) {
      clearTimeout(clearAlertTimer);
      clearAlertTimer = setTimeout(() => {
        if (activeIncidentId === incident.id && drawerMode === 'incident') {
          $('#drawer-incident').hidden = true; $('#drawer-empty').hidden = false; activeIncidentId = null;
        }
      }, 5000);
    }
    return incident;
  }
  function showIncidentInDrawer(incident) {
    $('#drawer-empty').hidden = true; $('#drawer-incident').hidden = false;
    $('#drawer-message').textContent = incident.message;
    $('#drawer-severity').textContent = incident.acknowledged ? 'REVIEWED' : incident.severity;
    $('#drawer-camera-pill').textContent = cameraName(Number(incident.camera)).toUpperCase();
    $('#drawer-id').textContent = incident.id; $('#drawer-time').textContent = incident.time; $('#drawer-people').textContent = incident.people;
    const snapshot = $('#drawer-snapshot'); snapshot.replaceChildren();
    if (incident.snapshot) { const img = document.createElement('img'); img.src = incident.snapshot; img.alt = `Snapshot for ${incident.id}`; snapshot.appendChild(img); }
    else snapshot.textContent = 'No snapshot attached to this incident.';
    $('#view-snapshot-btn').hidden = !incident.snapshot;
    $('#acknowledge-btn').textContent = incident.acknowledged ? '✓ Marked as reviewed' : 'Mark as reviewed';
  }
  function viewIncident(id) {
    const incident = incidents.find(item => item.id === id); if (!incident) return;
    activeIncidentId = incident.id; $('#drawer-history')?.setAttribute('hidden', '');
    $('#drawer-kicker').textContent = 'INCIDENT NOTIFICATION'; $('#drawer-title').textContent = 'Alert details';
    showIncidentInDrawer(incident); openDrawer('incident');
  }
  $('#view-incident-btn').addEventListener('click', () => {
    const incident = incidents.find(item => item.id === activeIncidentId);
    if (!incident) { showToast('Choose an incident from History first.'); return; }
    closeDrawer(); navigate('history'); selectedHistoryCamera = Number(incident.camera); renderHistoryPage();
  });
  $('#acknowledge-btn').addEventListener('click', () => {
    const incident = incidents.find(item => item.id === activeIncidentId); if (!incident) return;
    incident.acknowledged = true; saveIncidents(); showIncidentInDrawer(incident); renderHistoryPage(); renderDashboard(); showToast('Incident marked as reviewed.');
  });
  $('#view-snapshot-btn').addEventListener('click', () => { if (activeIncidentId) openSnapshot(activeIncidentId); });
  function openSnapshot(id) {
    const incident = incidents.find(item => item.id === id); if (!incident) return;
    $('#snapshot-modal-title').textContent = `${cameraName(Number(incident.camera))} · ${incident.time}`;
    const content = $('#snapshot-modal-content'); content.replaceChildren();
    if (incident.snapshot) { const img = document.createElement('img'); img.src = incident.snapshot; img.alt = `Incident snapshot ${incident.id}`; content.appendChild(img); }
    else { const note = document.createElement('p'); note.textContent = 'No snapshot was saved for this incident.'; content.appendChild(note); }
    const meta = document.createElement('p'); meta.className = 'snapshot-caption'; meta.textContent = `${incident.id} · ${incident.message}`; content.appendChild(meta);
    $('#snapshot-modal').hidden = false;
  }
  $('#close-snapshot-modal').addEventListener('click', () => { $('#snapshot-modal').hidden = true; });
  $('#snapshot-modal').addEventListener('click', event => { if (event.target.id === 'snapshot-modal') $('#snapshot-modal').hidden = true; });

  $('#test-alert-btn').addEventListener('click', () => {
    const camera = Number($('#demo-camera-select').value || 0);
    createIncident({ camera, people: camera === 0 ? 2 : 3, message: 'Demo alert: suspicious movement requires review.', severity: 'DEMO ALERT', demo: true });
    showToast(`Demo alert added to ${cameraName(camera)} history.`);
  });
  $('#sound-toggle').checked = loadJSON(STORAGE.sound, false);
  $('#sound-toggle').addEventListener('change', event => save(STORAGE.sound, event.target.checked));
  $('#autoclear-toggle').checked = loadJSON(STORAGE.autoclear, true);
  $('#autoclear-toggle').addEventListener('change', event => save(STORAGE.autoclear, event.target.checked));
  $('#clear-demo-data').addEventListener('click', () => {
    if (!window.confirm('Clear all saved demo incidents and restore the default camera names?')) return;
    incidents = []; cameras = defaults.map(camera => ({ ...camera })); selectedHistoryCamera = 0; saveIncidents(); saveCameras();
    renderDashboard(); renderCameraManagement(); renderHistoryPage(); closeDrawer(); showToast('Saved demo data cleared.');
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closeSidebar(); closeDrawer(); closeCameraModal(); $('#snapshot-modal').hidden = true; }
  });

  // Integration hook for a future backend/API connection. It does not run detection itself.
  window.CampusGuardianUI = {
    receiveIncident(data) { return createIncident(data || {}); },
    setCameraStatus(index, connected, sourceLabel) {
      if (!cameras[index]) return;
      cameras[index].connected = Boolean(connected);
      if (sourceLabel !== undefined) cameras[index].source = String(sourceLabel);
      saveCameras(); renderDashboard(); renderCameraManagement();
    },
    setCameraFeed(index, imageUrl) {
      const frame = $(`#video-frame-${index}`); if (!frame) return;
      frame.querySelector('.feed-placeholder')?.remove();
      let image = frame.querySelector('img.camera-feed-image');
      if (!image) { image = document.createElement('img'); image.className = 'camera-feed-image'; image.alt = `Camera feed ${index + 1}`; frame.prepend(image); }
      image.src = imageUrl;
    },
    getIncidents() { return incidents.map(item => ({ ...item })); }
  };

  // Restore saved data into the visible UI on every refresh.
  renderDashboard(); renderCameraManagement(); renderHistoryPage(); updateHistoryCount();
  $('#camera-name-input').value = cameras[0].name; $('#camera-source-input').value = cameras[0].source || '';
})();
