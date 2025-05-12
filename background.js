
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'resetApiKey',
        title: 'Reset Raider.IO API Key',
        contexts: ['all'],
    });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'resetApiKey') {
        chrome.storage.local.remove("raiderio_access_key", () => {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    alert("✅ Raider.IO API Key removed correctly.");
                }
            });
        });
    }
});
