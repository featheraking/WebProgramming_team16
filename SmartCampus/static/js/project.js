// 공용 함수 가져오기
import { generateInviteCode, currentUserId, Users } from "./workspace_utils.js";


/* 프로젝트 임시 데이터 */
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

projectSettingsForm.addEventListener("submit", event => {
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

    // 프로젝트 데이터 수정
    currentProject.name = name;
    currentProject.description = description;
    currentProject.dueDate = dueDate;
    currentProject.maxMembers = maxMembers;

    // 프로젝트 화면 갱신
    renderProjectInfo();

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

projectMemberList.addEventListener("click", event => {
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

    const targetUserId = memberItem.dataset.userId;

    if (!currentProject.currentMembers.includes(targetUserId)) {
        alert("프로젝트 참여자를 찾을 수 없습니다.");
        return;
    }

    const targetName = Users[targetUserId] ?? targetUserId;

    if (!targetMember) {
        alert("참여자를 찾을 수 없습니다.");
        return;
    }

    // 관리자 본인에게 양도하는 것은 방지
    if (targetUserId === currentProject.adminId) return;

    // 사용자에게 확인
    const confirmed = confirm(
        `관리자 권한을 '${targetMember.name}'님에게 양도하시겠습니까?\n\n` +
        "양도 후에는 프로젝트 관리 권한을 잃게 됩니다."
    );

    if (!confirmed) return;

    // 관리자 변경
    currentProject.adminId = targetUserId;

    // 인원 관리 화면 갱신
    renderProjectMembers();

    alert(`'${targetMember.name}'님에게 관리자 권한을 양도했습니다.`);
});


// 강퇴는 추후 구현 예정




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
        alert("초대 코드 복사에 실패했습니다.");
    }
});

// 초대 코드 재발급
document.getElementById("regenerateProjectInviteCode").addEventListener("click", () => {
    // 관리자가 아니라면 불가능
    if (currentProject.adminId !== currentUserId) {
        alert("프로젝트 관리자만 코드를 재발급할 수 있습니다.");
        return;
    }

    const confirmed = confirm("초대 코드를 재발급하시겠습니까?");
    if (!confirmed) return;

    let newCode;

    // 기존 코드와 겹치지 않도록 새 코드 생성
    do {
        newCode = generateInviteCode();
    } while (newCode === currentProject.inviteCode);

    // 초대 코드 갱신
    currentProject.inviteCode = newCode;

    renderInviteCode();
});




// 프로젝트 탈퇴 (DB 연동 후 추가적인 작업 필요)
document.getElementById("confirmLeaveProject").addEventListener("click", () => {
    window.location.href = "/workspace";
});




// 초기 렌더링
renderProjectInfo();
renderProjectMembers();
renderInviteCode();
