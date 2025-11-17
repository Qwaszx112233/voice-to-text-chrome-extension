class SpeechToTextPro {
    constructor() {
        this.recognition = null;
        this.isRecording = false;
        this.finalTranscript = '';
        this.microphoneAccessGranted = false;
        this.recordingStartTime = null;
        this.recordingTimer = null;
        this.spellCheckEnabled = false;
        this.autoPunctuationLevel = 'medium';
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadSavedSettings();
        this.checkBrowserSupport();
        this.setupSpellCheck();
        this.updateStats();
    }

    initializeElements() {
        // Основные элементы управления
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.output = document.getElementById('output');
        this.status = document.getElementById('status');
        this.languageSelect = document.getElementById('language');
        this.autoPunctuationSelect = document.getElementById('autoPunctuation');
        this.instructions = document.getElementById('instructions');

        // Элементы панели инструментов
        this.spellCheckBtn = document.getElementById('spellCheckBtn');
        this.formatTextBtn = document.getElementById('formatTextBtn');
        this.punctuateBtn = document.getElementById('punctuateBtn');

        // Элементы статистики
        this.wordCount = document.getElementById('wordCount');
        this.charCount = document.getElementById('charCount');
        this.timeCount = document.getElementById('timeCount');

        // Кнопки форматирования
        this.toolbarBtns = document.querySelectorAll('.toolbar-btn[data-command]');
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

        // Панель инструментов
        this.spellCheckBtn.addEventListener('click', () => this.toggleSpellCheck());
        this.formatTextBtn.addEventListener('click', () => this.formatText());
        this.punctuateBtn.addEventListener('click', () => this.autoPunctuate());

        // Кнопки форматирования текста
        this.toolbarBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.executeCommand(btn.dataset.command);
            });
        });

        // Горячие клавиши
        document.addEventListener('keydown', (e) => this.handleHotkeys(e));

        // Отслеживание изменений текста
        this.output.addEventListener('input', () => {
            this.updateStats();
            this.saveTextDraft();
        });

        // Перетаскивание окна
        this.setupWindowDrag();
    }

    setupWindowDrag() {
        const header = document.querySelector('.header');
        let isDragging = false;
        let startX, startY;

        header.style.cursor = 'move';
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            // В расширениях прямое перемещение невозможно, но можно показать эффект
            header.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            header.style.transform = 'none';
        });
    }

    handleHotkeys(e) {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case '1':
                    if (e.shiftKey) {
                        e.preventDefault();
                        this.startRecording();
                    }
                    break;
                case '2':
                    if (e.shiftKey) {
                        e.preventDefault();
                        this.stopRecording();
                    }
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
            }
        }
    }

    executeCommand(command) {
        document.execCommand(command, false, null);
        this.output.focus();
    }

    async checkMicrophonePermission() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioDevices = devices.filter(device => device.kind === 'audioinput');
            
            if (audioDevices.length === 0) {
                this.showError('Микрофон не найден');
                return false;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100
                }
            });
            
            stream.getTracks().forEach(track => track.stop());
            this.microphoneAccessGranted = true;
            this.hideInstructions();
            return true;
            
        } catch (error) {
            console.error('Microphone error:', error);
            this.microphoneAccessGranted = false;
            
            if (error.name === 'NotAllowedError') {
                this.showError('Доступ к микрофону запрещен. Разрешите доступ в настройках браузера.', true);
            } else {
                this.showError(`Ошибка микрофона: ${error.message}`);
            }
            return false;
        }
    }

    checkBrowserSupport() {
        if (!('webkitSpeechRecognition' in window)) {
            this.showError('Браузер не поддерживает распознавание речи. Используйте Chrome или Edge.');
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
                this.recordingStartTime = Date.now();
                this.startRecordingTimer();
                this.updateUI();
                this.showStatus(`🎤 Запись... Говорите четко`, 'recording');
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

                const displayText = this.finalTranscript + interimTranscript;
                this.output.value = displayText;
                this.updateStats();
                this.output.scrollTop = this.output.scrollHeight;
            };

            this.recognition.onerror = (event) => {
                console.error('Recognition error:', event.error);
                
                if (event.error === 'not-allowed') {
                    this.showError('Доступ к микрофону запрещен', true);
                } else if (event.error === 'no-speech') {
                    this.showStatus('🔇 Речь не обнаружена. Продолжайте говорить...', 'warning');
                    return;
                } else {
                    this.showError(`Ошибка: ${event.error}`);
                }
                
                this.stopRecording();
            };

            this.recognition.onend = () => {
                if (this.isRecording) {
                    setTimeout(() => {
                        if (this.isRecording && this.recognition) {
                            try {
                                this.recognition.start();
                            } catch (error) {
                                console.error('Restart error:', error);
                            }
                        }
                    }, 100);
                }
            };

            return true;
        } catch (error) {
            this.showError(`Ошибка инициализации: ${error.message}`);
            return false;
        }
    }

    processPunctuation(text) {
        if (this.autoPunctuationLevel === 'off') return text;

        // Базовая обработка пунктуации на основе пауз и ключевых слов
        let processed = text
            .replace(/\s*,\s*/g, ', ')
            .replace(/\s*\.\s*/g, '. ')
            .replace(/\s*\?\s*/g, '? ')
            .replace(/\s*!\s*/g, '! ');

        if (this.autoPunctuationLevel === 'high') {
            // Более продвинутая обработка
            processed = processed
                .replace(/([.!?])\s+([а-яa-z])/g, (match, p1, p2) => 
                    `${p1} ${p2.toUpperCase()}`)
                .replace(/\b(но|а|и|или|что|который|где|когда)\b/gi, ', $1')
                .replace(/, ,/g, ',');
        }

        // Капитализация первого символа
        if (processed.length > 0) {
            processed = processed.charAt(0).toUpperCase() + processed.slice(1);
        }

        return processed.trim();
    }

    async startRecording() {
        if (this.isRecording) return;

        if (!this.microphoneAccessGranted) {
            const hasAccess = await this.checkMicrophonePermission();
            if (!hasAccess) return;
        }

        try {
            if (!this.recognition && !this.initializeRecognition()) {
                return;
            }

            this.finalTranscript = this.output.value || '';
            this.recognition.lang = this.languageSelect.value;
            
            setTimeout(() => {
                try {
                    this.recognition.start();
                } catch (error) {
                    this.showError(`Ошибка запуска: ${error.message}`);
                }
            }, 300);
            
            this.saveSettings();
            this.hideInstructions();
            
        } catch (error) {
            this.showError(`Не удалось начать запись: ${error.message}`);
        }
    }

    stopRecording() {
        if (this.recognition && this.isRecording) {
            this.isRecording = false;
            this.recognition.stop();
            this.recognition = null;
            this.stopRecordingTimer();
            this.updateUI();
            this.showStatus('⏹️ Запись остановлена', 'info');
        }
    }

    startRecordingTimer() {
        this.stopRecordingTimer();
        this.recordingTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
            this.timeCount.textContent = `⏱️ Время: ${elapsed}с`;
        }, 1000);
    }

    stopRecordingTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }

    copyToClipboard() {
        if (!this.output.value.trim()) {
            this.showStatus('Нет текста для копирования', 'warning');
            return;
        }

        navigator.clipboard.writeText(this.output.value)
            .then(() => {
                this.showStatus('✅ Текст скопирован!', 'success');
            })
            .catch(err => {
                this.showError('Ошибка копирования: ' + err);
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

    setupSpellCheck() {
        // Базовая реализация проверки орфографии
        this.output.addEventListener('click', (e) => {
            if (!this.spellCheckEnabled) return;
            
            // Здесь можно добавить кастомную проверку орфографии
            // с использованием словарей или API
        });
    }

    formatText() {
        let text = this.output.value;
        
        // Улучшенное форматирование текста
        text = text
            .replace(/\s+/g, ' ')
            .replace(/([.!?])\s*/g, '$1 ')
            .replace(/\s*([,;:])\s*/g, '$1 ')
            .replace(/(\s)\.\s*\.\s*\./g, '$1...')
            .replace(/([.!?])\s+([а-яa-z])/g, (match, p1, p2) => 
                `${p1} ${p2.toUpperCase()}`)
            .trim();

        // Капитализация первого символа
        if (text.length > 0) {
            text = text.charAt(0).toUpperCase() + text.slice(1);
        }

        this.output.value = text;
        this.updateStats();
        this.showStatus('✨ Текст отформатирован', 'success');
    }

    autoPunctuate() {
        let text = this.output.value;
        
        // AI-подобная расстановка знаков препинания
        const sentences = text.split(/(?<=[.!?])\s+/);
        const punctuated = sentences.map(sentence => {
            if (sentence.length === 0) return '';
            
            // Простая эвристика для расстановки знаков препинания
            let result = sentence.trim();
            
            if (!/[.!?]$/.test(result)) {
                if (result.toLowerCase().includes('?')) {
                    result += '?';
                } else if (result.toLowerCase().includes('!')) {
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
        
        this.wordCount.textContent = `📝 Слов: ${words}`;
        this.charCount.textContent = `🔤 Символов: ${characters}`;
    }

    updateUI() {
        this.startBtn.disabled = this.isRecording;
        this.stopBtn.disabled = !this.isRecording;
        
        if (this.isRecording) {
            this.startBtn.innerHTML = '🔴 Запись...<div class="hotkey">Ctrl+Shift+1</div>';
        } else {
            this.startBtn.innerHTML = '🎤 Начать запись<div class="hotkey">Ctrl+Shift+1</div>';
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
        this.status.className = `status ${type}`;
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
            textDraft: this.output.value
        };
        chrome.storage.local.set(settings);
    }

    saveTextDraft() {
        // Автосохранение каждые 5 секунд
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            chrome.storage.local.set({ textDraft: this.output.value });
        }, 5000);
    }

    loadSavedSettings() {
        chrome.storage.local.get(['language', 'autoPunctuation', 'textDraft'], (result) => {
            if (result.language) {
                this.languageSelect.value = result.language;
            }
            if (result.autoPunctuation) {
                this.autoPunctuationSelect.value = result.autoPunctuation;
                this.autoPunctuationLevel = result.autoPunctuation;
            }
            if (result.textDraft) {
                this.output.value = result.textDraft;
                this.finalTranscript = result.textDraft;
                this.updateStats();
            }
        });
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    new SpeechToTextPro();
});

// Обработка сообщений от background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "startRecording") {
        const stt = new SpeechToTextPro();
        stt.startRecording();
    } else if (request.action === "stopRecording") {
        const stt = new SpeechToTextPro();
        stt.stopRecording();
    }
});