class SpeechToTextPro {
    constructor() {
        this.recognition = null;
        this.isRecording = false;
        this.finalTranscript = '';
        this.isDarkTheme = true;
        this.spellCheckEnabled = false;
        this.autoPunctuationLevel = 'medium';
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadSavedSettings();
        this.checkBrowserSupport();
        this.applyTheme();
    }

    initializeElements() {
        // Основные элементы
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.output = document.getElementById('output');
        this.status = document.getElementById('status');
        this.languageSelect = document.getElementById('language');
        this.autoPunctuationSelect = document.getElementById('autoPunctuation');
        this.instructions = document.getElementById('instructions');
        this.themeToggle = document.getElementById('themeToggle');
        
        // Toolbar
        this.spellCheckBtn = document.getElementById('spellCheckBtn');
        this.formatTextBtn = document.getElementById('formatTextBtn');
        this.punctuateBtn = document.getElementById('punctuateBtn');
        
        // Stats
        this.wordCount = document.getElementById('wordCountText');
        this.charCount = document.getElementById('charCountText');
        
        // Formatting
        this.toolbarBtns = document.querySelectorAll('.toolbar-btn[data-command]');
        
        // Progress
        this.progressBar = document.querySelector('.progress-bar');
    }

    setupEventListeners() {
        // Основные кнопки
        this.startBtn.addEventListener('click', () => this.startRecording());
        this.stopBtn.addEventListener('click', () => this.stopRecording());
        this.copyBtn.addEventListener('click', () => this.copyToClipboard());
        this.clearBtn.addEventListener('click', () => this.clearText());
        
        // Настройки
        this.languageSelect.addEventListener('change', () => this.saveSettings());
        this.autoPunctuationSelect.addEventListener('change', () => {
            this.autoPunctuationLevel = this.autoPunctuationSelect.value;
            this.saveSettings();
        });
        
        // Тема
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Toolbar
        this.spellCheckBtn.addEventListener('click', () => this.toggleSpellCheck());
        this.formatTextBtn.addEventListener('click', () => this.formatText());
        this.punctuateBtn.addEventListener('click', () => this.autoPunctuate());
        
        this.toolbarBtns.forEach(btn => {
            btn.addEventListener('click', () => this.executeCommand(btn.dataset.command));
        });

        // Текст
        this.output.addEventListener('input', () => {
            this.updateStats();
            this.saveTextDraft();
        });

        // Горячие клавиши
        document.addEventListener('keydown', (e) => this.handleHotkeys(e));
    }

    toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        document.body.classList.toggle('light-theme', !this.isDarkTheme);
        document.body.classList.toggle('dark-theme', this.isDarkTheme);
        this.themeToggle.textContent = this.isDarkTheme ? '🌙' : '☀️';
        this.themeToggle.title = this.isDarkTheme ? 'Темная тема' : 'Светлая тема';
        this.saveSettings();
    }

    applyTheme() {
        if (this.isDarkTheme) {
            document.body.classList.add('dark-theme');
            document.body.classList.remove('light-theme');
        } else {
            document.body.classList.add('light-theme');
            document.body.classList.remove('dark-theme');
        }
    }

    handleHotkeys(e) {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'Enter':
                    if (e.shiftKey) {
                        e.preventDefault();
                        this.startRecording();
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.stopRecording();
                    break;
                case 'c':
                    if (!e.shiftKey) {
                        e.preventDefault();
                        this.copyToClipboard();
                    }
                    break;
                case 'Delete':
                    e.preventDefault();
                    this.clearText();
                    break;
                case 'b':
                    e.preventDefault();
                    this.executeCommand('bold');
                    break;
                case 'i':
                    e.preventDefault();
                    this.executeCommand('italic');
                    break;
                case 'u':
                    e.preventDefault();
                    this.executeCommand('underline');
                    break;
                case 'm':
                    if (e.shiftKey) {
                        e.preventDefault();
                        this.toggleTheme();
                    }
                    break;
            }
        }
    }

    executeCommand(command) {
        document.execCommand(command, false, null);
        this.output.focus();
        this.showStatus('✨ Текст отформатирован', 'success');
    }

    async checkMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            this.showError('🎤 Доступ к микрофону запрещен', true);
            return false;
        }
    }

    checkBrowserSupport() {
        if (!('webkitSpeechRecognition' in window)) {
            this.showError('❌ Браузер не поддерживает распознавание речи');
            this.startBtn.disabled = true;
            return false;
        }
        return true;
    }

    initializeRecognition() {
        try {
            const SpeechRecognition = window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = this.languageSelect.value;
            this.recognition.maxAlternatives = 3;

            this.recognition.onstart = () => {
                this.isRecording = true;
                this.updateUI();
                this.showStatus('🎤 Запись... Говорите четко', 'recording');
                document.querySelector('.status-container').classList.add('recording');
            };

            this.recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalSegment = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    
                    if (event.results[i].isFinal) {
                        finalSegment += this.processPunctuation(transcript);
                        this.finalTranscript += finalSegment + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }

                this.output.value = this.finalTranscript + interimTranscript;
                this.updateStats();
                this.output.scrollTop = this.output.scrollHeight;
            };

            this.recognition.onerror = (event) => {
                if (event.error === 'not-allowed') {
                    this.showError('🎤 Доступ к микрофону запрещен', true);
                } else if (event.error === 'no-speech') {
                    this.showStatus('🔇 Речь не обнаружена. Продолжайте говорить...', 'warning');
                    return;
                } else {
                    this.showError(`❌ Ошибка: ${event.error}`);
                }
                this.stopRecording();
            };

            this.recognition.onend = () => {
                if (this.isRecording) {
                    setTimeout(() => {
                        if (this.isRecording && this.recognition) {
                            this.recognition.start();
                        }
                    }, 100);
                }
            };

            return true;
        } catch (error) {
            this.showError(`❌ Ошибка инициализации: ${error.message}`);
            return false;
        }
    }

    processPunctuation(text) {
        if (this.autoPunctuationLevel === 'off') return text;

        let processed = text
            .replace(/\s*,\s*/g, ', ')
            .replace(/\s*\.\s*/g, '. ')
            .replace(/\s*\?\s*/g, '? ')
            .replace(/\s*!\s*/g, '! ');

        if (this.autoPunctuationLevel === 'medium' || this.autoPunctuationLevel === 'high') {
            processed = processed
                .replace(/\s+(но|а|и|или|что|который|где|когда)\s+/gi, ', $1 ')
                .replace(/, ,/g, ',');
        }

        if (this.autoPunctuationLevel === 'high') {
            processed = processed
                .replace(/([.!?])\s+([а-яa-z])/g, (match, p1, p2) => 
                    `${p1} ${p2.toUpperCase()}`)
                .replace(/\s+(впрочем|однако|тем не менее|кроме того)\s+/gi, '. $1, ');
        }

        if (processed.length > 0) {
            processed = processed.charAt(0).toUpperCase() + processed.slice(1);
        }

        return processed.trim();
    }

    async startRecording() {
        if (this.isRecording) return;

        const hasAccess = await this.checkMicrophonePermission();
        if (!hasAccess) return;

        try {
            if (!this.recognition && !this.initializeRecognition()) {
                return;
            }

            this.finalTranscript = this.output.value || '';
            this.recognition.lang = this.languageSelect.value;
            
            setTimeout(() => {
                this.recognition.start();
            }, 300);
            
            this.hideInstructions();
            
        } catch (error) {
            this.showError(`❌ Не удалось начать запись: ${error.message}`);
        }
    }

    stopRecording() {
        if (this.recognition && this.isRecording) {
            this.isRecording = false;
            this.recognition.stop();
            this.recognition = null;
            this.updateUI();
            document.querySelector('.status-container').classList.remove('recording');
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
                this.showStatus('✅ Текст скопирован в буфер!', 'success');
            })
            .catch(err => {
                this.showError('❌ Ошибка копирования');
            });
    }

    clearText() {
        this.output.value = '';
        this.finalTranscript = '';
        this.updateStats();
        this.showStatus('🗑️ Текст очищен', 'info');
    }

    toggleSpellCheck() {
        this.spellCheckEnabled = !this.spellCheckEnabled;
        this.output.spellcheck = this.spellCheckEnabled;
        this.spellCheckBtn.classList.toggle('active', this.spellCheckEnabled);
        this.output.classList.toggle('spell-check-enabled', this.spellCheckEnabled);
        
        this.showStatus(
            this.spellCheckEnabled ? '🔤 Проверка орфографии включена' : '🔤 Проверка орфографии выключена',
            'info'
        );
    }

    formatText() {
        let text = this.output.value;
        
        if (!text.trim()) {
            this.showStatus('📝 Нет текста для форматирования', 'warning');
            return;
        }

        text = text
            .replace(/\s+/g, ' ')
            .replace(/([.!?])\s*/g, '$1 ')
            .replace(/\s*([,;:])\s*/g, '$1 ')
            .replace(/(\s)\.\s*\.\s*\./g, '$1...')
            .replace(/([.!?])\s+([а-яa-z])/g, (match, p1, p2) => 
                `${p1} ${p2.toUpperCase()}`)
            .trim();

        if (text.length > 0) {
            text = text.charAt(0).toUpperCase() + text.slice(1);
        }

        this.output.value = text;
        this.updateStats();
        this.showStatus('✨ Текст отформатирован', 'success');
    }

    autoPunctuate() {
        let text = this.output.value;
        
        if (!text.trim()) {
            this.showStatus('📝 Нет текста для пунктуации', 'warning');
            return;
        }

        const sentences = text.split(/(?<=[.!?])\s+/);
        const punctuated = sentences.map(sentence => {
            if (sentence.length === 0) return '';
            
            let result = sentence.trim();
            
            if (!/[.!?]$/.test(result)) {
                const lowerResult = result.toLowerCase();
                if (lowerResult.includes('?')) {
                    result += '?';
                } else if (lowerResult.includes('!')) {
                    result += '!';
                } else {
                    result += '.';
                }
            }
            
            return result.charAt(0).toUpperCase() + result.slice(1);
        }).join(' ');

        this.output.value = punctuated;
        this.updateStats();
        this.showStatus('🔠 Знаки препинания расставлены', 'success');
    }

    updateStats() {
        const text = this.output.value;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const characters = text.length;
        
        this.wordCount.textContent = `${words} слов`;
        this.charCount.textContent = `${characters} симв.`;
    }

    updateUI() {
        this.startBtn.disabled = this.isRecording;
        this.stopBtn.disabled = !this.isRecording;
    }

    showError(message, showInstructions = false) {
        this.status.innerHTML = message;
        this.status.className = 'status error';
        this.isRecording = false;
        this.updateUI();
        
        if (showInstructions) {
            this.showInstructions();
        }
    }

    showStatus(message, type = 'info') {
        this.status.innerHTML = message;
        this.status.className = `status ${type}`;
        
        if (type === 'info' || type === 'success') {
            setTimeout(() => {
                if (!this.isRecording && this.status.className.includes(type)) {
                    this.showStatus('🔴 Готов к записи', 'info');
                }
            }, 3000);
        }
    }

    showInstructions() {
        this.instructions.style.display = 'block';
    }

    hideInstructions() {
        this.instructions.style.display = 'none';
    }

    saveSettings() {
        const settings = {
            language: this.languageSelect.value,
            autoPunctuation: this.autoPunctuationSelect.value,
            textDraft: this.output.value,
            darkTheme: this.isDarkTheme,
            spellCheck: this.spellCheckEnabled
        };
        chrome.storage.local.set(settings);
    }

    saveTextDraft() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            chrome.storage.local.set({ textDraft: this.output.value });
        }, 2000);
    }

    loadSavedSettings() {
        chrome.storage.local.get([
            'language', 
            'autoPunctuation', 
            'textDraft', 
            'darkTheme',
            'spellCheck'
        ], (result) => {
            if (result.language) this.languageSelect.value = result.language;
            if (result.autoPunctuation) {
                this.autoPunctuationSelect.value = result.autoPunctuation;
                this.autoPunctuationLevel = result.autoPunctuation;
            }
            if (result.textDraft) {
                this.output.value = result.textDraft;
                this.finalTranscript = result.textDraft;
                this.updateStats();
            }
            if (result.darkTheme !== undefined) {
                this.isDarkTheme = result.darkTheme;
                this.applyTheme();
                this.themeToggle.textContent = this.isDarkTheme ? '🌙' : '☀️';
            }
            if (result.spellCheck) {
                this.spellCheckEnabled = result.spellCheck;
                this.output.spellcheck = this.spellCheckEnabled;
                this.spellCheckBtn.classList.toggle('active', this.spellCheckEnabled);
                this.output.classList.toggle('spell-check-enabled', this.spellCheckEnabled);
            }
        });
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    new SpeechToTextPro();
});