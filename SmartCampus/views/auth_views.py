from functools import wraps

from flask import Blueprint, redirect, render_template, session, url_for

bp = Blueprint('auth', __name__)


def login_required(view):
    # 로그인 안 한 사용자는 홈으로 보냄 - 다른 파트에서도 import해서 사용
    # from views.auth_views import login_required
    @wraps(view)
    def wrapped(*args, **kwargs):
        if session.get('user_id') is None:
            return redirect(url_for('auth.index'))
        return view(*args, **kwargs)
    return wrapped


# 페이지
@bp.route('/')
def index():
    return render_template('index.html')


@bp.route('/settings')
def settings():
    # 로그인 백엔드 완성 후 @login_required 추가 예정
    return render_template('settings.html')


# 회원가입, 로그인·로그아웃

@bp.route('/auth/register', methods=['POST'])
def register():
    # 구현 예정
    return redirect(url_for('auth.index'))


@bp.route('/auth/login', methods=['POST'])
def login():
    # 구현 예정
    return redirect(url_for('auth.index'))


@bp.route('/auth/logout')
def logout():
    session.clear()
    return redirect(url_for('auth.index'))