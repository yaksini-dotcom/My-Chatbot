
/* ====================================================
   Notes Circle — shared script
   Used by: index.html, member-form.html
   Each section is self-contained and exits early if the
   page it belongs to isn't loaded, so one file can safely
   be shared across every page.
   ==================================================== */

// ===== Chat widget (index.html) — registers/recognizes the chatter via
// Supabase "Users", and saves anything they share as a note via
// Supabase "NotesHistory" =====
(function () {
  const chatIcon = document.getElementById('chat-icon');
  const chatBox = document.getElementById('chat-box');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-button');

  if (!chatIcon || !chatBox || !chatMessages || !chatInput || !sendButton) return;

  const CHAT_USER_KEY = 'notesCircleChatUser';

  let hasOpened = false;
  // step machine: 'idle' -> 'firstName' -> 'lastName' -> 'email' -> 'note'
  let step = 'idle';
  let pendingFirstName = '';
  let pendingLastName = '';
  let currentUser = null; // { id, firstName, lastName, email, token }

  function addMessage(text, sender) {
    const div = document.createElement('div');
    div.classList.add('message');
    div.classList.add(sender === 'bot' ? 'bot-message' : 'user-message');
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function getSavedChatUser() {
    try {
      const raw = localStorage.getItem(CHAT_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveChatUser(user) {
    currentUser = user;
    localStorage.setItem(CHAT_USER_KEY, JSON.stringify(user));
  }

  function clearChatUser() {
    currentUser = null;
    localStorage.removeItem(CHAT_USER_KEY);
  }

  function askForNote() {
    addMessage("What's your note? Type it and I'll save it for you.", 'bot');
    step = 'note';
  }

  async function readJson(response) {
    try {
      return await response.json();
    } catch (e) {
      return null;
    }
  }

  chatIcon.addEventListener('click', async function () {
    if (chatBox.style.display === 'flex') {
      chatBox.style.display = 'none';
      return;
    }

    chatBox.style.display = 'flex';
    if (hasOpened) return;
    hasOpened = true;

    const saved = getSavedChatUser();
    if (!saved || !saved.token) {
      addMessage("Welcome to Notes Circle! Let's get you added to the circle. What's your first name?", 'bot');
      step = 'firstName';
      return;
    }

    addMessage("Welcome to Notes Circle! One sec, checking who you are...", 'bot');
    try {
      const response = await fetch('/api/chat-users/validate?token=' + encodeURIComponent(saved.token));
      const data = await readJson(response);
      if (response.ok && data && data.valid) {
        saveChatUser(data);
        addMessage('Welcome back, ' + data.firstName + '!', 'bot');
        askForNote();
      } else {
        clearChatUser();
        addMessage("Looks like your session expired. What's your first name?", 'bot');
        step = 'firstName';
      }
    } catch (err) {
      clearChatUser();
      addMessage("Couldn't reach the server. What's your first name?", 'bot');
      step = 'firstName';
    }
  });

  sendButton.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') sendMessage();
  });

  async function sendMessage() {
    const text = chatInput.value.trim();
    if (text === '') return;

    addMessage(text, 'user');
    chatInput.value = '';

    if (step === 'firstName') {
      pendingFirstName = text;
      addMessage('Nice to meet you, ' + pendingFirstName + '. What\'s your last name?', 'bot');
      step = 'lastName';
      return;
    }

    if (step === 'lastName') {
      pendingLastName = text;
      addMessage('Thanks! And what\'s your email?', 'bot');
      step = 'email';
      return;
    }

    if (step === 'email') {
      const email = text;
      try {
        const response = await fetch('/api/chat-users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: pendingFirstName,
            lastName: pendingLastName,
            email: email
          })
        });
        const data = await readJson(response);
        if (!response.ok) {
          throw new Error((data && data.error) || 'Could not sign you in.');
        }
        saveChatUser(data);
        if (data.isNewUser) {
          addMessage('Thanks, ' + data.firstName + ' ' + data.lastName + ' — you\'re on the list.', 'bot');
        } else {
          addMessage('Welcome back, ' + data.firstName + '!', 'bot');
        }
        askForNote();
      } catch (err) {
        addMessage('Sorry, something went wrong (' + err.message + '). What\'s your email?', 'bot');
      }
      return;
    }

    if (step === 'note') {
      if (!currentUser || !currentUser.id) {
        addMessage("I lost track of who you are — let's start over. What's your first name?", 'bot');
        step = 'firstName';
        return;
      }
      try {
        const response = await fetch('/api/notes-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id, note: text })
        });
        const data = await readJson(response);
        if (!response.ok) {
          throw new Error((data && data.error) || 'Could not save your note.');
        }
        addMessage("Got it! Saved your note. Want to add another? Just type it.", 'bot');
      } catch (err) {
        addMessage('Sorry, could not save that note (' + err.message + '). Want to try again?', 'bot');
      }
      return;
    }

    addMessage('Thanks for the message!', 'bot');
  }
})();

// ===== Login-aware nav (any page with Sign In / Log Out links) =====
(function () {
  const signInLink = document.getElementById('signInLink');
  const logoutBtn = document.getElementById('logoutBtn');
  const welcomeText = document.getElementById('welcomeText');

  if (!signInLink || !logoutBtn || !welcomeText) return;

  const USER_KEY = 'notesCircleUser';

  function getCurrentUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function refreshNav() {
    const user = getCurrentUser();
    if (user) {
      signInLink.style.display = 'none';
      logoutBtn.style.display = 'inline-block';
      welcomeText.style.display = 'inline';
      welcomeText.textContent = 'Hi, ' + user.displayName;
    } else {
      signInLink.style.display = 'inline-block';
      logoutBtn.style.display = 'none';
      welcomeText.style.display = 'none';
    }
  }

  logoutBtn.addEventListener('click', function () {
    localStorage.removeItem(USER_KEY);
    refreshNav();
  });

  refreshNav();
})();

// ===== Upload modal (index.html only) =====
(function () {
  const uploadBtn = document.getElementById('uploadBtn');
  const boardGrid = document.getElementById('boardGrid');
  const uploadModal = document.getElementById('uploadModal');
  const noteTextInput = document.getElementById('noteText');
  const noteImageInput = document.getElementById('noteImage');
  const saveUploadBtn = document.getElementById('saveUploadBtn');
  const cancelUploadBtn = document.getElementById('cancelUploadBtn');

  if (!uploadBtn || !boardGrid || !uploadModal || !noteTextInput || !noteImageInput || !saveUploadBtn || !cancelUploadBtn) {
    return;
  }

  const USER_KEY = 'notesCircleUser';
  const NOTES_KEY = 'notesCircleNotes';

  function getCurrentUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function getSavedNotes() {
    try {
      const raw = localStorage.getItem(NOTES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveNotes(notes) {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }

  function refreshUploadVisibility() {
    uploadBtn.style.display = getCurrentUser() ? 'inline-block' : 'none';
  }

  function renderNoteCard(note) {
    const div = document.createElement('div');
    div.classList.add('note', note.color === 'green' ? 'note--green' : 'note--yellow');

    const textNode = document.createElement('div');
    textNode.textContent = note.text;
    div.appendChild(textNode);

    if (note.image) {
      const img = document.createElement('img');
      img.src = note.image;
      img.alt = 'Attached image';
      div.appendChild(img);
    }

    const author = document.createElement('span');
    author.classList.add('author');
    author.textContent = '— ' + note.author;
    div.appendChild(author);

    boardGrid.appendChild(div);
  }

  function loadSavedNotes() {
    getSavedNotes().forEach(renderNoteCard);
  }

  function openUploadModal() {
    noteTextInput.value = '';
    noteImageInput.value = '';
    uploadModal.classList.add('open');
  }

  function closeUploadModal() {
    uploadModal.classList.remove('open');
  }

  function handleSaveNote() {
    const user = getCurrentUser();
    if (!user) {
      closeUploadModal();
      return;
    }

    const text = noteTextInput.value.trim();
    if (text === '') {
      noteTextInput.focus();
      return;
    }

    const file = noteImageInput.files && noteImageInput.files[0];
    const author = user.displayName;
    const colors = ['yellow', 'green'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    function finishSave(imageDataUrl) {
      const note = { text: text, author: author, image: imageDataUrl || null, color: color };
      const notes = getSavedNotes();
      notes.push(note);
      saveNotes(notes);
      renderNoteCard(note);
      closeUploadModal();
    }

    if (file) {
      const reader = new FileReader();
      reader.onload = function () { finishSave(reader.result); };
      reader.readAsDataURL(file);
    } else {
      finishSave(null);
    }
  }

  uploadBtn.addEventListener('click', openUploadModal);
  cancelUploadBtn.addEventListener('click', closeUploadModal);
  saveUploadBtn.addEventListener('click', handleSaveNote);
  uploadModal.addEventListener('click', function (e) {
    if (e.target === uploadModal) closeUploadModal();
  });

  refreshUploadVisibility();
  loadSavedNotes();
})();

// ===== Login form (login.html) =====
(function () {
  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const errorText = document.getElementById('errorText');

  if (!form || !emailInput || !passwordInput || !errorText) return;

  const USER_KEY = 'notesCircleUser';

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      errorText.style.display = 'block';
      return;
    }

    errorText.style.display = 'none';

    const displayName = email.split('@')[0];
    const user = { displayName: displayName, email: email };
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    window.location.href = '/';
  });
})();

// ===== All Notes page (notes.html) =====
(function () {
  const notesGrid = document.getElementById('notesGrid');
  const noteCountEl = document.getElementById('noteCount');
  const statTotalNotes = document.getElementById('statTotalNotes');
  const statTotalUsers = document.getElementById('statTotalUsers');
  const statNotesToday = document.getElementById('statNotesToday');
  const searchInput = document.getElementById('noteSearchInput');
  const userFilterSelect = document.getElementById('userFilterSelect');
  const sortSelect = document.getElementById('sortSelect');
  const refreshBtn = document.getElementById('refreshBtn');
  const paginationEl = document.getElementById('notesPagination');
  const paginationSummaryEl = document.getElementById('notesPaginationSummary');

  if (!notesGrid) return;

  const CHAT_USER_KEY = 'notesCircleChatUser';
  const BOOKMARKS_KEY = 'notesCircleBookmarks';
  const PER_PAGE = 8;
  const AVATAR_COLORS = ['#7C5CFC', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#14B8A6'];
  const CARD_ACCENTS = ['#7C5CFC', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#14B8A6'];

  let allNotes = [];
  let currentPage = 1;
  let openMenuId = null;

  function getCurrentChatUser() {
    try {
      const raw = localStorage.getItem(CHAT_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function getBookmarks() {
    try {
      const raw = localStorage.getItem(BOOKMARKS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function toggleBookmark(noteId) {
    const bookmarks = getBookmarks();
    const idx = bookmarks.indexOf(noteId);
    if (idx === -1) {
      bookmarks.push(noteId);
    } else {
      bookmarks.splice(idx, 1);
    }
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    return bookmarks.indexOf(noteId) !== -1;
  }

  function colorFor(palette, key) {
    const n = Math.abs(Number(key) || 0);
    return palette[n % palette.length];
  }

  function initialsFor(note) {
    const a = (note.first_name || '').trim().charAt(0);
    const b = (note.last_name || '').trim().charAt(0);
    const initials = (a + b).toUpperCase();
    return initials || '?';
  }

  function nameFor(note) {
    const name = ((note.first_name || '') + ' ' + (note.last_name || '')).trim();
    return name || 'Someone';
  }

  function timeAgo(value) {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;

    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return diffMin + (diffMin === 1 ? ' minute ago' : ' minutes ago');
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return diffHour + (diffHour === 1 ? ' hour ago' : ' hours ago');
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return diffDay + (diffDay === 1 ? ' day ago' : ' days ago');
    return date.toLocaleDateString();
  }

  function isToday(value) {
    if (!value) return false;
    const date = new Date(value);
    if (isNaN(date.getTime())) return false;
    const now = new Date();
    return date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
  }

  async function readJson(response) {
    try {
      return await response.json();
    } catch (e) {
      return null;
    }
  }

  function populateUserFilter(notes) {
    const seen = new Map();
    notes.forEach(function (n) {
      if (n.user_id && !seen.has(n.user_id)) {
        seen.set(n.user_id, nameFor(n));
      }
    });

    const previousValue = userFilterSelect.value;
    userFilterSelect.innerHTML = '<option value="">All Users</option>';
    seen.forEach(function (name, userId) {
      const opt = document.createElement('option');
      opt.value = String(userId);
      opt.textContent = name;
      userFilterSelect.appendChild(opt);
    });
    userFilterSelect.value = previousValue;
  }

  function updateStats(notes) {
    statTotalNotes.textContent = String(notes.length);
    const distinctUsers = new Set(notes.map(function (n) { return n.user_id; }).filter(Boolean));
    statTotalUsers.textContent = String(distinctUsers.size);
    statNotesToday.textContent = String(notes.filter(function (n) { return isToday(n.created_at); }).length);
  }

  function getFilteredSortedNotes() {
    const query = searchInput.value.trim().toLowerCase();
    const userFilter = userFilterSelect.value;
    const sortOrder = sortSelect.value;

    let filtered = allNotes.filter(function (n) {
      const matchesQuery = !query || (n.notes || '').toLowerCase().includes(query);
      const matchesUser = !userFilter || String(n.user_id) === userFilter;
      return matchesQuery && matchesUser;
    });

    filtered.sort(function (a, b) {
      const aTime = new Date(a.created_at).getTime() || 0;
      const bTime = new Date(b.created_at).getTime() || 0;
      return sortOrder === 'oldest' ? aTime - bTime : bTime - aTime;
    });

    return filtered;
  }

  function buildNoteCard(note, accentColor) {
    const card = document.createElement('div');
    card.classList.add('note-card');

    const top = document.createElement('div');
    top.classList.add('note-card-top');
    top.style.background = accentColor;
    card.appendChild(top);

    const body = document.createElement('div');
    body.classList.add('note-card-body');

    const header = document.createElement('div');
    header.classList.add('note-card-header');

    const avatar = document.createElement('div');
    avatar.classList.add('note-avatar');
    avatar.style.background = colorFor(AVATAR_COLORS, note.user_id);
    avatar.textContent = initialsFor(note);
    header.appendChild(avatar);

    const meta = document.createElement('div');
    meta.classList.add('note-card-meta');

    const author = document.createElement('div');
    author.classList.add('note-author');
    author.textContent = nameFor(note);
    meta.appendChild(author);

    const time = document.createElement('div');
    time.classList.add('note-time');
    time.textContent = timeAgo(note.created_at);
    meta.appendChild(time);

    header.appendChild(meta);

    const currentChatUser = getCurrentChatUser();
    const isOwner = currentChatUser && String(currentChatUser.id) === String(note.user_id);

    if (isOwner) {
      const menuWrap = document.createElement('div');
      menuWrap.classList.add('note-card-menu');

      const menuBtn = document.createElement('button');
      menuBtn.classList.add('note-menu-btn');
      menuBtn.type = 'button';
      menuBtn.textContent = '⋯';

      const dropdown = document.createElement('div');
      dropdown.classList.add('note-menu-dropdown');

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', function () {
        deleteNote(note.id, currentChatUser.token);
      });
      dropdown.appendChild(deleteBtn);

      menuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('open');
        document.querySelectorAll('.note-menu-dropdown.open').forEach(function (el) {
          el.classList.remove('open');
        });
        if (!isOpen) dropdown.classList.add('open');
      });

      menuWrap.appendChild(menuBtn);
      menuWrap.appendChild(dropdown);
      header.appendChild(menuWrap);
    }

    body.appendChild(header);

    const text = document.createElement('p');
    text.classList.add('note-text');
    text.textContent = note.notes;
    body.appendChild(text);

    const actions = document.createElement('div');
    actions.classList.add('note-card-actions');

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.classList.add('note-action-btn');
    copyBtn.textContent = '⧉ Copy';
    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(note.notes).then(function () {
        copyBtn.textContent = '✓ Copied';
        setTimeout(function () { copyBtn.textContent = '⧉ Copy'; }, 1500);
      }).catch(function () {
        copyBtn.textContent = 'Could not copy';
        setTimeout(function () { copyBtn.textContent = '⧉ Copy'; }, 1500);
      });
    });
    actions.appendChild(copyBtn);

    const bookmarks = getBookmarks();
    const bookmarkBtn = document.createElement('button');
    bookmarkBtn.type = 'button';
    bookmarkBtn.classList.add('note-action-btn');
    if (bookmarks.indexOf(note.id) !== -1) bookmarkBtn.classList.add('bookmarked');
    bookmarkBtn.textContent = '🔖 Saved for me';
    bookmarkBtn.title = 'Bookmarks are saved only in this browser';
    bookmarkBtn.addEventListener('click', function () {
      const isBookmarked = toggleBookmark(note.id);
      bookmarkBtn.classList.toggle('bookmarked', isBookmarked);
    });
    actions.appendChild(bookmarkBtn);

    body.appendChild(actions);
    card.appendChild(body);
    return card;
  }

  function renderPage() {
    const filtered = getFilteredSortedNotes();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;

    noteCountEl.textContent = filtered.length + (filtered.length === 1 ? ' note' : ' notes');

    notesGrid.innerHTML = '';

    if (filtered.length === 0) {
      notesGrid.innerHTML = '<div class="empty-state">No notes match what you are looking for.</div>';
      paginationEl.innerHTML = '';
      paginationSummaryEl.textContent = '';
      return;
    }

    const startIdx = (currentPage - 1) * PER_PAGE;
    const pageItems = filtered.slice(startIdx, startIdx + PER_PAGE);

    pageItems.forEach(function (note, i) {
      const accent = colorFor(CARD_ACCENTS, startIdx + i);
      notesGrid.appendChild(buildNoteCard(note, accent));
    });

    renderPagination(totalPages, filtered.length, startIdx, pageItems.length);
  }

  function renderPagination(totalPages, totalItems, startIdx, pageItemCount) {
    paginationEl.innerHTML = '';

    function makeBtn(label, page, opts) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      if (opts && opts.active) btn.classList.add('active');
      if (opts && opts.disabled) btn.disabled = true;
      btn.addEventListener('click', function () {
        currentPage = page;
        renderPage();
      });
      return btn;
    }

    paginationEl.appendChild(makeBtn('‹', Math.max(1, currentPage - 1), { disabled: currentPage === 1 }));

    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 7 && p !== 1 && p !== totalPages && Math.abs(p - currentPage) > 1) {
        if (p === 2 || p === totalPages - 1) {
          const ellipsis = document.createElement('span');
          ellipsis.textContent = '…';
          ellipsis.style.padding = '0 4px';
          paginationEl.appendChild(ellipsis);
        }
        continue;
      }
      paginationEl.appendChild(makeBtn(String(p), p, { active: p === currentPage }));
    }

    paginationEl.appendChild(makeBtn('›', Math.min(totalPages, currentPage + 1), { disabled: currentPage === totalPages }));

    paginationSummaryEl.textContent =
      'Showing ' + (startIdx + 1) + ' to ' + (startIdx + pageItemCount) + ' of ' + totalItems + ' notes';
  }

  async function deleteNote(noteId, token) {
    if (!token) return;
    if (!window.confirm('Delete this note? This cannot be undone.')) return;
    try {
      const response = await fetch('/api/notes-history/' + noteId, {
        method: 'DELETE',
        headers: { 'X-User-Token': token }
      });
      const data = await readJson(response);
      if (!response.ok) {
        throw new Error((data && data.error) || 'Could not delete that note.');
      }
      await loadNotes();
    } catch (err) {
      window.alert('Could not delete note: ' + err.message);
    }
  }

  async function loadNotes() {
    notesGrid.innerHTML = '<div class="loading-state">Loading notes…</div>';
    try {
      const response = await fetch('/api/notes-history/all');
      const data = await readJson(response);
      if (!response.ok) {
        throw new Error((data && data.error) || 'Could not load notes.');
      }
      allNotes = Array.isArray(data) ? data : [];
      updateStats(allNotes);
      populateUserFilter(allNotes);
      currentPage = 1;
      renderPage();
    } catch (err) {
      notesGrid.innerHTML = '<div class="empty-state">Could not load notes: ' + err.message + '</div>';
    }
  }

  searchInput.addEventListener('input', function () { currentPage = 1; renderPage(); });
  userFilterSelect.addEventListener('change', function () { currentPage = 1; renderPage(); });
  sortSelect.addEventListener('change', function () { currentPage = 1; renderPage(); });
  refreshBtn.addEventListener('click', loadNotes);

  document.addEventListener('click', function () {
    document.querySelectorAll('.note-menu-dropdown.open').forEach(function (el) {
      el.classList.remove('open');
    });
  });

  loadNotes();
})();