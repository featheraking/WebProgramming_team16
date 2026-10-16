
let projects = [];

try {
    const savedProjects = JSON.parse(
        localStorage.getItem("projects") || "[]"
    );

    projects = Array.isArray(savedProjects) ? savedProjects : [];
} catch (error) {
    console.error("프로젝트 데이터 불러오기 실패:", error);
}

function getTodayDate() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function saveProjects() {
    localStorage.setItem("projects", JSON.stringify(projects));
}

function createProjectCard(project) {
    const column = document.createElement("div");
    column.className = "col-md-6 col-xl-4";

    column.innerHTML = `
        
            <div class="card h-100 border border-primary border-2 text-black project-card">
                <div class="card-body">

                    <!-- 프로젝트명 (1줄 제한) -->
                    <h4 class="project-card-title text-limit-1">프로젝트 이름</h4>

                    <!-- 생성/마감 날짜 -->
                    <p class="mb-3">
                        <i class="fas fa-calendar-plus"></i>
                        생성일자: <span class="project-created-at"></span>
                        <br>
                        <i class="fas fa-calendar-check"></i>
                        마감일: <span class="project-due-date"></span>
                    </p>

                    <!-- 프로젝트 설명란 (2줄 제한) -->
                    <p class="project-card-expl text-limit-2"></p>

                    <!-- 과제/참여자 수 -->
                    <div class="d-flex flex-wrap justify-content-between my-3">
                        <span class="task-count me-3"></span>
                        <span class="member-count me-3"></span>
                        <span></span>
                    </div>

                    <!-- 입장 버튼 -->
                    <div class="d-flex align-items-center justify-content-end mt-auto">
                        <a class="btn btn-primary px-4 py-2 mt-2">enter</a>
                    </div>

                </div>
            </div>
        
    `;

    column.querySelector("h4").textContent = project.name;
    column.querySelector(".project-card-expl").textContent = project.description;

    column.querySelector(".project-created-at").textContent = `${project.createdAt}`;
    column.querySelector(".project-due-date").textContent = `${project.dueDate}`;

    column.querySelector(".task-count").textContent = `과제 ${project.taskCount}개`;
    column.querySelector(".member-count").textContent = `참여자 ${project.memberCount}/${project.maxMembers}명`;

    column.querySelector("a").href = `project.html?id=${encodeURIComponent(project.id)}`;

    return column;
}

function renderProjects() {

    const container = document.getElementById("project-list");

    if (!container) {
        console.error("project-list 요소를 찾을 수 없습니다.");
        return;
    }

    // 기존 프로젝트 카드 제거
    container.replaceChildren();

    // 프로젝트가 하나도 없을 경우
    if (projects.length === 0) {
        const emptyMessage = document.createElement("div");
        emptyMessage.className = "col-12 text-center text-muted py-5";
        emptyMessage.textContent = "등록된 프로젝트가 없습니다.";

        container.appendChild(emptyMessage);
        return;
    }

    // 프로젝트 목록 순회 및 카드 생성
    projects.forEach(project => {
        const card = createProjectCard(project);
        container.appendChild(card);
    });
}

function createProject(data) {

    // 프로젝트 객체 생성
    const newProject = {
        id: crypto.randomUUID(),
        name: data.name,
        description: data.description,
        createdAt: getTodayDate(),
        dueDate: data.dueDate,
        taskCount: 0,
        memberCount: 1,
        maxMembers: data.maxMembers
    };

    // 배열에 추가
    projects.push(newProject);

    // 브라우저 저장
    saveProjects();

    // 화면 갱신
    renderProjects();

    return newProject;
}

document.addEventListener("DOMContentLoaded", () => {

    // 프로젝트 목록 출력
    renderProjects();

    const form = document.getElementById("createProjectForm");
    const modalElement = document.getElementById("createProjectModal");

    if (!form || !modalElement) {
        console.error("프로젝트 생성 Form 또는 Modal을 찾을 수 없습니다.");
        return;
    }

    // 프로젝트 생성 버튼 이벤트
    form.addEventListener("submit", event => {

        // 기본 제출 동작 방지
        event.preventDefault();

        // Modal 입력값 추출
        const data = {
            name: document.getElementById("projectName").value.trim(),

            description: document.getElementById("projectDescription")
                .value.trim(),

            dueDate: document.getElementById("projectDueDate").value,

            maxMembers: Number(
                document.getElementById("projectMaxMembers").value
            )
        };


        // 프로젝트 생성
        try {
            createProject(data);
        } catch (error) {
            console.error("프로젝트 생성 실패:", error);
            alert("프로젝트 생성 중 오류가 발생했습니다.");
            return;
        }

        // Modal 입력값 초기화
        form.reset();

        // Modal 닫기
        const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
        modal.hide();
    });

});