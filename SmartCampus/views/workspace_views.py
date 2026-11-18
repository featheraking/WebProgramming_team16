from flask import Blueprint, render_template, request, jsonify, session
from db import query, execute, get_db
from datetime import date, datetime
import pymysql

bp = Blueprint('workspace', __name__, url_prefix='/workspace')


@bp.route('')
def index():
    return render_template('workspace.html')


@bp.route('/project/<project_id>')
def project(project_id):
    return render_template('project.html', project_id=project_id)



# 날짜
def day(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat() 
    else:
        return value

def stamp(value):
    if isinstance(value, datetime):
        return value.strftime('%Y-%m-%d %H:%M')
    else:
        return value

# 에러 메세지
def api_error(message, status=400):
    data = {'error':message}
        
    return jsonify(data), status


# 세션 확인
def session_check():
    uid = session.get("user_id")
    
    if uid is None:
        return None, api_error("로그인이 필요합니다.", 401)
    
    return uid, None


# 권한 확인
def is_accessible(pid, owner=False):
    uid, error = session_check()
    if error:
        return None, error

    sql = ('SELECT 1 FROM projects WHERE id=%s AND owner_id=%s' if owner else
           'SELECT 1 FROM project_members WHERE project_id=%s AND user_id=%s')

    if not query(sql, (pid, uid), one=True):
        return None, api_error('접근 권한이 없습니다.', 403)

    return uid, None


# 담당자 id 확인
def assignee_ids(pid, values):
    if not isinstance(values, list) or any(type(v) is not int for v in values):
        return None
    
    ids = list(dict.fromkeys(values))
    allowed = {r['user_id'] for r in query('SELECT user_id FROM project_members WHERE project_id=%s', (pid,))}
    
    return ids if set(ids) <= allowed else None




## 프로젝트 관련 API

# 프로젝트 리스트
@bp.route('/api/projects', methods=['GET'])
def get_projects():
    uid, error = session_check()
    if uid is None:
        return jsonify([])
    
    if error:
        return error
    
    rows = query('''SELECT p.*,
        (SELECT COUNT(*) FROM project_tasks t WHERE t.project_id=p.id) AS task_count,
        (SELECT COUNT(*) FROM project_members x WHERE x.project_id=p.id) AS member_count
        FROM projects p JOIN project_members m ON m.project_id=p.id
        WHERE m.user_id=%s ORDER BY p.created_date DESC''', (uid,)
        )
    
    for r in rows:
        r['created_date'] = day(r['created_date'])
        r['due_date'] = day(r['due_date'])
        
    return jsonify(rows)


# 프로젝트 생성
@bp.route('/api/projects', methods=['POST'])
def create_project():
    uid, error = session_check()
    if error:
        return error
    
    d = request.get_json() or {}
    
    if not d.get('name') or not d.get('due_date') or not d.get('id') or not d.get('invite_code'):
        return api_error('프로젝트 정보를 입력해주세요.')
    
    if d.get('owner_id') != uid:
        return api_error('생성자 정보가 사용자 정보와 일치하지 않습니다.', 403)
    
    conn = get_db()
    
    try:
        conn.begin()
        execute('''INSERT INTO projects(id,name,description,due_date,owner_id,invite_code,max_members)
                   VALUES(%s,%s,%s,%s,%s,%s,%s)''',
                (d['id'], d['name'], d.get('description', ''), d['due_date'], uid,
                 d['invite_code'], d.get('max_members', 5)))
        
        execute('INSERT INTO project_members(project_id,user_id) VALUES(%s,%s)', (d['id'], uid))
        
        conn.commit()
    except pymysql.IntegrityError as exc:
        conn.rollback()
        
        if exc.args[0] == 1062 and 'invite_code' in str(exc).lower():
            return api_error('초대 코드가 중복되었습니다.', 409)
        
        return api_error('중복된 데이터입니다.', 409)
    except Exception:
        conn.rollback()
        raise
    
    return jsonify({'id': d['id']}), 201


# 프로젝트 참여
@bp.route('/api/projects/join', methods=['POST'])
def join_project():
    uid, error = session_check()
    if error:
        return error
    
    code = (request.get_json() or {}).get('invite_code')
    
    conn = get_db()
    try:
        conn.begin()
        p = query('SELECT id,max_members FROM projects WHERE invite_code=%s FOR UPDATE', (code,), one=True)
        
        if not p:
            conn.rollback()
            return api_error('프로젝트를 찾을 수 없습니다.', 404)
        
        if query('SELECT 1 FROM project_members WHERE project_id=%s AND user_id=%s', (p['id'], uid), one=True):
            conn.rollback()
            return api_error('이미 참여 중인 프로젝트입니다.', 409)
        
        count = query('SELECT COUNT(*) AS n FROM project_members WHERE project_id=%s', (p['id'],), one=True)['n']
        if count >= p['max_members']:
            conn.rollback()
            return api_error('프로젝트 인원이 가득 찼습니다.', 409)
        
        execute('INSERT INTO project_members(project_id,user_id) VALUES(%s,%s)', (p['id'], uid))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    
    return jsonify({'id': p['id']}), 201


# 프로젝트 정보
@bp.route('/api/projects/<pid>', methods=['GET'])
def get_project(pid):
    uid, error = is_accessible(pid)
    if error:
        return error
    
    p = query('SELECT * FROM projects WHERE id=%s', (pid,), one=True)
    p['created_date'] = day(p['created_date'])
    p['due_date'] = day(p['due_date'])
    p['members'] = query('''SELECT u.id,u.name FROM users u JOIN project_members m ON u.id=m.user_id
                             WHERE m.project_id=%s ORDER BY u.id''', (pid,))
    
    return jsonify(p)


# 프로젝트 정보 수정
@bp.route('/api/projects/<pid>', methods=['PATCH'])
def update_project(pid):
    uid, error = is_accessible(pid, owner=True)
    if error:
        return error
    
    d = request.get_json() or {}
    
    count = query('SELECT COUNT(*) AS n FROM project_members WHERE project_id=%s', (pid,), one=True)['n']
    
    if not d.get('name') or not d.get('due_date') or not isinstance(d.get('max_members'), int) or d['max_members'] < count:
        return api_error('수정 사항을 다시 확인해주세요.')
    
    execute('''UPDATE projects SET name=%s,description=%s,due_date=%s,max_members=%s WHERE id=%s''',
            (d['name'], d.get('description', ''), d['due_date'], d['max_members'], pid))
    
    return jsonify({'ok': True})


# 관리자 양도
@bp.route('/api/projects/<pid>/owner', methods=['PATCH'])
def transfer_owner(pid):
    uid, error = is_accessible(pid, owner=True)
    if error:
        return error
    
    target = (request.get_json() or {}).get('owner_id')
    
    if not query('SELECT 1 FROM project_members WHERE project_id=%s AND user_id=%s', (pid, target), one=True):
        return api_error('프로젝트 참여자가 아닙니다.')
    
    execute('UPDATE projects SET owner_id=%s WHERE id=%s', (target, pid))
    
    return jsonify({'ok': True})


# 초대 코드
@bp.route('/api/projects/<pid>/invite-code', methods=['POST'])
def regenerate_invite_code(pid):
    uid, error = is_accessible(pid, owner=True)
    if error:
        return error
    
    code = (request.get_json() or {}).get('invite_code')
    if not isinstance(code, str) or len(code) != 8:
        return api_error('초대 코드는 8자리여야 합니다.')
    
    try:
        execute('UPDATE projects SET invite_code=%s WHERE id=%s', (code, pid))
    except pymysql.IntegrityError as exc:
        if exc.args[0] == 1062:
            return api_error('초대 코드가 중복되었습니다.', 409)
        raise
    
    return jsonify({'ok': True})


# 프로젝트 탈퇴
@bp.route('/api/projects/<pid>/leave', methods=['POST'])
def leave_project(pid):
    uid, error = is_accessible(pid)
    if error:
        return error
    
    p = query('SELECT owner_id FROM projects WHERE id=%s', (pid,), one=True)
    
    if p['owner_id'] == uid:
        return api_error('관리자는 탈퇴할 수 없습니다.')
    
    execute('DELETE FROM project_members WHERE project_id=%s AND user_id=%s', (pid, uid))
    
    return jsonify({'ok': True})


# 강퇴
@bp.route('/api/projects/<pid>/members/<int:target>', methods=['DELETE'])
def kick_member(pid, target):
    uid, error = is_accessible(pid, owner=True)
    if error:
        return error
    
    if target == uid:
        return api_error('관리자는 강퇴될 수 없습니다.')
    
    execute('DELETE FROM project_members WHERE project_id=%s AND user_id=%s', (pid, target))
    
    return jsonify({'ok': True})



## 과제 관련 API

# 과제 리스트
@bp.route('/api/projects/<pid>/tasks', methods=['GET'])
def get_tasks(pid):
    uid, error = is_accessible(pid)
    if error:
        return error
    
    rows = query('SELECT * FROM project_tasks WHERE project_id=%s ORDER BY created_date DESC', (pid,))
    
    for t in rows:
        t['created_date'] = day(t['created_date'])
        t['due_date'] = day(t['due_date'])
        t['is_active'] = bool(t['is_active'])
        t['assignees'] = query('SELECT user_id,comment FROM task_assignees WHERE task_id=%s', (t['id'],))
    
    return jsonify(rows)


# 과제 생성
@bp.route('/api/projects/<pid>/tasks', methods=['POST'])
def create_task(pid):
    uid, error = is_accessible(pid)
    if error:
        return error
    
    d = request.get_json() or {}
    ids = assignee_ids(pid, d.get('assignees'))
    
    if not d.get('id') or not d.get('title') or ids is None:
        return api_error('과제 정보를 확인해주세요.')
    
    conn = get_db()
    try:
        conn.begin()
        execute('''INSERT INTO project_tasks(id,project_id,title,content,created_by,due_date,status)
                   VALUES(%s,%s,%s,%s,%s,%s,'todo')''',
                (d['id'], pid, d['title'], d.get('content', ''), uid, d.get('due_date')))
        
        for member in ids:
            execute('INSERT INTO task_assignees(task_id,user_id) VALUES(%s,%s)', (d['id'], member))
        
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    
    return jsonify({'id': d['id']}), 201


# 과제 정보 수정
@bp.route('/api/projects/<pid>/tasks/<tid>', methods=['PATCH'])
def update_task(pid, tid):
    uid, error = is_accessible(pid)
    if error:
        return error
    
    task = query('SELECT created_by FROM project_tasks WHERE id=%s AND project_id=%s', (tid, pid), one=True)
    if not task:
        return api_error('과제를 찾을 수 없습니다.', 404)
    
    assigned = query('SELECT 1 FROM task_assignees WHERE task_id=%s AND user_id=%s', (tid, uid), one=True)
    if task['created_by'] != uid and not assigned:
        return api_error('과제 수정 권한이 없습니다.', 403)
    
    d = request.get_json() or {}
    ids = assignee_ids(pid, d.get('assignees'))
    if not d.get('title') or d.get('status') not in ('todo', 'progress', 'done') or ids is None:
        return api_error('수정 사항을 다시 확인해주세요.')
    
    conn = get_db()
    try:
        conn.begin()
        execute('''UPDATE project_tasks SET title=%s,content=%s,due_date=%s,status=%s,is_active=%s
                   WHERE id=%s AND project_id=%s''',
                (d['title'], d.get('content', ''), d.get('due_date'), d['status'], bool(d.get('is_active', True)), tid, pid))
        
        if ids:
            marks = ','.join(['%s'] * len(ids))
            execute(f'DELETE FROM task_assignees WHERE task_id=%s AND user_id NOT IN ({marks})', (tid, *ids))
        else:
            execute('DELETE FROM task_assignees WHERE task_id=%s', (tid,))
        for member in ids:
            execute('INSERT IGNORE INTO task_assignees(task_id,user_id) VALUES(%s,%s)', (tid, member))
            
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    
    return jsonify({'ok': True})


# 코멘트 수정
@bp.route('/api/projects/<pid>/tasks/<tid>/memo', methods=['PATCH'])
def update_task_memo(pid, tid):
    uid, error = is_accessible(pid)
    if error:
        return error
    
    if not query('''SELECT 1 FROM task_assignees a JOIN project_tasks t ON t.id=a.task_id
                    WHERE a.task_id=%s AND a.user_id=%s AND t.project_id=%s''', (tid, uid, pid), one=True):
        return api_error('담당자만 자신의 메모를 수정할 수 있습니다.', 403)
    
    d = request.get_json() or {}
    execute('UPDATE task_assignees SET comment=%s WHERE task_id=%s AND user_id=%s', (d.get('comment', ''), tid, uid))
    
    return jsonify({'ok': True})



## 기록 관련 API

# 기록 리스트
@bp.route('/api/projects/<pid>/records', methods=['GET'])
def get_records(pid):
    uid, error = is_accessible(pid)
    if error:
        return error
    
    rows = query('SELECT * FROM project_records WHERE project_id=%s ORDER BY created_at DESC', (pid,))
    for r in rows:
        r['created_at'] = stamp(r['created_at'])
        r['updated_at'] = stamp(r['updated_at'])
        
        children = query('SELECT * FROM project_sub_records WHERE project_id=%s AND parent_id=%s ORDER BY created_at DESC', (pid, r['id']))
        for c in children:
            c['edited_at'] = stamp(c['updated_at']) if c['updated_at'] != c['created_at'] else None
            c['created_at'] = stamp(c['created_at'])
            c.pop('updated_at')
            if c['is_hidden'] and c['author_id'] != uid:
                c['content'] = '숨겨진 기록입니다.'
                
        r['children'] = children
        if r['is_hidden'] and r['author_id'] != uid:
            r['title'] = r['content'] = '숨겨진 기록입니다.'
            r['children'] = []
            
    return jsonify(rows)


# 기록 생성
@bp.route('/api/projects/<pid>/records', methods=['POST'])
def create_record(pid):
    uid, error = is_accessible(pid)
    if error:
        return error
    
    d = request.get_json() or {}
    if not d.get('id') or not d.get('title') or not d.get('content'):
        return api_error('기록 정보를 확인해주세요.')
    
    if d.get('author_id') != uid:
        return api_error('작성자만 수정할 수 있습니다.', 403)
    
    execute('INSERT INTO project_records(id,project_id,author_id,title,content) VALUES(%s,%s,%s,%s,%s)',
            (d['id'], pid, uid, d['title'], d['content']))
    
    return jsonify({'id': d['id']}), 201


# 기록 수정
@bp.route('/api/projects/<pid>/records/<rid>', methods=['PATCH'])
def update_record(pid, rid):
    uid, error = is_accessible(pid)
    if error:
        return error
    
    d = request.get_json() or {}
    if not d.get('title') or not d.get('content'):
        return api_error('기록 정보를 확인해주세요.')
    
    conn = get_db()
    try:
        conn.begin()
        old = query('SELECT author_id,title,content FROM project_records WHERE id=%s AND project_id=%s FOR UPDATE', (rid, pid), one=True)
        if not old:
            conn.rollback()
            return api_error('수정할 기록이 없습니다.', 403)
        
        if old['author_id'] != uid:
            conn.rollback()
            return api_error('작성자만 수정할 수 있습니다.', 403)
        
        if old['title'] != d['title'] or old['content'] != d['content']:
            execute('INSERT INTO project_record_histories(record_id,old_title,old_content) VALUES(%s,%s,%s)',
                    (rid, old['title'], old['content']))
            
        execute('UPDATE project_records SET title=%s,content=%s,is_hidden=%s WHERE id=%s AND project_id=%s',
                (d['title'], d['content'], bool(d.get('is_hidden')), rid, pid))
        
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    
    return jsonify({'ok': True})


# 기록 수정 이력
@bp.route('/api/projects/<pid>/records/<rid>/history', methods=['GET'])
def get_record_history(pid, rid):
    uid, error = is_accessible(pid)
    if error:
        return error
    
    record = query('SELECT author_id,is_hidden FROM project_records WHERE id=%s AND project_id=%s', (rid, pid), one=True)
    if not record:
        return api_error('기록을 찾을 수 없습니다.', 404)
    
    if record['is_hidden'] and record['author_id'] != uid:
        return api_error('다른 참여자의 숨긴 기록의 수정 이력은 볼 수 없습니다.', 403)
    
    rows = query('SELECT old_title,old_content,edited_at FROM project_record_histories WHERE record_id=%s ORDER BY edited_at DESC,id DESC', (rid,))
    for r in rows:
        r['edited_at'] = stamp(r['edited_at'])
        
    return jsonify(rows)


# 하위 기록 생성
@bp.route('/api/projects/<pid>/records/<rid>/children', methods=['POST'])
def create_child(pid, rid):
    uid, error = is_accessible(pid)
    if error:
        return error
    
    parent = query('SELECT author_id,is_hidden FROM project_records WHERE id=%s AND project_id=%s', (rid, pid), one=True)
    if not parent:
        return api_error('상위 기록을 찾을 수 없습니다.', 404)
    
    if parent['is_hidden'] and parent['author_id'] != uid:
        return api_error('숨겨진 기록에는 작성할 수 없습니다.', 403)
    
    d = request.get_json() or {}
    if not d.get('id') or not d.get('content'):
        return api_error('하위 기록 내용을 입력해주세요.')
    
    if d.get('author_id') != uid:
        return api_error('작성자 정보가 일치하지 않습니다.', 403)
    
    execute('INSERT INTO project_sub_records(id,project_id,parent_id,author_id,content) VALUES(%s,%s,%s,%s,%s)',
            (d['id'], pid, rid, uid, d['content']))
    
    return jsonify({'id': d['id']}), 201


# 하위 기록 수정
@bp.route('/api/projects/<pid>/children/<cid>', methods=['PATCH'])
def update_child(pid, cid):
    uid, error = is_accessible(pid)
    if error:
        return error
    
    row = query('SELECT author_id,content FROM project_sub_records WHERE id=%s AND project_id=%s', (cid, pid), one=True)
    if not row:
        return api_error('수정할 기록이 없습니다.', 403)
    
    if row['author_id'] != uid:
        return api_error('작성자만 수정할 수 있습니다.', 403)
    
    d = request.get_json() or {}
    if not d.get('content'):
        return api_error('내용을 입력해주세요.')
    
    if d['content'] != row['content']:
        execute('UPDATE project_sub_records SET content=%s,updated_at=NOW() WHERE id=%s AND project_id=%s', (d['content'], cid, pid))
        
    return jsonify({'ok': True})


# 숨김 상태 변환
@bp.route('/api/projects/<pid>/children/<cid>/hidden', methods=['PATCH'])
def toggle_child_hidden(pid, cid):
    uid, error = is_accessible(pid)
    if error:
        return error
    
    row = query('SELECT author_id FROM project_sub_records WHERE id=%s AND project_id=%s', (cid, pid), one=True)
    if not row or row['author_id'] != uid:
        return api_error('작성자만 숨김 상태를 바꿀 수 있습니다.', 403)
    
    d = request.get_json() or {}
    execute('UPDATE project_sub_records SET is_hidden=%s,updated_at=updated_at WHERE id=%s AND project_id=%s',
            (bool(d.get('is_hidden')), cid, pid))
    
    return jsonify({'ok': True})