import { generateId } from "./uiUtils.js"; // ID 생성을 위해 import
import { triggerFullYearSave } from "./dirtyFileService.js";
import * as dirtyFileService from "./dirtyFileService.js";

// dataManager와 eventBus는 init 함수에서 주입받아 사용합니다.
let data;
let eventBus;

let draggedMandalId = null; // 드래그 중인 항목의 ID를 저장할 변수

// 이 뷰에서 추가한 모든 이벤트 리스너를 추적하여 cleanup 시 제거하기 위한 배열
const activeEventListeners = [];

// 컨텍스트 메뉴가 대상으로 하는 ID를 저장하기 위한 모듈 변수
let contextMenuTarget = {
  cellId: null,
  mandalId: null,
};

// --- 9x9 그리드 상수 (모듈 스코프에 유지) ---
const NINE_GRID_CONFIG = {
  CENTRAL_GOAL_INDEX: 40,
  PALETTE: {
    30: { bg: "#ffcdd2", text: "#000000" },
    31: { bg: "#ffe0b2", text: "#000000" },
    32: { bg: "#fff9c4", text: "#000000" },
    39: { bg: "#c8e6c9", text: "#000000" },
    40: { bg: "#ffffff", text: "#000000" },
    41: { bg: "#b3e5fc", text: "#000000" },
    48: { bg: "#c5cae9", text: "#000000" },
    49: { bg: "#e1bee7", text: "#000000" },
    50: { bg: "#212121", text: "#ffffff" },
  },
  SYNC_MAP: { 30: 10, 31: 13, 32: 16, 39: 37, 41: 43, 48: 64, 49: 67, 50: 70 },
};

// --- 헬퍼 함수 ---
function getRepresentativeColor(cellIndex) {
  const row = Math.floor(cellIndex / 9);
  const col = cellIndex % 9;
  const blockRow = Math.floor(row / 3);
  const blockCol = Math.floor(col / 3);
  const topicCellIndex = (blockRow + 3) * 9 + (blockCol + 3);
  return NINE_GRID_CONFIG.PALETTE[topicCellIndex]?.bg || "#ffffff";
}

// --- 렌더링 함수 ---
function render() {
  if (!data.getMandalArtState()) return; // 데이터가 아직 없으면 렌더링 중단
  renderSidebar();
  const mode = data.getSettings()?.mandalArtViewMode || "grid";
  if (mode === "matrix") {
    renderMatrix();
  } else {
    renderGrid();
  }
}

function renderSidebar() {
  const mandalListEl = document.getElementById("mandal-list");
  if (!mandalListEl || !data) return;
  const mandalState = data.getMandalArtState();
  if (!mandalState) return;
  mandalListEl.innerHTML = "";
  mandalState.mandalArts.forEach((mandal) => {
    const li = document.createElement("li");
    li.textContent = mandal.name;
    li.dataset.id = mandal.id;
    li.draggable = true; // ▼▼▼ [추가] 드래그 가능하도록 설정 ▼▼▼
    if (mandal.id === mandalState.activeMandalArtId) li.classList.add("active");
    mandalListEl.appendChild(li);
  });
}

function renderGrid() {
  const gridContainerEl = document.getElementById("mandal-art-grid");
  if (!gridContainerEl || !data) return;
  const matrixContainerEl = document.getElementById("mandal-art-matrix");
  if (matrixContainerEl) matrixContainerEl.style.display = "none";
  gridContainerEl.style.display = "";

  const mandalState = data.getMandalArtState();
  const activeMandal = mandalState.mandalArts.find(
    (m) => m.id === mandalState.activeMandalArtId
  );

  gridContainerEl.innerHTML = "";
  if (!activeMandal) return;

  gridContainerEl.style.setProperty("--mandal-grid-size", 9);
  gridContainerEl.className = "mandal-art-grid-container grid-9x9";

  activeMandal.cells.forEach((cellData, i) => {
    const cellEl = document.createElement("div");
    cellEl.className = "cell";
    cellEl.dataset.id = cellData.id;

    const row = Math.floor(i / 9);
    const col = i % 9;
    const textarea = document.createElement("textarea");

    if ((col + 1) % 3 === 0 && col < 8)
      cellEl.classList.add("border-right-bold");
    if ((row + 1) % 3 === 0 && row < 8)
      cellEl.classList.add("border-bottom-bold");

    const syncSourceIndex = Object.keys(NINE_GRID_CONFIG.SYNC_MAP).find(
      (key) => NINE_GRID_CONFIG.SYNC_MAP[key] === i
    );
    if (syncSourceIndex) {
      cellData.content = activeMandal.cells[syncSourceIndex].content;
      cellEl.classList.add("sub-goal");
      textarea.readOnly = true;
    }

    if (i === NINE_GRID_CONFIG.CENTRAL_GOAL_INDEX) {
      cellEl.classList.add("central-goal");
      cellData.content = activeMandal.name;
    }

    const paletteInfo =
      NINE_GRID_CONFIG.PALETTE[i] || NINE_GRID_CONFIG.PALETTE[syncSourceIndex];
    if (paletteInfo) {
      cellEl.style.backgroundColor = paletteInfo.bg;
      textarea.style.color = paletteInfo.text;
    }

    if (cellData.color) {
      cellEl.style.backgroundColor = cellData.color;
    }

    if (cellData.isCompleted) {
      cellEl.classList.add("completed");
      cellEl.style.backgroundColor = getRepresentativeColor(i);
    }

    if (cellData.isHighlighted) cellEl.classList.add("highlighted");

    textarea.value = cellData.content;

    const checkmark = document.createElement("div");
    checkmark.className = "checkmark";
    checkmark.innerHTML = "✔";

    cellEl.appendChild(textarea);
    cellEl.appendChild(checkmark);
    gridContainerEl.appendChild(cellEl);
  });
}

// --- Matrix View 렌더링 ---
function renderMatrix() {
  const gridContainerEl = document.getElementById("mandal-art-grid");
  const matrixContainerEl = document.getElementById("mandal-art-matrix");
  if (!matrixContainerEl || !data) return;
  if (gridContainerEl) gridContainerEl.style.display = "none";
  matrixContainerEl.style.display = "";

  const mandalState = data.getMandalArtState();
  const activeMandal = mandalState.mandalArts.find(
    (m) => m.id === mandalState.activeMandalArtId
  );
  matrixContainerEl.innerHTML = "";
  if (!activeMandal) return;

  // 헤더 행 (빈 셀 + 1..8)
  const table = document.createElement("table");
  table.className = "mandal-matrix";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const thBlank = document.createElement("th");
  thBlank.textContent = "level";
  headerRow.appendChild(thBlank);
  for (let i = 1; i <= 8; i++) {
    const th = document.createElement("th");
    th.textContent = String(i);
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  // 원본 9x9 인덱스 매핑 준비
  // 주변 8개의 3x3 블록의 중앙 셀 인덱스 (시계방향: 좌상 -> 상 -> 우상 -> 우 -> 우하 -> 하 -> 좌하 -> 좌)
  const outerCenterIndices = [10, 13, 16, 43, 70, 67, 64, 37];
  // 각 블록의 좌상단 좌표 (r,c)
  const outerBlockTopLefts = [
    { r: 0, c: 0 }, // 10
    { r: 0, c: 3 }, // 13
    { r: 0, c: 6 }, // 16
    { r: 3, c: 6 }, // 43
    { r: 6, c: 6 }, // 70
    { r: 6, c: 3 }, // 67
    { r: 6, c: 0 }, // 64
    { r: 3, c: 0 }, // 37
  ];
  // 3x3 블록 내에서 중심(1,1)을 제외한 8방향 순서 (1..8):
  // 1:좌상, 2:상, 3:우상, 4:우, 5:우하, 6:하, 7:좌하, 8:좌
  const localOffsets = [
    { dr: 0, dc: 0 }, // 1
    { dr: 0, dc: 1 }, // 2
    { dr: 0, dc: 2 }, // 3
    { dr: 1, dc: 2 }, // 4
    { dr: 2, dc: 2 }, // 5
    { dr: 2, dc: 1 }, // 6
    { dr: 2, dc: 0 }, // 7
    { dr: 1, dc: 0 }, // 8
  ];
  function cellIndexAtBlock(blockIdx, levelIdx) {
    const tl = outerBlockTopLefts[blockIdx];
    const off = localOffsets[levelIdx];
    const r = tl.r + off.dr;
    const c = tl.c + off.dc;
    return r * 9 + c;
  }
  function topicIndexForCell(cellIndex) {
    const row = Math.floor(cellIndex / 9);
    const col = cellIndex % 9;
    const blockRow = Math.floor(row / 3);
    const blockCol = Math.floor(col / 3);
    return (blockRow + 3) * 9 + (blockCol + 3);
  }
  // target(외곽 중앙) -> source(중앙 링) 역매핑
  const TARGET_TO_SOURCE = Object.entries(NINE_GRID_CONFIG.SYNC_MAP).reduce(
    (acc, [src, tgt]) => {
      acc[tgt] = parseInt(src, 10);
      return acc;
    },
    {}
  );
  // 좌측 라벨: 각 주변 3x3 블록의 중앙 셀 내용으로 표시 (비어있으면 x{n})
  const levelLabels = outerCenterIndices.map((centerIdx) => {
    const sourceIdx = TARGET_TO_SOURCE[centerIdx];
    const label =
      (sourceIdx !== undefined
        ? activeMandal.cells[sourceIdx]?.content
        : activeMandal.cells[centerIdx]?.content) || "";
    return label;
  });
  // 행: 주제(8개 블록), 열: 레벨 1..8 (블록 내 8방향)
  for (let t = 0; t < 8; t++) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    // 편집 가능한 라벨 박스 (textarea로 grid 셀과 동일한 느낌)
    const labelTextarea = document.createElement("textarea");
    labelTextarea.value = levelLabels[t] || "";
    labelTextarea.className = "mandal-matrix-label";
    const centerIdx = outerCenterIndices[t];
    const sourceIdxForThis = TARGET_TO_SOURCE[centerIdx];
    labelTextarea.dataset.sourceIndex = String(
      sourceIdxForThis !== undefined ? sourceIdxForThis : centerIdx
    );
    th.appendChild(labelTextarea);
    // 좌측 라벨 색상을 만다라트의 해당 블록 대표 색상으로 적용
    const topicIdx = topicIndexForCell(centerIdx);
    const paletteInfo = NINE_GRID_CONFIG.PALETTE[topicIdx];
    if (paletteInfo) {
      th.style.backgroundColor = paletteInfo.bg;
      th.style.color = paletteInfo.text;
    }
    tr.appendChild(th);
    for (let lvl = 0; lvl < 8; lvl++) {
      const td = document.createElement("td");
      const textarea = document.createElement("textarea");
      const idx = cellIndexAtBlock(t, lvl);
      const cellData = activeMandal.cells[idx];
      textarea.value = cellData?.content || "";
      textarea.dataset.index = String(idx);
      // 컨텍스트 메뉴를 위해 cellId 추가
      td.dataset.cellId = cellData?.id || `cell-${idx}`;

      // 완료 상태에 따른 스타일링
      if (cellData?.isCompleted) {
        td.classList.add("completed");
        // Grid view와 동일한 대표 색상 적용
        td.style.backgroundColor = getRepresentativeColor(idx);
        // 체크마크 추가
        const checkmark = document.createElement("div");
        checkmark.className = "checkmark";
        checkmark.innerHTML = "✔";
        td.appendChild(checkmark);
      }

      td.appendChild(textarea);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  matrixContainerEl.appendChild(table);
}

// --- 이벤트 핸들러 ---
// 모든 핸들러는 dataManager를 통해 상태를 업데이트합니다.

function handleAddMandal() {
  const name = prompt("새 만다라트의 이름을 입력하세요:", "새 프로젝트");
  if (!name) return;

  const mandalState = JSON.parse(JSON.stringify(data.getMandalArtState())); // 상태 복사
  const newId = generateId("mandal_");
  const newMandal = {
    id: newId,
    name: name,
    type: "9x9",
    cells: Array.from({ length: 81 }, (_, i) => ({
      id: `cell-${i}`,
      content: "",
      isCompleted: false,
      isHighlighted: false,
      color: null,
    })),
  };
  newMandal.cells[NINE_GRID_CONFIG.CENTRAL_GOAL_INDEX].content = name;

  mandalState.mandalArts.push(newMandal);
  mandalState.activeMandalArtId = newId;

  data.updateMandalArtState(mandalState);
}

function handleDeleteMandal() {
  const { mandalId } = contextMenuTarget;
  if (!mandalId) return;

  const mandalState = JSON.parse(JSON.stringify(data.getMandalArtState()));
  const mandalToDelete = mandalState.mandalArts.find((m) => m.id === mandalId);

  if (
    mandalToDelete &&
    confirm(`'${mandalToDelete.name}' 만다라트를 정말 삭제하시겠습니까?`)
  ) {
    mandalState.mandalArts = mandalState.mandalArts.filter(
      (m) => m.id !== mandalId
    );

    if (mandalState.activeMandalArtId === mandalId) {
      mandalState.activeMandalArtId =
        mandalState.mandalArts.length > 0 ? mandalState.mandalArts[0].id : null;
    }
    data.updateMandalArtState(mandalState);
  }
}

async function handleFullSave() {
  console.log("[MandalArtViewHandler] Triggering Full Year Save...");
  const currentYear = data.getState().currentDisplayYear;
  const filesToSave = data.getCurrentYearDataForSave(); // 최적화된 데이터 포함

  await triggerFullYearSave(currentYear, filesToSave);

  // 저장이 완료되었으므로 dirty 상태 클리어
  data.clearAllDirtyFilesForYear(currentYear);
  // 만다라트 데이터는 연도와 무관하므로 별도 클리어
  dirtyFileService.clearDirtyFile("mandal-art.json");
}

// --- SPA 페이지 초기화 및 정리 함수 ---

export async function initMandalArtView(dataModule, eventBusModule) {
  console.log("[MandalArtViewHandler] 만다라트 뷰 초기화");
  data = dataModule;
  eventBus = eventBusModule;
  activeEventListeners.length = 0;

  // 만다라트 데이터가 없으면 dataManager를 통해 초기화
  if (!data.getMandalArtState()) {
    data.initializeMandalArtState();
  }

  // DOM 요소 참조
  const addMandalBtn = document.getElementById("add-mandal-btn");
  const mandalListEl = document.getElementById("mandal-list");
  const gridContainerEl = document.getElementById("mandal-art-grid");
  const matrixContainerEl = document.getElementById("mandal-art-matrix");
  const toolbarEl = document.getElementById("mandal-art-toolbar");
  const gridBtn = document.getElementById("mandal-view-grid-btn");
  const matrixBtn = document.getElementById("mandal-view-matrix-btn");
  const cellContextMenuEl = document.getElementById("mandal-cell-context-menu");
  const sidebarContextMenuEl = document.getElementById(
    "mandal-sidebar-context-menu"
  );
  const colorPicker = document.getElementById("mandal-color-picker");

  // --- 이벤트 리스너 등록 ---

  // 1. 데이터 변경 감지 리스너
  const dataChangedHandler = (payload) => {
    // mandalArt 관련 업데이트가 있을 때만 렌더링
    if (payload.source && payload.source.startsWith("mandalArt")) {
      render();
    }
    if (payload.source === "settingsUpdated") {
      render();
    }
  };
  // 2-a. 뷰 모드 토글 리스너
  if (gridBtn) {
    const gridClick = () => {
      const settings = data.getSettings();
      data.updateSettings({ ...settings, mandalArtViewMode: "grid" });
    };
    gridBtn.addEventListener("click", gridClick);
    activeEventListeners.push({
      element: gridBtn,
      type: "click",
      handler: gridClick,
    });
  }
  if (matrixBtn) {
    const matrixClick = () => {
      const settings = data.getSettings();
      data.updateSettings({ ...settings, mandalArtViewMode: "matrix" });
    };
    matrixBtn.addEventListener("click", matrixClick);
    activeEventListeners.push({
      element: matrixBtn,
      type: "click",
      handler: matrixClick,
    });
  }
  eventBus.on("dataChanged", dataChangedHandler);
  activeEventListeners.push({
    target: eventBus,
    type: "dataChanged",
    handler: dataChangedHandler,
    isEventBus: true,
  });

  // 2. 버튼 클릭 리스너
  if (addMandalBtn) {
    addMandalBtn.addEventListener("click", handleAddMandal);
    activeEventListeners.push({
      element: addMandalBtn,
      type: "click",
      handler: handleAddMandal,
    });
  }

  // 3. 이벤트 위임을 사용한 리스너
  if (mandalListEl) {
    const switchMandalHandler = (e) => {
      const li = e.target.closest("li");
      if (li && li.dataset.id) {
        const mandalState = JSON.parse(
          JSON.stringify(data.getMandalArtState())
        );
        mandalState.activeMandalArtId = li.dataset.id;
        data.updateMandalArtState(mandalState);
      }
    };
    mandalListEl.addEventListener("click", switchMandalHandler);
    activeEventListeners.push({
      element: mandalListEl,
      type: "click",
      handler: switchMandalHandler,
    });

    const sidebarContextMenuHandler = (e) => {
      e.preventDefault();
      const li = e.target.closest("li");
      if (li) {
        contextMenuTarget.mandalId = li.dataset.id;
        sidebarContextMenuEl.style.display = "block";
        sidebarContextMenuEl.style.top = `${e.clientY}px`;
        sidebarContextMenuEl.style.left = `${e.clientX}px`;
      }
    };
    mandalListEl.addEventListener("contextmenu", sidebarContextMenuHandler);
    activeEventListeners.push({
      element: mandalListEl,
      type: "contextmenu",
      handler: sidebarContextMenuHandler,
    });

    const dragStartHandler = (e) => {
      const li = e.target.closest("li");
      if (li) {
        draggedMandalId = li.dataset.id;
        // 드래그 중인 항목에 시각적 효과를 주기 위함 (선택적)
        setTimeout(() => li.classList.add("mandal-dragging"), 0);
      }
    };
    mandalListEl.addEventListener("dragstart", dragStartHandler);
    activeEventListeners.push({
      element: mandalListEl,
      type: "dragstart",
      handler: dragStartHandler,
    });

    const dragEndHandler = (e) => {
      const li = e.target.closest("li");
      if (li) {
        li.classList.remove("mandal-dragging");
      }
      draggedMandalId = null;
    };
    mandalListEl.addEventListener("dragend", dragEndHandler);
    activeEventListeners.push({
      element: mandalListEl,
      type: "dragend",
      handler: dragEndHandler,
    });

    const dragOverHandler = (e) => {
      e.preventDefault(); // drop 이벤트를 허용하기 위해 필수
      const draggingEl = mandalListEl.querySelector(".mandal-dragging");
      const afterElement = getDragAfterElement(mandalListEl, e.clientY);
      if (afterElement == null) {
        mandalListEl.appendChild(draggingEl);
      } else {
        mandalListEl.insertBefore(draggingEl, afterElement);
      }
    };
    mandalListEl.addEventListener("dragover", dragOverHandler);
    activeEventListeners.push({
      element: mandalListEl,
      type: "dragover",
      handler: dragOverHandler,
    });

    const dropHandler = (e) => {
      e.preventDefault();
      // DOM에서 현재 순서대로 ID 목록을 추출
      const newIdOrder = Array.from(mandalListEl.querySelectorAll("li")).map(
        (li) => li.dataset.id
      );
      // dataManager에 순서 변경 요청
      data.reorderMandalArts(newIdOrder);
    };
    mandalListEl.addEventListener("drop", dropHandler);
    activeEventListeners.push({
      element: mandalListEl,
      type: "drop",
      handler: dropHandler,
    });

    // 드래그 위치를 계산하는 헬퍼 함수
    function getDragAfterElement(container, y) {
      const draggableElements = [
        ...container.querySelectorAll("li:not(.mandal-dragging)"),
      ];
      return draggableElements.reduce(
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
      ).element;
    }
  }

  if (gridContainerEl) {
    // Grid 입력/수정 핸들러
    const gridInputHandler = (e) => {
      if (e.target.tagName !== "TEXTAREA") return;

      const cellId = e.target.closest(".cell").dataset.id;
      const cellIndex = parseInt(cellId.split("-")[1]);

      const mandalState = JSON.parse(JSON.stringify(data.getMandalArtState()));
      const activeMandal = mandalState.mandalArts.find(
        (m) => m.id === mandalState.activeMandalArtId
      );
      if (!activeMandal) return;

      const cellData = activeMandal.cells.find((c) => c.id === cellId);
      if (!cellData) return;

      cellData.content = e.target.value;

      // 중앙 목표 셀 수정 시
      if (cellIndex === NINE_GRID_CONFIG.CENTRAL_GOAL_INDEX) {
        activeMandal.name = e.target.value;
        // UI 즉시 업데이트를 위해 사이드바만 다시 렌더링
        renderSidebar();
      }
      // 8개 하위 목표 셀 수정 시
      else if (NINE_GRID_CONFIG.SYNC_MAP[cellIndex] !== undefined) {
        const targetCellIndex = NINE_GRID_CONFIG.SYNC_MAP[cellIndex];
        activeMandal.cells[targetCellIndex].content = e.target.value;
        const targetTextarea = gridContainerEl.querySelector(
          `[data-id="cell-${targetCellIndex}"] textarea`
        );
        if (targetTextarea) targetTextarea.value = e.target.value;
      }

      // 변경된 상태를 broadcast 없이 조용히 저장
      data.updateMandalArtState(mandalState, { broadcast: false });
    };
    gridContainerEl.addEventListener("input", gridInputHandler);
    activeEventListeners.push({
      element: gridContainerEl,
      type: "input",
      handler: gridInputHandler,
    });

    // Matrix 입력/수정 핸들러
    if (matrixContainerEl) {
      const matrixInputHandler = (e) => {
        const tag = e.target.tagName;
        if (tag !== "TEXTAREA" && tag !== "INPUT") return;
        const mandalState = JSON.parse(
          JSON.stringify(data.getMandalArtState())
        );
        const activeMandal = mandalState.mandalArts.find(
          (m) => m.id === mandalState.activeMandalArtId
        );
        if (!activeMandal) return;

        // 좌측 라벨 편집
        if (e.target.dataset.sourceIndex) {
          const srcIdx = parseInt(e.target.dataset.sourceIndex, 10);
          if (!isNaN(srcIdx) && activeMandal.cells[srcIdx]) {
            activeMandal.cells[srcIdx].content = e.target.value;
            // 중앙 링 변경 시 외곽 중앙도 동기화됨 (기존 renderGrid 로직 참고)
            const mapped = NINE_GRID_CONFIG.SYNC_MAP[srcIdx];
            if (mapped !== undefined) {
              activeMandal.cells[mapped].content = e.target.value;
            }
            data.updateMandalArtState(mandalState, { broadcast: false });
          }
          return;
        }

        // 개별 레벨(실천) 편집
        const idx = parseInt(e.target.dataset.index, 10);
        const cellData = activeMandal.cells[idx];
        if (!cellData) return;
        cellData.content = e.target.value;
        // 동기화 대상(중앙 9블록으로 복제되는 위치) 반영
        const syncSourceIndex = Object.keys(NINE_GRID_CONFIG.SYNC_MAP).find(
          (key) => NINE_GRID_CONFIG.SYNC_MAP[key] === idx
        );
        if (syncSourceIndex) {
          const src = parseInt(syncSourceIndex, 10);
          activeMandal.cells[src].content = e.target.value;
        }
        data.updateMandalArtState(mandalState, { broadcast: false });
      };
      matrixContainerEl.addEventListener("input", matrixInputHandler);
      activeEventListeners.push({
        element: matrixContainerEl,
        type: "input",
        handler: matrixInputHandler,
      });

      // Matrix 클릭 핸들러 (완료 토글)
      const matrixClickHandler = (e) => {
        const td = e.target.closest("td");
        if (td && e.target.tagName !== "TEXTAREA") {
          // td 자체를 클릭했을 때 (textarea가 아닌 경우)
          const textarea = td.querySelector("textarea");
          if (textarea && textarea.dataset.index) {
            const idx = parseInt(textarea.dataset.index, 10);
            const mandalState = JSON.parse(
              JSON.stringify(data.getMandalArtState())
            );
            const activeMandal = mandalState.mandalArts.find(
              (m) => m.id === mandalState.activeMandalArtId
            );
            const cellData = activeMandal.cells[idx];
            if (cellData) {
              const wasCompleted = cellData.isCompleted;
              cellData.isCompleted = !cellData.isCompleted;
              console.log(
                `[MandalArtViewHandler] Matrix cell ${idx} completion toggled: ${wasCompleted} -> ${cellData.isCompleted}`
              );
              data.updateMandalArtState(mandalState);
            }
          }
        }
      };
      matrixContainerEl.addEventListener("click", matrixClickHandler);
      activeEventListeners.push({
        element: matrixContainerEl,
        type: "click",
        handler: matrixClickHandler,
      });

      // Matrix 우클릭 핸들러 (컨텍스트 메뉴)
      const matrixContextMenuHandler = (e) => {
        e.preventDefault();
        const td = e.target.closest("td");
        if (td && td.dataset.cellId) {
          contextMenuTarget.cellId = td.dataset.cellId;
          cellContextMenuEl.style.display = "block";
          cellContextMenuEl.style.top = `${e.clientY}px`;
          cellContextMenuEl.style.left = `${e.clientX}px`;
        }
      };
      matrixContainerEl.addEventListener(
        "contextmenu",
        matrixContextMenuHandler
      );
      activeEventListeners.push({
        element: matrixContainerEl,
        type: "contextmenu",
        handler: matrixContextMenuHandler,
      });
    }

    // Grid 자동 스크롤 핸들러
    const gridBlurHandler = (e) => {
      if (e.target.tagName === "TEXTAREA") e.target.scrollTop = 0;
    };
    gridContainerEl.addEventListener("blur", gridBlurHandler, true);
    activeEventListeners.push({
      element: gridContainerEl,
      type: "blur",
      handler: gridBlurHandler,
      options: true,
    });

    // Grid 왼쪽 클릭 핸들러 (완료)
    const gridClickHandler = (e) => {
      const cellEl = e.target.closest(".cell");
      if (cellEl && e.target.tagName !== "TEXTAREA") {
        // 셀 자체를 클릭했을 때
        const mandalState = JSON.parse(
          JSON.stringify(data.getMandalArtState())
        );
        const activeMandal = mandalState.mandalArts.find(
          (m) => m.id === mandalState.activeMandalArtId
        );
        const cellData = activeMandal.cells.find(
          (c) => c.id === cellEl.dataset.id
        );
        const wasCompleted = cellData.isCompleted;
        cellData.isCompleted = !cellData.isCompleted;
        console.log(
          `[MandalArtViewHandler] Cell ${cellEl.dataset.id} completion toggled: ${wasCompleted} -> ${cellData.isCompleted}`
        );
        data.updateMandalArtState(mandalState);
      }
    };
    gridContainerEl.addEventListener("click", gridClickHandler);
    activeEventListeners.push({
      element: gridContainerEl,
      type: "click",
      handler: gridClickHandler,
    });

    // Grid 우클릭 핸들러
    const gridContextMenuHandler = (e) => {
      e.preventDefault();
      const cellEl = e.target.closest(".cell");
      if (cellEl) {
        contextMenuTarget.cellId = cellEl.dataset.id;
        cellContextMenuEl.style.display = "block";
        cellContextMenuEl.style.top = `${e.clientY}px`;
        cellContextMenuEl.style.left = `${e.clientX}px`;
      }
    };
    gridContainerEl.addEventListener("contextmenu", gridContextMenuHandler);
    activeEventListeners.push({
      element: gridContainerEl,
      type: "contextmenu",
      handler: gridContextMenuHandler,
    });

    // 전체 저장 단축키 핸들러
    const keydownHandler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleFullSave();
      }
    };
    document.addEventListener("keydown", keydownHandler);
    activeEventListeners.push({
      target: document,
      type: "keydown",
      handler: keydownHandler,
    });
  }

  // 4. 컨텍스트 메뉴 리스너
  if (cellContextMenuEl) {
    const cellMenuClickHandler = (e) => {
      const action = e.target.closest("li")?.dataset.action;
      if (!action) return;

      const mandalState = JSON.parse(JSON.stringify(data.getMandalArtState()));
      const activeMandal = mandalState.mandalArts.find(
        (m) => m.id === mandalState.activeMandalArtId
      );
      const cellData = activeMandal.cells.find(
        (c) => c.id === contextMenuTarget.cellId
      );
      if (!cellData) return;

      switch (action) {
        case "toggle-complete":
          const wasCompleted = cellData.isCompleted;
          cellData.isCompleted = !cellData.isCompleted;
          console.log(
            `[MandalArtViewHandler] Cell ${contextMenuTarget.cellId} completion toggled via context menu: ${wasCompleted} -> ${cellData.isCompleted}`
          );
          break;
        case "highlight":
          cellData.isHighlighted = !cellData.isHighlighted;
          break;
        case "set-color":
          colorPicker.click();
          return;
        case "reset-cell":
          cellData.content = "";
          cellData.isCompleted = false;
          cellData.isHighlighted = false;
          cellData.color = null;
          break;
      }
      cellContextMenuEl.style.display = "none";
      data.updateMandalArtState(mandalState);
    };
    cellContextMenuEl.addEventListener("click", cellMenuClickHandler);
    activeEventListeners.push({
      element: cellContextMenuEl,
      type: "click",
      handler: cellMenuClickHandler,
    });
  }

  if (sidebarContextMenuEl) {
    sidebarContextMenuEl.addEventListener("click", (e) => {
      if (e.target.closest("li")?.dataset.action === "delete-mandal") {
        handleDeleteMandal();
      }
      sidebarContextMenuEl.style.display = "none";
    });
    activeEventListeners.push({
      element: sidebarContextMenuEl,
      type: "click",
      handler: (e) => {
        /* ... */
      },
    });
  }

  if (colorPicker) {
    const colorChangeHandler = (e) => {
      const mandalState = JSON.parse(JSON.stringify(data.getMandalArtState()));
      const activeMandal = mandalState.mandalArts.find(
        (m) => m.id === mandalState.activeMandalArtId
      );
      const cellData = activeMandal.cells.find(
        (c) => c.id === contextMenuTarget.cellId
      );
      if (cellData) {
        cellData.color = e.target.value;
        data.updateMandalArtState(mandalState);
      }
    };
    colorPicker.addEventListener("input", colorChangeHandler);
    activeEventListeners.push({
      element: colorPicker,
      type: "input",
      handler: colorChangeHandler,
    });
  }

  // 5. 전역 클릭 리스너 (메뉴 닫기)
  const globalClickHandler = () => {
    if (cellContextMenuEl) cellContextMenuEl.style.display = "none";
    if (sidebarContextMenuEl) sidebarContextMenuEl.style.display = "none";
  };
  window.addEventListener("click", globalClickHandler);
  activeEventListeners.push({
    target: window,
    type: "click",
    handler: globalClickHandler,
  });

  // 첫 렌더링
  render();
}

export function cleanupMandalArtView() {
  console.log("[MandalArtViewHandler] 만다라트 뷰 정리");
  activeEventListeners.forEach((listener) => {
    const target = listener.target || listener.element;
    if (target) {
      if (listener.isEventBus) {
        if (typeof target.off === "function") {
          target.off(listener.type, listener.handler);
          console.log(
            `[MandalArtViewHandler] EventBus listener for '${listener.type}' removed.`
          );
        }
      } else {
        const options = listener.options || false;
        if (typeof target.removeEventListener === "function") {
          target.removeEventListener(listener.type, listener.handler, options);
        }
      }
    }
  });
  activeEventListeners.length = 0; // 배열 비우기
}
