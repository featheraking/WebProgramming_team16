import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    # 세션(session['user_id']) 암호화에 쓰는 키
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-only-change-me')

    # 각자 로컬 MySQL 접속 정보
    DB_HOST = os.getenv('DB_HOST', '127.0.0.1')
    DB_PORT = int(os.getenv('DB_PORT', '3306'))
    DB_USER = os.getenv('DB_USER', 'root')
    DB_PASSWORD = os.getenv('DB_PASSWORD', '')
    DB_NAME = os.getenv('DB_NAME', 'smart_campus')

    # 외부 API 키 (도구함)
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
    SAFE_BROWSING_API_KEY = os.getenv('SAFE_BROWSING_API_KEY', '')
