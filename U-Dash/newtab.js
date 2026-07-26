chrome.storage.local.get(['enable_newtab'], (result) => {
    if (result.enable_newtab === false) {
        chrome.runtime.sendMessage({ action: "open_default_newtab" });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // --- CLOCK & SEARCH ---
    const clockEl = document.getElementById('clock');
    setInterval(() => {
        clockEl.textContent = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    }, 1000);

    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (!query) return;
            if (query.match(/^(http:\/\/|https:\/\/|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i)) {
                window.location.href = query.startsWith('http') ? query : 'http://' + query;
            } else {
                window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            }
        }
    });

    // --- STATE MANAGEMENT ---
    let db = { pages: [], folders: [], links: [], widgets: [] };
    let activePageId = null;

    // --- MIGRATION & INIT ---
    chrome.storage.local.get(['udash_pages', 'udash_folders', 'udash_links', 'udash_widgets'], (result) => {
        let needsSave = false;

        if (result.udash_links && result.udash_links.length > 0 && (!result.udash_pages || result.udash_pages.length === 0)) {
            const defaultPageId = generateId('p');
            const defaultFolderId = generateId('f');

            db.pages = [{ id: defaultPageId, name: "Main" }];
            db.folders = [{ id: defaultFolderId, pageId: defaultPageId, name: "Bookmarks" }];
            db.links = result.udash_links.map(l => ({ id: generateId('l'), folderId: defaultFolderId, title: l.title || l.name, url: l.url }));
            db.widgets = [];
            needsSave = true;
        } else {
            db.pages = result.udash_pages || [{ id: generateId('p'), name: "Home" }];
            db.folders = result.udash_folders || [];
            db.links = result.udash_links || [];
            db.widgets = result.udash_widgets || [];
        }

        if (needsSave) saveData();
        activePageId = db.pages.length > 0 ? db.pages[0].id : null;
        renderUI();
    });

    function generateId(prefix) { return prefix + '_' + Math.random().toString(36).substr(2, 9); }

    function saveData(callback) {
        chrome.storage.local.set({ udash_pages: db.pages, udash_folders: db.folders, udash_links: db.links, udash_widgets: db.widgets }, callback);
    }

    // --- RENDER UI ---
    function renderUI() {
        renderTabs();
        renderWorkspace();
    }

    function renderTabs() {
        const tabsContainer = document.getElementById('tabs-container');
        tabsContainer.innerHTML = '';

        db.pages.forEach(page => {
            const tab = document.createElement('div');
            tab.className = `page-tab ${page.id === activePageId ? 'active' : ''}`;

            const titleSpan = document.createElement('span');
            titleSpan.textContent = page.name;
            titleSpan.onclick = () => { activePageId = page.id; renderWorkspace(); renderTabs(); };

            const editBtn = document.createElement('span');
            editBtn.className = 'tab-edit';
            editBtn.textContent = '✏️';
            editBtn.title = 'Edit Page';
            editBtn.onclick = (e) => { e.stopPropagation(); openModal('editPage', page.id); };

            tab.appendChild(titleSpan);
            tab.appendChild(editBtn);
            tabsContainer.appendChild(tab);
        });
    }

    function renderWorkspace() {
        const wrapper = document.getElementById('folders-wrapper');
        wrapper.innerHTML = '';

        if (!activePageId) return;

        // 1. Render Link Folders
        const pageFolders = db.folders.filter(f => f.pageId === activePageId);
        pageFolders.forEach(folder => {
            const block = document.createElement('div');
            block.className = 'folder-block';

            const header = document.createElement('div');
            header.className = 'folder-header';
            header.innerHTML = `
                <div class="folder-title">📁 ${folder.name}</div>
                <div class="folder-actions">
                    <button title="Add Link" onclick="window.dispatchModal('addLink', '${folder.id}')">➕ Add Link</button>
                    <button title="Edit Folder" onclick="window.dispatchModal('editFolder', '${folder.id}')">✏️</button>
                    <button class="delete-folder" title="Delete Folder" onclick="window.dispatchDelete('folder', '${folder.id}')">&times;</button>
                </div>
            `;
            block.appendChild(header);

            const grid = document.createElement('div');
            grid.className = 'grid';

            const folderLinks = db.links.filter(l => l.folderId === folder.id);
            folderLinks.forEach(link => {
                const card = document.createElement('a');
                card.href = link.url;
                card.className = 'link-card';
                card.target = '_blank';

                const initial = link.title ? link.title.charAt(0).toUpperCase() : 'L';
                card.innerHTML = `
                    <div class="link-controls">
                        <div class="link-ctrl-btn" onclick="event.preventDefault(); window.dispatchModal('editLink', '${link.id}')">✏️</div>
                        <div class="link-ctrl-btn del" onclick="event.preventDefault(); window.dispatchDelete('link', '${link.id}')">&times;</div>
                    </div>
                    <div class="initial-icon">${initial}</div>
                    <span style="font-size:0.9rem; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; width:100%; text-align:center;">${link.title}</span>
                `;
                grid.appendChild(card);
            });

            if (folderLinks.length === 0) grid.innerHTML = '<div style="color:#565f89; font-size:0.9rem;">Folder is empty.</div>';
            block.appendChild(grid);
            wrapper.appendChild(block);
        });

        // 2. Render RSS Widgets
        const pageWidgets = db.widgets.filter(w => w.pageId === activePageId);
        pageWidgets.forEach(widget => {
            const block = document.createElement('div');
            block.className = 'folder-block';

            const header = document.createElement('div');
            header.className = 'folder-header';
            header.innerHTML = `
                <div class="folder-title">📰 ${widget.name}</div>
                <div class="folder-actions">
                    <button title="Edit RSS Widget" onclick="window.dispatchModal('editWidget', '${widget.id}')">✏️</button>
                    <button class="delete-folder" title="Delete Widget" onclick="window.dispatchDelete('widget', '${widget.id}')">&times;</button>
                </div>
            `;
            block.appendChild(header);

            const rssContainer = document.createElement('div');
            rssContainer.className = 'rss-container';
            rssContainer.id = `rss-${widget.id}`;
            rssContainer.innerHTML = '<div style="color:#888;">Fetching feed...</div>';
            block.appendChild(rssContainer);
            wrapper.appendChild(block);

            // Fetch XML feed
            fetchRSS(widget.url, rssContainer);
        });
    }

    async function fetchRSS(url, container) {
        try {
            const res = await fetch(url);
            const text = await res.text();
            const xml = new window.DOMParser().parseFromString(text, "text/xml");

            // Supports both RSS 2.0 <item> and Atom <entry>
            const items = Array.from(xml.querySelectorAll("item, entry")).slice(0, 6);

            if (items.length === 0) {
                container.innerHTML = '<div style="color:var(--down-color);">No valid items found in feed.</div>';
                return;
            }

            container.innerHTML = '';
            items.forEach(item => {
                const titleEl = item.querySelector("title");
                const linkEl = item.querySelector("link");

                let linkUrl = '';
                if (linkEl) {
                    // Handle Atom <link href="..."> vs RSS <link>http...</link>
                    linkUrl = linkEl.textContent.trim() || linkEl.getAttribute('href');
                }
                const title = titleEl ? titleEl.textContent : 'Untitled';

                const a = document.createElement('a');
                a.href = linkUrl;
                a.target = '_blank';
                a.className = 'rss-item';
                a.textContent = "▪ " + title;
                container.appendChild(a);
            });
        } catch (e) {
            container.innerHTML = '<div style="color:var(--down-color);">Failed to load feed. Check URL or CORS policies.</div>';
        }
    }

    // --- MODAL & CRUD LOGIC ---
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalFields = document.getElementById('modal-fields');
    const modalSave = document.getElementById('modal-save');
    const modalCancel = document.getElementById('modal-cancel');

    let currentAction = null;
    let currentTargetId = null;

    modalCancel.onclick = () => modal.classList.remove('active');

    window.dispatchModal = (action, targetId = null) => openModal(action, targetId);
    window.dispatchDelete = (type, targetId) => handleDelete(type, targetId);

    document.getElementById('btn-add-page').onclick = () => openModal('addPage');
    document.getElementById('global-add-folder').onclick = () => openModal('addFolder');
    document.getElementById('global-add-rss').onclick = () => openModal('addWidget');

    function openModal(action, targetId = null) {
        currentAction = action;
        currentTargetId = targetId;
        modalFields.innerHTML = '';
        modal.classList.add('active');

        if (action === 'addPage') {
            modalTitle.textContent = "Create New Page";
            modalFields.innerHTML = `<input type="text" id="modal-input-name" placeholder="Page Name (e.g., Homelab)">`;
        } else if (action === 'editPage') {
            modalTitle.textContent = "Edit Page";
            const page = db.pages.find(p => p.id === targetId);
            modalFields.innerHTML = `<input type="text" id="modal-input-name" value="${page.name}">`;

            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-cancel';
            delBtn.style.color = 'var(--down-color)';
            delBtn.style.borderColor = 'var(--down-color)';
            delBtn.textContent = 'Delete Entire Page';
            delBtn.onclick = () => { handleDelete('page', targetId); modal.classList.remove('active'); };
            modalFields.appendChild(delBtn);
        } else if (action === 'addFolder') {
            modalTitle.textContent = "Create New Folder";
            modalFields.innerHTML = `<input type="text" id="modal-input-name" placeholder="Folder Name">`;
        } else if (action === 'editFolder') {
            modalTitle.textContent = "Edit Folder";
            const folder = db.folders.find(f => f.id === targetId);
            modalFields.innerHTML = `<input type="text" id="modal-input-name" value="${folder.name}">`;
        } else if (action === 'addWidget') {
            modalTitle.textContent = "Add RSS Widget";
            modalFields.innerHTML = `
                <input type="text" id="modal-input-name" placeholder="Feed Name (e.g., Ars Technica)">
                <input type="url" id="modal-input-url" placeholder="RSS/XML Feed URL">
            `;
        } else if (action === 'editWidget') {
            modalTitle.textContent = "Edit RSS Widget";
            const widget = db.widgets.find(w => w.id === targetId);
            modalFields.innerHTML = `
                <input type="text" id="modal-input-name" value="${widget.name}">
                <input type="url" id="modal-input-url" value="${widget.url}">
            `;
        } else if (action === 'addLink') {
            modalTitle.textContent = "Add Bookmark";
            modalFields.innerHTML = `
                <input type="text" id="modal-input-title" placeholder="Title">
                <input type="url" id="modal-input-url" placeholder="URL">
            `;
        } else if (action === 'editLink') {
            modalTitle.textContent = "Edit Bookmark";
            const link = db.links.find(l => l.id === targetId);
            modalFields.innerHTML = `
                <input type="text" id="modal-input-title" value="${link.title}">
                <input type="url" id="modal-input-url" value="${link.url}">
            `;
        }

        setTimeout(() => { const first = modalFields.querySelector('input'); if(first) first.focus(); }, 100);
    }

    modalSave.onclick = () => {
        if (['addPage', 'editPage', 'addFolder', 'editFolder'].includes(currentAction)) {
            const name = document.getElementById('modal-input-name').value.trim();
            if (!name) return;

            if (currentAction === 'addPage') {
                const newId = generateId('p');
                db.pages.push({ id: newId, name });
                activePageId = newId;
            } else if (currentAction === 'editPage') {
                db.pages.find(p => p.id === currentTargetId).name = name;
            } else if (currentAction === 'addFolder') {
                db.folders.push({ id: generateId('f'), pageId: activePageId, name });
            } else if (currentAction === 'editFolder') {
                db.folders.find(f => f.id === currentTargetId).name = name;
            }
        } else if (['addWidget', 'editWidget'].includes(currentAction)) {
            const name = document.getElementById('modal-input-name').value.trim();
            let url = document.getElementById('modal-input-url').value.trim();
            if (!name || !url) return;
            if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

            if (currentAction === 'addWidget') {
                db.widgets.push({ id: generateId('w'), pageId: activePageId, type: 'rss', name, url });
            } else if (currentAction === 'editWidget') {
                const widget = db.widgets.find(w => w.id === currentTargetId);
                widget.name = name;
                widget.url = url;
            }
        } else if (['addLink', 'editLink'].includes(currentAction)) {
            const title = document.getElementById('modal-input-title').value.trim();
            let url = document.getElementById('modal-input-url').value.trim();
            if (!title || !url) return;
            if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

            if (currentAction === 'addLink') {
                db.links.push({ id: generateId('l'), folderId: currentTargetId, title, url });
            } else if (currentAction === 'editLink') {
                const link = db.links.find(l => l.id === currentTargetId);
                link.title = title;
                link.url = url;
            }
        }

        saveData(() => { modal.classList.remove('active'); renderUI(); });
    };

    function handleDelete(type, targetId) {
        let msg = '';
        if (type === 'page') msg = "Delete this page, including all folders, links, and widgets inside it?";
        if (type === 'folder') msg = "Delete this folder and all links inside it?";
        if (type === 'widget') msg = "Delete this RSS feed?";
        if (type === 'link') msg = "Remove this bookmark?";

        if (confirm(msg)) {
            if (type === 'page') {
                db.pages = db.pages.filter(p => p.id !== targetId);
                const foldersToRemove = db.folders.filter(f => f.pageId === targetId).map(f => f.id);
                db.folders = db.folders.filter(f => f.pageId !== targetId);
                db.links = db.links.filter(l => !foldersToRemove.includes(l.folderId));
                db.widgets = db.widgets.filter(w => w.pageId !== targetId);
                activePageId = db.pages.length > 0 ? db.pages[0].id : null;
            } else if (type === 'folder') {
                db.folders = db.folders.filter(f => f.id !== targetId);
                db.links = db.links.filter(l => l.folderId !== targetId);
            } else if (type === 'widget') {
                db.widgets = db.widgets.filter(w => w.id !== targetId);
            } else if (type === 'link') {
                db.links = db.links.filter(l => l.id !== targetId);
            }
            saveData(() => renderUI());
        }
    }
});
