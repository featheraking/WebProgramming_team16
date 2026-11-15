from functools import wraps

import re

import pymysql
from flask import Blueprint, jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

from db import execute, query

bp = Blueprint('auth', __name__)


USER_COLUMNS = 'id, username, name, student_id, email, department, semester'


def get_current_user():
    user_id = session.get('user_id')
    if user_id is None:
        return None
    return query(f'SELECT {USER_COLUMNS} FROM users WHERE id = %s', (user_id,), one=True)


def to_public(user):
    if not user:
        return None
    return {
        'id': user['id'],
        'username': user['username'],
        'name': user['name'],
        'studentId': user['student_id'],
        'email': user['email'],
        'department': user['department'],
        'semester': user['semester'],
    }


def form_data():
    return request.get_json(silent=True) or request.form


def fail(message, status=400):
    return jsonify({'ok': False, 'error': message}), status


@bp.app_context_processor
def inject_current_user():
    try:
        return {'current_user': to_public(get_current_user())}
    except pymysql.MySQLError:
        return {'current_user': None}


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
    data = form_data()
    name = (data.get('name') or '').strip()
    student_id = (data.get('student_id') or '').strip()
    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip()
    password = data.get('password') or ''
    password_confirm = data.get('password_confirm') or ''

    if not all([name, student_id, username, email, password]):
        return fail('모든 항목을 입력해 주세요.')
    if not re.fullmatch(r'\d{8}', student_id):
        return fail('학번은 숫자 8자리로 입력해 주세요.')
    if len(username) < 4:
        return fail('아이디는 4자 이상이어야 해요.')
    if not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', email):
        return fail('이메일 형식이 올바르지 않아요.')
    if len(password) < 8:
        return fail('비밀번호는 8자 이상이어야 해요.')
    if password != password_confirm:
        return fail('비밀번호가 일치하지 않아요.')

    duplicate = query(
        'SELECT username, student_id, email FROM users WHERE username = %s OR student_id = %s OR email = %s',
        (username, student_id, email), one=True)
    if duplicate:
        if duplicate['username'] == username:
            return fail('이미 사용 중인 아이디예요.', 409)
        if duplicate['student_id'] == student_id:
            return fail('이미 가입된 학번이에요.', 409)
        return fail('이미 가입된 이메일이에요.', 409)

    user_id = execute(
        'INSERT INTO users (username, password_hash, name, student_id, email) VALUES (%s, %s, %s, %s, %s)',
        (username, generate_password_hash(password), name, student_id, email))

    session.clear()
    session['user_id'] = user_id
    return jsonify({'ok': True, 'user': to_public(get_current_user())}), 201


@bp.route('/auth/login', methods=['POST'])
def login():
    data = form_data()
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    if not username or not password:
        return fail('아이디와 비밀번호를 입력해 주세요.')

    user = query('SELECT id, password_hash FROM users WHERE username = %s', (username,), one=True)
    if not user or not check_password_hash(user['password_hash'], password):
        return fail('아이디 또는 비밀번호가 올바르지 않아요.', 401)

    session.clear()
    session['user_id'] = user['id']
    session.permanent = bool(data.get('remember'))
    return jsonify({'ok': True, 'user': to_public(get_current_user())})


@bp.route('/auth/me')
def me():
    return jsonify({'ok': True, 'user': to_public(get_current_user())})

# 작성중

DOING_STATUSES = ('progress', '진행 중')


@bp.route('/api/dashboard')
def dashboard_data():
    user_id = session.get('user_id')
    if user_id is None:
        return fail('로그인이 필요해요.', 401)

    exam = query(
        '''SELECT name, exam_at FROM exams
           WHERE user_id = %s AND exam_at > NOW()
           ORDER BY exam_at LIMIT 1''',
        (user_id,), one=True)

    projects = query(
        '''SELECT p.id, p.name, p.due_date, p.max_members,
                  (SELECT COUNT(*) FROM project_members m2 WHERE m2.project_id = p.id) AS member_count
           FROM projects p
           JOIN project_members m ON m.project_id = p.id
           WHERE m.user_id = %s
           ORDER BY p.due_date IS NULL, p.due_date, p.name''',
        (user_id,))

    tasks = query(
        '''SELECT t.title, t.status, t.due_date
           FROM project_tasks t
           JOIN task_assignees a ON a.task_id = t.id
           WHERE a.user_id = %s AND t.is_active = TRUE''',
        (user_id,))

    doing = sorted((t for t in tasks if t['status'] in DOING_STATUSES),
                   key=lambda t: (t['due_date'] is None, t['due_date'] or ''))

    return jsonify({
        'ok': True,
        'nearestExam': {
            'name': exam['name'],
            'at': exam['exam_at'].isoformat(),
        } if exam else None,
        'projects': [{
            'id': p['id'],
            'name': p['name'],
            'dueDate': p['due_date'].isoformat() if p['due_date'] else None,
            'memberCount': p['member_count'],
            'maxMembers': p['max_members'],
        } for p in projects],
        'tasks': {
            'total': len(tasks),
            'doingCount': len(doing),
            'nearestTitle': doing[0]['title'] if doing else None,
        },
    })

@bp.route('/auth/logout')
def logout():
    session.clear()
    return redirect(url_for('auth.index'))