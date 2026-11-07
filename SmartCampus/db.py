import pymysql
from flask import current_app, g

def get_db():
    # 요청마다 DB 연결을 하나 만들고, 같은 요청 안에서는 재사용
    if 'db' not in g:
        cfg = current_app.config
        g.db = pymysql.connect(
            host=cfg['DB_HOST'],
            port=cfg['DB_PORT'],
            user=cfg['DB_USER'],
            password=cfg['DB_PASSWORD'],
            database=cfg['DB_NAME'],
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor,  # {'컬럼명': 값} 형태
            autocommit=True,
        )
    return g.db


def close_db(exception=None):
    conn = g.pop('db', None)
    if conn is not None:
        conn.close()


def init_app(app):
    app.teardown_appcontext(close_db)


def query(sql, params=None, one=False):
    # SELECT : 결과 목록(또는 one=True면 한 줄) 반환
    with get_db().cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone() if one else cur.fetchall()


def execute(sql, params=None):
    # INSERT / UPDATE / DELETE : 새로 만든 행의 id 반환
    with get_db().cursor() as cur:
        cur.execute(sql, params)
        return cur.lastrowid