// Фоновый скрипт для управления расширением
chrome.runtime.onInstalled.addListener(() => {
    console.log('Голос в Текст Pro установлен');
});

// Обработка сообщений от popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getMicrophonePermission") {
        sendResponse({status: "ready"});
    }
});