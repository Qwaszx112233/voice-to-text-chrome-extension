class SpeechToText {
    constructor() {
        this.recognition = null;
        this.isRecording = false;
        this.finalTranscript = '';
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadSavedSettings();
        this.checkBrowserSupport();
    }

    initializeElements() {
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.output = document.getElementById('output');
        this.status = document.getElementById('status');
        this.languageSelect = document.getElementById('language');
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startRecording());
        this.stopBtn.addEventListener('click', () => this.stopRecording());
        this.copyBtn.addEventListener('click', () => this.copyToClipboard());
        this.clearBtn.addEventListener('click', () => this.clearText());
        this.languageSelect.addEventListener('change', () => this.saveSettings());
    }

    checkBrowserSupport() {
        if (!('webkitSpeechRecognition' in window)) {
            this.showError('Ваш браузер не поддерживает распознавание речи. Пожалуйста, используйте Chrome или Edge.');
            this.startBtn.disabled = true;
        }
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
            const SpeechRecognition = window.webkitSpeechRecognition;
            
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
                this.finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    
                    if (event.results[i].isFinal) {
                        this.finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }

                this.output.value = this.finalTranscript || interimTranscript;
                this.output.scrollTop = this.output.scrollHeight;
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                
                if (event.error === 'not-allowed') {
                    this.showError('Доступ к микрофону запрещен. Пожалуйста, разрешите доступ к микрофону в настройках браузера.');
                } else if (event.error === 'network') {
                    this.showError('Ошибка сети. Проверьте подключение к интернету.');
                } else if (event.error === 'audio-capture') {
                    this.showError('Микрофон не найден или недоступен.');
                } else if (event.error === 'no-speech') {
                    const langName = this.getLanguageName(this.languageSelect.value);
                    this.showStatus(`Речь не распознана. Попробуйте говорить громче на ${langName} языке`, 'warning');
                    return;
                } else {
                    this.showError(`Ошибка распознавания: ${event.error}`);
                }
                
                this.stopRecording();
            };

            this.recognition.onend = () => {
                console.log('Recognition ended');
                if (this.isRecording) {
                    setTimeout(() => {
                        if (this.isRecording) {
                            this.recognition.start();
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

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            
            if (!this.recognition && !this.initializeRecognition()) {
                return;
            }

            this.finalTranscript = '';
            this.recognition.lang = this.languageSelect.value;
            
            setTimeout(() => {
                this.recognition.start();
            }, 300);
            
            this.saveSettings();
        } catch (error) {
            console.error('Error starting recording:', error);
            if (error.name === 'NotAllowedError') {
                this.showError('Доступ к микрофону запрещен. Разрешите доступ в настройках браузера.');
            } else {
                this.showError(`Не удалось начать запись: ${error.message}`);
            }
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
            this.updateUI();
            this.showStatus('🔴 Запись остановлена', 'info');
        }
    }

    copyToClipboard() {
        if (!this.output.value.trim()) {
            this.showStatus('Нет текста для копирования', 'warning');
            return;
        }

        navigator.clipboard.writeText(this.output.value)
            .then(() => {
                this.showStatus('Текст скопирован в буфер обмена!', 'success');
            })
            .catch(err => {
                this.showError('Не удалось скопировать текст: ' + err);
            });
    }

    clearText() {
        this.output.value = '';
        this.finalTranscript = '';
        this.showStatus('Текст очищен', 'info');
    }

    updateUI() {
        if (this.isRecording) {
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
        } else {
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
        }
    }

    showError(message) {
        this.status.textContent = `❌ ${message}`;
        this.status.className = 'status';
        this.isRecording = false;
        this.updateUI();
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

document.addEventListener('DOMContentLoaded', () => {
    new SpeechToText();
});