/* 데이터는 샘플 + 브라우저 저장소에서 읽음. */
/* Flask에서 아래 데이터 계층의 함수들만 fetch('/api/...')으로 바꿀 예정 */

(function () {
    'use strict';

    const $ = (sel) => document.querySelector(sel);

    // 시험 스케줄러(exam-scheduler.js) 저장 키
    const EXAM_STORAGE_KEY = 'smart-campus-exams-v1';

    // ---------------------------------------------------------------
    // 데이터 계층 (Flask에서 수정할 예정)
    const SAMPLE_EXAMS = [
        { name: '웹프로그래밍', at: daysFromToday(3, 9, 0) },
        { name: '자료구조', at: daysFromToday(6, 13, 0) },
        { name: '선형대수', at: daysFromToday(10, 9, 0) },
    ];
    // ---------------------------------------------------------------

    // icon: Font Awesome 아이콘 이름, tone: blue | green | purple
    const SAMPLE_PROJECTS = [
        { id: 1, name: '캠퍼스 생활 편의 앱 기획', members: 4, progress: 70, icon: 'fa-laptop', tone: 'green' },
        { id: 2, name: 'AI 기반 학습 도우미', members: 5, progress: 45, icon: 'fa-chart-column', tone: 'blue' },
        { id: 3, name: '캠퍼스 보안 시스템', members: 3, progress: 30, icon: 'fa-lightbulb', tone: 'purple' },
    ];

    // 워크스페이스 칸반의 3단 상태: todo | doing | done (내게 배정된 과제만)
    const SAMPLE_TASKS = [
        { title: 'AI 서비스 기획안 작성', projectId: 2, status: 'doing', due: daysFromToday(2, 23, 59) },
        { title: '화면 설계서 정리', projectId: 1, status: 'doing', due: daysFromToday(4, 23, 59) },
        { title: '보안 요구사항 조사', projectId: 3, status: 'todo', due: daysFromToday(7, 23, 59) },
        { title: '주제 선정 회의록 작성', projectId: 1, status: 'done', due: daysFromToday(-3, 23, 59) },
    ];

    function daysFromToday(days, hour, minute) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        d.setHours(hour, minute, 0, 0);
        return d.toISOString();
    }

    function safeGet(key) {
        try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
    }

    /** 시험 목록: 스케줄러에 등록된 시험이 있으면 사용 (없으면 샘플 사용) */
    function loadExams() {
        const saved = safeGet(EXAM_STORAGE_KEY);
        if (saved && Array.isArray(saved.exams) && saved.exams.length) {
            return { exams: saved.exams.map((e) => ({ name: e.name, at: e.at })), isSample: false };
        }
        return { exams: SAMPLE_EXAMS, isSample: true };
    }

    function loadProjects() {
        return SAMPLE_PROJECTS;
    }

    function loadTasks() {
        return SAMPLE_TASKS;
    }

    // 로그인 정보는 공통 틀 스크립트(js/frame.js)가 관리
    function loadUser() {
        return window.SCH ? SCH.getUser() : null;
    }


    
    // 1. 환영 배너 & 로그인 상태
    function renderUser() {
        const user = loadUser();
        const loggedIn = !!user;

        $('#heroGreeting').textContent = loggedIn ? `안녕하세요, ${user.name}님! 🎓` : '안녕하세요! 🎓';
        $('#heroSub').textContent = loggedIn
            ? '오늘도 더 나은 내일을 위해, 함께 성장해요.'
            : '로그인하고 나만의 학업 대시보드를 확인하세요.';
        $('#heroDept').textContent = loggedIn && user.department ? user.department : '학과 정보 없음';
        $('#heroSemester').textContent = loggedIn && user.semester ? user.semester : '학기 정보 없음';
    }

    // 2-1. 시험 플래너 위젯 (D-Day)
    let nearestExam = null;

    /** 날짜 기준 D-Day 계산 (시각 무시, 오늘 시험이면 D-Day) */
    function calcDday(dateString) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(dateString);
        target.setHours(0, 0, 0, 0);
        return Math.round((target - today) / 86400000);
    }

    function formatDday(diff) {
        if (diff === 0) return 'D-Day';
        return diff > 0 ? `D-${diff}` : `D+${-diff}`;
    }

    function formatExamDate(dateString) {
        const d = new Date(dateString);
        const pad = (n) => String(n).padStart(2, '0');
        const week = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
        return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${week}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function renderExamWidget() {
        const { exams, isSample } = loadExams();
        const now = Date.now();
        const upcoming = exams
            .filter((e) => new Date(e.at).getTime() > now)
            .sort((a, b) => new Date(a.at) - new Date(b.at));
        nearestExam = upcoming[0] || null;

        const badge = $('#ddayBadge');
        if (!nearestExam) {
            badge.textContent = '-';
            badge.classList.remove('is-urgent');
            $('#ddayExamName').textContent = '예정된 시험이 없어요';
            $('#ddayExamDate').textContent = '시험 스케줄러에서 시험을 추가해 보세요.';
        } else {
            const diff = calcDday(nearestExam.at);
            badge.textContent = formatDday(diff);
            badge.classList.toggle('is-urgent', diff <= 3); // 3일 이내면 테두리로 강조
            $('#ddayExamName').textContent = nearestExam.name;
            $('#ddayExamDate').textContent = formatExamDate(nearestExam.at) + (isSample ? ' · 샘플' : '');
        }
        renderPomoGoal();
    }

    // 2-2. 워크스페이스 알리미
    function renderTaskWidget() {
        const tasks = loadTasks();
        const doing = tasks
            .filter((t) => t.status === 'doing')
            .sort((a, b) => new Date(a.due) - new Date(b.due));

        // "2건"에서 숫자만 크게, "건"은 작게
        const badge = $('#taskCountBadge');
        badge.textContent = doing.length;
        const unit = document.createElement('small');
        unit.textContent = '건';
        badge.appendChild(unit);

        $('#taskTopTitle').textContent = doing.length ? doing[0].title : '진행 중인 과제가 없어요';
        $('#taskCountDesc').textContent = tasks.length
            ? `총 ${tasks.length}건 중 진행 중 과제 수`
            : '참여 코드로 팀플 방에 입장해 보세요.';
    }

    // 3-2. 참여 중인 팀 프로젝트 목록
    const TONES = ['blue', 'green', 'purple'];

    function renderProjects() {
        const projects = loadProjects();
        const list = $('#projectList');
        list.replaceChildren();

        if (!projects.length) {
            list.innerHTML = '<p class="dh-empty">참여 코드로 팀플 방에 입장해 보세요.</p>';
            return;
        }
        projects.forEach((p) => {
            const tone = TONES.includes(p.tone) ? p.tone : 'blue';
            const item = document.createElement('div');
            item.className = `dh-project tone-${tone}`;
            item.innerHTML = `
                <div class="dh-project-icon"><i class="fas"></i></div>
                <div>
                    <div class="dh-project-name"></div>
                    <div class="dh-project-meta"></div>
                    <div class="dh-progress">
                        <div class="dh-progress-track"><div class="dh-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"></div></div>
                        <span class="dh-progress-num"></span>
                    </div>
                </div>
                <a class="dh-enter">입장하기</a>`;
            // 사용자 입력이 들어갈 수 있는 값은 textContent로 넣음 (XSS 방지)
            item.querySelector('.fas').classList.add(/^fa-[a-z0-9-]+$/.test(p.icon) ? p.icon : 'fa-folder');
            item.querySelector('.dh-project-name').textContent = p.name;
            item.querySelector('.dh-project-meta').textContent = `팀 프로젝트 · ${p.members}명`;
            item.querySelector('.dh-progress-num').textContent = `${p.progress}%`;
            const bar = item.querySelector('.dh-progress-bar');
            bar.style.width = `${p.progress}%`;
            bar.setAttribute('aria-valuenow', p.progress);
            item.querySelector('.dh-enter').href = `workspace.html?project=${encodeURIComponent(p.id)}`;
            list.appendChild(item);
        });
    }

    // 3-1. 뽀모도로 타이머
    const RING_LENGTH = 552.92; // 원 둘레 2πr (r=88) (dashboard.css와 같은 값)
    const MODES = {
        focus: { minutes: 25, label: '집중 시간', startLabel: '집중 시작', statusRunning: '집중하는 중이에요. 화이팅!' },
        break: { minutes: 5, label: '휴식 시간', startLabel: '휴식 시작', statusRunning: '잠시 쉬어 가요.' },
    };
    const pomo = {
        mode: 'focus',
        remaining: MODES.focus.minutes * 60, // 남은 초
        endAt: null, // 실행 중일 때 종료 시각(ms)
        intervalId: null,
    };
    const baseTitle = document.title;

    function renderPomoGoal() {
        $('#pomoGoal').textContent = nearestExam ? `목표: ${nearestExam.name} 🎯` : '목표: 자유 공부';
    }

    function renderClock() {
        const total = MODES[pomo.mode].minutes * 60;
        const mm = String(Math.floor(pomo.remaining / 60)).padStart(2, '0');
        const ss = String(pomo.remaining % 60).padStart(2, '0');
        $('#pomoClock').textContent = `${mm}:${ss}`;
        $('#pomoLabel').textContent = MODES[pomo.mode].label;

        // 링: 시간이 흐를수록 채워짐 (offset 552.92 = 빈 원, 0 = 꽉 찬 원)
        const elapsedRatio = (total - pomo.remaining) / total;
        $('#pomoRing').style.strokeDashoffset = RING_LENGTH * (1 - elapsedRatio);

        document.title = pomo.intervalId ? `${mm}:${ss} · ${baseTitle}` : baseTitle;
    }

    function renderStartButton() {
        const btn = $('#pomoStartBtn');
        if (pomo.intervalId) {
            btn.innerHTML = '<i class="fas fa-pause"></i>일시정지';
        } else {
            const resumed = pomo.remaining < MODES[pomo.mode].minutes * 60;
            btn.innerHTML = `<i class="fas fa-play"></i>${resumed ? '계속하기' : MODES[pomo.mode].startLabel}`;
        }
    }

    function tick() {
        // setInterval은 탭이 백그라운드일 때 느려지므로 종료 시각 기준으로 계산
        pomo.remaining = Math.max(0, Math.round((pomo.endAt - Date.now()) / 1000));
        renderClock();
        if (pomo.remaining === 0) finishSession();
    }

    function startTimer() {
        if (pomo.remaining === 0) pomo.remaining = MODES[pomo.mode].minutes * 60;
        pomo.endAt = Date.now() + pomo.remaining * 1000;
        pomo.intervalId = setInterval(tick, 250);
        $('#pomoStatus').textContent = MODES[pomo.mode].statusRunning;
        renderClock();
        renderStartButton();
    }

    function pauseTimer() {
        clearInterval(pomo.intervalId);
        pomo.intervalId = null;
        $('#pomoStatus').textContent = '일시정지했어요.';
        renderClock();
        renderStartButton();
    }

    function resetTimer() {
        clearInterval(pomo.intervalId);
        pomo.intervalId = null;
        pomo.remaining = MODES[pomo.mode].minutes * 60;
        $('#pomoStatus').textContent = '준비되면 시작 버튼을 눌러 주세요.';
        renderClock();
        renderStartButton();
    }

    function setMode(mode) {
        pomo.mode = mode;
        $('#pomoCard').dataset.mode = mode; // CSS가 휴식 모드일 때 초록색으로 바꿈
        document.querySelectorAll('#pomoTabs button').forEach((tab) => {
            const active = tab.dataset.mode === mode;
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-selected', active);
        });
        resetTimer();
    }

    function finishSession() {
        const wasFocus = pomo.mode === 'focus';
        clearInterval(pomo.intervalId);
        pomo.intervalId = null;
        beep();
        // 집중이 끝나면 휴식으로, 휴식이 끝나면 집중으로 자동 전환 (자동 시작은 하지 않음)
        setMode(wasFocus ? 'break' : 'focus');
        $('#pomoStatus').textContent = wasFocus
            ? '집중 25분 완료! 5분 휴식을 시작해 보세요.'
            : '휴식 끝! 다시 집중해 볼까요?';
    }

    function beep() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            osc.frequency.value = 880;
            osc.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
        } catch { /* 소리 재생 불가 시 무시 */ }
    }

    function initPomodoro() {
        document.querySelectorAll('#pomoTabs button').forEach((tab) => {
            tab.addEventListener('click', () => {
                if (tab.dataset.mode === pomo.mode) return;
                if (pomo.intervalId && !confirm('진행 중인 타이머를 멈추고 전환할까요?')) return;
                setMode(tab.dataset.mode);
            });
        });
        $('#pomoStartBtn').addEventListener('click', () => (pomo.intervalId ? pauseTimer() : startTimer()));
        $('#pomoResetBtn').addEventListener('click', resetTimer);
        renderClock();
        renderStartButton();
    }



    // 시작
    window.addEventListener('DOMContentLoaded', () => {
        renderUser();
        renderExamWidget();
        renderTaskWidget();
        renderProjects();
        initPomodoro();

        // 상단바에서 로그인,로그아웃하면 배너 인사말 갱신
        document.addEventListener('sch:auth', renderUser);

        // 자정이 지나면 D-Day가 바뀌므로 1분마다 다시 계산
        setInterval(renderExamWidget, 60000);
        // 다른 탭에서 시험 스케줄러를 수정하면 즉시 반영
        window.addEventListener('storage', (e) => {
            if (e.key === EXAM_STORAGE_KEY) renderExamWidget();
        });
    });
})();