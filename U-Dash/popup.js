document.addEventListener('DOMContentLoaded', () => {
    const scratchpad = document.getElementById('scratchpad');
    const saveTabBtn = document.getElementById('save-tab-btn');
    const linkList = document.getElementById('link-list');

    chrome.storage.local.get(['udash_notes', 'udash_links'], (result) => {
        if (result.udash_notes) scratchpad.value = result.udash_notes;
        if (result.udash_links) renderLinks(result.udash_links);
    });

    scratchpad.addEventListener('input', () => {
        chrome.storage.local.set({ 'udash_notes': scratchpad.value });
    });

    function parseSafeUrl(rawUrl) {
        try {
            const parsed = new URL(rawUrl);
            return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
        } catch (e) { return null; }
    }

    saveTabBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            let activeTab = tabs[0];
            const safeUrl = parseSafeUrl(activeTab.url);
            if (!safeUrl) return;

            chrome.storage.local.get(['udash_pages', 'udash_folders', 'udash_links'], (result) => {
                let pages = result.udash_pages || [];
                let folders = result.udash_folders || [];
                let links = result.udash_links || [];

                let targetFolderId = null;
                if (folders.length > 0) {
                    targetFolderId = folders[0].id;
                } else {
                    const defaultPageId = 'p_' + Math.random().toString(36).substr(2, 9);
                    targetFolderId = 'f_' + Math.random().toString(36).substr(2, 9);
                    pages.push({ id: defaultPageId, name: "Inbox" });
                    folders.push({ id: targetFolderId, pageId: defaultPageId, name: "Saved Links" });
                    chrome.storage.local.set({ udash_pages: pages, udash_folders: folders });
                }

                if (!links.some(l => l.url === safeUrl)) {
                    links.push({
                        id: 'l_' + Math.random().toString(36).substr(2, 9),
                        folderId: targetFolderId,
                        title: activeTab.title,
                        url: safeUrl
                    });
                    chrome.storage.local.set({ 'udash_links': links }, () => renderLinks(links));
                }
            });
        });
    });

    function renderLinks(links) {
        linkList.innerHTML = '';
        links.slice(-10).reverse().forEach((link) => {
            const safeUrl = parseSafeUrl(link.url);
            if (!safeUrl) return;

            let li = document.createElement('li');
            let a = document.createElement('a');
            a.href = safeUrl;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.textContent = link.title;

            let delBtn = document.createElement('div');
            delBtn.className = 'delete-btn';
            delBtn.textContent = '×';
            delBtn.addEventListener('click', () => {
                const updatedLinks = links.filter(l => l.id !== link.id);
                chrome.storage.local.set({ 'udash_links': updatedLinks }, () => renderLinks(updatedLinks));
            });

            li.appendChild(a);
            li.appendChild(delBtn);
            linkList.appendChild(li);
        });
    }
});
