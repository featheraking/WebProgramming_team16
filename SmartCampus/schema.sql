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


-- [팀 프로젝트 워크스페이스]



-- [URL 스캐너]
-- 회원별로 바꾸려면 user_id INT NULL + FOREIGN KEY 추가
CREATE TABLE url_scan_logs (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    ip_address      VARCHAR(45)  NOT NULL, -- IP 주소 (IPv6까지 고려해 넉넉하게 45자)
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