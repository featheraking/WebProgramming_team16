/* 
    [현재 구현] 서버가 없으므로 로그인 된 척만 하고 이름,학번을 브라우저에 저장 (비밀번호는 저장 안 함)
    [Flask 연동시]PROTOTYPE_MODE를 false로 바꾸면 폼이 /auth/login, /auth/register로 실제 전송됨.

    다른 페이지에서 로그인 정보가 필요하면:
     const user = SCH.getUser(); // 없으면 null
     document.addEventListener('sch:auth', (e) => e.detail); // 로그인,로그아웃할 때마다 호출 */

(function () {
    'use strict';

    const PROTOTYPE_MODE = true;
    const USER_KEY = 'smart-campus-demo-user'; // 지금 로그인한 사람
    const ACCOUNTS_KEY = 'smart-campus-demo-accounts'; // 가입한 사람들 (아이디 → 이름·학번, 비밀번호 제외)

    function read(key) {
        try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
    }
    function getUser() {
        return read(USER_KEY);
    }
    function saveAccount(user) {
        const accounts = read(ACCOUNTS_KEY) || {};
        accounts[user.username] = user;
        try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts)); } catch { /* 무시 */ }
    }
    function setUser(user) {
        try {
            if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
            else localStorage.removeItem(USER_KEY);
        } catch { /* 저장 불가 환경이면 무시 */ }
        renderAuth();
    }


    // 1. 사이드바 현재 메뉴 표시
    // 같은 파일을 가리키는 메뉴가 여러 개면 주소의 #까지 같은 메뉴를, 없으면 그 파일의 첫 번째 메뉴를 표시
    function markActiveMenu() {
        const currentFile = location.pathname.split('/').pop() || 'index.html';
        const links = [...document.querySelectorAll('#sidenavAccordion .nav-link')];
        const parse = (link) => {
            const [path, hash = ''] = (link.getAttribute('href') || '').split('#');
            return { file: path.split('?')[0].split('/').pop(), hash: hash ? '#' + hash : '' };
        };
        const candidates = links.filter((link) => parse(link).file === currentFile);
        const activeLink = candidates.find((link) => parse(link).hash && parse(link).hash === location.hash)
            || candidates[0];

        links.forEach((link) => {
            const active = link === activeLink;
            link.classList.toggle('active', active);
            if (active) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
    }

    // 2. 로그인 상태 표시
    function renderAuth() {
        const user = getUser();
        document.body.classList.toggle('is-logged-in', !!user);
        const nameEl = document.getElementById('schUserName');
        if (nameEl) nameEl.textContent = user ? `${user.name}님 환영합니다` : '';
        document.dispatchEvent(new CustomEvent('sch:auth', { detail: user }));
    }

    function hideLoginDropdown() {
        const toggle = document.querySelector('#schGuest [data-bs-toggle="dropdown"]');
        if (toggle) bootstrap.Dropdown.getOrCreateInstance(toggle).hide();
    }

    function initLogin() {
        const form = document.getElementById('schLoginForm');
        if (!form) return;
        form.addEventListener('submit', (e) => {
            if (!form.checkValidity()) {
                e.preventDefault();
                form.classList.add('was-validated');
                return;
            }
            if (!PROTOTYPE_MODE) return; // 실제 서버로 전송
            e.preventDefault();
            const username = form.username.value.trim();
            const accounts = read(ACCOUNTS_KEY) || {};
            // 가입한 아이디면 그 정보를 쓰고, 없으면 아이디를 이름 대신 표시 (비밀번호는 확인하지 않음)
            setUser(accounts[username]
                || { username, name: username, studentId: '', department: 'AI소프트웨어학부', semester: '2026년 2학기' });
            form.reset();
            form.classList.remove('was-validated');
            hideLoginDropdown();
        });
    }

    function initRegister() {
        const modalEl = document.getElementById('schRegisterModal');
        const form = document.getElementById('schRegisterForm');
        if (!modalEl || !form) return;
        const errorBox = document.getElementById('schRegisterError');
        const showError = (msg) => {
            errorBox.textContent = msg;
            errorBox.classList.toggle('d-none', !msg);
        };

        modalEl.addEventListener('show.bs.modal', hideLoginDropdown);
        modalEl.addEventListener('hidden.bs.modal', () => {
            form.reset();
            form.classList.remove('was-validated');
            showError('');
        });

        form.addEventListener('submit', (e) => {
            const match = form.password.value === form.password_confirm.value;
            form.password_confirm.setCustomValidity(match ? '' : '비밀번호가 일치하지 않습니다.');
            if (!form.checkValidity()) {
                e.preventDefault();
                form.classList.add('was-validated');
                showError(match ? '입력값을 다시 확인해 주세요.' : '비밀번호가 일치하지 않습니다.');
                return;
            }
            if (!PROTOTYPE_MODE) return;
            e.preventDefault();
            const user = {
                username: form.username.value.trim(),
                name: form.name.value.trim(),
                studentId: form.student_id.value.trim(),
                department: 'AI소프트웨어학부',
                semester: '2026년 2학기',
            };
            saveAccount(user);
            setUser(user);
            bootstrap.Modal.getOrCreateInstance(modalEl).hide();
        });
    }

    function initLogout() {
        document.querySelectorAll('.sch-logout').forEach((link) => {
            link.addEventListener('click', (e) => {
                if (!PROTOTYPE_MODE) return; // 실제로 /auth/logout 이동
                e.preventDefault();
                setUser(null);
            });
        });
    }

    window.SCH = { getUser };

    window.addEventListener('DOMContentLoaded', () => {
        markActiveMenu();
        window.addEventListener('hashchange', markActiveMenu);
        initLogin();
        initRegister();
        initLogout();
        renderAuth();
    });
})();
