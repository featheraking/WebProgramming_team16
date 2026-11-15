/*
    로그인 · 회원가입 · 로그아웃 (서버: views/auth_views.py)

    다른 페이지에서 로그인 정보가 필요하면:
     const user = SCH.getUser(); // 없으면 null
     document.addEventListener('sch:auth', (e) => e.detail); // 로그인,로그아웃할 때마다 호출 */

(function () {
    'use strict';

    let currentUser = window.SCH_CURRENT_USER || null;

    function getUser() {
        return currentUser;
    }
    function setUser(user) {
        currentUser = user || null;
        renderAuth();
    }

    async function postForm(form) {
        try {
            const res = await fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
                headers: { Accept: 'application/json' },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) return { error: data.error || '잠시 후 다시 시도해 주세요.' };
            return { user: data.user };
        } catch {
            return { error: '서버에 연결할 수 없어요.' };
        }
    }

    function showMessage(box, msg) {
        if (!box) return;
        box.textContent = msg;
        box.classList.toggle('d-none', !msg);
    }

    // 1. 사이드바 현재 메뉴 표시
    function markActiveMenu() {
        const current = location.pathname.replace(/\/+$/, '') || '/';
        const links = [...document.querySelectorAll('#sidenavAccordion .nav-link')];
        const pathOf = (link) => (link.getAttribute('href') || '').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
        const matches = links.filter((link) => {
            const path = pathOf(link);
            return path === '/' ? current === '/' : current === path || current.startsWith(path + '/');
        });
        const activeLink = matches.sort((a, b) => pathOf(b).length - pathOf(a).length)[0];

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
        const errorBox = document.getElementById('schLoginError');
        const submitBtn = form.querySelector('[type="submit"]');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            showMessage(errorBox, '');
            if (!form.checkValidity()) {
                form.classList.add('was-validated');
                return;
            }
            submitBtn.disabled = true;
            const { user, error } = await postForm(form);
            submitBtn.disabled = false;
            if (error) {
                showMessage(errorBox, error);
                return;
            }
            form.reset();
            form.classList.remove('was-validated');
            hideLoginDropdown();
            setUser(user);
        });
    }

    function initRegister() {
        const modalEl = document.getElementById('schRegisterModal');
        const form = document.getElementById('schRegisterForm');
        if (!modalEl || !form) return;
        const errorBox = document.getElementById('schRegisterError');
        const submitBtn = form.querySelector('[type="submit"]');

        modalEl.addEventListener('show.bs.modal', hideLoginDropdown);
        modalEl.addEventListener('hidden.bs.modal', () => {
            form.reset();
            form.classList.remove('was-validated');
            showMessage(errorBox, '');
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const match = form.password.value === form.password_confirm.value;
            form.password_confirm.setCustomValidity(match ? '' : '비밀번호가 일치하지 않습니다.');
            if (!form.checkValidity()) {
                form.classList.add('was-validated');
                showMessage(errorBox, match ? '입력값을 다시 확인해 주세요.' : '비밀번호가 일치하지 않습니다.');
                return;
            }
            showMessage(errorBox, '');
            submitBtn.disabled = true;
            const { user, error } = await postForm(form);
            submitBtn.disabled = false;
            if (error) {
                showMessage(errorBox, error);
                return;
            }
            bootstrap.Modal.getOrCreateInstance(modalEl).hide();
            setUser(user);
        });
    }

    window.SCH = { getUser };

    window.addEventListener('DOMContentLoaded', () => {
        markActiveMenu();
        initLogin();
        initRegister();
        renderAuth();
    });
})();