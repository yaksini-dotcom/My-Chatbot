
(function () {
  const chatIcon = document.getElementById('chat-icon');
  const chatBox = document.getElementById('chat-box');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-button');

  if (!chatIcon || !chatBox || !chatMessages || !chatInput || !sendButton) return;

  let hasGreeted = false;
  let step = 0;
  let firstName = "";
  let lastName = "";

  function addMessage(text, sender) {
    const div = document.createElement('div');
    div.classList.add('message');
    div.classList.add(sender === 'bot' ? 'bot-message' : 'user-message');
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  chatIcon.addEventListener('click', function () {
    if (chatBox.style.display === 'flex') {
      chatBox.style.display = 'none';
    } else {
      chatBox.style.display = 'flex';
      if (!hasGreeted) {
        hasGreeted = true;
        addMessage("Welcome to Notes Circle! Send me a message to get started.", 'bot');
      }
    }
  });

  sendButton.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') sendMessage();
  });

  function sendMessage() {
    const text = chatInput.value.trim();
    if (text === "") return;

    addMessage(text, 'user');
    chatInput.value = "";

    if (step === 0) {
      addMessage("Let's get you added to the circle. What's your first name?", 'bot');
      step = 1;
    } else if (step === 1) {
      firstName = text;
      addMessage("Nice to meet you, " + firstName + ". What's your last name?", 'bot');
      step = 2;
    } else if (step === 2) {
      lastName = text;
      addMessage("Thanks, " + firstName + " " + lastName + " — you're on the list.", 'bot');
      step = 3;
    } else {
      addMessage("Thanks for the message!", 'bot');
    }
  }
})();


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

(function () {
  const form = document.getElementById('memberForm');
  const tableBody = document.getElementById('membersTableBody');

  if (!form || !tableBody) return;

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

  let editingId = null;

  

  function apiFetch(path, options) {
    return fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options))
      .then(function (res) {
        if (!res.ok) return res.json().then(function (e) { throw e; });
        
        return res.status === 204 ? [] : res.json();
      });
  }

  function fetchMembers() {
    return apiFetch('/api/members');
  }

  function createMember(data) {
    return apiFetch('/api/members', { method: 'POST', body: JSON.stringify(data) });
  }

  function updateMember(id, data) {
    return apiFetch('/api/members/' + id, { method: 'PATCH', body: JSON.stringify(data) });
  }

  function deleteMemberApi(id) {
    return apiFetch('/api/members/' + id, { method: 'DELETE' });
  }

  

  function normalise(row) {
    return {
      id:          row.id,
      firstName:   row.FirstName   || row.firstName   || '',
      lastName:    row.LastName    || row.lastName    || '',
      address:     row.Address     || row.address     || '',
      age:         row.Age         || row.age         || '',
      gender:      row.Gender      || row.gender      || '',
      phone:       row.Phone       || row.phone       || '',
      email:       row.Email       || row.email       || '',
      description: row.Description || row.description || '',
      submittedAt: row.SubmittedAt || row.submittedAt || '',
    };
  }

  

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const entryData = {
      firstName:   firstNameInput.value.trim(),
      lastName:    lastNameInput.value.trim(),
      address:     addressInput.value.trim(),
      age:         ageInput.value.trim(),
      gender:      genderInput.value,
      phone:       phoneInput.value.trim(),
      email:       emailInput.value.trim(),
      description: descriptionInput.value.trim(),
      submittedAt: new Date().toLocaleString(),
    };

    setFormBusy(true);

    var apiCall = editingId !== null
      ? updateMember(editingId, entryData)
      : createMember(entryData);

    apiCall
      .then(function () {
        resetForm();
        return loadAndRender();
      })
      .catch(function (err) {
        console.error('Save failed:', err);
        alert('Could not save member. Check the console for details.');
      })
      .finally(function () {
        setFormBusy(false);
      });
  });

  cancelEditBtn.addEventListener('click', resetForm);

  

  function loadAndRender() {
    return fetchMembers()
      .then(function (rows) {
        renderTable(Array.isArray(rows) ? rows.map(normalise) : []);
      })
      .catch(function (err) {
        console.error('Load failed:', err);
        tableBody.innerHTML = '<tr class="empty-row"><td colspan="10">Failed to load members.</td></tr>';
      });
  }

  function renderTable(members) {
    tableBody.innerHTML = '';

    if (members.length === 0) {
      tableBody.innerHTML = '<tr class="empty-row"><td colspan="10">No members added yet.</td></tr>';
      return;
    }

    members.forEach(function (m) {
      const row = document.createElement('tr');
      row.innerHTML =
        '<td>' + esc(m.firstName)   + '</td>' +
        '<td>' + esc(m.lastName)    + '</td>' +
        '<td>' + esc(m.address)     + '</td>' +
        '<td>' + esc(m.age)         + '</td>' +
        '<td>' + esc(m.gender)      + '</td>' +
        '<td>' + esc(m.phone)       + '</td>' +
        '<td>' + esc(m.email)       + '</td>' +
        '<td>' + esc(m.description) + '</td>' +
        '<td>' + esc(m.submittedAt) + '</td>' +
        '<td>' +
          '<button type="button" class="action-btn edit-btn"   data-id="' + m.id + '">Edit</button>' +
          '<button type="button" class="action-btn delete-btn" data-id="' + m.id + '">Delete</button>' +
        '</td>';
      tableBody.appendChild(row);
    });

    tableBody.querySelectorAll('.edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { startEdit(parseInt(btn.dataset.id, 10)); });
    });

    tableBody.querySelectorAll('.delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { deleteMember(parseInt(btn.dataset.id, 10)); });
    });
  }

  

  function startEdit(id) {
    fetchMembers()
      .then(function (rows) {
        const raw = rows.find(function (r) { return r.id === id; });
        if (!raw) return;
        const m = normalise(raw);

        editingId = id;
        firstNameInput.value   = m.firstName;
        lastNameInput.value    = m.lastName;
        addressInput.value     = m.address;
        ageInput.value         = m.age;
        genderInput.value      = m.gender;
        phoneInput.value       = m.phone;
        emailInput.value       = m.email;
        descriptionInput.value = m.description;

        submitBtn.textContent    = 'Update Member';
        formTitle.textContent    = 'Edit Member';
        cancelEditBtn.hidden     = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(function (err) { console.error('Edit fetch failed:', err); });
  }

  function deleteMember(id) {
    if (!confirm('Delete this member?')) return;
    deleteMemberApi(id)
      .then(function () {
        if (editingId === id) resetForm();
        return loadAndRender();
      })
      .catch(function (err) {
        console.error('Delete failed:', err);
        alert('Could not delete member. Check the console for details.');
      });
  }

  

  function resetForm() {
    form.reset();
    editingId = null;
    submitBtn.textContent = 'Add Member';
    formTitle.textContent = 'Add a Member';
    cancelEditBtn.hidden  = true;
  }

  function setFormBusy(busy) {
    submitBtn.disabled = busy;
    submitBtn.textContent = busy
      ? (editingId !== null ? 'Saving…' : 'Adding…')
      : (editingId !== null ? 'Update Member' : 'Add Member');
  }

  
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Initial load
  loadAndRender();
})();