/* 공용 함수 가져오기 */
import { getCurrentDateTime, currentUserId, Users } from "./workspace_utils.js";


/* 과제 관리 */
let taskSortIndex = 0;
const taskSortOptions = [
    { key: "dueDate", order: "asc", label: "마감일 오름차순" },
    { key: "dueDate", order: "desc", label: "마감일 내림차순" }
];

const statusNames = {
    todo: "미시작",
    progress: "진행 중",
    done: "완료"
};

const statusColors = {
    todo: "bg-secondary",
    progress: "bg-primary",
    done: "bg-success"
};


const tasks = [
    {
        id: crypto.randomUUID(),
        creatorId: "user1",
        title: "테스트 과제 A",
        description: "테스트 과제 A의 상세 내용",
        assignees: ["user1", "user2"],
        status: "done",
        createdAt: "2019-12-31",
        dueDate: "2029-12-31",
        isActive: true,
        notes: {}
    },
    {
        id: crypto.randomUUID(),
        creatorId: "user3",
        title: "테스트 과제 B",
        description: "테스트 과제 B의 상세 내용",
        assignees: ["user3"],
        status: "todo",
        createdAt: "2039-12-31",
        dueDate: "2049-12-31",
        isActive: true,
        notes: {}
    },
    {
        id: crypto.randomUUID(),
        creatorId: "user4",
        title: "테스트 과제 C",
        description: "테스트 과제 C의 상세 내용",
        assignees: ["user4"],
        status: "progress",
        createdAt: "2008-12-31",
        dueDate: "2009-12-31",
        isActive: true,
        notes: {}
    }
];



// 과제 상세 정보 렌더링

// 과제 목록 렌더링
function renderTaskList() {
    const taskList = document.getElementById("task-list");
    const template = document.getElementById("task-row-template");

    // 기존 과제 목록 제거
    taskList.replaceChildren();

    // 필터값 가져오기
    const search = document.getElementById("taskSearch").value.trim().toLowerCase();
    const assignee = document.getElementById("taskAssigneeFilter").value;
    const status = document.getElementById("taskStatusFilter").value;
    const hideInactive = document.getElementById("hideInactiveTasks").checked;

    // 과제 필터링
    const filteredTasks = tasks.filter(task => {
        const matchTitle = task.title.toLowerCase().includes(search);
        const matchAssignee = assignee === "all" || task.assignees.includes(assignee);
        const matchStatus = status === "all" || task.status === status;
        const matchActive = !hideInactive || task.isActive !== false;

        return matchTitle && matchAssignee && matchStatus && matchActive;
    });

    // 생성일 정렬
    const { key, order } = taskSortOptions[taskSortIndex];

    filteredTasks.sort((a, b) => {
        const result = a[key].localeCompare(b[key]);

        return order === "asc" ? result : -result;
    });

    // 필터링 결과가 비어있는 경우
    if (filteredTasks.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");

        td.colSpan = 4;
        td.className = "text-center text-muted py-4";
        td.textContent = "조건에 맞는 과제가 없습니다.";

        tr.appendChild(td);
        taskList.appendChild(tr);
        return;
    }

    // 과제별 테이블 행 생성
    filteredTasks.forEach(task => {
        // 템플릿 복제
        const tr = template.content.firstElementChild.cloneNode(true);

        // 과제명과 상세정보 Modal 연결
        const titleButton = tr.querySelector(".task-title");
        titleButton.textContent = task.title;
        titleButton.dataset.taskId = task.id;

        // 과제 비활성화 표시
        if (task.isActive === false) {
            tr.querySelector(".task-inactive").classList.remove("d-none");
        }

        // 수정 버튼과 수정 Modal 연결
        const editButton = tr.querySelector(".edit-task-btn");
        editButton.dataset.taskId = task.id;

        // 과제 생성자 및 담당자에게만 수정 버튼 보이기
        const canEdit = task.creatorId === currentUserId || task.assignees.includes(currentUserId);
        editButton.classList.toggle("d-none", !canEdit);


        // 담당자 표기
        tr.querySelector(".task-assignees").textContent = task.assignees.map(id => Users[id] ?? id).join(", ");

        // 진행 상태 표기
        const statusBadge = tr.querySelector(".task-status");
        statusBadge.textContent = statusNames[task.status] ?? task.status;
        statusBadge.classList.add(statusColors[task.status] ?? "bg-secondary");

        // 마감일
        tr.querySelector(".task-due-date").textContent = task.dueDate;


        // 목록에 추가
        taskList.appendChild(tr);
    });
}


// 담당자별 작업 기록 카드 렌더링

// 담당자별 코멘트 렌더링
function renderTaskNotes(task) {
    const noteList = document.getElementById("task-note-list");
    const template = document.getElementById("task-note-template");

    // 이전 과제의 코멘트 제거
    noteList.replaceChildren();

    // notes가 없는 과제 처리
    task.notes ??= {};

    // 담당자별 코멘트 카드 생성
    task.assignees.forEach(userId => {
        // 템플릿 복제
        const card = template.content.firstElementChild.cloneNode(true);

        // 담당자 ID 저장
        card.dataset.userId = userId;

        // 담당자 이름 표시
        card.querySelector(".task-note-author").textContent = Users[userId] ?? userId;

        // 해당 담당자의 기존 코멘트
        const savedNote = task.notes[userId] ?? "";
        const contentElement = card.querySelector(".task-note-content");
        contentElement.textContent = savedNote || "아직 작성된 내용이 없습니다.";
        contentElement.classList.toggle("text-muted", !savedNote);


        // 자기 코멘트면 수정 버튼 보이기
        if (userId !== currentUserId) {
            card.querySelector(".edit-task-note").classList.add("d-none");
        }


        // 코멘트 목록에 카드 추가
        noteList.appendChild(card);
    });
}



// 과제 생성
const createTaskForm = document.getElementById("createTaskForm");

createTaskForm.addEventListener("submit", event => {
    event.preventDefault();

    // 입력값 가져오기
    const title = document.getElementById("taskTitle").value.trim();
    const description = document.getElementById("taskDescription").value;
    const dueDate = document.getElementById("taskDueDate").value;

    const assigneeSelect = document.getElementById("taskAssignees");
    const assignees = Array.from(assigneeSelect.selectedOptions).map(option => option.value);


    // 새로운 과제 객체 생성
    const newTask = {
        id: crypto.randomUUID(),
        creatorId: currentUserId,
        title: title,
        description: description,
        assignees: assignees,
        status: "todo",
        createdAt: getCurrentDateTime(),
        dueDate: dueDate,
        isActive: true,
        notes: {}
    };

    // 데이터 추가
    tasks.push(newTask);

    // 목록 갱신
    renderTaskList();

    // Modal 닫기
    const modalElement = document.getElementById("createTaskModal");
    const modal = bootstrap.Modal.getInstance(modalElement);

    modal.hide();

    // 폼 초기화
    createTaskForm.reset();
});


// 과제 상세 정보 모달에 데이터 불러오기
const taskDetailModal = document.getElementById("taskDetailModal");

taskDetailModal.addEventListener("show.bs.modal", event => {
    // 클릭한 과제의 ID 가져오기
    const taskId = event.relatedTarget.dataset.taskId;

    // 과제 데이터 검색
    const task = tasks.find(t => t.id === taskId);

    if (!task) return;

    // 상세 정보 표시
    document.getElementById("detailTaskTitle").textContent = task.title;
    document.getElementById("detailTaskDescription").textContent = task.description;
    document.getElementById("detailTaskCreatedAt").textContent = task.createdAt;
    document.getElementById("detailTaskDueDate").textContent = task.dueDate;

    // 담당자 ID를 이름으로 변환
    document.getElementById("detailTaskAssignees").textContent =
        task.assignees.map(id => Users[id] ?? id).join(", ");

    // 진행 상태 표시
    const statusElement =
        document.getElementById("detailTaskStatus");

    statusElement.textContent = statusNames[task.status];

    // 진행 상태에 따른 배지 색상
    const statusColors = {
        todo: "bg-secondary",
        progress: "bg-primary",
        done: "bg-success"
    };

    statusElement.className = `badge ${statusColors[task.status]}`;


    // 현재 조회 중인 과제 ID 저장
    taskDetailModal.dataset.taskId = task.id;

    // 담당자별 코멘트 생성
    renderTaskNotes(task);
});


// 과제 상세 정보 수정 - 데이터 가져오기
const editTaskModal = document.getElementById("editTaskModal");

editTaskModal.addEventListener("show.bs.modal", event => {
    // 수정 버튼의 data-task-id 가져오기
    const taskId = event.relatedTarget.dataset.taskId;

    // 해당 과제 찾기 (DB에서 찾도록 추후 수정 필요)
    const task = tasks.find(task => task.id === taskId);

    if (!task) {
        alert("과제를 찾을 수 없습니다.");
        return;
    }

    // 기존 과제 정보 입력
    document.getElementById("editTaskId").value = task.id;
    document.getElementById("editTaskTitle").value = task.title;
    document.getElementById("editTaskDescription").value = task.description;
    document.getElementById("editTaskDueDate").value = task.dueDate;
    document.getElementById("editTaskStatus").value = task.status;

    // 담당자 다중 선택
    const assigneeSelect = document.getElementById("editTaskAssignees");

    Array.from(assigneeSelect.options).forEach(option => {
        option.selected = task.assignees.includes(option.value);
    });

    editTaskIsActive = task.isActive ?? true;
    updateTaskActiveButton();
});

const taskActiveButton = document.getElementById("taskActiveButton");
let editTaskIsActive = true;

function updateTaskActiveButton() {
    if (editTaskIsActive) {
        taskActiveButton.className = "btn btn-danger";
        taskActiveButton.setAttribute("aria-pressed", "true");
        taskActiveButton.innerHTML = "비활성화";
    }
    else {
        taskActiveButton.className = "btn btn-primary";
        taskActiveButton.setAttribute("aria-pressed", "false");
        taskActiveButton.innerHTML = "활성화";
    }
}

taskActiveButton.addEventListener("click", () => {
    editTaskIsActive = !editTaskIsActive;
    updateTaskActiveButton();
});


// 과제 상세 정보 수정 - 데이터 수정하기
document.getElementById("editTaskForm").addEventListener("submit", event => {
    event.preventDefault();

    // 수정할 과제 찾기
    const taskId = document.getElementById("editTaskId").value;
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
        alert("과제를 찾을 수 없습니다.");
        return;
    }

    // 수정 Modal에서 입력한 값 가져오기
    const title = document.getElementById("editTaskTitle").value.trim();
    const description = document.getElementById("editTaskDescription").value;
    const dueDate = document.getElementById("editTaskDueDate").value;
    const status = document.getElementById("editTaskStatus").value;

    // 담당자 다중 선택
    const assigneeSelect = document.getElementById("editTaskAssignees");
    const assignees = Array.from(assigneeSelect.selectedOptions).map(option => option.value);

    // 기존 과제 객체 수정
    task.title = title;
    task.description = description;
    task.dueDate = dueDate;
    task.status = status;
    task.assignees = assignees;
    task.isActive = editTaskIsActive;

    // 과제 목록 화면 갱신
    renderTaskList();

    // Modal 닫기
    const modalElement = document.getElementById("editTaskModal");
    const modal = bootstrap.Modal.getInstance(modalElement);
    modal.hide();
});


// 담당자별 코멘트 수정하기
const taskNoteList = document.getElementById("task-note-list");

taskNoteList.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;

    const card = button.closest(".task-note-card");
    if (!card) return;

    // 현재 상세 조회 중인 과제 찾기
    const taskId = taskDetailModal.dataset.taskId;
    const task = tasks.find(t => t.id === taskId);

    if (!task) return;

    const userId = card.dataset.userId;

    const view = card.querySelector(".task-note-view");
    const edit = card.querySelector(".task-note-edit");
    const content = card.querySelector(".task-note-content");
    const input = card.querySelector(".task-note-input");

    // 수정 버튼
    if (button.matches(".edit-task-note")) {
        input.value = task.notes?.[userId] ?? "";

        view.classList.add("d-none");
        edit.classList.remove("d-none");
        input.focus();
    }

    // 취소 버튼
    if (button.matches(".cancel-task-note")) {
        edit.classList.add("d-none");
        view.classList.remove("d-none");
    }

    // 저장 버튼
    if (button.matches(".save-task-note")) {
        const newContent = input.value;

        // 데이터 저장
        task.notes ??= {};
        task.notes[userId] = newContent;

        // 화면 갱신
        content.textContent = newContent;

        edit.classList.add("d-none");
        view.classList.remove("d-none");
    }
});



// 필터 적용 시마다 렌더링
document.getElementById("taskSearch").addEventListener("input", renderTaskList);
document.getElementById("taskAssigneeFilter").addEventListener("change", renderTaskList);
document.getElementById("taskStatusFilter").addEventListener("change", renderTaskList);
document.getElementById("hideInactiveTasks").addEventListener("change", renderTaskList);

// 날짜별 정렬 순서 조정
const taskSortButton = document.getElementById("taskSortButton");
taskSortButton.addEventListener("click", () => {
    taskSortIndex = (taskSortIndex + 1) % taskSortOptions.length;

    taskSortButton.innerHTML = `<i class="fas fa-sort me-1"></i> ${taskSortOptions[taskSortIndex].label}`;

    renderTaskList();
});

// 필터 초기화
document.getElementById("resetTaskFilter").addEventListener("click", () => {
    document.getElementById("taskSearch").value = "";
    document.getElementById("taskAssigneeFilter").value = "all";
    document.getElementById("taskStatusFilter").value = "all";
    document.getElementById("hideInactiveTasks").checked = false;

    taskSortIndex = 0;
    taskSortButton.innerHTML = `<i class="fas fa-sort me-1"></i> ${taskSortOptions[taskSortIndex].label}`;

    renderTaskList();
})

// 초기 렌더링
renderTaskList();
