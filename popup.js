class SpeechToText {
    constructor() {
        this.recognition = null;
        this.isRecording = false;
        this.finalTranscript = '';
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadSavedSettings();
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

    initializeRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            this.showError('Ваш браузер не поддерживает распознавание речи. Пожалуйста, используйте Chrome или Edge.');
            return false;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = this.languageSelect.value;

        this.recognition.onstart = () => {
            this.isRecording = true;
            this.updateUI();
        };

        this.recognition.onresult = (event) => {
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
            
            if (event.error === 'not-allowed') {
                this.showError('Доступ к микрофону запрещен. Пожалуйста, разрешите доступ к микрофону в настройках браузера.');
            } else if (event.error === 'network') {
                this.showError('Ошибка сети. Проверьте подключение к интернету.');
            } else {
                this.showError(`Ошибка распознавания: ${event.error}`);
            }
            
            this.stopRecording();
        };

        this.recognition.onend = () => {
            if (this.isRecording) {
                this.recognition.start();
            } else {
                this.updateUI();
            }
        };

        return true;
    }

    startRecording() {
        if (!this.recognition && !this.initializeRecognition()) {
            return;
        }

        try {
            this.finalTranscript = '';
            this.recognition.lang = this.languageSelect.value;
            this.recognition.start();
            this.saveSettings();
        } catch (error) {
            this.showError(`Не удалось начать запись: ${error.message}`);
        }
    }

    stopRecording() {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
            this.isRecording = false;
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
            this.status.textContent = '🎤 Запись... Говорите сейчас';
            this.status.className = 'status recording';
        } else {
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
            this.status.textContent = '🔴 Запись остановлена';
            this.status.className = 'status';
        }
    }

    showError(message) {
        this.status.textContent = `❌ ${message}`;
        this.status.className = 'status';
    }

    showStatus(message, type = 'info') {
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };
        
        this.status.textContent = `${icons[type]} ${message}`;
        this.status.className = 'status';
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