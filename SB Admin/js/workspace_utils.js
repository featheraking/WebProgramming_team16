/* 임시 공용 데이터 */
export const currentUserId = "user1";

export const Users = {
    user1: "팀원 A",
    user2: "팀원 B",
    user3: "팀원 C",
    user4: "팀원 D"
};


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