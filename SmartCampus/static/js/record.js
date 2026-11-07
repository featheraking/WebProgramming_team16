// 공용 가져오기
import { getCurrentDateTime, currentUserId, Users } from "./workspace_utils.js";


// 하위 기록을 펼칠 때 끊어서 보여주는 개수
const recordPageSize = 4;


// 임시 데이터
const initialRecords = [
    {
        id: "record1",
        title: "테스트 기록 A",
        content: "테스트 기록 내용 A",
        authorId: "user1",
        createdAt: "2026-11-04 10:00",
        isHidden: false,
        history: [],
        children: [
            { id: "child3", authorId: "user3", content: "숨겨진 기록", createdAt: "2026-11-01 17:30", isHidden: true, editedAt: "2026-11-04 19:00" },
            { id: "child2", authorId: "user1", content: "A의 기록", createdAt: "2026-11-01 10:30", isHidden: false, editedAt: null },
            { id: "child1", authorId: "user2", content: "B의 기록", createdAt: "2026-11-01 11:00", isHidden: false, editedAt: null }
        ]
    },
    {
        id: "record2",
        title: "테스트 기록 B",
        content: "테스트 기록 내용 B",
        authorId: "user2",
        createdAt: "2026-11-03 09:00",
        isHidden: false,
        history: [],
        children: []
    }
];


// 저장/불러오기 및 기본 유틸리티
let records = structuredClone(initialRecords);
let openRecordId = null;
const childPageCounts = {};  // 부모 기록별 현재 표시 개수
let hideOtherHiddenRecords = false;

const recordList = document.getElementById("record-list");
const createRecordModal = document.getElementById("createRecordModal");
const editRecordModal = document.getElementById("editRecordModal");


function recordUserName(userId) {
    return Users[userId] ?? userId;
}

function isVisibleRecord(record) {
    return !(hideOtherHiddenRecords && record.isHidden && record.authorId !== currentUserId);
}

function findRecord(id) {
    return records.find(record => record.id === id);
}


// 하위 기록 카드 생성
function renderChildRecord(child) {
    if (!isVisibleRecord(child)) return null;

    const template = document.getElementById("child-record-template");

    const card = template.content.firstElementChild.cloneNode(true);

    const own = child.authorId === currentUserId;

    const hiddenOther = child.isHidden && !own;

    // 하위 기록 고유 ID
    card.dataset.childId = child.id;

    // 기본 정보
    card.querySelector(".child-record-author").textContent = recordUserName(child.authorId);

    // 생성/수정된 시간
    card.querySelector(".child-record-timestamp").textContent = child.editedAt ?? child.createdAt;

    // 수정 여부
    if (child.editedAt) {
        card.querySelector(".child-record-edited").classList.remove("d-none");
    }

    // 본인의 숨겨진 기록
    if (child.isHidden && own) {
        card.querySelector(".child-record-hidden").classList.remove("d-none");
    }

    // 내용
    const contentElement = card.querySelector(".child-record-content");
    contentElement.textContent = hiddenOther ? "숨겨진 기록입니다." : child.content;


    // 다른 사람의 숨겨진 기록
    if (hiddenOther) {
        contentElement.classList.add("text-muted");

        card.querySelector(".child-record-actions").remove();
        card.querySelector(".child-record-edit").remove();

        contentElement.classList.replace("mb-3", "mb-0");

        return card;
    }

    // 본인 기록이 아닌 경우 수정 버튼 제거
    if (!own) {
        card.querySelector(".child-record-actions").remove();
        card.querySelector(".child-record-edit").remove();
    } else {
        // 숨김 상태에 따라 버튼 문구 변경
        const hideButton = card.querySelector('[data-action="toggle-child-hidden"]');
        hideButton.textContent = child.isHidden ? "숨김 해제" : "숨김";
    }

    return card;
}

function renderChildrenIntoCard(card, record) {
    const childrenList = card.querySelector(".childRecordList");

    childrenList.replaceChildren();

    const children = (record.children ?? []).map((child, index) => ({ child, index }))
        .filter(({ child }) => isVisibleRecord(child))
        .sort((a, b) => { b.child.createdAt.localeCompare(a.child.createdAt) || b.index - a.index });

    const count = childPageCounts[record.id] ?? recordPageSize;

    const visibleChildren = children.slice(0, count);

    visibleChildren.forEach(({ child }) => {
        const childCard = renderChildRecord(child);

        if (childCard) {
            childrenList.appendChild(childCard);
        }
    });

    // 하위 기록이 없는 경우
    if (children.length === 0) {
        const message = document.createElement("p");

        message.className = "text-muted small mb-0";
        message.textContent = "아직 작성된 하위 기록이 없습니다.";

        childrenList.appendChild(message);
    }

    // 더 보기 버튼 표시 여부
    const moreWrap = card.querySelector(".record-more-wrap");

    moreWrap.classList.toggle(
        "d-none",
        children.length <= count
    );
}

// 상위 기록 카드 생성
function renderParentRecord(record) {
    if (!isVisibleRecord(record)) return null;

    const template = document.getElementById("parent-record-template");

    const card = template.content.firstElementChild.cloneNode(true);

    const own = record.authorId === currentUserId;
    const hiddenOther = record.isHidden && !own;

    // 상위 기록 고유 ID
    card.dataset.recordId = record.id;

    // 기본 정보
    card.querySelector(".record-title").textContent = hiddenOther ? "숨겨진 기록입니다." : record.title;
    card.querySelector(".record-created-at").textContent = record.createdAt;
    card.querySelector(".record-author").textContent = recordUserName(record.authorId);

    const contentElement = card.querySelector(".record-content");
    contentElement.textContent = hiddenOther ? "숨겨진 기록입니다." : record.content;

    // 작성자 본인의 숨김 표시
    if (record.isHidden && own) {
        const hiddenBadge = document.createElement("span");

        hiddenBadge.className = "badge bg-secondary ms-2";
        hiddenBadge.textContent = "숨김";

        card.querySelector(".record-created-at").appendChild(hiddenBadge);
    }

    // 다른 사용자가 숨긴 상위 기록
    if (hiddenOther) {
        contentElement.classList.add("text-muted");

        card.querySelector(".record-actions").remove();
        card.querySelector(".record-composer").remove();
        card.querySelector(".record-children-panel").remove();

        return card;
    }

    // 본인 기록이 아닌 경우 수정 버튼 숨김
    if (!own) {
        card.querySelector('[data-action="edit-parent"]').remove();
    }


    // 펼침 여부
    const expanded = openRecordId === record.id;

    const toggleButton = card.querySelector('[data-action="toggle-children"]');
    toggleButton.dataset.id = record.id;

    const childrenPanel = card.querySelector(".record-children-panel");

    toggleButton.textContent = expanded ? "접기" : "펼치기";

    if (expanded) {
        // 하위 기록 목록 생성
        renderChildrenIntoCard(card, record);

        // 생성된 하위 기록 목록 표시
        childrenPanel.classList.remove("d-none");
    }
    else {
        childrenPanel.classList.add("d-none");
    }

    return card;
}

// 상위 기록 목록 갱신 (상위 기록 최신순)
function renderRecordList() {
    recordList.replaceChildren();
    const visible = records.filter(isVisibleRecord).map((record, index) => ({ record, index }))
        .sort((a, b) => { b.record.createdAt.localeCompare(a.record.createdAt) || b.index - a.index });

    // 보여줄 기록이 없을 때
    if (visible.length === 0) {

        const element = document.createElement("p");
        element.className = "text-muted text-center py-4";
        element.textContent = "표시할 기록이 없습니다.";

        recordList.appendChild(element);

        return;
    }

    visible.forEach(({ record }) => {
        const card = renderParentRecord(record);
        if (card) recordList.appendChild(card);
    });
}

// 상위 기록 생성
const createRecordForm = document.getElementById("createRecordForm");

createRecordForm.addEventListener("submit", event => {
    event.preventDefault();

    const title = document.getElementById("recordTitle").value.trim();
    const content = document.getElementById("recordContent").value.trim();

    records.push({
        id: crypto.randomUUID(),
        title: title,
        content: content,
        authorId: currentUserId,
        createdAt: getCurrentDateTime(true),
        isHidden: false,
        history: [],
        children: []
    });

    renderRecordList();

    bootstrap.Modal.getInstance(createRecordModal)?.hide();

    createRecordForm.reset();
});


// 상위 기록 수정
function openEditRecordModal(record) {
    if (record.authorId !== currentUserId) return;

    document.getElementById("editRecordId").value = record.id;
    document.getElementById("editRecordTitle").value = record.title;
    document.getElementById("editRecordContent").value = record.content;
    document.getElementById("editRecordIsHidden").checked = record.isHidden;

    bootstrap.Modal.getOrCreateInstance(editRecordModal).show();
}

document.getElementById("editRecordForm").addEventListener("submit", event => {
    event.preventDefault();

    const record = findRecord(document.getElementById("editRecordId").value);

    // 작성자가 아니면 수정 불가
    if (!record || record.authorId !== currentUserId) {
        alert("수정할 권한이 없습니다.");
        return;
    }

    // 데이터 불러오기
    const title = document.getElementById("editRecordTitle").value.trim();
    const content = document.getElementById("editRecordContent").value.trim();
    const isHidden = document.getElementById("editRecordIsHidden").checked;

    if (!title || !content) {
        alert("기록 제목과 내용을 입력해주세요.");
        return;
    }

    // 수정 이력 등록
    if (title !== record.title || content !== record.content) {
        record.history ??= [];
        record.history.push({
            recordId: record.id,
            previousTitle: record.title,
            previousContent: record.content,
            editedAt: getCurrentDateTime()
        });
    }

    // 수정 반영
    record.title = title;
    record.content = content;
    record.isHidden = isHidden;

    renderRecordList();

    bootstrap.Modal.getInstance(editRecordModal)?.hide();
});

// 상위 기록 수정 이력
function openHistoryModal(record) {
    document.getElementById("historyRecordTitle").textContent = record.title;

    const list = document.getElementById("recordHistoryList");
    const template = document.getElementById("recordHistoryTemplate");

    list.replaceChildren();

    const history = [...(record.history ?? [])].reverse();

    if (history.length === 0) {
        const message = document.createElement("p");
        message.className = "text-muted";
        message.textContent = "수정 이력이 없습니다.";

        list.appendChild(message);
    }

    history.forEach(item => {
        const card = template.content.firstElementChild.cloneNode(true);

        card.querySelector(".history-date").textContent = `${item.editedAt}에 수정됨`;
        card.querySelector(".history-title").textContent = item.previousTitle;

        const content = card.querySelector(".history-content");

        content.textContent = item.previousContent;

        list.appendChild(card);
    });

    bootstrap.Modal.getOrCreateInstance(document.getElementById("recordHistoryModal")).show();
}


/* 기록 목록 버튼 이벤트 처리 */
recordList.addEventListener("click", event => {
    // 클릭한 버튼 찾기
    const button = event.target.closest("button[data-action]");
    if (!button || !recordList.contains(button)) return;

    // 버튼 동작 및 소속 상위 기록 찾기
    const action = button.dataset.action;

    const recordCard = button.closest(".record-card");
    if (!recordCard) return;

    const record = records.find(
        item => item.id === recordCard.dataset.recordId
    );

    if (!record) return;

    // 상위 기록 펼치기/접기
    if (action === "toggle-children") {
        openRecordId = openRecordId === record.id ? null : record.id;

        renderRecordList();
        return;
    }

    // 상위 기록 수정
    if (action === "edit-parent") {
        openEditRecordModal(record);
        return;
    }

    // 상위 기록 수정 이력 조회
    if (action === "history-parent") {
        openHistoryModal(record);
        return;
    }

    // 하위 기록 작성
    if (action === "create-child") {
        const input = recordCard.querySelector(".new-child-content");
        const content = input?.value.trim();

        if (!content) {
            alert("하위 기록 내용을 입력해주세요.");
            return;
        }

        record.children ??= [];

        record.children.push({
            id: crypto.randomUUID(),
            authorId: currentUserId,
            content: content,
            createdAt: getCurrentDateTime(true),
            editedAt: null,
            isHidden: false
        });

        // 새로 작성한 하위 기록이 보이도록 자동 펼치기
        childPageCounts[record.id] = recordPageSize;
        openRecordId = record.id;

        renderRecordList();
        return;
    }

    // 하위 기록 더 보기
    if (action === "more-children") {
        childPageCounts[record.id] = (childPageCounts[record.id] ?? recordPageSize) + recordPageSize;

        renderRecordList();
        return;
    }

    // 하위 기록 데이터 찾기

    // 클릭된 버튼이 포함된 하위 기록 카드
    const childCard = button.closest(".child-record-card");
    if (!childCard) return;

    // 카드에 저장된 하위 기록 ID 사용
    const childId = childCard.dataset.childId;

    const child = (record.children ?? []).find(item => item.id === childId);
    if (!child) return;

    // 작성자 본인만 수정 및 숨김 가능
    if (child.authorId !== currentUserId) return;

    // 카드 내부 요소
    const view = childCard.querySelector(".child-record-view");
    const edit = childCard.querySelector(".child-record-edit");
    const input = childCard.querySelector(".child-record-input");


    // 하위 기록 수정 모드
    if (action === "edit-child") {
        input.value = child.content;

        view.classList.add("d-none");
        edit.classList.remove("d-none");

        input.focus();
        return;
    }

    // 하위 기록 수정 취소
    if (action === "cancel-child") {
        edit.classList.add("d-none");
        view.classList.remove("d-none");
        return;
    }

    // 하위 기록 수정 저장
    if (action === "save-child") {
        const content = input.value.trim();

        if (!content) {
            alert("하위 기록 내용을 입력해주세요.");
            return;
        }

        // 수정 시각 갱신
        if (child.content !== content) {
            child.content = content;
            child.editedAt = getCurrentDateTime(true);
        }

        renderRecordList();
        return;
    }

    // 하위 기록 숨김/숨김 해제
    if (action === "toggle-child-hidden") {
        child.isHidden = !child.isHidden;

        renderRecordList();
        return;
    }
});


// 타인의 숨김 기록 자체를 감추기
const hideOtherHiddenRecordsInput = document.getElementById("hideOtherHiddenRecords");

hideOtherHiddenRecordsInput.addEventListener("change", () => {
    hideOtherHiddenRecords = hideOtherHiddenRecordsInput.checked;
    renderRecordList();
});


// 최초 렌더링
renderRecordList();
