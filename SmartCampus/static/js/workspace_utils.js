/* 프로젝트 id 받아오기 */
export function getProjectId() {
    return window.projectId ?? null;
}

/* Flask 통신용 함수 */
export async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
            ...options.headers
        }
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        const err = new Error(data?.error || `요청 실패 (${response.status})`);

        err.status = response.status;
        err.code = data?.code;

        throw err;
    }

    return data;
}

/* 현재 유저값 받아오기 */
export let currentUserId = null;

export async function loadCurrentUser() {
    const data = await apiRequest("/auth/me");

    currentUserId = data?.user ? Number(data.user.id) : null;

    return data.user;
}

/* 프로젝트 참여자 명단 받아오기 */
export let Users = {};

export function setUsers(members) {
    for (const key of Object.keys(Users)) {
        delete Users[key];
    }

    for (const member of members) {
        Users[member.id] = member.name;
    }
}


/* 현재 날짜 및 시간 반환 */
export function getCurrentDateTime(includeTime = false) {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    const date = `${year}-${month}-${day}`;

    if (!includeTime) {
        return date;
    }

    const hour = String(now.getHours()).padStart(2, "0");
    const minute = String(now.getMinutes()).padStart(2, "0");

    return `${date} ${hour}:${minute}`;
}



/* 프로젝트 초대 코드 생성 */
export function generateInviteCode(length = 8) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const result = [];
    const random = new Uint8Array(length);
    const limit = 256 - (256 % chars.length);

    while (result.length < length) {
        crypto.getRandomValues(random);

        for (let value of random) {
            if (value >= limit) continue;

            result.push(chars[value % chars.length]);

            if (result.length === length) break;
        }
    }

    return result.join("");
}