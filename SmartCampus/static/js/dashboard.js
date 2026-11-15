/* 홈 대시보드: 로그인한 사람의 시험 · 과제 · 프로젝트는 /api/dashboard(views/auth_views.py)에서 불러옴 */

(function () {
    'use strict';

    const $ = (sel) => document.querySelector(sel);

    const MAX_HOME_PROJECTS = 3;
    let homeData = null;

    async function loadHomeData() {
        if (!loadUser()) return null;
        try {
            const res = await fetch('/api/dashboard', { headers: { Accept: 'application/json' } });
            const data = await res.json();
            return data.ok ? data : null;
        } catch {
            return null;
        }
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
        const exam = homeData ? homeData.nearestExam : null;
        nearestExam = exam && new Date(exam.at).getTime() > Date.now() ? exam : null;

        const badge = $('#ddayBadge');
        if (!nearestExam) {
            badge.textContent = '-';
            badge.classList.remove('is-urgent');
            $('#ddayExamName').textContent = homeData ? '예정된 시험이 없어요' : '로그인하면 시험 D-Day를 볼 수 있어요';
            $('#ddayExamDate').textContent = homeData ? '시험 스케줄러에서 시험을 추가해 보세요.' : '';
        } else {
            const diff = calcDday(nearestExam.at);
            badge.textContent = formatDday(diff);
            badge.classList.toggle('is-urgent', diff <= 3); // 3일 이내면 테두리로 강조
            $('#ddayExamName').textContent = nearestExam.name;
            $('#ddayExamDate').textContent = formatExamDate(nearestExam.at);
        }
        renderPomoGoal();
    }

    // 2-2. 워크스페이스 알리미
    function renderTaskWidget() {
        const tasks = homeData ? homeData.tasks : null;
        const doingCount = tasks ? tasks.doingCount : 0;

        // "2건"에서 숫자만 크게, "건"은 작게
        const badge = $('#taskCountBadge');
        badge.textContent = doingCount;
        const unit = document.createElement('small');
        unit.textContent = '건';
        badge.appendChild(unit);

        if (!tasks) {
            $('#taskTopTitle').textContent = '로그인하면 내 과제를 볼 수 있어요';
            $('#taskCountDesc').textContent = '오른쪽 위 [로그인 / 회원가입]';
            return;
        }
        $('#taskTopTitle').textContent = tasks.nearestTitle || '진행 중인 과제가 없어요';
        $('#taskCountDesc').textContent = tasks.total
            ? `총 ${tasks.total}건 중 진행 중 과제 수`
            : '아직 맡은 과제가 없어요.';
    }

    // 3-2. 참여 중인 팀 프로젝트 목록
    const TONES = ['blue', 'green', 'purple'];
    const ICONS = ['fa-laptop', 'fa-chart-column', 'fa-lightbulb'];

    function formatDueDate(dateString) {
        const [, month, day] = (dateString || '').split('-');
        return month && day ? `${Number(month)}/${Number(day)}` : '';
    }

    function renderProjects() {
        const list = $('#projectList');
        list.replaceChildren();

        if (!homeData) {
            list.innerHTML = '<p class="dh-empty">로그인하면 참여 중인 프로젝트를 볼 수 있어요.</p>';
            return;
        }
        const projects = homeData.projects;
        if (!projects.length) {
            list.innerHTML = '<p class="dh-empty">아직 참여 중인 프로젝트가 없어요.<br><a href="/workspace">워크스페이스에서 프로젝트 만들기</a></p>';
            return;
        }
        projects.slice(0, MAX_HOME_PROJECTS).forEach((p, index) => {
            const tone = TONES[index % TONES.length];
            const item = document.createElement('div');
            item.className = `dh-project tone-${tone}`;
            item.innerHTML = `
                <div class="dh-project-icon"><i class="fas"></i></div>
                <div>
                    <div class="dh-project-name"></div>
                    <div class="dh-project-meta"></div>
                </div>
                <a class="dh-enter">입장하기</a>`;
            // 사용자 입력이 들어갈 수 있는 값은 textContent로 넣음 (XSS 방지)
            item.querySelector('.fas').classList.add(ICONS[index % ICONS.length]);
            item.querySelector('.dh-project-name').textContent = p.name;
            const due = formatDueDate(p.dueDate);
            item.querySelector('.dh-project-meta').textContent =
                `참여자 ${p.memberCount}/${p.maxMembers}명` + (due ? ` · 마감 ${due}` : '');
            item.querySelector('.dh-enter').href = `/workspace/project/${encodeURIComponent(p.id)}`;
            list.appendChild(item);
        });

        if (projects.length > MAX_HOME_PROJECTS) {
            const more = document.createElement('a');
            more.className = 'dh-project-more';
            more.href = '/workspace';
            more.textContent = `+ ${projects.length - MAX_HOME_PROJECTS}개 프로젝트 더 보기`;
            list.appendChild(more);
        }
    }

    async function refreshHomeData() {
        homeData = await loadHomeData();
        renderExamWidget();
        renderTaskWidget();
        renderProjects();
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
        refreshHomeData();
        initPomodoro();

        // 상단바에서 로그인,로그아웃하면 배너 인사말 갱신
        document.addEventListener('sch:auth', () => {
            renderUser();
            refreshHomeData();
        });

        // 자정이 지나면 D-Day가 바뀌므로 1분마다 다시 계산
        setInterval(renderExamWidget, 60000);
    });
})();