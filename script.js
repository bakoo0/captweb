const metrics = {
    typing: {
        duration: 0,
        errors: 0,
        intervals: [],
        timeline: [],
        wpm: 0,
        characters: 0,
        corrections: 0
    },
    clicks: {
        count: 0,
        reactionTimes: [],
        timeline: []
    },
    scroll: {
        speeds: [],
        variance: 0,
        timeline: []
    },
    interactions: {
        total: 0,
        hover: 0,
        duration: 0,
        firstTimestamp: null,
        lastTimestamp: null,
        timeline: [],
        types: {}
    },
    session: {
        start: Date.now(),
        duration: 0
    },
    mouse: {
        start: null,
        lastEvent: null,
        lastX: null,
        lastY: null,
        distance: 0,
        events: 0
    },
    arrows: {
        total: 0,
        counts: {
            up: 0,
            down: 0,
            left: 0,
            right: 0
        },
        firstTimestamp: null,
        lastTimestamp: null
    }
};

const typingSentence = 'Собака бегает по зелёной траве.';
let typingStartTime = null;
let lastKeyTime = null;
let typingCompleted = false;

const consentModal = document.getElementById('consentModal');
const agreeBtn = document.getElementById('agreeBtn');
const declineBtn = document.getElementById('declineBtn');

const typingInput = document.getElementById('typingInput');
const typingTimeEl = document.getElementById('typingTime');
const typingErrorsEl = document.getElementById('typingErrors');
const typingCorrectionsEl = document.getElementById('typingCorrections');
const typingProgress = document.getElementById('typingProgress');
const targetSentenceEl = document.getElementById('targetSentence');

const clickStage = document.getElementById('clickStage');
const clickTarget = document.getElementById('clickTarget');
const startClickTestBtn = document.getElementById('startClickTest');
const clickCountEl = document.getElementById('clickCount');
const reactionTimeEl = document.getElementById('reactionTime');
const MAX_CLICK_ROUNDS = 5;
let clickRoundsRemaining = 0;
let clickTimeoutId = null;
let clickTestActive = false;

const scrollContainer = document.querySelector('.scroll-content');
const scrollProgress = document.getElementById('scrollProgress');
const scrollSpeedEl = document.getElementById('scrollSpeed');
const scrollVarianceEl = document.getElementById('scrollVariance');
const scrollTargetMarker = document.getElementById('scrollTarget');
let scrollTestCompleted = false;

const interactionElements = document.querySelectorAll('[data-interaction]');
const interactionCountEl = document.getElementById('interactionCount');
const interactionDurationEl = document.getElementById('interactionDuration');
const hoverCountEl = document.getElementById('hoverCount');
const sliderValueEl = document.getElementById('sliderValue');

const finishBtn = document.getElementById('finishBtn');
const finishMessage = document.getElementById('finishMessage');

const userId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `user-${Date.now()}`;

const sessionLog = {
    typing: {
        start: null,
        end: null,
        duration: 0,
        errors: 0,
        wpm: 0,
        characters: 0,
        corrections: 0
    },
    click: {
        start: null,
        end: null,
        clicks: 0,
        reactionAverage: 0
    },
    scroll: {
        start: null,
        end: null,
        duration: 0,
        averageSpeed: 0,
        variance: 0
    },
    interactions: {
        start: null,
        end: null,
        duration: 0,
        total: 0,
        hover: 0
    },
    arrows: {
        start: null,
        end: null,
        total: 0,
        counts: {
            up: 0,
            down: 0,
            left: 0,
            right: 0
        }
    },
    mouse: {
        start: null,
        end: null,
        events: 0,
        distance: 0
    }
};

if (finishBtn) {
    finishBtn.addEventListener('click', finalizeSession);
}

const tableTypingSpeed = document.getElementById('tableTypingSpeed');
const tableTypingErrors = document.getElementById('tableTypingErrors');
const tableReaction = document.getElementById('tableReaction');
const tableScroll = document.getElementById('tableScroll');
const tableInteractions = document.getElementById('tableInteractions');
const tableArrows = document.getElementById('tableArrows');
const sessionDurationEl = document.getElementById('sessionDuration');
const humanRateEl = document.getElementById('humanRate');
const botRateEl = document.getElementById('botRate');

const arrowUpCountEl = document.getElementById('arrowUpCount');
const arrowDownCountEl = document.getElementById('arrowDownCount');
const arrowLeftCountEl = document.getElementById('arrowLeftCount');
const arrowRightCountEl = document.getElementById('arrowRightCount');
const arrowButtons = document.querySelectorAll('.arrow-btn');
const arrowButtonMap = {};
const arrowActiveTimers = {};

let typingChart, clickChart, scrollChart, sessionChart;
let previousTypingValue = '';

function blockSite() {
    document.body.classList.add('consent-blocked');
}

function allowSite() {
    document.body.classList.remove('consent-blocked');
    consentModal.classList.add('hidden');
}

blockSite();

declineBtn.addEventListener('click', () => {
    consentModal.querySelector('p').textContent = 'Без согласия функционал сайта ограничен. Вы можете закрыть вкладку или согласиться, чтобы продолжить.';
    declineBtn.disabled = true;
});

agreeBtn.addEventListener('click', () => {
    allowSite();
});

function highlightTyping(value) {
    let highlighted = '';
    for (let i = 0; i < typingSentence.length; i++) {
        const expectedChar = typingSentence[i] || '';
        const typedChar = value[i] || '';
        if (!typedChar) {
            highlighted += `<span class="pending">${expectedChar}</span>`;
        } else if (typedChar === expectedChar) {
            highlighted += `<span class="correct">${expectedChar}</span>`;
        } else {
            highlighted += `<span class="incorrect">${expectedChar}</span>`;
        }
    }
    targetSentenceEl.innerHTML = highlighted;
}

function updateTypingStats(duration, errors, wpm) {
    if (typingTimeEl) {
        typingTimeEl.textContent = `${duration.toFixed(1)} c`;
    }
    if (typingErrorsEl) {
        typingErrorsEl.textContent = errors.toString();
    }
    if (typingCorrectionsEl) {
        typingCorrectionsEl.textContent = metrics.typing.corrections.toString();
    }
    if (tableTypingSpeed) {
        tableTypingSpeed.textContent = wpm > 0 ? `${wpm.toFixed(1)} сл/мин` : '–';
    }
    if (tableTypingErrors) {
        const correctionSuffix = metrics.typing.corrections > 0 ? ` (испр: ${metrics.typing.corrections})` : '';
        tableTypingErrors.textContent = `${errors}${correctionSuffix}`;
    }
}

function handleTyping(event) {
    const value = event.target.value;
    const inputType = event.inputType || '';
    const cursorPosition = event.target.selectionStart ?? value.length;
    const previousValue = previousTypingValue;

    if (previousValue && previousValue.length > value.length && inputType.includes('delete')) {
        const removalIndex = Math.max(0, cursorPosition);
        const removedChar = previousValue[removalIndex];
        const expectedChar = typingSentence[removalIndex];
        if (removedChar && expectedChar && removedChar !== expectedChar) {
            metrics.typing.corrections += 1;
            sessionLog.typing.corrections = metrics.typing.corrections;
        }
    }
    if (!typingStartTime) {
        typingStartTime = Date.now();
        sessionLog.typing.start = typingStartTime;
    }

    const now = Date.now();
    if (lastKeyTime) {
        metrics.typing.intervals.push((now - lastKeyTime) / 1000);
    }
    lastKeyTime = now;

    let errors = 0;
    for (let i = 0; i < value.length; i++) {
        if (value[i] !== typingSentence[i]) {
            errors++;
        }
    }
    metrics.typing.errors = errors;
    sessionLog.typing.errors = errors;
    sessionLog.typing.corrections = metrics.typing.corrections;

    const progress = Math.min((value.length / typingSentence.length) * 100, 100);
    typingProgress.style.width = `${progress}%`;
    highlightTyping(value);

    if (typingStartTime) {
        const duration = (now - typingStartTime) / 1000;
        metrics.typing.duration = duration;
        metrics.typing.characters = value.length;
        metrics.typing.wpm = duration > 0 ? ((value.length / 5) / (duration / 60)) : 0;
        metrics.typing.timeline.push({ x: now, y: metrics.typing.wpm });
        sessionLog.typing.duration = duration;
        sessionLog.typing.wpm = metrics.typing.wpm;
        sessionLog.typing.characters = value.length;
        updateTypingStats(duration, errors, metrics.typing.wpm);
    }

    if (!typingCompleted && value === typingSentence) {
        typingInput.disabled = true;
        typingCompleted = true;
        sessionLog.typing.end = now;
    }

    refreshCharts();
    updateAdminDashboard();

    previousTypingValue = value;
}

typingInput.addEventListener('input', handleTyping);

startClickTestBtn.addEventListener('click', () => {
    metrics.clicks.count = 0;
    metrics.clicks.reactionTimes = [];
    metrics.clicks.timeline = [];
    clickCountEl.textContent = '0';
    reactionTimeEl.textContent = '–';
    tableReaction.textContent = '–';
    clickRoundsRemaining = MAX_CLICK_ROUNDS;
    clickTestActive = true;
    sessionLog.click.start = Date.now();
    sessionLog.click.end = null;
    sessionLog.click.clicks = 0;
    sessionLog.click.reactionAverage = 0;
    startClickTestBtn.disabled = true;
    startClickTestBtn.textContent = 'Идёт тест...';
    spawnTarget();
    refreshCharts();
});

function spawnTarget() {
    if (!clickTestActive || clickRoundsRemaining <= 0) {
        concludeClickTest();
        return;
    }

    const { width, height } = clickStage.getBoundingClientRect();
    const size = 120;
    const padding = 20;
    const x = Math.random() * (width - size - padding * 2) + padding + size / 2;
    const y = Math.random() * (height - size - padding * 2) + padding + size / 2;

    clickTarget.style.left = `${x}px`;
    clickTarget.style.top = `${y}px`;
    clickTarget.classList.add('visible');
    clickTarget.dataset.spawnTime = Date.now().toString();
}

function concludeClickTest() {
    if (clickTimeoutId) {
        clearTimeout(clickTimeoutId);
        clickTimeoutId = null;
    }
    clickTarget.classList.remove('visible');
    if (!clickTestActive) {
        startClickTestBtn.disabled = false;
        startClickTestBtn.textContent = 'Начать';
        return;
    }
    clickTestActive = false;
    sessionLog.click.end = Date.now();
    startClickTestBtn.disabled = false;
    startClickTestBtn.textContent = 'Повторить тест';
}

clickTarget.addEventListener('click', () => {
    if (!clickTestActive || !clickTarget.classList.contains('visible')) {
        return;
    }

    const spawnTime = Number(clickTarget.dataset.spawnTime);
    const reaction = (Date.now() - spawnTime) / 1000;
    metrics.clicks.count += 1;
    metrics.clicks.reactionTimes.push(reaction);
    metrics.clicks.timeline.push({ x: Date.now(), y: reaction });

    clickCountEl.textContent = metrics.clicks.count;
    const average = metrics.clicks.reactionTimes.reduce((a, b) => a + b, 0) / metrics.clicks.reactionTimes.length;
    reactionTimeEl.textContent = `${average.toFixed(2)} c`;
    tableReaction.textContent = `${average.toFixed(2)} c`;
    sessionLog.click.clicks = metrics.clicks.count;
    sessionLog.click.reactionAverage = average;

    clickTarget.classList.remove('visible');
    clickRoundsRemaining -= 1;

    if (clickRoundsRemaining > 0) {
        clickTimeoutId = setTimeout(spawnTarget, 600 + Math.random() * 800);
    } else {
        concludeClickTest();
    }

    refreshCharts();
    updateAdminDashboard();
});

const scrollSpeedsWindow = [];
scrollContainer.addEventListener('scroll', () => {
    const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    const progress = (scrollContainer.scrollTop / maxScroll) * 100;
    scrollProgress.style.width = `${progress}%`;

    const now = Date.now();

    if (!sessionLog.scroll.start) {
        sessionLog.scroll.start = now;
    }

    if (
        scrollTargetMarker &&
        scrollContainer.scrollTop + scrollContainer.clientHeight >=
            scrollTargetMarker.offsetTop + scrollTargetMarker.offsetHeight / 2
    ) {
        scrollTargetMarker.classList.add('reached');
        if (!scrollTestCompleted) {
            scrollTestCompleted = true;
            sessionLog.scroll.end = now;
            sessionLog.scroll.duration = sessionLog.scroll.start
                ? (sessionLog.scroll.end - sessionLog.scroll.start) / 1000
                : 0;
        }
    }

    if (!scrollContainer.lastScrollTime) {
        scrollContainer.lastScrollTime = now;
        scrollContainer.lastScrollTop = scrollContainer.scrollTop;
        return;
    }

    const deltaTime = (now - scrollContainer.lastScrollTime) / 1000;
    const deltaScroll = Math.abs(scrollContainer.scrollTop - scrollContainer.lastScrollTop);
    if (deltaTime > 0) {
        const speed = deltaScroll / deltaTime;
        scrollSpeedsWindow.push(speed);
        if (scrollSpeedsWindow.length > 30) {
            scrollSpeedsWindow.shift();
        }
        metrics.scroll.speeds.push(speed);
        const avgSpeed = scrollSpeedsWindow.reduce((a, b) => a + b, 0) / scrollSpeedsWindow.length;
        metrics.scroll.timeline.push({ x: now, y: avgSpeed });
        const mean = avgSpeed;
        const variance = scrollSpeedsWindow.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / scrollSpeedsWindow.length;
        metrics.scroll.variance = variance;
        sessionLog.scroll.averageSpeed = avgSpeed;
        sessionLog.scroll.variance = variance;
        scrollSpeedEl.textContent = `${avgSpeed.toFixed(0)} px/c`;
        scrollVarianceEl.textContent = variance.toFixed(2);
        tableScroll.textContent = `${avgSpeed.toFixed(0)} px/c`;
    }

    scrollContainer.lastScrollTime = now;
    scrollContainer.lastScrollTop = scrollContainer.scrollTop;

    refreshCharts();
    updateAdminDashboard();
});

interactionElements.forEach((el) => {
    el.addEventListener('click', () => registerInteraction('click'));
    el.addEventListener('input', () => registerInteraction('input'));
    el.addEventListener('change', () => registerInteraction('change'));
    el.addEventListener('focus', () => registerInteraction('focus'));
});

interactionElements.forEach((el) => {
    el.addEventListener('mouseenter', () => {
        metrics.interactions.hover += 1;
        hoverCountEl.textContent = metrics.interactions.hover;
        sessionLog.interactions.hover = metrics.interactions.hover;
        registerInteraction('hover');
    });
});

if (sliderValueEl) {
    const slider = document.getElementById('focusSlider');
    slider.addEventListener('input', (event) => {
        sliderValueEl.textContent = event.target.value;
    });
}

if (arrowButtons.length) {
    const keyDirectionMap = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right'
    };

    arrowButtons.forEach((button) => {
        const direction = button.dataset.direction;
        if (direction) {
            arrowButtonMap[direction] = button;
        }

        button.addEventListener('click', (event) => {
            event.preventDefault();
        });

        button.addEventListener('keydown', (event) => {
            if (!direction) {
                return;
            }
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                logArrowDirection(direction);
            }
        });
    });

    document.addEventListener('keydown', (event) => {
        const direction = keyDirectionMap[event.key];
        if (!direction) {
            return;
        }

        const target = event.target;
        if (target) {
            const tagName = target.tagName;
            const isTypingField = tagName === 'INPUT' || tagName === 'TEXTAREA';
            if (isTypingField || target.isContentEditable) {
                return;
            }
        }

        event.preventDefault();
        logArrowDirection(direction);
    });
}

function logArrowDirection(direction) {
    const now = Date.now();

    if (!direction) {
        registerInteraction('arrow');
        return;
    }

    metrics.arrows.total += 1;
    metrics.arrows.counts[direction] = (metrics.arrows.counts[direction] || 0) + 1;
    metrics.arrows.lastTimestamp = now;
    if (!metrics.arrows.firstTimestamp) {
        metrics.arrows.firstTimestamp = now;
    }

    if (!sessionLog.arrows.start) {
        sessionLog.arrows.start = now;
    }
    sessionLog.arrows.end = now;
    sessionLog.arrows.total = metrics.arrows.total;
    sessionLog.arrows.counts[direction] = metrics.arrows.counts[direction];

    animateArrowButton(direction);
    updateArrowCounters();
    registerInteraction('arrow');
}

function animateArrowButton(direction) {
    const button = arrowButtonMap[direction];
    if (!button) {
        return;
    }

    button.classList.add('active');
    clearTimeout(arrowActiveTimers[direction]);
    arrowActiveTimers[direction] = setTimeout(() => {
        button.classList.remove('active');
    }, 200);
}

function registerInteraction(type) {
    const now = Date.now();
    metrics.interactions.total += 1;
    if (interactionCountEl) {
        interactionCountEl.textContent = metrics.interactions.total;
    }
    metrics.interactions.types[type] = (metrics.interactions.types[type] || 0) + 1;

    if (!metrics.interactions.firstTimestamp) {
        metrics.interactions.firstTimestamp = now;
    }
    metrics.interactions.lastTimestamp = now;
    metrics.interactions.duration = (metrics.interactions.lastTimestamp - metrics.interactions.firstTimestamp) / 1000;
    if (interactionDurationEl) {
        interactionDurationEl.textContent = `${metrics.interactions.duration.toFixed(1)} c`;
    }
    metrics.interactions.timeline.push({ x: now, y: metrics.interactions.total });
    if (tableInteractions) {
        tableInteractions.textContent = metrics.interactions.total;
    }
    if (!sessionLog.interactions.start) {
        sessionLog.interactions.start = now;
    }
    sessionLog.interactions.end = now;
    sessionLog.interactions.duration = metrics.interactions.duration;
    sessionLog.interactions.total = metrics.interactions.total;

    refreshCharts();
    updateAdminDashboard();
}

function updateArrowCounters() {
    if (arrowUpCountEl) {
        arrowUpCountEl.textContent = metrics.arrows.counts.up;
    }
    if (arrowDownCountEl) {
        arrowDownCountEl.textContent = metrics.arrows.counts.down;
    }
    if (arrowLeftCountEl) {
        arrowLeftCountEl.textContent = metrics.arrows.counts.left;
    }
    if (arrowRightCountEl) {
        arrowRightCountEl.textContent = metrics.arrows.counts.right;
    }
    if (tableArrows) {
        tableArrows.textContent = metrics.arrows.total > 0 ? formatArrowBreakdown() : '–';
    }
}

function formatArrowBreakdown() {
    const { up, down, left, right } = metrics.arrows.counts;
    return `↑: ${up} | ↓: ${down} | ←: ${left} | →: ${right}`;
}

document.addEventListener('mousemove', trackMouseMovement, { passive: true });

function trackMouseMovement(event) {
    const now = Date.now();
    const mouse = metrics.mouse;

    if (!mouse.start) {
        mouse.start = now;
        sessionLog.mouse.start = now;
    }

    if (mouse.lastX !== null && mouse.lastY !== null) {
        const deltaX = event.clientX - mouse.lastX;
        const deltaY = event.clientY - mouse.lastY;
        mouse.distance += Math.hypot(deltaX, deltaY);
    }

    mouse.lastX = event.clientX;
    mouse.lastY = event.clientY;
    mouse.events += 1;
    mouse.lastEvent = now;

    sessionLog.mouse.events = mouse.events;
    sessionLog.mouse.distance = mouse.distance;
    sessionLog.mouse.end = now;
    if (!sessionLog.mouse.start) {
        sessionLog.mouse.start = mouse.start;
    }
}

function initCharts() {
    const baseOptions = {
        responsive: true,
        animation: false,
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'second'
                },
                ticks: {
                    color: '#94a3b8'
                },
                grid: {
                    color: 'rgba(148, 163, 184, 0.12)'
                }
            },
            y: {
                ticks: {
                    color: '#94a3b8'
                },
                grid: {
                    color: 'rgba(148, 163, 184, 0.08)'
                }
            }
        },
        plugins: {
            legend: {
                labels: {
                    color: '#e2e8f0'
                }
            }
        }
    };

    typingChart = new Chart(document.getElementById('typingChart'), {
        type: 'line',
        data: {
            datasets: [{
                label: 'Скорость ввода',
                data: [],
                borderColor: '#4caf50',
                backgroundColor: 'rgba(76, 175, 80, 0.25)',
                tension: 0.3,
                fill: true
            }]
        },
        options: baseOptions
    });

    clickChart = new Chart(document.getElementById('clickChart'), {
        type: 'line',
        data: {
            datasets: [{
                label: 'Реакция',
                data: [],
                borderColor: '#ff5722',
                backgroundColor: 'rgba(255, 87, 34, 0.25)',
                tension: 0.3,
                fill: true
            }]
        },
        options: baseOptions
    });

    scrollChart = new Chart(document.getElementById('scrollChart'), {
        type: 'line',
        data: {
            datasets: [{
                label: 'Скорость прокрутки',
                data: [],
                borderColor: '#2196f3',
                backgroundColor: 'rgba(33, 150, 243, 0.25)',
                tension: 0.3,
                fill: true
            }]
        },
        options: baseOptions
    });

    sessionChart = new Chart(document.getElementById('sessionChart'), {
        type: 'bar',
        data: {
            labels: ['Интеракции', 'Ошибки', 'Клики'],
            datasets: [{
                label: 'Сводка',
                data: [0, 0, 0],
                backgroundColor: ['#4caf50', '#ff5722', '#2196f3'],
                borderRadius: 12
            }]
        },
        options: {
            responsive: true,
            animation: false,
            scales: {
                x: {
                    ticks: { color: '#94a3b8' },
                    grid: { display: false }
                },
                y: {
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(148, 163, 184, 0.12)' }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function refreshCharts() {
    if (!typingChart) return;

    typingChart.data.datasets[0].data = metrics.typing.timeline;
    typingChart.update('none');

    clickChart.data.datasets[0].data = metrics.clicks.timeline;
    clickChart.update('none');

    scrollChart.data.datasets[0].data = metrics.scroll.timeline;
    scrollChart.update('none');

    sessionChart.data.datasets[0].data = [
        metrics.interactions.total,
        metrics.typing.errors,
        metrics.clicks.count
    ];
    sessionChart.update('none');
}

function updateAdminDashboard() {
    const now = Date.now();
    metrics.session.duration = (now - metrics.session.start) / 1000;
    if (sessionDurationEl) {
        sessionDurationEl.textContent = `${metrics.session.duration.toFixed(0)} c`;
    }

    const typingDuration = metrics.typing.duration;
    const averageReaction = metrics.clicks.reactionTimes.length
        ? metrics.clicks.reactionTimes.reduce((a, b) => a + b, 0) / metrics.clicks.reactionTimes.length
        : 0;
    const averageScrollSpeed = metrics.scroll.speeds.length
        ? metrics.scroll.speeds.reduce((a, b) => a + b, 0) / metrics.scroll.speeds.length
        : 0;

    const normalized = [
        normalize(typingDuration, 60),
        normalize(averageReaction, 2),
        normalize(averageScrollSpeed, 600),
        normalize(metrics.typing.errors, 12),
        normalize(metrics.interactions.total, 30)
    ];

    const botScore = normalized.reduce((sum, val) => sum + val, 0) / normalized.length;
    const botRate = Math.min(100, Math.max(0, botScore * 100));
    const humanRate = 100 - botRate;

    if (humanRateEl && botRateEl) {
        humanRateEl.textContent = `${humanRate.toFixed(0)}%`;
        botRateEl.textContent = `${botRate.toFixed(0)}%`;
    }
}

function normalize(value, expected) {
    if (!value) return 0;
    return Math.min(value / expected, 1);
}

function buildSessionEntries() {
    const now = Date.now();
    const entries = [];

    const typingStart = sessionLog.typing.start;
    const typingEnd = sessionLog.typing.end || (typingStart ? now : null);
    const typingDuration = sessionLog.typing.duration || (typingStart && typingEnd ? (typingEnd - typingStart) / 1000 : 0);
    const typingCharacters = sessionLog.typing.characters || metrics.typing.characters;
    const typingWpm = sessionLog.typing.wpm || (typingDuration > 0 && typingCharacters > 0
        ? ((typingCharacters / 5) / (typingDuration / 60))
        : 0);
    const typingHasData = Boolean(typingStart || typingCharacters > 0 || sessionLog.typing.errors > 0);

    const typingErrorsValue = typingHasData
        ? `${sessionLog.typing.errors}${sessionLog.typing.corrections ? ` (испр: ${sessionLog.typing.corrections})` : ''}`
        : '';

    entries.push({
        UserID: userId,
        TestType: 'TextEntry',
        StartTime: formatTimestamp(typingStart),
        EndTime: formatTimestamp(typingEnd),
        Speed: typingHasData && typingWpm ? `${typingWpm.toFixed(1)} wpm` : '',
        Errors: typingErrorsValue,
        Clicks: '',
        ScrollTime: '',
        Duration: typingHasData ? formatDuration(typingDuration) : ''
    });

    const clickStart = sessionLog.click.start;
    const clickEnd = sessionLog.click.end || (clickStart ? now : null);
    const clickDuration = clickStart && clickEnd ? (clickEnd - clickStart) / 1000 : 0;
    const clickHasData = Boolean(clickStart || sessionLog.click.clicks > 0);

    entries.push({
        UserID: userId,
        TestType: 'ImageClick',
        StartTime: formatTimestamp(clickStart),
        EndTime: formatTimestamp(clickEnd),
        Speed: clickHasData && sessionLog.click.reactionAverage ? `${sessionLog.click.reactionAverage.toFixed(2)}s` : '',
        Errors: '',
        Clicks: clickHasData ? sessionLog.click.clicks : '',
        ScrollTime: '',
        Duration: clickHasData ? formatDuration(clickDuration) : ''
    });

    const scrollStart = sessionLog.scroll.start;
    const scrollEnd = sessionLog.scroll.end || (scrollStart ? now : null);
    const scrollDuration = sessionLog.scroll.duration || (scrollStart && scrollEnd ? (scrollEnd - scrollStart) / 1000 : 0);
    const scrollHasData = Boolean(scrollStart || sessionLog.scroll.averageSpeed || sessionLog.scroll.variance);

    entries.push({
        UserID: userId,
        TestType: 'Scroll',
        StartTime: formatTimestamp(scrollStart),
        EndTime: formatTimestamp(scrollEnd),
        Speed: scrollHasData && sessionLog.scroll.averageSpeed ? `${sessionLog.scroll.averageSpeed.toFixed(0)} px/s` : '',
        Errors: '',
        Clicks: '',
        ScrollTime: scrollHasData ? formatDuration(scrollDuration) : '',
        Duration: scrollHasData ? formatDuration(scrollDuration) : ''
    });

    const interactionStart = sessionLog.interactions.start;
    const interactionEnd = sessionLog.interactions.end || (interactionStart ? now : null);
    const interactionDuration = sessionLog.interactions.duration || (interactionStart && interactionEnd
        ? (interactionEnd - interactionStart) / 1000
        : 0);
    const interactionHasData = Boolean(interactionStart || sessionLog.interactions.total > 0 || sessionLog.interactions.hover > 0);

    entries.push({
        UserID: userId,
        TestType: 'Interaction',
        StartTime: formatTimestamp(interactionStart),
        EndTime: formatTimestamp(interactionEnd),
        Speed: '',
        Errors: '',
        Clicks: interactionHasData ? sessionLog.interactions.total : '',
        ScrollTime: '',
        Duration: interactionHasData ? formatDuration(interactionDuration) : ''
    });

    const arrowsStart = sessionLog.arrows.start;
    const arrowsEnd = sessionLog.arrows.end || (arrowsStart ? now : null);
    const arrowsDuration = arrowsStart && arrowsEnd ? (arrowsEnd - arrowsStart) / 1000 : 0;
    const arrowsHasData = metrics.arrows.total > 0;

    entries.push({
        UserID: userId,
        TestType: 'ArrowButtons',
        StartTime: formatTimestamp(arrowsStart),
        EndTime: formatTimestamp(arrowsEnd),
        Speed: arrowsHasData ? formatArrowBreakdown() : '',
        Errors: '',
        Clicks: arrowsHasData ? metrics.arrows.total : '',
        ScrollTime: '',
        Duration: arrowsHasData ? formatDuration(arrowsDuration) : ''
    });

    const mouseStart = sessionLog.mouse.start || metrics.mouse.start;
    const mouseEnd = sessionLog.mouse.end || metrics.mouse.lastEvent;
    const mouseDurationSeconds = mouseStart && mouseEnd ? (mouseEnd - mouseStart) / 1000 : 0;
    const mouseHasData = Boolean(metrics.mouse.events);
    const mouseAverageSpeed = mouseHasData && metrics.session.duration > 0
        ? metrics.mouse.distance / metrics.session.duration
        : 0;

    entries.push({
        UserID: userId,
        TestType: 'MouseMovement',
        StartTime: formatTimestamp(mouseStart),
        EndTime: formatTimestamp(mouseEnd),
        Speed: mouseHasData && mouseAverageSpeed > 0 ? `${mouseAverageSpeed.toFixed(2)} px/s` : '',
        Errors: '',
        Clicks: mouseHasData ? metrics.mouse.events : '',
        ScrollTime: '',
        Duration: mouseHasData ? formatDuration(mouseDurationSeconds) : ''
    });

    return entries;
}

function formatTimestamp(value) {
    if (!value) return '';
    return new Date(value).toISOString();
}

function formatDuration(seconds) {
    if (!seconds || Number.isNaN(seconds)) {
        return '';
    }
    return `${seconds.toFixed(2)}s`;
}

function finalizeSession() {
    if (!finishBtn) {
        return;
    }

    const entries = buildSessionEntries();
    const hasAnyData = entries.some((entry) =>
        Boolean(entry.StartTime || entry.EndTime || entry.Speed || entry.Errors || entry.Clicks || entry.ScrollTime || entry.Duration)
    );

    if (finishMessage) {
        finishMessage.classList.remove('success', 'error');
        finishMessage.textContent = '';
    }

    if (!hasAnyData) {
        if (finishMessage) {
            finishMessage.textContent = 'Нет собранных данных для сохранения.';
            finishMessage.classList.add('error');
        }
        return;
    }

    if (finishBtn.disabled && finishBtn.textContent === 'Сохранено') {
        return;
    }

    finishBtn.disabled = true;
    finishBtn.textContent = 'Сохранение...';

    if (typeof fetch !== 'function') {
        if (finishMessage) {
            finishMessage.textContent = 'Автосохранение недоступно в этом браузере.';
            finishMessage.classList.add('error');
        }
        finishBtn.disabled = false;
        finishBtn.textContent = 'Завершить';
        return;
    }

    fetch('/api/session', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(entries)
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error('Сервер вернул ошибку');
            }
            return response.json ? response.json().catch(() => ({})) : {};
        })
        .then(() => {
            finishBtn.textContent = 'Сохранено';
            if (finishMessage) {
                finishMessage.textContent = 'Спасибо за участие! Ваши данные были сохранены.';
                finishMessage.classList.add('success');
            }
        })
        .catch((error) => {
            console.error('Ошибка сохранения данных', error);
            finishBtn.disabled = false;
            finishBtn.textContent = 'Завершить';
            if (finishMessage) {
                finishMessage.textContent = 'Не удалось сохранить данные. Попробуйте ещё раз.';
                finishMessage.classList.add('error');
            }
        });
}

function tickSession() {
    updateAdminDashboard();
    requestAnimationFrame(tickSession);
}

window.addEventListener('load', () => {
    initCharts();
    highlightTyping('');
    updateArrowCounters();
    tickSession();
});
