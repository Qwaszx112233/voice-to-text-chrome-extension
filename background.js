// Фоновый скрипт
chrome.runtime.onInstalled.addListener(() => {
    console.log('Голос в Текст Pro установлен');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getMicrophonePermission") {
        sendResponse({status: "ready"});
    }
});