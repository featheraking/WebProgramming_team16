# 📌 백엔드 시작 전 필독

## 1. 바뀐 내용 (요약)
- **`SmartCampus` 폴더** 새로 커밋한 상태. 
- `SB Admin`은 참고용으로만 두고, **앞으로 작업은 `SmartCampus`에서만** (확인 끝나면 삭제 예정)
- 상단바·사이드바·푸터는 `templates/base.html` 하나로 합쳐짐. 각 페이지는 본문만 빼고 삭제.
- DB: `schema.sql`과 테이블을 만드는 `init_db.py` 추가.
- 페이지 주소를 Flask 주소로 통일 (workspace.html, project.html 수정 - 11/07)

- **공통 파일**(`app.py`, `config.py`, `db.py`, `base.html`, `frame.*`, `schema.sql`)은 수정금지.

<br>

## 2. 실행 방법

### 처음 한 번
1. **MySQL 8 설치** (root 비밀번호 꼭 기억!)
2. **VS Code에서 `SmartCampus` 폴더 열기** (`app.py`가 보이는 폴더)
3. **터미널(Command Prompt)에서**
   ```bash
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   ```
4. **`.env` 만들기**: `.env.example`을 복사해 이름을 `.env`로 바꾸고 `DB_PASSWORD`에 MySQL 비밀번호 적기
5. **DB · 테이블 만들기**   -> init_db.py 실행
   ```bash
   python init_db.py
   ```

    MySQL 명령어로도 실행 가능
    ```bash
    mysql -u root -p < schema.sql
    ```
6. `Ctrl+Shift+P` → **Python: Select Interpreter** → `.\venv\Scripts\python.exe` 선택

<br>

### 매번 실행할 때
```bash
venv\Scripts\activate
flask --app app run --debug
```
→ 브라우저에서 **http://127.0.0.1:5000** 로 실행 (종료: `Ctrl + C`)

> Mac은 `venv\Scripts\activate` 대신 `source venv/bin/activate`

<br>

## 3. GitHub에 올릴 때 주의
- `venv` 폴더, `.env` 파일은 **올리지 않기** (웹으로 끌어다 놓을 때 꼭 빼기)

<br>

## 4. 자주 나는 오류 
<sub>(AI 어시스트가 정리함 - 참고만 할 것)
| 메시지 | 해결 |
|---|---|
| `No module named 'flask'` | `venv\Scripts\activate` 후 다시 실행 |
| `비밀번호가 틀렸어요` / `Access denied` | `.env`의 `DB_PASSWORD` 확인 |
| `MySQL에 연결할 수 없어요` | `Win+R` → `services.msc` → **MySQL80** 시작 |
| 페이지가 404 | 파일 이름(`.html`) 대신 위 주소로 접속 |
| 디자인이 예전 그대로 | `Ctrl + F5` (강력 새로고침) |