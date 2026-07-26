document.addEventListener('DOMContentLoaded', () => {
    const ntToggle = document.getElementById('toggle-newtab');
    const popToggle = document.getElementById('toggle-popup');
    const status = document.getElementById('status-msg');

    chrome.storage.local.get(['enable_newtab', 'enable_popup'], (result) => {
        ntToggle.checked = result.enable_newtab !== false;
        popToggle.checked = result.enable_popup !== false;
    });

    function saveOptions() {
        const enableNewTab = ntToggle.checked;
        const enablePopup = popToggle.checked;

        chrome.storage.local.set({
            enable_newtab: enableNewTab,
            enable_popup: enablePopup
        }, () => {
            if (enablePopup) {
                chrome.action.setPopup({ popup: "popup.html" });
            } else {
                chrome.action.setPopup({ popup: "" });
            }
            status.style.display = "block";
            setTimeout(() => { status.style.display = "none"; }, 2000);
        });
    }

    ntToggle.addEventListener('change', saveOptions);
    popToggle.addEventListener('change', saveOptions);
});