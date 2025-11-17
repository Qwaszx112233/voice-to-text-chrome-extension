class SpeechToText {
    constructor() {
        this.recognition = null;
        this.isRecording = false;
        this.finalTranscript = '';
        this.microphoneAccessGranted = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadSavedSettings();
        this.checkBrowserSupport();
        // Отложим проверку микрофона до момента нажатия кнопки
    }

    initializeElements() {
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.output = document.getElementById('output');
        this.status = document.getElementById('status');
        this.languageSelect = document.getElementById('language');
        this.instructions = document.getElementById('instructions');
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startRecording());
        this.stopBtn.addEventListener('click', () => this.stopRecording());
        this.copyBtn.addEventListener('click', () => this.copyToClipboard());
        this.clearBtn.addEventListener('click', () => this.clearText());
        this.languageSelect.addEventListener('change', () => this.saveSettings());
    }

    async checkMicrophonePermission() {
        try {
            this.showStatus('🔍 Проверка доступа к микрофону...', 'info');
            
            // Сначала проверяем, есть ли вообще микрофоны
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioDevices = devices.filter(device => device.kind === 'audioinput');
            
            if (audioDevices.length === 0) {
                this.showError('Микрофон не найден на устройстве');
                return false;
            }

            // Пытаемся получить доступ к микрофону с более простыми настройками
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                },
                video: false
            });
            
            // Освобождаем поток после проверки
            stream.getTracks().forEach(track => track.stop());
            
            this.microphoneAccessGranted = true;
            this.hideInstructions();
            this.showStatus('✅ Микрофон доступен', 'success');
            
            return true;
            
        } catch (error) {
            console.error('Microphone permission error:', error);
            this.microphoneAccessGranted = false;
            
            let errorMessage = '';
            
            if (error.name === 'NotAllowedError') {
                errorMessage = 'Доступ к микрофону запрещен. ';
                if (window.chrome) {
                    errorMessage += 'Нажмите на значок 🔒 в адресной строке браузера и разрешите доступ к микрофону для этого сайта.';
                } else {
                    errorMessage += 'Разрешите доступ к микрофону в настройках браузера.';
                }
                this.showInstructions();
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                errorMessage = 'Микрофон не найден. Убедитесь, что микрофон подключен и работает.';
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                errorMessage = 'Микрофон используется другим приложением. Закройте другие программы, использующие микрофон.';
            } else {
                errorMessage = `Ошибка доступа к микрофону: ${error.message}`;
            }
            
            this.showError(errorMessage);
            return false;
        }
    }

    checkBrowserSupport() {
        const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
        
        if (!SpeechRecognition) {
            this.showError('Ваш браузер не поддерживает распознавание речи. Пожалуйста, используйте Chrome версии 25+ или Edge.');
            this.startBtn.disabled = true;
            return false;
        }
        return true;
    }

    getLanguageName(code) {
        const languages = {
            'ru-RU': 'русском',
            'uk-UA': 'українській',
            'en-US': 'английском',
            'es-ES': 'испанском',
            'fr-FR': 'французском',
            'de-DE': 'немецком'
        };
        return languages[code] || code;
    }

    initializeRecognition() {
        try {
            const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
            
            if (!SpeechRecognition) {
                this.showError('Web Speech API не поддерживается');
                return false;
            }

            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = this.languageSelect.value;

            this.recognition.onstart = () => {
                console.log('Recognition started');
                this.isRecording = true;
                this.updateUI();
                const langName = this.getLanguageName(this.languageSelect.value);
                this.showStatus(`🎤 Запись... Говорите на ${langName} языке`, 'recording');
            };

            this.recognition.onresult = (event) => {
                console.log('Recognition result received');
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    
                    if (event.results[i].isFinal) {
                        this.finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }

                this.output.value = this.finalTranscript + interimTranscript;
                this.output.scrollTop = this.output.scrollHeight;
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                
                // Не останавливаем запись для некоторых ошибок
                if (event.error === 'no-speech') {
                    const langName = this.getLanguageName(this.languageSelect.value);
                    this.showStatus(`🔇 Речь не распознана. Продолжайте говорить на ${langName} языке`, 'warning');
                    return;
                } else if (event.error === 'network') {
                    this.showError('Ошибка сети. Проверьте подключение к интернету.');
                } else if (event.error === 'not-allowed') {
                    this.showError('Доступ к микрофону запрещен. Обновите разрешения для расширения.', true);
                    this.showInstructions();
                } else if (event.error === 'audio-capture') {
                    this.showError('Микрофон не найден или недоступен.');
                } else {
                    this.showError(`Ошибка распознавания: ${event.error}`);
                }
                
                this.stopRecording();
            };

            this.recognition.onend = () => {
                console.log('Recognition ended');
                if (this.isRecording) {
                    // Автоматически перезапускаем, если пользователь не остановил запись
                    setTimeout(() => {
                        if (this.isRecording && this.recognition) {
                            try {
                                this.recognition.start();
                                console.log('Recognition restarted automatically');
                            } catch (error) {
                                console.error('Error restarting recognition:', error);
                                this.showError('Ошибка перезапуска записи');
                                this.stopRecording();
                            }
                        }
                    }, 100);
                } else {
                    this.updateUI();
                }
            };

            return true;
        } catch (error) {
            console.error('Error initializing recognition:', error);
            this.showError(`Ошибка инициализации: ${error.message}`);
            return false;
        }
    }

    async startRecording() {
        if (this.isRecording) return;

        // Проверяем разрешение на микрофон перед началом записи
        if (!this.microphoneAccessGranted) {
            this.showStatus('🔐 Запрос доступа к микрофону...', 'info');
            const hasAccess = await this.checkMicrophonePermission();
            if (!hasAccess) {
                return;
            }
        }

        try {
            if (!this.initializeRecognition()) {
                return;
            }

            this.finalTranscript = '';
            this.recognition.lang = this.languageSelect.value;
            
            // Добавляем задержку для стабильности
            await new Promise(resolve => setTimeout(resolve, 500));
            
            try {
                this.recognition.start();
                this.saveSettings();
                this.hideInstructions();
            } catch (startError) {
                console.error('Error starting recognition:', startError);
                
                // Если ошибка связана с разрешениями, проверяем снова
                if (startError.name === 'NotAllowedError' || startError.message.includes('permission')) {
                    this.microphoneAccessGranted = false;
                    this.showError('Доступ к микрофону не предоставлен. Проверьте разрешения.', true);
                    this.showInstructions();
                } else {
                    this.showError(`Не удалось начать запись: ${startError.message}`);
                }
            }
            
        } catch (error) {
            console.error('Error in startRecording:', error);
            this.showError(`Неожиданная ошибка: ${error.message}`);
        }
    }

    stopRecording() {
        if (this.recognition && this.isRecording) {
            this.isRecording = false;
            try {
                this.recognition.stop();
            } catch (e) {
                console.log('Recognition already stopped');
            }
            this.recognition = null;
            this.updateUI();
            this.showStatus('⏹️ Запись остановлена', 'info');
        }
    }

    copyToClipboard() {
        if (!this.output.value.trim()) {
            this.showStatus('📝 Нет текста для копирования', 'warning');
            return;
        }

        navigator.clipboard.writeText(this.output.value)
            .then(() => {
                this.showStatus('✅ Текст скопирован в буфер обмена!', 'success');
            })
            .catch(err => {
                this.showError('❌ Не удалось скопировать текст: ' + err);
            });
    }

    clearText() {
        this.output.value = '';
        this.finalTranscript = '';
        this.showStatus('🗑️ Текст очищен', 'info');
    }

    updateUI() {
        if (this.isRecording) {
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.startBtn.textContent = '🔴 Запись...';
            this.stopBtn.textContent = '⏹️ Остановить';
        } else {
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
            this.startBtn.textContent = '▶️ Начать запись';
            this.stopBtn.textContent = '⏹️ Остановить';
        }
    }

    showError(message, showInstructions = false) {
        this.status.textContent = `❌ ${message}`;
        this.status.className = 'status error';
        this.isRecording = false;
        this.updateUI();
        
        if (showInstructions) {
            this.showInstructions();
        }
        
        // Автоматически скрываем ошибку через 5 секунд
        setTimeout(() => {
            if (this.status.className === 'status error') {
                this.showStatus('🔴 Готов к записи', 'info');
            }
        }, 5000);
    }

    showStatus(message, type = 'info') {
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            recording: '🎤'
        };
        
        this.status.textContent = `${icons[type] || ''} ${message}`;
        this.status.className = type === 'recording' ? 'status recording' : 'status';
    }

    showInstructions() {
        this.instructions.style.display = 'block';
    }

    hideInstructions() {
        this.instructions.style.display = 'none';
    }

    saveSettings() {
        const settings = {
            language: this.languageSelect.value
        };
        chrome.storage.local.set(settings);
    }

    loadSavedSettings() {
        chrome.storage.local.get(['language'], (result) => {
            if (result.language) {
                this.languageSelect.value = result.language;
            }
        });
    }
}

// Инициализация когда DOM загружен
document.addEventListener('DOMContentLoaded', () => {
    new SpeechToText();
});