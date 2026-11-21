"""읽기 전용 DB 연결·컬럼 확인. SmartCampus 폴더에서 python scheduler_check.py 실행."""
import sys
import pymysql
from flask import Flask
from config import Config
import db

REQUIRED = {
    'users': {'id'},
    'exams': {'id','user_id','name','exam_at','formats','traits','readiness','created_at','updated_at'},
    'exam_scopes': {'id','exam_id','title','status','sort_order','updated_at'},
    'daily_study_plans': {'id','user_id','plan_date','budget_minutes','created_at','updated_at'},
    'study_plan_items': {'id','plan_id','scope_id','sort_order','minutes','status_at_plan','is_recorded'},
    'study_records': {'id','user_id','exam_id','scope_id','study_type','title','study_date','seconds','expected_minutes','result','saved_at'},
    'active_study_timers': {'user_id','exam_id','scope_id','plan_item_id','title','expected_minutes','accumulated_ms','last_started_at','is_running'},
}


def main():
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    try:
        with app.app_context():
            connected = db.query('SELECT DATABASE() AS db_name, VERSION() AS version', one=True)
            print('연결 성공:', connected['db_name'], '/ MySQL', connected['version'])
            missing = False
            for table, columns in REQUIRED.items():
                rows = db.query('SELECT COLUMN_NAME AS col FROM information_schema.COLUMNS '
                                'WHERE TABLE_SCHEMA=%s AND TABLE_NAME=%s', (Config.DB_NAME, table))
                absent = columns - {r['col'] for r in rows}
                if absent:
                    missing = True
                    print('[확인 필요]', table, ':', ', '.join(sorted(absent)))
                else:
                    print('[OK]', table)
            print('데이터는 변경하지 않았습니다.')
            return 1 if missing else 0
    except pymysql.MySQLError as error:
        code = error.args[0] if error.args else 'unknown'
        print('DB 연결 실패. 오류 번호:', code)
        print('1045: .env 비밀번호/계정, 1049: DB 생성 여부, 2003: MySQL80 서비스/포트를 확인하세요.')
        return 1


if __name__ == '__main__':
    sys.exit(main())
