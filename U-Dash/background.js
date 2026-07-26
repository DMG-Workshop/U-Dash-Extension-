chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "open_default_newtab") {
        chrome.tabs.update(sender.tab.id, { url: "chrome://search/" });
    }
});

chrome.storage.local.get(['enable_popup'], (result) => {
    const popupEnabled = result.enable_popup !== false;
    if (!popupEnabled) {
        chrome.action.setPopup({ popup: "" });
    }
});

chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: "newtab.html" });
});