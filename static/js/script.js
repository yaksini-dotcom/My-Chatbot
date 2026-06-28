const CHAT_USER_KEY = 'notesCircleChatUser';

function getChatUser() {
  try { return JSON.parse(localStorage.getItem(CHAT_USER_KEY) || 'null'); } catch (e) { return null; }
}
function saveChatUser(u) { localStorage.setItem(CHAT_USER_KEY, JSON.stringify(u)); }
function clearChatUser() { localStorage.removeItem(CHAT_USER_KEY); }

async function readJson(res) {
  try { return await res.json(); } catch (e) { return null; }
}

// ── INDEX PAGE ─────────────────────────────────────────────
(function () {
  if (!document.getElementById('storeSection')) return;

  
  const welcomeText   = document.getElementById('welcomeText');
  const logoutBtn     = document.getElementById('logoutBtn');
  const openAuthBtn   = document.getElementById('openAuthBtn');
  const heroGetStarted = document.getElementById('heroGetStarted');

  
  const storeSignedInView  = document.getElementById('storeSignedInView');
  const storeSignedOutView = document.getElementById('storeSignedOutView');
  const promptSignInBtn    = document.getElementById('promptSignInBtn');
  const promptRegisterBtn  = document.getElementById('promptRegisterBtn');
  const storeNotesGrid  = document.getElementById('storeNotesGrid');
  const storeSearch     = document.getElementById('storeSearch');
  const storeSortSelect = document.getElementById('storeSortSelect');
  const addNoteBtn      = document.getElementById('addNoteBtn');
  const storePagination = document.getElementById('storePagination');
  const storePaginationSummary = document.getElementById('storePaginationSummary');

  // Sidebar user
  const sidebarUserInfo    = document.getElementById('sidebarUserInfo');
  const sidebarSignInPrompt = document.getElementById('sidebarSignInPrompt');
  const sidebarAvatar      = document.getElementById('sidebarAvatar');
  const sidebarUserName    = document.getElementById('sidebarUserName');
  const sidebarUserEmail   = document.getElementById('sidebarUserEmail');
  const sidebarSignInBtn   = document.getElementById('sidebarSignInBtn');

  // Auth modal
  const authModal       = document.getElementById('authModal');
  const tabLogin        = document.getElementById('tabLogin');
  const tabRegister     = document.getElementById('tabRegister');
  const loginPanel      = document.getElementById('loginPanel');
  const registerPanel   = document.getElementById('registerPanel');
  const loginEmail      = document.getElementById('loginEmail');
  const loginError      = document.getElementById('loginError');
  const loginSubmitBtn  = document.getElementById('loginSubmitBtn');
  const authCancelBtn   = document.getElementById('authCancelBtn');
  const authCancelBtn2  = document.getElementById('authCancelBtn2');
  const regFirstName    = document.getElementById('regFirstName');
  const regLastName     = document.getElementById('regLastName');
  const regEmail        = document.getElementById('regEmail');
  const registerError   = document.getElementById('registerError');
  const registerSubmitBtn = document.getElementById('registerSubmitBtn');

  // Note modal
  const noteModal       = document.getElementById('noteModal');
  const noteModalTitle  = document.getElementById('noteModalTitle');
  const noteModalText   = document.getElementById('noteModalText');
  const noteModalError  = document.getElementById('noteModalError');
  const noteModalSaveBtn = document.getElementById('noteModalSaveBtn');
  const noteModalCancelBtn = document.getElementById('noteModalCancelBtn');

  
  let allNotes    = [];
  let editingNoteId = null;
  const PER_PAGE  = 8;
  let currentPage = 1;

  const ACCENT_COLORS = ['#7C5CFC','#3B82F6','#10B981','#F59E0B','#EC4899','#14B8A6'];
  const AVATAR_COLORS = ['#7C5CFC','#3B82F6','#10B981','#F59E0B','#EC4899','#14B8A6'];

  function colorFor(palette, key) {
    const n = Math.abs(Number(key) || 0);
    return palette[n % palette.length];
  }

  // ---- Auth UI ----
  function refreshUI() {
    const user = getChatUser();
    if (user && user.id) {
      // Nav
      welcomeText.style.display = 'inline';
      welcomeText.textContent   = 'Hi, ' + user.firstName;
      logoutBtn.style.display   = 'inline-block';
      openAuthBtn.style.display = 'none';
      
      storeSignedInView.style.display  = 'block';
      storeSignedOutView.style.display = 'none';
      // Sidebar
      sidebarUserInfo.style.display    = 'block';
      sidebarSignInPrompt.style.display = 'none';
      const initials = ((user.firstName||'').charAt(0) + (user.lastName||'').charAt(0)).toUpperCase() || '?';
      sidebarAvatar.textContent  = initials;
      sidebarAvatar.style.background = colorFor(AVATAR_COLORS, user.id);
      sidebarUserName.textContent  = user.firstName + ' ' + user.lastName;
      sidebarUserEmail.textContent = user.email;
      loadStoreNotes();
    } else {
      welcomeText.style.display = 'none';
      logoutBtn.style.display   = 'none';
      openAuthBtn.style.display = 'inline-block';
      
      storeSignedInView.style.display  = 'none';
      storeSignedOutView.style.display = 'block';
      sidebarUserInfo.style.display    = 'none';
      sidebarSignInPrompt.style.display = 'block';
      allNotes = [];
    }
  }

  promptSignInBtn.addEventListener('click', () => openAuth('login'));
  promptRegisterBtn.addEventListener('click', () => openAuth('register'));

  logoutBtn.addEventListener('click', function () {
    clearChatUser();
    refreshUI();
  });

 
  function openAuth(tab) {
    authModal.classList.add('open');
    loginError.textContent    = '';
    registerError.textContent = '';
    loginEmail.value   = '';
    regFirstName.value = '';
    regLastName.value  = '';
    regEmail.value     = '';
    if (tab === 'register') {
      showRegister();
    } else {
      showLogin();
    }
  }

  function closeAuth() { authModal.classList.remove('open'); }

  function showLogin() {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginPanel.style.display    = 'block';
    registerPanel.style.display = 'none';
  }

  function showRegister() {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    registerPanel.style.display = 'block';
    loginPanel.style.display    = 'none';
  }

  openAuthBtn.addEventListener('click', () => openAuth('login'));
  heroGetStarted.addEventListener('click', () => openAuth('login'));
  sidebarSignInBtn.addEventListener('click', () => openAuth('login'));
  authCancelBtn.addEventListener('click', closeAuth);
  authCancelBtn2.addEventListener('click', closeAuth);
  authModal.addEventListener('click', function (e) { if (e.target === authModal) closeAuth(); });
  tabLogin.addEventListener('click', showLogin);
  tabRegister.addEventListener('click', showRegister);

  // ---- Login submit ----
  loginSubmitBtn.addEventListener('click', async function () {
    const email = loginEmail.value.trim();
    if (!email) { loginError.textContent = 'Please enter your email.'; return; }
    loginError.textContent = '';
    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = 'Signing in…';
    try {
      const res  = await fetch('/api/chat-users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        loginError.textContent = (data && data.error) || 'Sign in failed.';
        return;
      }
      saveChatUser(data);
      closeAuth();
      refreshUI();
    } catch (err) {
      loginError.textContent = 'Network error. Please try again.';
    } finally {
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.textContent = 'Sign In';
    }
  });

  loginEmail.addEventListener('keydown', function (e) { if (e.key === 'Enter') loginSubmitBtn.click(); });

  // ---- Register submit ----
  registerSubmitBtn.addEventListener('click', async function () {
    const fn    = regFirstName.value.trim();
    const ln    = regLastName.value.trim();
    const email = regEmail.value.trim();
    if (!fn || !ln || !email) { registerError.textContent = 'All fields are required.'; return; }
    registerError.textContent = '';
    registerSubmitBtn.disabled = true;
    registerSubmitBtn.textContent = 'Creating…';
    try {
      const res  = await fetch('/api/chat-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: fn, lastName: ln, email }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        registerError.textContent = (data && data.error) || 'Registration failed.';
        return;
      }
      saveChatUser(data);
      closeAuth();
      refreshUI();
    } catch (err) {
      registerError.textContent = 'Network error. Please try again.';
    } finally {
      registerSubmitBtn.disabled = false;
      registerSubmitBtn.textContent = 'Create Account';
    }
  });

  // ---- Search / sort ----
  storeSearch.addEventListener('input', function () { currentPage = 1; renderStorePage(); });
  storeSortSelect.addEventListener('change', function () { currentPage = 1; renderStorePage(); });

  
  async function loadStoreNotes() {
    const user = getChatUser();
    if (!user || !user.id) { allNotes = []; return; }

    storeNotesGrid.innerHTML = '<div class="loading-state">Loading notes…</div>';
    try {
      const res  = await fetch('/api/notes-history?userId=' + encodeURIComponent(user.id));
      const data = await readJson(res);
      if (!res.ok) throw new Error((data && data.error) || 'Could not load notes.');
      allNotes = Array.isArray(data) ? data : [];
      currentPage = 1;
      renderStorePage();
    } catch (err) {
      storeNotesGrid.innerHTML = '<div class="empty-state">Could not load notes: ' + err.message + '</div>';
    }
  }

  
  function getFiltered() {
    const query = storeSearch.value.trim().toLowerCase();
    const sort  = storeSortSelect.value;

    let list = allNotes.filter(function (n) {
      return !query || (n.notes || '').toLowerCase().includes(query);
    });

    list.sort(function (a, b) {
      const ta = new Date(a.created_at).getTime() || 0;
      const tb = new Date(b.created_at).getTime() || 0;
      return sort === 'oldest' ? ta - tb : tb - ta;
    });

    return list;
  }

  // ---- Render grid ----
  function renderStorePage() {
    const filtered   = getFiltered();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;

    storeNotesGrid.innerHTML = '';

    if (filtered.length === 0) {
      storeNotesGrid.innerHTML = '<div class="empty-state">' +
        (storeSearch.value.trim() ? 'No notes match your search.' : 'You haven\'t added any notes yet. Hit "+ New Note" to start.') +
        '</div>';
      storePagination.innerHTML = '';
      storePaginationSummary.textContent = '';
      return;
    }

    const startIdx = (currentPage - 1) * PER_PAGE;
    filtered.slice(startIdx, startIdx + PER_PAGE).forEach(function (note, i) {
      storeNotesGrid.appendChild(buildStoreCard(note, colorFor(ACCENT_COLORS, startIdx + i)));
    });

    renderStorePagination(totalPages, filtered.length, startIdx, Math.min(PER_PAGE, filtered.length - startIdx));
  }

  
  function buildStoreCard(note, accent) {
    const user    = getChatUser();
    const isOwner = user && String(user.id) === String(note.user_id);

    const card = document.createElement('div');
    card.className = 'note-card store-note-card';

    const bar = document.createElement('div');
    bar.className = 'note-card-top';
    bar.style.background = accent;
    card.appendChild(bar);

    const body = document.createElement('div');
    body.className = 'note-card-body';

    // Header row
    const header = document.createElement('div');
    header.className = 'note-card-header';

    const avatar = document.createElement('div');
    avatar.className = 'note-avatar';
    avatar.style.background = colorFor(AVATAR_COLORS, user ? user.id : 0);
    const initials = (((user && user.firstName || '').charAt(0)) + ((user && user.lastName || '').charAt(0))).toUpperCase() || '?';
    avatar.textContent = initials;
    header.appendChild(avatar);

    const meta = document.createElement('div');
    meta.className = 'note-card-meta';
    const authorEl = document.createElement('div');
    authorEl.className = 'note-author';
    authorEl.textContent = user ? ((user.firstName || '') + ' ' + (user.lastName || '')).trim() : 'You';
    const timeEl = document.createElement('div');
    timeEl.className = 'note-time';
    timeEl.textContent = timeAgo(note.created_at);
    meta.appendChild(authorEl);
    meta.appendChild(timeEl);
    header.appendChild(meta);

    // Owner menu (edit + delete)
    if (isOwner) {
      const menuWrap = document.createElement('div');
      menuWrap.className = 'note-card-menu';

      const menuBtn = document.createElement('button');
      menuBtn.type = 'button';
      menuBtn.className = 'note-menu-btn';
      menuBtn.textContent = '⋯';

      const dropdown = document.createElement('div');
      dropdown.className = 'note-menu-dropdown';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.textContent = '✏️ Edit';
      editBtn.style.color = '#333';
      editBtn.addEventListener('click', function () {
        dropdown.classList.remove('open');
        openNoteModal('edit', note);
      });
      dropdown.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = '🗑️ Delete';
      delBtn.addEventListener('click', function () {
        dropdown.classList.remove('open');
        deleteStoreNote(note.id);
      });
      dropdown.appendChild(delBtn);

      menuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('open');
        document.querySelectorAll('.note-menu-dropdown.open').forEach(el => el.classList.remove('open'));
        if (!isOpen) dropdown.classList.add('open');
      });

      menuWrap.appendChild(menuBtn);
      menuWrap.appendChild(dropdown);
      header.appendChild(menuWrap);
    }

    body.appendChild(header);

    const textEl = document.createElement('p');
    textEl.className = 'note-text';
    textEl.textContent = note.notes;
    body.appendChild(textEl);

    card.appendChild(body);
    return card;
  }

  
  function renderStorePagination(totalPages, totalItems, startIdx, pageCount) {
    storePagination.innerHTML = '';

    function btn(label, page, opts) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      if (opts && opts.active)   b.classList.add('active');
      if (opts && opts.disabled) b.disabled = true;
      b.addEventListener('click', function () { currentPage = page; renderStorePage(); });
      return b;
    }

    storePagination.appendChild(btn('‹', Math.max(1, currentPage - 1), { disabled: currentPage === 1 }));

    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 7 && p !== 1 && p !== totalPages && Math.abs(p - currentPage) > 1) {
        if (p === 2 || p === totalPages - 1) {
          const e = document.createElement('span');
          e.textContent = '…'; e.style.padding = '0 4px';
          storePagination.appendChild(e);
        }
        continue;
      }
      storePagination.appendChild(btn(String(p), p, { active: p === currentPage }));
    }

    storePagination.appendChild(btn('›', Math.min(totalPages, currentPage + 1), { disabled: currentPage === totalPages }));
    storePaginationSummary.textContent =
      'Showing ' + (startIdx + 1) + '–' + (startIdx + pageCount) + ' of ' + totalItems;
  }

  
  function openNoteModal(mode, note) {
    noteModalError.textContent = '';
    if (mode === 'edit') {
      editingNoteId = note.id;
      noteModalTitle.textContent = 'Edit Note';
      noteModalText.value = note.notes || '';
      noteModalSaveBtn.textContent = 'Save Changes';
    } else {
      editingNoteId = null;
      noteModalTitle.textContent = 'New Note';
      noteModalText.value = '';
      noteModalSaveBtn.textContent = 'Post Note';
    }
    noteModal.classList.add('open');
    setTimeout(() => noteModalText.focus(), 50);
  }

  function closeNoteModal() { noteModal.classList.remove('open'); }

  addNoteBtn.addEventListener('click', function () { openNoteModal('add'); });
  noteModalCancelBtn.addEventListener('click', closeNoteModal);
  noteModal.addEventListener('click', function (e) { if (e.target === noteModal) closeNoteModal(); });

  noteModalSaveBtn.addEventListener('click', async function () {
    const user = getChatUser();
    if (!user) return;
    const text = noteModalText.value.trim();
    if (!text) { noteModalError.textContent = 'Note cannot be empty.'; return; }
    noteModalError.textContent = '';
    noteModalSaveBtn.disabled = true;

    try {
      let res;
      if (editingNoteId) {
        res = await fetch('/api/notes-history/' + editingNoteId, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-User-Token': user.token },
          body: JSON.stringify({ note: text }),
        });
      } else {
        res = await fetch('/api/notes-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, note: text }),
        });
      }
      const data = await readJson(res);
      if (!res.ok) throw new Error((data && data.error) || 'Could not save note.');
      closeNoteModal();
      await loadStoreNotes();
    } catch (err) {
      noteModalError.textContent = err.message;
    } finally {
      noteModalSaveBtn.disabled = false;
    }
  });

  // ---- Delete note ----
  async function deleteStoreNote(noteId) {
    if (!window.confirm('Delete this note? This cannot be undone.')) return;
    const user = getChatUser();
    if (!user) return;
    try {
      const res  = await fetch('/api/notes-history/' + noteId, {
        method: 'DELETE',
        headers: { 'X-User-Token': user.token },
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error((data && data.error) || 'Could not delete note.');
      await loadStoreNotes();
    } catch (err) {
      alert('Could not delete: ' + err.message);
    }
  }

  
  document.addEventListener('click', function () {
    document.querySelectorAll('.note-menu-dropdown.open').forEach(el => el.classList.remove('open'));
  });

  
  function timeAgo(value) {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    const diff = Date.now() - date.getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return m + (m === 1 ? ' min ago' : ' mins ago');
    const h = Math.floor(m / 60);
    if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    const d = Math.floor(h / 24);
    if (d < 7) return d + (d === 1 ? ' day ago' : ' days ago');
    return date.toLocaleDateString();
  }

  
  (async function init() {
    const saved = getChatUser();
    if (saved && saved.token) {
      try {
        const res  = await fetch('/api/chat-users/validate?token=' + encodeURIComponent(saved.token));
        const data = await readJson(res);
        if (res.ok && data && data.valid) {
          saveChatUser(data);
        } else {
          clearChatUser();
        }
      } catch (e) {
        
      }
    }
    refreshUI();
  })();

})();



(function () {
  const chatIcon    = document.getElementById('chat-icon');
  const chatBox     = document.getElementById('chat-box');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput   = document.getElementById('chat-input');
  const sendButton  = document.getElementById('send-button');

  if (!chatIcon || !chatBox || !chatMessages || !chatInput || !sendButton) return;

  let hasOpened = false;

  function addMessage(text, sender) {
    const div = document.createElement('div');
    div.classList.add('message', sender === 'bot' ? 'bot-message' : 'user-message');
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  chatIcon.addEventListener('click', function () {
    if (chatBox.style.display === 'flex') { chatBox.style.display = 'none'; return; }
    chatBox.style.display = 'flex';
    if (hasOpened) return;
    hasOpened = true;
    const user = getChatUser();
    if (user && user.firstName) {
      addMessage('Welcome back, ' + user.firstName + '! Use the Notes Store above to add or manage your notes.', 'bot');
    } else {
      addMessage('Hi! Sign in or register using the Notes Store panel above to save your notes.', 'bot');
    }
  });

  sendButton.addEventListener('click', function () {
    const text = chatInput.value.trim();
    if (!text) return;
    addMessage(text, 'user');
    chatInput.value = '';
    addMessage('Use the Notes Store panel on the page to manage your notes!', 'bot');
  });

  chatInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') sendButton.click();
  });
})();



(function () {
  const notesGrid   = document.getElementById('notesGrid');
  if (!notesGrid) return;

  const noteCountEl          = document.getElementById('noteCount');
  const statTotalNotes       = document.getElementById('statTotalNotes');
  const statTotalUsers       = document.getElementById('statTotalUsers');
  const statNotesToday       = document.getElementById('statNotesToday');
  const searchInput          = document.getElementById('noteSearchInput');
  const userFilterSelect     = document.getElementById('userFilterSelect');
  const sortSelect           = document.getElementById('sortSelect');
  const refreshBtn           = document.getElementById('refreshBtn');
  const paginationEl         = document.getElementById('notesPagination');
  const paginationSummaryEl  = document.getElementById('notesPaginationSummary');

  const BOOKMARKS_KEY  = 'notesCircleBookmarks';
  const PER_PAGE       = 8;
  const AVATAR_COLORS  = ['#7C5CFC','#3B82F6','#10B981','#F59E0B','#EC4899','#14B8A6'];
  const CARD_ACCENTS   = ['#7C5CFC','#3B82F6','#10B981','#F59E0B','#EC4899','#14B8A6'];

  let allNotes  = [];
  let currentPage = 1;

  function colorFor(palette, key) {
    return palette[Math.abs(Number(key)||0) % palette.length];
  }

  function getBookmarks() {
    try { const r = localStorage.getItem(BOOKMARKS_KEY); const p = r ? JSON.parse(r) : []; return Array.isArray(p) ? p : []; } catch (e) { return []; }
  }

  function toggleBookmark(id) {
    const b = getBookmarks(); const i = b.indexOf(id);
    if (i === -1) b.push(id); else b.splice(i, 1);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(b));
    return b.indexOf(id) !== -1;
  }

  function nameFor(n)     { return (((n.first_name||'') + ' ' + (n.last_name||'')).trim()) || 'Someone'; }
  function initialsFor(n) { return (((n.first_name||'').charAt(0)) + ((n.last_name||'').charAt(0))).toUpperCase() || '?'; }

  function timeAgo(value) {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    const diff = Date.now() - date.getTime();
    const s = Math.floor(diff/1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s/60); if (m < 60) return m + (m===1?' min ago':' mins ago');
    const h = Math.floor(m/60); if (h < 24) return h + (h===1?' hour ago':' hours ago');
    const d = Math.floor(h/24); if (d < 7)  return d + (d===1?' day ago':' days ago');
    return date.toLocaleDateString();
  }

  function isToday(v) {
    if (!v) return false;
    const d = new Date(v); if (isNaN(d.getTime())) return false;
    const n = new Date();
    return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth() && d.getDate()===n.getDate();
  }

  function updateStats(notes) {
    statTotalNotes.textContent = notes.length;
    statTotalUsers.textContent = new Set(notes.map(n=>n.user_id).filter(Boolean)).size;
    statNotesToday.textContent = notes.filter(n=>isToday(n.created_at)).length;
  }

  function populateUserFilter(notes) {
    const seen = new Map();
    notes.forEach(n => { if (n.user_id && !seen.has(n.user_id)) seen.set(n.user_id, nameFor(n)); });
    const prev = userFilterSelect.value;
    userFilterSelect.innerHTML = '<option value="">All Users</option>';
    seen.forEach((name, uid) => {
      const o = document.createElement('option');
      o.value = String(uid); o.textContent = name;
      userFilterSelect.appendChild(o);
    });
    userFilterSelect.value = prev;
  }

  function getFilteredSorted() {
    const q  = searchInput.value.trim().toLowerCase();
    const uf = userFilterSelect.value;
    const so = sortSelect.value;
    let list = allNotes.filter(n =>
      (!q  || (n.notes||'').toLowerCase().includes(q)) &&
      (!uf || String(n.user_id) === uf)
    );
    list.sort((a,b) => {
      const ta = new Date(a.created_at).getTime()||0;
      const tb = new Date(b.created_at).getTime()||0;
      return so==='oldest' ? ta-tb : tb-ta;
    });
    return list;
  }

  function buildNoteCard(note, accent) {
    const chatUser = getChatUser();
    const isOwner  = chatUser && String(chatUser.id) === String(note.user_id);

    const card = document.createElement('div');
    card.className = 'note-card';

    const bar = document.createElement('div');
    bar.className = 'note-card-top';
    bar.style.background = accent;
    card.appendChild(bar);

    const body = document.createElement('div');
    body.className = 'note-card-body';

    const header = document.createElement('div');
    header.className = 'note-card-header';

    const avatar = document.createElement('div');
    avatar.className = 'note-avatar';
    avatar.style.background = colorFor(AVATAR_COLORS, note.user_id);
    avatar.textContent = initialsFor(note);
    header.appendChild(avatar);

    const meta = document.createElement('div');
    meta.className = 'note-card-meta';
    const authorEl = document.createElement('div');
    authorEl.className = 'note-author';
    authorEl.textContent = nameFor(note);
    const timeEl = document.createElement('div');
    timeEl.className = 'note-time';
    timeEl.textContent = timeAgo(note.created_at);
    meta.appendChild(authorEl);
    meta.appendChild(timeEl);
    header.appendChild(meta);

    if (isOwner) {
      const menuWrap = document.createElement('div');
      menuWrap.className = 'note-card-menu';
      const menuBtn = document.createElement('button');
      menuBtn.type = 'button'; menuBtn.className = 'note-menu-btn'; menuBtn.textContent = '⋯';
      const dropdown = document.createElement('div');
      dropdown.className = 'note-menu-dropdown';
      const delBtn = document.createElement('button');
      delBtn.type = 'button'; delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => deleteNote(note.id, chatUser.token));
      dropdown.appendChild(delBtn);
      menuBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        const open = dropdown.classList.contains('open');
        document.querySelectorAll('.note-menu-dropdown.open').forEach(el=>el.classList.remove('open'));
        if (!open) dropdown.classList.add('open');
      });
      menuWrap.appendChild(menuBtn);
      menuWrap.appendChild(dropdown);
      header.appendChild(menuWrap);
    }

    body.appendChild(header);

    const textEl = document.createElement('p');
    textEl.className = 'note-text';
    textEl.textContent = note.notes;
    body.appendChild(textEl);

    const actions = document.createElement('div');
    actions.className = 'note-card-actions';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button'; copyBtn.className = 'note-action-btn'; copyBtn.textContent = '⧉ Copy';
    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(note.notes).then(() => {
        copyBtn.textContent = '✓ Copied';
        setTimeout(() => { copyBtn.textContent = '⧉ Copy'; }, 1500);
      }).catch(() => { copyBtn.textContent = '⧉ Copy'; });
    });
    actions.appendChild(copyBtn);

    const bmarks = getBookmarks();
    const bmBtn  = document.createElement('button');
    bmBtn.type = 'button'; bmBtn.className = 'note-action-btn';
    if (bmarks.indexOf(note.id) !== -1) bmBtn.classList.add('bookmarked');
    bmBtn.textContent = '🔖 Save';
    bmBtn.addEventListener('click', function () {
      bmBtn.classList.toggle('bookmarked', toggleBookmark(note.id));
    });
    actions.appendChild(bmBtn);

    body.appendChild(actions);
    card.appendChild(body);
    return card;
  }

  function renderPage() {
    const filtered   = getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;

    noteCountEl.textContent = filtered.length + (filtered.length === 1 ? ' note' : ' notes');
    notesGrid.innerHTML = '';

    if (filtered.length === 0) {
      notesGrid.innerHTML = '<div class="empty-state">No notes found.</div>';
      paginationEl.innerHTML = '';
      paginationSummaryEl.textContent = '';
      return;
    }

    const startIdx = (currentPage - 1) * PER_PAGE;
    filtered.slice(startIdx, startIdx + PER_PAGE).forEach((note, i) => {
      notesGrid.appendChild(buildNoteCard(note, colorFor(CARD_ACCENTS, startIdx + i)));
    });

    paginationEl.innerHTML = '';

    function makeBtn(label, page, opts) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      if (opts && opts.active)   b.classList.add('active');
      if (opts && opts.disabled) b.disabled = true;
      b.addEventListener('click', () => { currentPage = page; renderPage(); });
      return b;
    }

    paginationEl.appendChild(makeBtn('‹', Math.max(1, currentPage-1), { disabled: currentPage===1 }));
    for (let p=1; p<=totalPages; p++) {
      if (totalPages>7 && p!==1 && p!==totalPages && Math.abs(p-currentPage)>1) {
        if (p===2 || p===totalPages-1) { const sp=document.createElement('span'); sp.textContent='…'; sp.style.padding='0 4px'; paginationEl.appendChild(sp); }
        continue;
      }
      paginationEl.appendChild(makeBtn(String(p), p, { active: p===currentPage }));
    }
    paginationEl.appendChild(makeBtn('›', Math.min(totalPages, currentPage+1), { disabled: currentPage===totalPages }));

    const end = startIdx + Math.min(PER_PAGE, filtered.length - startIdx);
    paginationSummaryEl.textContent = 'Showing ' + (startIdx+1) + '–' + end + ' of ' + filtered.length;
  }

  async function deleteNote(noteId, token) {
    if (!token || !window.confirm('Delete this note? This cannot be undone.')) return;
    try {
      const res  = await fetch('/api/notes-history/' + noteId, { method:'DELETE', headers:{'X-User-Token':token} });
      const data = await readJson(res);
      if (!res.ok) throw new Error((data&&data.error)||'Could not delete.');
      await loadNotes();
    } catch (err) { alert('Could not delete: ' + err.message); }
  }

  async function loadNotes() {
    notesGrid.innerHTML = '<div class="loading-state">Loading notes…</div>';
    try {
      const res  = await fetch('/api/notes-history/all');
      const data = await readJson(res);
      if (!res.ok) throw new Error((data&&data.error)||'Could not load.');
      allNotes = Array.isArray(data) ? data : [];
      updateStats(allNotes);
      populateUserFilter(allNotes);
      currentPage = 1;
      renderPage();
    } catch (err) {
      notesGrid.innerHTML = '<div class="empty-state">Could not load notes: ' + err.message + '</div>';
    }
  }

  searchInput.addEventListener('input',    () => { currentPage=1; renderPage(); });
  userFilterSelect.addEventListener('change', () => { currentPage=1; renderPage(); });
  sortSelect.addEventListener('change',    () => { currentPage=1; renderPage(); });
  refreshBtn.addEventListener('click',     loadNotes);

  document.addEventListener('click', () => {
    document.querySelectorAll('.note-menu-dropdown.open').forEach(el=>el.classList.remove('open'));
  });

  loadNotes();
})();