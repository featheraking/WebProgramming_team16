"""시험 스케줄러: 팀의 기존 6개 테이블과 화면 상태를 연결합니다."""
import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pymysql
from flask import Blueprint, current_app, jsonify, render_template, request, session
from db import execute, get_db, query
from views.auth_views import login_required

bp = Blueprint('scheduler', __name__, url_prefix='/scheduler')
KST = timezone(timedelta(hours=9))
STATUSES = {'unknown', 'unsure', 'done'}


def today():
    return datetime.now(KST).date().isoformat()


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)


def revision(state):
    return hashlib.sha256(encode(state).encode()).hexdigest()


def decode(value):
    return json.loads(value) if isinstance(value, str) else value


def local_datetime(value):
    result = datetime.fromisoformat(value)
    if result.tzinfo:
        result = result.astimezone(KST).replace(tzinfo=None)
    return result


def load_state(uid):
    exams = query('SELECT * FROM exams WHERE user_id = %s ORDER BY id', (uid,))
    scopes = query('SELECT s.* FROM exam_scopes s JOIN exams e ON e.id = s.exam_id '
                   'WHERE e.user_id = %s ORDER BY s.sort_order, s.id', (uid,))
    parts = {}
    for s in scopes:
        parts.setdefault(s['exam_id'], []).append(dict(id=s['id'], title=s['title'], status=s['status']))
    plan = query('SELECT * FROM daily_study_plans WHERE user_id = %s AND plan_date = %s',
                 (uid, today()), one=True)
    items = query('SELECT i.*, s.title, s.exam_id, e.name AS exam_name FROM study_plan_items i '
                  'JOIN exam_scopes s ON s.id = i.scope_id JOIN exams e ON e.id = s.exam_id '
                  'WHERE i.plan_id = %s AND e.user_id = %s ORDER BY i.sort_order, i.id',
                  (plan['id'], uid)) if plan else []
    records = query('SELECT * FROM study_records WHERE user_id = %s ORDER BY saved_at, id', (uid,))
    timer = query('SELECT * FROM active_study_timers WHERE user_id = %s', (uid,), one=True)
    state = dict(
        exams=[dict(id=e['id'], name=e['name'], at=e['exam_at'].isoformat(timespec='minutes'),
                    formats=decode(e['formats']), traits=decode(e['traits']), readiness=str(e['readiness']),
                    scopes=parts.get(e['id'], [])) for e in exams],
        plan=[dict(itemId=i['id'], examId=i['exam_id'], scopeId=i['scope_id'], title=i['title'],
                   examName=i['exam_name'], status=i['status_at_plan'], minutes=i['minutes'],
                   done=bool(i['is_recorded'])) for i in items],
        records=[dict(id=r['id'], examId=r['exam_id'], scopeId=r['scope_id'], title=r['title'],
                      day=r['study_date'].isoformat(), seconds=r['seconds'], status=r['result'],
                      expected=r['expected_minutes'], studyType=r['study_type']) for r in records],
        budget=plan['budget_minutes'] if plan else 180, planDay=today(), timer=None)
    if timer:
        state['timer'] = dict(title=timer['title'], examId=timer['exam_id'], scopeId=timer['scope_id'],
                             expected=timer['expected_minutes'] or 0, elapsed=timer['accumulated_ms'],
                             started=int(timer['last_started_at'].replace(tzinfo=KST).timestamp()*1000)
                             if timer['last_started_at'] else 0, running=bool(timer['is_running']))
    if records:
        r = records[-1]
        state['lastResult'] = dict(title=r['title'], seconds=r['seconds'], expected=r['expected_minutes'] or 0,
                                   day=r['study_date'].isoformat())
    return state


def require(condition, message):
    if not condition:
        raise ValueError(message)


def valid_id(value):
    require(isinstance(value, str) and str(UUID(value)) == value, 'ID는 소문자 UUID여야 합니다.')


def title(value, limit=150):
    require(isinstance(value, str) and 0 < len(value.strip()) <= limit, '제목의 길이를 확인해 주세요.')


def integer(value, low, high):
    require(type(value) is int and low <= value <= high, '시간 또는 숫자 범위를 확인해 주세요.')


def validate(state, old):
    require(isinstance(state, dict), 'state 객체가 필요합니다.')
    for key, limit in [('exams', 100), ('plan', 1000), ('records', 10000)]:
        require(isinstance(state.get(key), list) and len(state[key]) <= limit, '데이터 개수가 너무 많습니다.')
    integer(state.get('budget'), 1, 1440)
    require(state.get('planDay') == today(), '날짜가 바뀌었습니다. 새로 불러와 주세요.')
    exams, scopes = {}, {}
    for e in state['exams']:
        valid_id(e['id']); title(e['name'], 100)
        require(e['id'] not in exams, '시험 ID가 중복됩니다.')
        require(isinstance(e['at'], str) and 1000 <= local_datetime(e['at']).year <= 9999, '시험 날짜를 확인해 주세요.')
        require(str(e['readiness']) in {'0', '1', '2'}, '준비 상태가 잘못되었습니다.')
        for key, allowed in [('formats', {'객관식', '단답형', '서술형'}),
                             ('traits', {'문제은행형', '암기형', '계산형', '개념형'})]:
            values = e[key]
            require(isinstance(values, list) and 1 <= len(values) <= len(allowed)
                    and all(isinstance(v, str) and v in allowed for v in values)
                    and len(set(values)) == len(values), '시험 유형이 잘못되었습니다.')
        require(isinstance(e['scopes'], list) and 1 <= len(e['scopes']) <= 100, '범위는 1~100개입니다.')
        exams[e['id']] = e
        for s in e['scopes']:
            valid_id(s['id']); title(s['title'])
            require(s['id'] not in scopes and s['status'] in STATUSES, '범위 ID나 상태가 잘못되었습니다.')
            scopes[s['id']] = e['id']
    pairs, item_ids = set(), set()
    for p in state['plan']:
        require(p['examId'] in exams and scopes.get(p['scopeId']) == p['examId'], '계획의 시험·범위를 확인해 주세요.')
        pair = (p['examId'], p['scopeId'])
        require(pair not in pairs, '공부 항목이 중복됩니다.'); pairs.add(pair)
        integer(p['minutes'], 1, 1440)
        require(type(p['done']) is bool and p['status'] in STATUSES, '계획 상태가 잘못되었습니다.')
        if p.get('itemId'):
            valid_id(p['itemId'])
            require(p['itemId'] not in item_ids, '계획 항목 ID가 중복됩니다.')
            item_ids.add(p['itemId'])
    previous = {r['id']: r for r in old['records']}
    ids = set()
    for r in state['records']:
        valid_id(r['id']); title(r['title'])
        require(r['id'] not in ids, '기록 ID가 중복됩니다.'); ids.add(r['id'])
        if r['id'] in previous:
            require(r == previous[r['id']], '기존 공부 기록은 수정할 수 없습니다.')
            continue
        require(r['day'] == today(), '공부 기록 날짜를 확인해 주세요.')
        integer(r['seconds'], 0, 31536000)
        require(r.get('status') is None or r['status'] in STATUSES, '공부 결과가 잘못되었습니다.')
        if r.get('examId') is not None:
            require(r['examId'] in exams and scopes.get(r.get('scopeId')) == r['examId']
                    and r.get('status') in STATUSES, '공부 기록의 범위가 잘못되었습니다.')
            integer(r.get('expected'), 1, 1440)
        else:
            require(r.get('scopeId') is None and r.get('status') is None, '자유 공부 결과가 잘못되었습니다.')
    require(set(previous) <= ids, '기존 공부 기록은 삭제할 수 없습니다.')
    t = state.get('timer')
    if t is not None:
        title(t['title']); integer(t['expected'], 0, 1440)
        integer(t['elapsed'], 0, 31536000000); integer(t['started'], 0, 253402268399000)
        require(type(t['running']) is bool, '타이머 상태가 잘못되었습니다.')
        require((t.get('examId') is None and t.get('scopeId') is None) or
                (t.get('examId') in exams and scopes.get(t.get('scopeId')) == t.get('examId')),
                '진행 중인 범위를 삭제할 수 없습니다.')
    if old['timer'] and t is not None:
        require(state['exams'] == old['exams'] and state['plan'] == old['plan'],
                '진행 중에는 시험과 계획을 변경할 수 없습니다.')


def persist(uid, state, old):
    old_exams = {e['id']: e for e in old['exams']}
    old_scopes = {s['id']: e['id'] for e in old['exams'] for s in e['scopes']}
    new_scopes = set()
    for e in state['exams']:
        args = (e['name'], local_datetime(e['at']), encode(e['formats']), encode(e['traits']), int(e['readiness']))
        if e['id'] in old_exams:
            execute('UPDATE exams SET name=%s, exam_at=%s, formats=%s, traits=%s, readiness=%s '
                    'WHERE id=%s AND user_id=%s', args+(e['id'], uid))
        else:
            execute('INSERT INTO exams (name,exam_at,formats,traits,readiness,id,user_id) VALUES (%s,%s,%s,%s,%s,%s,%s)', args+(e['id'], uid))
        for order, s in enumerate(e['scopes']):
            new_scopes.add(s['id'])
            if s['id'] in old_scopes:
                require(old_scopes[s['id']] == e['id'], '범위를 다른 시험으로 이동할 수 없습니다.')
                execute('UPDATE exam_scopes SET title=%s,status=%s,sort_order=%s WHERE id=%s AND exam_id=%s',
                        (s['title'], s['status'], order, s['id'], e['id']))
            else:
                execute('INSERT INTO exam_scopes (id,exam_id,title,status,sort_order) VALUES (%s,%s,%s,%s,%s)',
                        (s['id'], e['id'], s['title'], s['status'], order))
    for sid in old_scopes.keys() - new_scopes:
        execute('DELETE FROM exam_scopes WHERE id=%s AND exam_id=%s', (sid, old_scopes[sid]))
    for eid in old_exams.keys() - {e['id'] for e in state['exams']}:
        execute('DELETE FROM exams WHERE id=%s AND user_id=%s', (eid, uid))
    plan = query('SELECT id FROM daily_study_plans WHERE user_id=%s AND plan_date=%s', (uid, today()), one=True)
    pid = plan['id'] if plan else str(uuid4())
    if plan:
        execute('UPDATE daily_study_plans SET budget_minutes=%s WHERE id=%s AND user_id=%s', (state['budget'], pid, uid))
    else:
        execute('INSERT INTO daily_study_plans (id,user_id,plan_date,budget_minutes) VALUES (%s,%s,%s,%s)',
                (pid, uid, today(), state['budget']))
    execute('DELETE FROM study_plan_items WHERE plan_id=%s', (pid,))
    item_ids = {}
    for order, p in enumerate(state['plan']):
        item_id = p.get('itemId') or str(uuid4())
        item_ids[p['scopeId']] = item_id
        execute('INSERT INTO study_plan_items (id,plan_id,scope_id,sort_order,minutes,status_at_plan,is_recorded) '
                'VALUES (%s,%s,%s,%s,%s,%s,%s)', (item_id, pid, p['scopeId'], order, p['minutes'], p['status'], p['done']))
    existing_records = {r['id'] for r in old['records']}
    for r in state['records']:
        if r['id'] not in existing_records:
            execute('INSERT INTO study_records (id,user_id,exam_id,scope_id,study_type,title,study_date,seconds,expected_minutes,result) '
                    'VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',
                    (r['id'], uid, r.get('examId'), r.get('scopeId'), 'planned' if r.get('examId') else 'free',
                     r['title'], r['day'], r['seconds'], r.get('expected') if r.get('examId') else None, r.get('status')))
    execute('DELETE FROM active_study_timers WHERE user_id=%s', (uid,))
    t = state.get('timer')
    if t:
        started = datetime.fromtimestamp(t['started']/1000, KST).replace(tzinfo=None)
        execute('INSERT INTO active_study_timers (user_id,exam_id,scope_id,plan_item_id,title,expected_minutes,'
                'accumulated_ms,last_started_at,is_running) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)',
                (uid, t.get('examId'), t.get('scopeId'), item_ids.get(t.get('scopeId')), t['title'],
                 t['expected'] or None, t['elapsed'], started, t['running']))


@bp.route('')
@login_required
def index():
    return render_template('exam-scheduler-team.html')


@bp.route('/api/state', methods=['GET', 'PUT'])
def api_state():
    uid = session.get('user_id')
    if uid is None:
        return jsonify(error='로그인이 필요합니다.'), 401
    token = session.setdefault('scheduler_csrf', secrets.token_urlsafe(32))
    if request.method == 'PUT' and not secrets.compare_digest(token, request.headers.get('X-CSRF-Token', '')):
        return jsonify(error='로그인 정보가 변경되었습니다. 새로고침해 주세요.'), 403
    if request.method == 'PUT' and (request.content_length is None or request.content_length > 2_000_000):
        return jsonify(error='요청 크기는 2MB 이하여야 합니다.'), 413
    conn = None
    try:
        conn = get_db()
        conn.begin()
        # 같은 회원의 변경을 직렬화합니다. 공통 db.py는 수정하지 않습니다.
        require(query('SELECT id FROM users WHERE id=%s FOR UPDATE', (uid,), one=True), '회원이 존재하지 않습니다.')
        old = load_state(uid)
        if request.method == 'PUT':
            payload = request.get_json(silent=True)
            require(isinstance(payload, dict), 'JSON 요청이 필요합니다.')
            if payload.get('revision') != revision(old):
                conn.rollback()
                return jsonify(error='다른 탭에서 수정했거나 날짜가 바뀌었습니다. 다시 불러와 주세요.'), 409
            state = payload.get('state')
            validate(state, old)
            persist(uid, state, old)
        result = load_state(uid) if request.method == 'PUT' else old
        conn.commit()
        response = jsonify(state=result, revision=revision(result), csrf_token=token)
        response.headers['Cache-Control'] = 'no-store'
        return response
    except (ValueError, TypeError, KeyError, AttributeError, OverflowError):
        if conn: conn.rollback()
        return jsonify(error='입력값 또는 데이터 연결이 잘못되었습니다. 다시 불러온 뒤 확인해 주세요.'), 400
    except pymysql.err.IntegrityError:
        if conn: conn.rollback()
        return jsonify(error='ID가 중복되거나 데이터 연결이 변경되었습니다. 다시 불러와 주세요.'), 409
    except pymysql.MySQLError:
        if conn: conn.rollback()
        current_app.logger.exception('Scheduler database error')
        return jsonify(error='DB 연결과 스케줄러 테이블을 확인해 주세요.'), 503
