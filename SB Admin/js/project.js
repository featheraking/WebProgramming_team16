
// 과제 코멘트 수정
document.querySelectorAll(".task-note-card").forEach(card => {
    const view = card.querySelector(".task-note-view");
    const edit = card.querySelector(".task-note-edit");

    const content = card.querySelector(".task-note-content");
    const input = card.querySelector(".task-note-input");

    // 수정 버튼
    card.querySelector(".edit-task-note").addEventListener("click", () => {
        input.value = content.textContent.trim();

        view.classList.add("d-none");
        edit.classList.remove("d-none");
    });

    // 취소 버튼
    card.querySelector(".cancel-task-note").addEventListener("click", () => {
        edit.classList.add("d-none");
        view.classList.remove("d-none");
    });

    // 저장 버튼
    card.querySelector(".save-task-note").addEventListener("click", () => {
        content.textContent = input.value;

        edit.classList.add("d-none");
        view.classList.remove("d-none");
    });
});


// 하위 기록 수정
const card = document.querySelector(
    '.child-record-card[data-child-id="child1"]'
);

const view = card.querySelector(".child-record-view");
const edit = card.querySelector(".child-record-edit");
const content = card.querySelector(".child-record-content");
const input = card.querySelector(".child-record-input");

card.querySelector(".edit-child-record").addEventListener("click", () => {
    input.value = content.textContent.trim();

    view.classList.add("d-none");
    edit.classList.remove("d-none");
    input.focus();
});

card.querySelector(".cancel-child-record").addEventListener("click", () => {
    edit.classList.add("d-none");
    view.classList.remove("d-none");
});

card.querySelector(".save-child-record").addEventListener("click", () => {
    const newContent = input.value.trim();
    if (!newContent) return;

    content.textContent = newContent;

    card.querySelector(".child-record-edited")
        .classList.remove("d-none");

    edit.classList.add("d-none");
    view.classList.remove("d-none");
});



/* 설정 관리 */

const settingsModal = document.getElementById("projectSettingsModal");

function showSettingsView(viewName) {

    const settingsViews = {
        menu: document.getElementById("projectSettingsMenu"),
        edit: document.getElementById("projectSettingsEdit"),
        leave: document.getElementById("projectSettingsLeave")
    };

    Object.entries(settingsViews).forEach(([name, element]) => {
        element.classList.toggle("d-none", name !== viewName);
    });

    const titles = {
        menu: "프로젝트 설정",
        edit: "프로젝트 정보 수정",
        leave: "프로젝트 나가기"
    };

    document.getElementById("projectSettingsModalLabel")
        .textContent = titles[viewName];
}

// 설정 메뉴 선택
document.getElementById("openProjectEdit")
    .addEventListener("click", () => showSettingsView("edit"));

document.getElementById("openProjectLeave")
    .addEventListener("click", () => showSettingsView("leave"));

// 뒤로가기
document.querySelectorAll(".settings-back").forEach(button => {
    button.addEventListener("click", () => {
        showSettingsView("menu");
    });
});

// 프로젝트 탈퇴 (현재는 workspace.html로 이동하는 것만 구현)
document.getElementById("confirmLeaveProject")
    .addEventListener("click", () => {
        window.location.href = "workspace.html";
    });

// 설정 Modal을 다시 열 때 처음 메뉴로 초기화
settingsModal.addEventListener("show.bs.modal", () => {
    showSettingsView("menu");
});
