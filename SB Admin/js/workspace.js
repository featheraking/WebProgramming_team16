// 공용 함수 가져오기
import { generateInviteCode, getCurrentDateTime, currentUserId, Users } from "./workspace_utils.js";


// 임시 프로젝트 데이터

const projects = [
    {
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
    }
];


//프로젝트 생성
function createProject(data) {
    const newProject = {
        id: crypto.randomUUID(),
        name: data.name,
        description: data.description,
        createdAt: getCurrentDateTime(),
        dueDate: data.dueDate,
        adminId: currentUserId,
        inviteCode: generateInviteCode(),
        maxMembers: data.maxMembers,
        currentMembers: [currentUserId],
        taskCount: 0
    };

    projects.push(newProject);

    return newProject;
}


// 프로젝트 카드 생성
function createProjectCard(project) {
    const template = document.getElementById("projectCardTemplate");

    const card = template.content.firstElementChild.cloneNode(true);

    // 프로젝트 ID 저장
    card.dataset.projectId = project.id;

    // 프로젝트명
    card.querySelector(".project-card-title").textContent = project.name;

    // 프로젝트 설명
    card.querySelector(".project-card-expl").textContent = project.description;

    // 날짜
    card.querySelector(".project-created-at").textContent = project.createdAt;
    card.querySelector(".project-due-date").textContent = project.dueDate;

    // 과제 개수
    card.querySelector(".task-count").textContent = `과제 ${project.taskCount}개`;

    // 참여 인원
    card.querySelector(".member-count").textContent = `참여자 ${project.currentMembers.length}/${project.maxMembers}명`;

    // 프로젝트 상세 페이지 이동
    card.querySelector(".projectEnter").href = `project.html?id=${encodeURIComponent(project.id)}`;

    return card;
}


// 프로젝트 필터링 및 정렬
function getFilteredProjects() {
    // 값 받아오기
    const search = document.getElementById("projectSearch").value.trim().toLowerCase();
    const sortOrder = document.getElementById("projectSort").value;
    const startDate = document.getElementById("projectStartDate").value;
    const endDate = document.getElementById("projectEndDate").value;

    // 검색 및 생성일 기간 필터링
    const filteredProjects = projects.filter(project => {
        const matchName = project.name.toLowerCase().includes(search);
        const matchStart = !startDate || project.createdAt >= startDate;
        const matchEnd = !endDate || project.createdAt <= endDate;
        return matchName && matchStart && matchEnd;
    });

    // 생성일 기준 정렬
    filteredProjects.sort((a, b) => {
        const result = a.createdAt.localeCompare(b.createdAt);
        return sortOrder === "asc" ? result : -result;
    });

    return filteredProjects;
}


// 프로젝트 목록 렌더링
function renderProjects() {
    const container = document.getElementById("project-list");

    const filteredProjects = getFilteredProjects();

    container.replaceChildren();

    // 표시할 프로젝트가 없는 경우
    if (filteredProjects.length === 0) {
        const emptyMessage = document.createElement("div");

        emptyMessage.className = "col-12 text-center text-muted py-5";
        emptyMessage.textContent = projects.length === 0 ? "등록된 프로젝트가 없습니다." : "조건에 맞는 프로젝트가 없습니다.";

        container.appendChild(emptyMessage);
        return;
    }

    // 프로젝트 카드 출력
    filteredProjects.forEach(project => {
        const card = createProjectCard(project);
        container.appendChild(card);
    });
}


// 프로젝트 생성 폼
const createProjectForm = document.getElementById("createProjectForm");

createProjectForm.addEventListener("submit", event => {
    event.preventDefault();

    // 값 받아오기
    const name = document.getElementById("projectName").value.trim();
    const description = document.getElementById("projectDescription").value.trim();
    const dueDate = document.getElementById("projectDueDate").value;
    const maxMembers = Number(document.getElementById("projectMaxMembers").value);

    // 입력값 검사
    if (!Number.isInteger(maxMembers) || maxMembers < 1) {
        alert("최대 참여 인원을 올바르게 입력해주세요.");
        return;
    }

    // 새 프로젝트 생성
    createProject({ name, description, dueDate, maxMembers });

    // 목록 갱신
    renderProjects();

    // 입력 폼 초기화
    createProjectForm.reset();

    // Modal 닫기
    const modalElement = document.getElementById("createProjectModal");

    bootstrap.Modal.getOrCreateInstance(modalElement).hide();
});


// 프로젝트 검색 & 필터 이벤트
document.getElementById("projectSearch").addEventListener("input", renderProjects);

document.getElementById("projectSort").addEventListener("change", renderProjects);
document.getElementById("projectStartDate").addEventListener("change", renderProjects);
document.getElementById("projectEndDate").addEventListener("change", renderProjects);


// 필터 초기화
document.getElementById("resetProjectFilters").addEventListener("click", () => {
    document.getElementById("projectSearch").value = "";
    document.getElementById("projectSort").value = "desc";
    document.getElementById("projectStartDate").value = "";
    document.getElementById("projectEndDate").value = "";

    renderProjects();
});


// 초기 렌더링
renderProjects();
