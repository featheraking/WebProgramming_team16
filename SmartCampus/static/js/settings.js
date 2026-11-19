/* 설정 페이지: 내 정보 수정, 비밀번호 변경 (서버: views/auth_views.py) */

(function () {
    'use strict';

    function showMessage(box, text, ok) {
        box.textContent = text;
        box.classList.toggle('d-none', !text);
        box.classList.toggle('alert-success', !!ok);
        box.classList.toggle('alert-danger', !ok);
    }

    async function send(form) {
        try {
            const res = await fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
                headers: { Accept: 'application/json' },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) return { error: data.error || '잠시 후 다시 시도해 주세요.' };
            return data;
        } catch {
            return { error: '서버에 연결할 수 없어요.' };
        }
    }

    function initForm(formId, messageId, { check, onSuccess }) {
        const form = document.getElementById(formId);
        const box = document.getElementById(messageId);
        const button = form.querySelector('[type="submit"]');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const problem = check ? check(form) : '';
            if (problem || !form.checkValidity()) {
                form.classList.add('was-validated');
                showMessage(box, problem || '입력값을 다시 확인해 주세요.', false);
                return;
            }
            button.disabled = true;
            const result = await send(form);
            button.disabled = false;
            if (result.error) {
                showMessage(box, result.error, false);
                return;
            }
            form.classList.remove('was-validated');
            onSuccess(form, box, result);
        });
    }

    window.addEventListener('DOMContentLoaded', () => {
        initForm('profileForm', 'profileMessage', {
            onSuccess(form, box, result) {
                if (window.SCH) SCH.setUser(result.user);
                showMessage(box, '저장했어요.', true);
            },
        });

        initForm('passwordForm', 'passwordMessage', {
            check(form) {
                const match = form.new_password.value === form.new_password_confirm.value;
                form.new_password_confirm.setCustomValidity(match ? '' : '새 비밀번호가 일치하지 않아요.');
                return match ? '' : '새 비밀번호가 일치하지 않아요.';
            },
            onSuccess(form, box) {
                form.reset();
                showMessage(box, '비밀번호를 바꿨어요. 다음 로그인부터 새 비밀번호를 써 주세요.', true);
            },
        });
    });
})();