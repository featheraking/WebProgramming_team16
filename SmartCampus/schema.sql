-- Smart Campus Hub — MySQL 테이블

DROP DATABASE IF EXISTS smart_campus;
CREATE DATABASE smart_campus DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smart_campus;


-- [공통] ★ User 테이블
-- 다른 테이블은 user_id로 이 테이블의 id 참조
-- 로그인하면 session['user_id'] = users.id
CREATE TABLE users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,        -- 로그인 아이디
    password_hash VARCHAR(255) NOT NULL,               -- 암호화된 비밀번호 (원래 비밀번호 저장 X)
    name          VARCHAR(50)  NOT NULL,               -- 이름
    student_id    VARCHAR(20)  NOT NULL UNIQUE,        -- 학번
    email         VARCHAR(100) NOT NULL UNIQUE,        -- 이메일
    department    VARCHAR(50)  NULL,                   -- 학과 (홈 배너 표시, 설정에서 입력)
    semester      VARCHAR(20)  NULL,                   -- 학기 (ex. 2026년 2학기)
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);



-- [시험 스케줄러]
-- UUID는 JS crypto.randomUUID() 형식 (하이픈 포함 36자)

-- 시험 테이블
CREATE TABLE exams (
    id         CHAR(36)     PRIMARY KEY, -- 시험 UUID
    user_id    INT          NOT NULL, -- 등록한 회원 (users.id)
    name       VARCHAR(100) NOT NULL, -- 시험명
    exam_at    DATETIME     NOT NULL, -- 시험 일시
    formats    JSON         NOT NULL, -- 문제 형식 (객관식 / 단답형 / 서술형, 복수)
    traits     JSON         NOT NULL, -- 학습 특성 (문제은행형 / 암기형 / 계산형 / 개념형, 복수)
    readiness  TINYINT      NOT NULL DEFAULT 0, -- 전체 준비 상태 (0: 시작 안 함 / 1: 조금 / 2: 많이)
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 생성 시각
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- 최종 수정 시각
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 시험 범위와 공부 상태 테이블
CREATE TABLE exam_scopes (
    id         CHAR(36)     PRIMARY KEY, -- 범위 UUID
    exam_id    CHAR(36)     NOT NULL, -- 속한 시험 UUID
    title      VARCHAR(150) NOT NULL, -- 범위명
    status     VARCHAR(10)  NOT NULL DEFAULT 'unknown', -- 공부 상태 (unknown / unsure / done)
    sort_order INT          NOT NULL DEFAULT 0, -- 표시 순서
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- 최종 수정 시각
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

-- 일일 공부 계획 테이블 (회원 + 날짜당 하나)
CREATE TABLE daily_study_plans (
    id             CHAR(36) PRIMARY KEY, -- 계획 UUID
    user_id        INT      NOT NULL, -- 회원 (users.id)
    plan_date      DATE     NOT NULL, -- 계획 날짜
    budget_minutes INT      NOT NULL CHECK (budget_minutes BETWEEN 1 AND 1440), -- 하루 총 공부 가능 시간 (분)
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 생성 시각
    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- 최종 수정 시각
    UNIQUE (user_id, plan_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 공부 계획 세부 항목 테이블
CREATE TABLE study_plan_items (
    id             CHAR(36)    PRIMARY KEY, -- 계획 항목 UUID
    plan_id        CHAR(36)    NOT NULL, -- 속한 일일 계획 UUID
    scope_id       CHAR(36)    NOT NULL, -- 공부할 범위 UUID
    sort_order     INT         NOT NULL DEFAULT 0, -- 공부 순서
    minutes        INT         NOT NULL, -- 추천 공부 시간 (분)
    status_at_plan VARCHAR(10) NOT NULL, -- 계획 생성 당시 공부 상태
    is_recorded    BOOLEAN     NOT NULL DEFAULT FALSE, -- 기록 완료 여부
    FOREIGN KEY (plan_id) REFERENCES daily_study_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (scope_id) REFERENCES exam_scopes(id) ON DELETE CASCADE
);

-- 공부 기록 및 결과 테이블 (시험·범위가 지워져도 기록은 유지)
CREATE TABLE study_records (
    id               CHAR(36)     PRIMARY KEY, -- 공부 기록 UUID
    user_id          INT          NOT NULL, -- 공부한 회원 (users.id)
    exam_id          CHAR(36)     NULL, -- 공부한 시험 UUID (자유 공부·시험 삭제 시 NULL)
    scope_id         CHAR(36)     NULL, -- 공부한 범위 UUID (자유 공부·범위 삭제 시 NULL)
    study_type       VARCHAR(10)  NOT NULL, -- 공부 구분 (planned / free)
    title            VARCHAR(150) NOT NULL, -- 기록 당시 공부 제목
    study_date       DATE         NOT NULL, -- 공부 날짜
    seconds          INT          NOT NULL, -- 실제 공부 시간 (초)
    expected_minutes INT          NULL, -- 예정 공부 시간 (분, 자유 공부는 NULL)
    result           VARCHAR(10)  NULL, -- 공부 결과 (unknown / unsure / done, 자유 공부는 NULL)
    saved_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 저장 시각
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE SET NULL,
    FOREIGN KEY (scope_id) REFERENCES exam_scopes(id) ON DELETE SET NULL
);

-- [선택] 진행 중인 타이머 테이블 (회원당 최대 하나)
CREATE TABLE active_study_timers (
    user_id          INT          PRIMARY KEY, -- 회원 (users.id)
    exam_id          CHAR(36)     NULL, -- 공부 중인 시험 UUID (자유 공부는 NULL)
    scope_id         CHAR(36)     NULL, -- 공부 중인 범위 UUID (자유 공부는 NULL)
    plan_item_id     CHAR(36)     NULL, -- 기록 완료로 바꿀 계획 항목 UUID (자유 공부는 NULL)
    title            VARCHAR(150) NOT NULL, -- 공부 제목
    expected_minutes INT          NULL, -- 예정 공부 시간 (분)
    accumulated_ms   BIGINT       NOT NULL DEFAULT 0, -- 누적 공부 시간 (밀리초)
    last_started_at  DATETIME     NULL, -- 마지막 시작·재개 시각
    is_running       BOOLEAN      NOT NULL DEFAULT FALSE, -- 실행 여부
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE SET NULL,
    FOREIGN KEY (scope_id) REFERENCES exam_scopes(id) ON DELETE SET NULL,
    FOREIGN KEY (plan_item_id) REFERENCES study_plan_items(id) ON DELETE SET NULL
);



-- [팀 프로젝트 워크스페이스]
-- UUID는 JS crypto.randomUUID() 형식 (하이픈 포함 36자)

-- 프로젝트 테이블
CREATE TABLE projects (
    id           CHAR(36)     PRIMARY KEY, -- 프로젝트 UUID
    name         VARCHAR(100) NOT NULL, -- 프로젝트명
    description  TEXT         NULL, -- 프로젝트 설명
    created_date DATE         NOT NULL DEFAULT (CURRENT_DATE), -- 생성일
    due_date     DATE         NULL, -- 마감일
    owner_id     INT          NULL, -- 관리자 식별 정보 (users.id)
    invite_code  CHAR(8)      NOT NULL UNIQUE, -- 초대코드 (8자리 영어/숫자)
    max_members  INT          NOT NULL DEFAULT 5, -- 최대 회원수
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 프로젝트 참여자 테이블
CREATE TABLE project_members (
    project_id CHAR(36) NOT NULL, -- 프로젝트 UUID
    user_id    INT      NOT NULL, -- 회원 식별 정보 (users.id)
    PRIMARY KEY (project_id, user_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 과제 테이블
CREATE TABLE project_tasks (
    id           CHAR(36)     PRIMARY KEY, -- 과제 UUID
    project_id   CHAR(36)     NOT NULL, -- 속한 프로젝트 UUID
    title        VARCHAR(100) NOT NULL, -- 과제명
    content      TEXT         NULL, -- 과제 내용
    created_by   INT          NULL, -- 과제 생성자 (users.id)
    created_date DATE         NOT NULL DEFAULT (CURRENT_DATE), -- 생성일
    due_date     DATE         NULL, -- 마감일
    status       VARCHAR(10)  NOT NULL DEFAULT 'todo', -- 진행 상태 (todo / progress / done)
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE, -- 활성화 여부
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 과제 담당자 테이블
CREATE TABLE task_assignees (
    task_id CHAR(36) NOT NULL, -- 과제 UUID
    user_id INT      NOT NULL, -- 담당자 식별용 정보 (users.id)
    comment TEXT     NULL, -- 코멘트
    PRIMARY KEY (task_id, user_id),
    FOREIGN KEY (task_id) REFERENCES project_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 상위 기록 테이블
CREATE TABLE project_records (
    id         CHAR(36)     PRIMARY KEY, -- 상위 기록 UUID
    project_id CHAR(36)     NOT NULL, -- 속한 프로젝트 UUID
    author_id  INT          NULL, -- 기록 작성자 식별 정보 (users.id)
    title      VARCHAR(100) NOT NULL, -- 기록명
    content    TEXT         NULL, -- 기록 내용
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 생성 시각
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- 수정 시각
    is_hidden  BOOLEAN      NOT NULL DEFAULT FALSE, -- 숨김 여부
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 하위 기록 테이블
CREATE TABLE project_sub_records (
    id         CHAR(36) PRIMARY KEY, -- 하위 기록 UUID
    project_id CHAR(36) NOT NULL, -- 속한 프로젝트 UUID
    parent_id  CHAR(36) NOT NULL, -- 부모 상위 기록 UUID
    author_id  INT      NULL, -- 기록 작성자 (users.id)
    content    TEXT     NULL, -- 기록 내용
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 생성 시각
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- 수정 시각
    is_hidden  BOOLEAN  NOT NULL DEFAULT FALSE, -- 숨김 여부
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES project_records(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 상위 기록 수정 이력 테이블
CREATE TABLE project_record_histories (
    id         INT AUTO_INCREMENT PRIMARY KEY, -- 수정 기록 ID
    record_id  CHAR(36)     NOT NULL, -- 수정한 상위 기록 UUID
    old_title  VARCHAR(100) NULL, -- 수정 전 기록명
    old_content TEXT        NULL, -- 수정 전 내용
    edited_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 수정 시각
    FOREIGN KEY (record_id) REFERENCES project_records(id) ON DELETE CASCADE
);



-- [URL 스캐너]
-- 회원별로 바꾸려면 user_id INT NULL + FOREIGN KEY 추가
CREATE TABLE url_scan_logs (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    ip_address      VARCHAR(45)  NOT NULL UNIQUE, -- IP 주소 (IPv6까지 고려해 넉넉하게 45자)
    country         VARCHAR(100) NULL, -- 나라
    hosting_company VARCHAR(255) NULL, -- 호스팅 회사
    is_proxy        BOOLEAN      NOT NULL DEFAULT FALSE, -- 프록시 여부
    scanned_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP -- 조회 날짜
);



-- [AI 톤 체인저]
CREATE TABLE tone_logs (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT         NOT NULL, -- 회원 (users.id)
    is_converted BOOLEAN     NOT NULL DEFAULT FALSE, -- 변환 여부
    input_text   TEXT        NOT NULL, -- 입력한 글
    recipient    VARCHAR(20) NOT NULL, -- 받는 사람
    template     VARCHAR(30) NOT NULL DEFAULT '없음', -- 템플릿
    analysis     JSON        NULL, -- 분석 결과
    created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 저장 날짜
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE -- 회원 탈퇴 시 기록도 삭제
);
