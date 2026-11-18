// 공용 함수 가져오기
import { apiRequest, getProjectId, generateInviteCode, loadCurrentUser, currentUserId, setUsers, Users, getCurrentDateTime } from "./workspace_utils.js";
import { loadTasks, setAssigneeOptions } from "./task.js";
import { loadRecords } from "./record.js";

/* 프로젝트 임시 데이터 */
/*
const currentProject = {
    id: crypto.randomUUID(),
    name: "테스트 프로젝트명(임시)",
    description: "프로젝트 설명입니다.",
    createdAt: "2026-11-01",
    dueDate: "2026-12-31",
    adminId: "user1",
    inviteCode: "ABCD1234",
    currentMembers: ["user1", "user2", "user3", "user4"],
    maxMembers: 5,
    taskCount: 0
};
*/

let currentProject = null;

// 기존 변수명과 호환시키기 위한 함수
function normalizeProjectDetail(row) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        createdAt: row.created_date,
        dueDate: row.due_date,
        adminId: row.owner_id,
        inviteCode: row.invite_code,
        maxMembers: row.max_members,
        members: row.members,
        currentMembers: row.members.map(member => member.id)
    };
}



async function loadProjectInfo() {
    const projectId = getProjectId();

    const data = await apiRequest(`/workspace/api/projects/${encodeURIComponent(projectId)}`);

    currentProject = normalizeProjectDetail(data);

    setUsers(currentProject.members);

    renderProjectInfo();
    renderProjectMembers();
    renderInviteCode();

    return currentProject;
}



/* 설정창 관리 */

// 설정창
const settingsModal = document.getElementById("projectSettingsModal");

function showSettingsView(viewName) {

    const settingsViews = {
        menu: document.getElementById("projectSettingsMenu"),
        members: document.getElementById("projectSettingsMembers"),
        edit: document.getElementById("projectSettingsEdit"),
        leave: document.getElementById("projectSettingsLeave")
    };

    Object.entries(settingsViews).forEach(([name, element]) => {
        element.classList.toggle("d-none", name !== viewName);
    });

    const titles = {
        menu: "프로젝트 설정",
        members: "프로젝트 인원 관리",
        edit: "프로젝트 정보 수정",
        leave: "프로젝트 나가기"
    };

    document.getElementById("projectSettingsModalLabel")
        .textContent = titles[viewName];
}

// 설정 메뉴 선택
document.getElementById("openProjectLeave").addEventListener("click", () => showSettingsView("leave"));

// 뒤로가기
document.querySelectorAll(".settingsBack").forEach(button => {
    button.addEventListener("click", () => {
        showSettingsView("menu");
    });
});

// 설정 Modal을 다시 열 때 처음 메뉴로 초기화
settingsModal.addEventListener("show.bs.modal", () => {
    showSettingsView("menu");
});



/* 프로젝트 정보 관리 */

// 렌더링 함수
function renderProjectInfo() {
    // 프로젝트명
    document.getElementById("projectTitle").textContent = currentProject.name;

    // 프로젝트 생성일 및 기한x
    document.getElementById("projectCreatedAt").textContent = currentProject.createdAt;
    document.getElementById("projectDueDate").textContent = currentProject.dueDate;

    // 현재 인원수 및 최대 인원수
    document.getElementById("projectCurrentMembers").textContent = currentProject.currentMembers.length;
    document.getElementById("projectMaxMembers").textContent = currentProject.maxMembers;

    // 프로젝트 설명문
    document.getElementById("projectDescription").textContent = currentProject.description;
}


// 프로젝트 정보 수정창 열기
document.getElementById("openProjectEdit").addEventListener("click", () => {
    // 관리자가 아니라면 불가능
    if (currentProject.adminId !== currentUserId) {
        alert("프로젝트 관리자만 정보를 수정할 수 있습니다.");
        showSettingsView("menu");
    }
    else {
        // 기존 프로젝트 데이터 띄우기
        document.getElementById("settingsProjectName").value = currentProject.name;
        document.getElementById("settingsProjectDescription").value = currentProject.description;
        document.getElementById("settingsProjectDueDate").value = currentProject.dueDate;
        document.getElementById("settingsProjectMaxMembers").value = currentProject.maxMembers;

        showSettingsView("edit");
    }
});


/* 프로젝트 정보 수정 */
const projectSettingsForm = document.getElementById("projectSettingsForm");

projectSettingsForm.addEventListener("submit", async event => {
    event.preventDefault();

    // 관리자가 아니라면 불가능
    if (currentProject.adminId !== currentUserId) {
        alert("프로젝트 관리자만 정보를 수정할 수 있습니다.");
        return;
    }


    // 입력값 가져오기
    const name = document.getElementById("settingsProjectName").value.trim();
    const description = document.getElementById("settingsProjectDescription").value.trim();
    const dueDate = document.getElementById("settingsProjectDueDate").value;
    const maxMembers = Number(document.getElementById("settingsProjectMaxMembers").value);

    // 최대 인원수의 최소 제한
    if (maxMembers < currentProject.currentMembers.length) {
        alert("현재 인원보다 더 적은 인원으로 설정할 수 없습니다.");
        return;
    }

    // 과거 날짜를 마감일로 설정 불가
    if (dueDate < getCurrentDateTime()) {
        alert("지난 날짜를 프로젝트 마감일로 설정할 수 없습니다.");
        return;
    }

    try {
        // 프로젝트 데이터 수정 요청
        await apiRequest(`/workspace/api/projects/${encodeURIComponent(currentProject.id)}`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    name: name,
                    description: description,
                    due_date: dueDate,
                    max_members: maxMembers
                })
            }
        );
    }
    catch (error) {
        alert(error.message);
        return;
    }

    // 프로젝트 화면 갱신
    //renderProjectInfo();
    try {
        await loadProjectInfo();
    }
    catch (error) {
        alert("목록 갱신에 실패하였습니다." + `\n${error.message}`);
    }

    // 설정 메뉴로 복귀
    showSettingsView("menu");
});



/* 프로젝트 참여 인원 관리 */

function renderProjectMembers() {
    const memberList = document.getElementById("projectMemberList");
    const template = document.getElementById("projectMemberTemplate");

    memberList.replaceChildren();

    // 참여 인원 표시
    const memberCount = currentProject.currentMembers.length;
    document.getElementById("settingsCurrentMembers").textContent = memberCount;
    document.getElementById("settingsMaxMembers").textContent = currentProject.maxMembers;


    // 참여자 목록
    currentProject.currentMembers.forEach(userId => {
        const item = template.content.firstElementChild.cloneNode(true);

        // 사용자 ID 표기
        item.dataset.userId = userId;
        item.querySelector(".memberName").textContent = Users[userId] ?? userId;

        // 일반 사용자/관리자 표기
        const isAdmin = userId === currentProject.adminId;
        const amIAdmin = currentUserId === currentProject.adminId;
        item.querySelector(".memberRole").textContent = isAdmin ? "관리자" : "참여자";

        // 관리자에게만 위임/강퇴 버튼 표기
        const canManage = amIAdmin && !isAdmin;
        item.querySelector(".kickMemberButton").classList.toggle("d-none", !canManage);
        item.querySelector(".transferAdminButton").classList.toggle("d-none", !canManage);

        memberList.appendChild(item);
    });
}

// 인원 관리 창 열기
document.getElementById("openProjectMembers").addEventListener("click", () => {
    renderProjectMembers();
    showSettingsView("members");
});

// 관리자 양도
const projectMemberList = document.getElementById("projectMemberList");

projectMemberList.addEventListener("click", async event => {
    const button = event.target.closest(".transferAdminButton");

    if (!button) return;

    // 현재 사용자가 관리자인지 확인
    if (currentProject.adminId !== currentUserId) {
        alert("프로젝트 관리자만 권한을 양도할 수 있습니다.");
        return;
    }

    // 선택한 참여자 찾기
    const memberItem = button.closest("[data-user-id]");
    if (!memberItem) return;

    const targetUserId = Number(memberItem.dataset.userId);

    // 관리자 본인에게 양도 방지
    if (targetUserId === currentProject.adminId) return;


    const targetMember = currentProject.members.find(member => member.id === targetUserId);
    if (!targetMember) {
        alert("참여자를 찾을 수 없습니다.");
        return;
    }

    // 사용자에게 확인
    if (!confirm(`관리자 권한을 '${targetMember.name}'님에게 양도하시겠습니까?\n\n양도 후에는 프로젝트 관리 권한을 잃게 됩니다.`))
        return;


    try {
        // 관리자 변경
        //currentProject.adminId = targetUserId;
        await apiRequest(`/workspace/api/projects/${currentProject.id}/owner`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    owner_id: targetUserId
                })
            }
        );
    }
    catch (error) {
        alert("관리자 변경에 실패하였습니다." + `\n${error.message}`);
        return;
    }

    alert(`'${targetMember.name}'님에게 관리자 권한을 양도했습니다.`);

    // 인원 관리 화면 갱신
    //renderProjectMembers();
    try {
        await loadProjectInfo();
    }
    catch (error) {
        alert("목록 갱신에 실패하였습니다." + `\n${error.message}`);
    }
});


// 강퇴 (Flask에서 삭제하도록 하기)
async function kickProjectMember(userId) {
    await apiRequest(`/workspace/api/projects/${currentProject.id}/members/${userId}`,
        {
            method: "DELETE"
        }
    );

    await loadProjectInfo();
}

projectMemberList.addEventListener("click", async event => {
    const button = event.target.closest(".kickMemberButton");

    if (!button || !projectMemberList.contains(button)) return;

    if (currentProject.adminId !== currentUserId) {
        alert("프로젝트 관리자만 강퇴할 수 있습니다.");
        return;
    }

    const memberItem = button.closest("[data-user-id]");
    if (!memberItem) return;

    // 대상 찾아내기
    const targetUserId = Number(memberItem.dataset.userId);

    // 관리자 강퇴 불가
    if (targetUserId === currentProject.adminId) {
        alert("관리자는 강퇴할 수 없습니다.");
        return;
    }

    const targetMember = currentProject.members.find(
        member => member.id === targetUserId
    );

    if (!targetMember) {
        alert("참여자를 찾을 수 없습니다.");
        return;
    }

    // 확인
    if (!confirm(`'${targetMember.name}'님을 강퇴하시겠습니까?`)) return;


    button.disabled = true;

    // 강퇴하기
    try {
        await kickProjectMember(targetUserId);
    }
    catch (error) {
        alert("강퇴에 실패했습니다." + `\n${error.message}`);
        return;
    }
    finally {
        button.disabled = false;
    }

    // 목록 갱신
    try {
        const project = await loadProjectInfo();
        setAssigneeOptions("taskAssignees", project.members);
        setAssigneeOptions("editTaskAssignees", project.members);
        setAssigneeOptions("taskAssigneeFilter", project.members, true);
    } catch (error) {
        alert("목록 갱신에 실패했습니다." + `\n${error.message}`);
    }
});


/* 초대 코드 관리 */

// 현재 초대 코드 표시
function renderInviteCode() {
    document.getElementById("settingsProjectInviteCode").value = currentProject.inviteCode;
}

// 초대 코드 복사
document.getElementById("copyProjectInviteCode").addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(currentProject.inviteCode);
        alert("초대 코드가 복사되었습니다.");
    }
    catch (error) {
        alert("초대 코드 복사에 실패했습니다." + `\n${error.message}`);
    }
});

// 초대 코드 재발급
document.getElementById("regenerateProjectInviteCode").addEventListener("click", async () => {
    // 관리자가 아니라면 불가능
    if (currentProject.adminId !== currentUserId) {
        alert("프로젝트 관리자만 코드를 재발급할 수 있습니다.");
        return;
    }


    if (!confirm("초대 코드를 재발급하시겠습니까?")) return;

    let successed = false;
    // 최대 10회 시도
    for (let i = 0; i < 10; i++) {
        let newCode;

        // 기존 코드와 겹치지 않도록 새 코드 생성
        do {
            newCode = generateInviteCode();
        } while (newCode === currentProject.inviteCode);

        try {
            // 초대 코드 갱신
            //currentProject.inviteCode = newCode;
            await apiRequest(`/workspace/api/projects/${currentProject.id}/invite-code`, {
                method: "POST",
                body: JSON.stringify({
                    invite_code: newCode
                })
            });

            successed = true;
            break;
        }
        catch (error) {
            if (error.status !== 409 || error.code !== "INVITE_CODE_DUPLICATE") throw error;
        }
    }
    if (!successed) throw new Error("초대 코드 재발급에 실패하였습니다.");


    // 목록 갱신
    try {
        //renderInviteCode();
        await loadProjectInfo();
    }
    catch (error) {
        alert("목록 갱신에 실패하였습니다." + `\n${error.message}`);
    }

});




// 프로젝트 탈퇴
document.getElementById("confirmLeaveProject").addEventListener("click", async () => {
    if (currentUserId === currentProject.adminId) {
        alert("관리자는 탈퇴할 수 없습니다.");
        return;
    }

    try {
        await apiRequest(`/workspace/api/projects/${currentProject.id}/leave`,
            { method: "POST" }
        );


    }
    catch (error) {
        alert(error.message);
        return;
    }

    window.location.href = "/workspace";
});




// 초기 렌더링
//renderProjectInfo();
//renderProjectMembers();
//renderInviteCode();
try {
    await loadCurrentUser();
    const proj = await loadProjectInfo();
    setAssigneeOptions("taskAssignees", proj.members);
    setAssigneeOptions("editTaskAssignees", proj.members);
    setAssigneeOptions("taskAssigneeFilter", proj.members, true);
    await Promise.all([loadTasks(), loadRecords()]);
}
catch (error) {
    alert("프로젝트를 불러오는 데 실패하였습니다." + `\n${error.message}`);
}