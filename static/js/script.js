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

// ===== Login-aware nav + upload modal (index.html) =====
(function () {
  const signInLink = document.getElementById('signInLink');
  const uploadBtn = document.getElementById('uploadBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const welcomeText = document.getElementById('welcomeText');
  const boardGrid = document.getElementById('boardGrid');

  if (!signInLink || !uploadBtn || !logoutBtn || !welcomeText || !boardGrid) return;

  const USER_KEY = 'notesCircleUser';
  const NOTES_KEY = 'notesCircleNotes';

  const uploadModal = document.getElementById('uploadModal');
  const noteTextInput = document.getElementById('noteText');
  const noteImageInput = document.getElementById('noteImage');
  const saveUploadBtn = document.getElementById('saveUploadBtn');
  const cancelUploadBtn = document.getElementById('cancelUploadBtn');

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

  function refreshNav() {
    const user = getCurrentUser();
    if (user) {
      signInLink.style.display = 'none';
      uploadBtn.style.display = 'inline-block';
      logoutBtn.style.display = 'inline-block';
      welcomeText.style.display = 'inline';
      welcomeText.textContent = 'Hi, ' + user.displayName;
    } else {
      signInLink.style.display = 'inline-block';
      uploadBtn.style.display = 'none';
      logoutBtn.style.display = 'none';
      welcomeText.style.display = 'none';
    }
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

  logoutBtn.addEventListener('click', function () {
    localStorage.removeItem(USER_KEY);
    refreshNav();
  });

  refreshNav();
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

    window.location.href = 'index.html';
  });
})();

// ===== Member form page (member-form.html) — backed by /api/members =====
(function () {
  const form = document.getElementById('memberForm');
  const tableBody = document.getElementById('membersTableBody');

  if (!form || !tableBody) return;

  const API_BASE = '/api/members';

  const submitBtn = document.getElementById('submitBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const formTitle = document.getElementById('formTitle');

  const firstNameInput = document.getElementById('firstName');
  const lastNameInput = document.getElementById('lastName');
  const addressInput = document.getElementById('address');
  const ageInput = document.getElementById('age');
  const genderInput = document.getElementById('gender');
  const phoneInput = document.getElementById('phone');
  const emailInput = document.getElementById('email');
  const descriptionInput = document.getElementById('description');

  let members = [];
  let editingId = null;

  // The API returns Supabase's exact column names (FirstName, LastName,
  // etc.). Convert each row to the camelCase shape the rest of this file
  // already expects.
  function normalizeMember(row) {
    return {
      id: row.id,
      firstName: row.FirstName,
      lastName: row.LastName,
      address: row.Address,
      age: row.Age,
      gender: row.Gender,
      phone: row.Phone,
      email: row.Email,
      description: row.Description,
      submittedAt: row.SubmittedAt
    };
  }

  function formatSubmittedAt(value) {
    if (!value) return '';
    const date = new Date(value);
    return isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  async function readJson(response) {
    try {
      return await response.json();
    } catch (e) {
      return null;
    }
  }

  async function fetchMembers() {
    try {
      const response = await fetch(API_BASE);
      const data = await readJson(response);
      if (!response.ok) {
        throw new Error((data && data.error) || 'Failed to load members.');
      }
      members = Array.isArray(data) ? data.map(normalizeMember) : [];
      renderTable();
    } catch (err) {
      tableBody.innerHTML =
        '<tr class="empty-row"><td colspan="10">Could not load members: ' + err.message + '</td></tr>';
    }
  }

  async function createMember(entryData) {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entryData)
    });
    const data = await readJson(response);
    if (!response.ok) {
      throw new Error((data && data.error) || 'Failed to add member.');
    }
  }

  async function updateMemberOnServer(id, entryData) {
    const response = await fetch(API_BASE + '/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entryData)
    });
    const data = await readJson(response);
    if (!response.ok) {
      throw new Error((data && data.error) || 'Failed to update member.');
    }
  }

  async function deleteMemberOnServer(id) {
    const response = await fetch(API_BASE + '/' + id, { method: 'DELETE' });
    const data = await readJson(response);
    if (!response.ok) {
      throw new Error((data && data.error) || 'Failed to delete member.');
    }
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const entryData = {
      firstName: firstNameInput.value.trim(),
      lastName: lastNameInput.value.trim(),
      address: addressInput.value.trim(),
      age: ageInput.value.trim(),
      gender: genderInput.value,
      phone: phoneInput.value.trim(),
      email: emailInput.value.trim(),
      description: descriptionInput.value.trim(),
      submittedAt: new Date().toISOString()
    };

    try {
      if (editingId !== null) {
        await updateMemberOnServer(editingId, entryData);
      } else {
        await createMember(entryData);
      }
      await fetchMembers();
      resetForm();
    } catch (err) {
      alert('Could not save member: ' + err.message);
    }
  });

  cancelEditBtn.addEventListener('click', resetForm);

  function renderTable() {
    tableBody.innerHTML = '';

    if (members.length === 0) {
      tableBody.innerHTML = '<tr class="empty-row"><td colspan="10">No members added yet.</td></tr>';
      return;
    }

    members.forEach(function (m) {
      const row = document.createElement('tr');
      row.innerHTML =
        '<td>' + m.firstName + '</td>' +
        '<td>' + m.lastName + '</td>' +
        '<td>' + m.address + '</td>' +
        '<td>' + m.age + '</td>' +
        '<td>' + m.gender + '</td>' +
        '<td>' + m.phone + '</td>' +
        '<td>' + m.email + '</td>' +
        '<td>' + m.description + '</td>' +
        '<td>' + formatSubmittedAt(m.submittedAt) + '</td>' +
        '<td>' +
          '<button type="button" class="action-btn edit-btn" data-id="' + m.id + '">Edit</button>' +
          '<button type="button" class="action-btn delete-btn" data-id="' + m.id + '">Delete</button>' +
        '</td>';
      tableBody.appendChild(row);
    });

    document.querySelectorAll('.edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        startEdit(parseInt(btn.dataset.id, 10));
      });
    });

    document.querySelectorAll('.delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        deleteMember(parseInt(btn.dataset.id, 10));
      });
    });
  }

  function startEdit(id) {
    const m = members.find(function (member) { return member.id === id; });
    if (!m) return;

    editingId = id;

    firstNameInput.value = m.firstName || '';
    lastNameInput.value = m.lastName || '';
    addressInput.value = m.address || '';
    ageInput.value = m.age || '';
    genderInput.value = m.gender || '';
    phoneInput.value = m.phone || '';
    emailInput.value = m.email || '';
    descriptionInput.value = m.description || '';

    submitBtn.textContent = 'Update Member';
    formTitle.textContent = 'Edit Member';
    cancelEditBtn.hidden = false;
  }

  async function deleteMember(id) {
    try {
      await deleteMemberOnServer(id);
      if (editingId === id) resetForm();
      await fetchMembers();
    } catch (err) {
      alert('Could not delete member: ' + err.message);
    }
  }

  function resetForm() {
    form.reset();
    editingId = null;
    submitBtn.textContent = 'Add Member';
    formTitle.textContent = 'Add a Member';
    cancelEditBtn.hidden = true;
  }

  fetchMembers();
})();
// ===== Notes page (notes.html) — loads all notes from /api/notes-history/all =====
(function () {
  const grid = document.getElementById('notesGrid');
  const countBadge = document.getElementById('noteCount');
  const refreshBtn = document.getElementById('refreshBtn');

  if (!grid || !countBadge || !refreshBtn) return;

  const signInLink  = document.getElementById('signInLink');
  const logoutBtn   = document.getElementById('logoutBtn');
  const welcomeText = document.getElementById('welcomeText');
  const USER_KEY      = 'notesCircleUser';
  const CHAT_USER_KEY = 'notesCircleChatUser';

  // The chat widget stores the token; use it to identify the logged-in chatter
  function getChatUser() {
    try { return JSON.parse(localStorage.getItem(CHAT_USER_KEY) || 'null'); } catch (e) { return null; }
  }

  function refreshNav() {
    try {
      var raw  = localStorage.getItem(USER_KEY);
      var user = raw ? JSON.parse(raw) : null;
      if (user) {
        if (signInLink)  signInLink.style.display  = 'none';
        if (logoutBtn)   logoutBtn.style.display   = 'inline-block';
        if (welcomeText) { welcomeText.style.display = 'inline'; welcomeText.textContent = 'Hi, ' + user.displayName; }
      } else {
        if (signInLink)  signInLink.style.display  = 'inline-block';
        if (logoutBtn)   logoutBtn.style.display   = 'none';
        if (welcomeText) welcomeText.style.display = 'none';
      }
    } catch (e) {}
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      localStorage.removeItem(USER_KEY);
      refreshNav();
    });
  }

  refreshNav();

  const COLORS = ['yellow', 'green'];
  var colorIdx = 0;
  function nextColor() {
    var c = COLORS[colorIdx % COLORS.length];
    colorIdx++;
    return c;
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString();
  }

  async function deleteNote(noteId, token, card) {
    if (!confirm('Delete this note?')) return;
    try {
      var res = await fetch('/api/notes-history/' + noteId, {
        method: 'DELETE',
        headers: { 'X-User-Token': token }
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not delete.');
      card.remove();
      var current = parseInt(countBadge.textContent, 10);
      if (!isNaN(current)) countBadge.textContent = current - 1;
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  function renderNotes(notes) {
    grid.innerHTML = '';
    var chatUser = getChatUser();

    if (!notes || notes.length === 0) {
      countBadge.textContent = '0';
      grid.innerHTML =
        '<div class="empty-state">' +
          '<span class="emoji">📭</span>' +
          'No notes yet. Open the chat widget on the home page and send your first note!' +
        '</div>';
      return;
    }

    countBadge.textContent = notes.length;
    colorIdx = 0;

    notes.forEach(function (n) {
      var card = document.createElement('div');
      var isMine = chatUser && chatUser.id && n.user_id === chatUser.id;
      card.classList.add('note-card', nextColor());
      if (isMine) card.classList.add('is-mine');

      var text = document.createElement('div');
      text.classList.add('note-text');
      text.textContent = n.notes || n.note || '';
      card.appendChild(text);

      var meta = document.createElement('div');
      meta.classList.add('note-meta');

      var author = document.createElement('span');
      author.classList.add('note-author');
      var firstName = n.first_name || '';
      var lastName  = n.last_name  || '';
      author.textContent = '— ' + ((firstName || lastName) ? (firstName + ' ' + lastName).trim() : 'Anonymous');
      meta.appendChild(author);

      var time = document.createElement('span');
      time.textContent = formatDate(n.created_at);
      meta.appendChild(time);

      card.appendChild(meta);

      // Delete button — only visible on own notes (CSS .is-mine controls display)
      if (isMine) {
        var delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.classList.add('delete-note-btn');
        delBtn.textContent = '🗑 Delete';
        delBtn.addEventListener('click', function () {
          deleteNote(n.id, chatUser.token, card);
        });
        card.appendChild(delBtn);
      }

      grid.appendChild(card);
    });
  }

  async function loadNotes() {
    grid.innerHTML = '<div class="loading-state">Loading notes…</div>';
    countBadge.textContent = '…';
    try {
      var res  = await fetch('/api/notes-history/all');
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load notes.');
      renderNotes(Array.isArray(data) ? data : []);
    } catch (err) {
      grid.innerHTML =
        '<div class="empty-state">' +
          '<span class="emoji">⚠️</span>' +
          'Could not load notes: ' + err.message +
        '</div>';
      countBadge.textContent = '!';
    }
  }

  refreshBtn.addEventListener('click', loadNotes);
  loadNotes();
})();