import re
import sys
from pathlib import Path

import pymysql

from config import Config

SCHEMA = Path(__file__).with_name('schema.sql')


def split_statements(sql):
    # 주석(-- ...)을 빼고 ; 기준으로 SQL 문장 나눔
    lines = [line for line in sql.splitlines() if not line.strip().startswith('--')]
    text = re.sub(r'\s--\s.*', '', '\n'.join(lines))  # 줄 끝 주석 제거
    return [s.strip() for s in text.split(';') if s.strip()]


def main():
    statements = split_statements(SCHEMA.read_text(encoding='utf-8'))

    if '--yes' not in sys.argv:
        answer = input(f"'{Config.DB_NAME}' DB를 생성. 기존 데이터는 삭제. ")
        return

    try:
        conn = pymysql.connect(host=Config.DB_HOST, port=Config.DB_PORT, user=Config.DB_USER,
                               password=Config.DB_PASSWORD, charset='utf8mb4', autocommit=True)
    except pymysql.err.OperationalError as e:
        code = e.args[0]
        if code == 1045:
            print('[오류] 비밀번호가 틀림! .env의 DB_USER / DB_PASSWORD 확인할 것. ')
        elif code == 2003:
            print('[오류] MySQL에 연결할 수 없음. MySQL이 켜져 있는지(서비스 MySQL80 실행 중인 상태) 확인할 것.')
        else:
            print('[오류] 연결 실패:', e)
        sys.exit(1)

    with conn, conn.cursor() as cur:
        for stmt in statements:
            cur.execute(stmt)
        cur.execute(f'USE `{Config.DB_NAME}`')
        cur.execute('SHOW TABLES')
        tables = [row[0] for row in cur.fetchall()]

    # 완료 되었을 때
    print(f"'{Config.DB_NAME}' 준비 완료 — 테이블 {len(tables)}개: {', '.join(tables)}")


if __name__ == '__main__':
    main()
