// js/eisenhowerMatrix.js
import * as data from "./dataManager.js";

let eisenhowerModal = null;
let eisenhowerBtn = null;
let closeEisenhowerBtn = null;
let eisenhowerContainer = null;
let quadrants = {};

// 사분면별 우선순위 매핑
const QUADRANT_PRIORITY_MAP = {
  1: 1, // 1사분면 (우상단): 중요하고 긴급함 -> 1순위
  2: 3, // 2사분면 (좌상단): 중요하지만 긴급하지 않음 -> 3순위
  3: 4, // 3사분면 (좌하단): 중요하지 않고 긴급하지 않음 -> 4순위
  4: 2, // 4사분면 (우하단): 중요하지 않지만 긴급함 -> 2순위
};

export function initEisenhowerMatrix() {
  eisenhowerModal = document.getElementById("eisenhowerMatrixModal");
  eisenhowerBtn = document.getElementById("eisenhowerBtn");
  closeEisenhowerBtn = document.getElementById("closeEisenhowerBtn");
  eisenhowerContainer = document.getElementById("eisenhowerContainer");

  if (!eisenhowerModal || !eisenhowerBtn || !closeEisenhowerBtn) {
    console.error("Eisenhower Matrix DOM elements not found!");
    return;
  }

  // 사분면 요소들 초기화
  quadrants = {
    1: document.getElementById("quadrant-1"),
    2: document.getElementById("quadrant-2"),
    3: document.getElementById("quadrant-3"),
    4: document.getElementById("quadrant-4"),
  };

  // 이벤트 리스너 설정
  eisenhowerBtn.addEventListener("click", openEisenhowerMatrix);
  closeEisenhowerBtn.addEventListener("click", closeEisenhowerMatrix);

  // 모달 배경 클릭 시 닫기
  eisenhowerModal.addEventListener("click", (e) => {
    if (e.target === eisenhowerModal) {
      closeEisenhowerMatrix();
    }
  });

  // 각 사분면에 드래그앤드롭 이벤트 설정
  Object.keys(quadrants).forEach((quadrantId) => {
    const quadrant = quadrants[quadrantId];
    if (quadrant) {
      setupQuadrantDragAndDrop(quadrant, parseInt(quadrantId));
    }
  });

  console.log("Eisenhower Matrix Module Initialized.");
}

function openEisenhowerMatrix() {
  eisenhowerModal.style.display = "flex";
  renderEisenhowerMatrix();
}

function closeEisenhowerMatrix() {
  eisenhowerModal.style.display = "none";
}

function renderEisenhowerMatrix() {
  const state = data.getState();
  const backlogTodos = state.backlogTodos || [];

  // 모든 사분면 초기화
  Object.values(quadrants).forEach((quadrant) => {
    if (quadrant) {
      quadrant.innerHTML = "";
    }
  });

  // 백로그 할 일들을 우선순위별로 사분면에 배치
  backlogTodos.forEach((todo) => {
    const quadrantId = getQuadrantByPriority(todo.priority);
    const quadrant = quadrants[quadrantId];

    if (quadrant) {
      const todoElement = createEisenhowerTodoElement(todo);
      quadrant.appendChild(todoElement);
    }
  });
}

function getQuadrantByPriority(priority) {
  // 우선순위에 따른 사분면 반환
  switch (priority) {
    case 1:
      return 1; // 1순위 -> 1사분면
    case 2:
      return 4; // 2순위 -> 4사분면
    case 3:
      return 2; // 3순위 -> 2사분면
    case 4:
      return 3; // 4순위 -> 3사분면
    default:
      return 3; // 기본값은 3사분면 (4순위)
  }
}

function createEisenhowerTodoElement(todo) {
  const item = document.createElement("div");
  item.className = "mv-eisenhower-todo-item";
  item.dataset.todoId = todo.id;
  item.draggable = true;

  const textDiv = document.createElement("div");
  textDiv.className = "mv-todo-text";
  textDiv.textContent = todo.text;

  const priorityDiv = document.createElement("div");
  priorityDiv.className = "mv-todo-priority";
  priorityDiv.textContent = `Priority: ${todo.priority}`;

  item.appendChild(textDiv);
  item.appendChild(priorityDiv);

  // 드래그 이벤트 설정
  item.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", todo.id);
    e.dataTransfer.setData("application/x-eisenhower-source", "true");
    e.dataTransfer.effectAllowed = "move";
    item.classList.add("mv-dragging");
  });

  item.addEventListener("dragend", () => {
    item.classList.remove("mv-dragging");
  });

  return item;
}

// backlog.js의 getDragAfterElement와 유사한 함수
function getDragAfterElementForEisenhower(container, y) {
  const draggableElements = [
    ...container.querySelectorAll(".mv-eisenhower-todo-item:not(.mv-dragging)"),
  ];
  const result = draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY }
  );
  return result.element;
}

function setupQuadrantDragAndDrop(quadrant, quadrantId) {
  quadrant.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    quadrant.classList.add("mv-drag-over");

    // 아이젠하워 매트릭스 내부에서 드래그된 항목인 경우 순서 변경을 위한 시각적 피드백
    if (e.dataTransfer.types.includes("application/x-eisenhower-source")) {
      const draggingItem = quadrant.querySelector(
        ".mv-eisenhower-todo-item.mv-dragging"
      );
      if (!draggingItem) return;

      const afterElement = getDragAfterElementForEisenhower(
        quadrant,
        e.clientY
      );
      if (afterElement === draggingItem) return;

      if (afterElement == null) {
        if (quadrant.lastChild !== draggingItem) {
          quadrant.appendChild(draggingItem);
        }
      } else {
        if (afterElement !== draggingItem.nextSibling) {
          quadrant.insertBefore(draggingItem, afterElement);
        }
      }
    }
  });

  quadrant.addEventListener("dragleave", (e) => {
    // 드래그가 실제로 사분면을 벗어났을 때만 클래스 제거
    if (!quadrant.contains(e.relatedTarget)) {
      quadrant.classList.remove("mv-drag-over");
    }
  });

  quadrant.addEventListener("drop", (e) => {
    e.preventDefault();
    quadrant.classList.remove("mv-drag-over");

    // 백로그에서 드래그된 항목인지 확인
    if (e.dataTransfer.types.includes("application/x-backlog-source")) {
      const todoId = e.dataTransfer.getData("text/plain");
      const newPriority = QUADRANT_PRIORITY_MAP[quadrantId];

      if (newPriority) {
        data.updateBacklogTodoPriority(todoId, newPriority);
        // 데이터 변경 이벤트로 인해 renderBacklog가 호출될 것
      }
    }
    // 아이젠하워 매트릭스 내부에서 드래그된 항목인지 확인
    else if (e.dataTransfer.types.includes("application/x-eisenhower-source")) {
      const todoId = e.dataTransfer.getData("text/plain");
      const newPriority = QUADRANT_PRIORITY_MAP[quadrantId];

      if (newPriority) {
        // 우선순위가 변경된 경우에만 업데이트
        const state = data.getState();
        const todo = state.backlogTodos.find((t) => t.id === todoId);
        if (todo && todo.priority !== newPriority) {
          data.updateBacklogTodoPriority(todoId, newPriority);
        }

        // 같은 사분면 내에서 순서 변경인 경우 (우선순위는 그대로, 순서만 변경)
        if (todo && todo.priority === newPriority) {
          // 전체 백로그 목록에서 현재 사분면의 할 일들만 순서 변경
          const state = data.getState();
          const allBacklogTodos = state.backlogTodos || [];

          // 현재 사분면의 할 일들만 추출
          const currentQuadrantTodos = allBacklogTodos.filter(
            (t) => t.priority === newPriority
          );

          // 새로운 순서로 정렬
          const newOrderedIds = [
            ...quadrant.querySelectorAll(".mv-eisenhower-todo-item"),
          ].map((item) => item.dataset.todoId);

          // 현재 사분면의 할 일들을 새로운 순서로 재정렬
          const reorderedQuadrantTodos = newOrderedIds
            .map((id) => currentQuadrantTodos.find((t) => t.id === id))
            .filter(Boolean);

          // 다른 사분면의 할 일들과 합쳐서 전체 목록 재구성
          const otherQuadrantTodos = allBacklogTodos.filter(
            (t) => t.priority !== newPriority
          );
          const finalOrderedTodos = [
            ...otherQuadrantTodos,
            ...reorderedQuadrantTodos,
          ];

          // 전체 목록을 새로운 순서로 업데이트
          data.reorderBacklogTodos(finalOrderedTodos.map((t) => t.id));
        }

        // 매트릭스 내부에서도 재렌더링
        renderEisenhowerMatrix();
      }
    }
  });
}

// 데이터 변경 이벤트 리스너 (외부에서 호출)
export function onDataChanged() {
  if (eisenhowerModal && eisenhowerModal.style.display === "flex") {
    renderEisenhowerMatrix();
  }
}
