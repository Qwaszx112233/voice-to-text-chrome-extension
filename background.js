// Фоновый скрипт для управления расширением
chrome.runtime.onInstalled.addListener(() => {
    console.log('Расширение "Голос в Текст" установлено');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getMicrophonePermission") {
        sendResponse({status: "ready"});
    }
});