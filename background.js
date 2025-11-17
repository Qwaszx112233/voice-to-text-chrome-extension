// Фоновый скрипт для управления расширением
chrome.runtime.onInstalled.addListener(() => {
    console.log('Голос в Текст Pro установлен');
    
    // Создаем контекстное меню
    chrome.contextMenus.create({
        id: "voiceToText",
        title: "Голос в Текст",
        contexts: ["editable"]
    });
});

// Обработка горячих клавиш
chrome.commands.onCommand.addListener((command) => {
    if (command === "start_recording") {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {action: "startRecording"});
        });
    } else if (command === "stop_recording") {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {action: "stopRecording"});
        });
    }
});

// Обработка контекстного меню
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "voiceToText") {
        chrome.tabs.create({
            url: chrome.runtime.getURL('popup.html'),
            active: true
        });
    }
});

// Обработка сообщений от popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getMicrophonePermission") {
        sendResponse({status: "ready"});
    }
});

// Уведомления о состоянии
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "voiceToText") {
        port.onMessage.addListener((msg) => {
            if (msg.type === "recordingStarted") {
                chrome.notifications.create({
                    type: "basic",
                    iconUrl: "icons/icon48.png",
                    title: "Голос в Текст Pro",
                    message: "Запись начата"
                });
            }
        });
    }
});