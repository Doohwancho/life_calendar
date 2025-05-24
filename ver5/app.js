import * as data from "./js/dataManager.js";
import {
  renderYearlyCalendar,
  renderAllYearlyCellContent,
} from "./js/yearlyCalendar.js";
import {
  initWeeklyCalendar,
  renderWeeklyCalendar,
} from "./js/weeklyCalendar.js"; // Import weekly functions
import { generateId, getMondayOfWeek, formatDate } from "./js/uiUtils.js";
import { initBacklog, renderBacklog } from "./js/backlog.js"; // Import backlog functions
import { eventBus } from "./js/eventBus.js";

document.addEventListener("DOMContentLoaded", () => {
  const todayForInit = new Date(); // Use provided date as "today"

  data.updateCurrentDisplayYear(todayForInit.getFullYear());
  data.updateCurrentWeeklyViewStartDate(getMondayOfWeek(todayForInit));

  // --- DOM Element References ---
  const currentYearDisplay = document.getElementById("currentYearDisplay");
  // const currentWeekDisplay = document.getElementById("currentWeekDisplay");
  // const prevYearBtn = document.getElementById("prevYearBtn");
  // const nextYearBtn = document.getElementById("nextYearBtn");
  // const prevWeekBtn = document.getElementById("prevWeekBtn");
  // const nextWeekBtn = document.getElementById("nextWeekBtn");
  const weekJumpInput = document.getElementById("weekJumpInput");

  const labelsContainer = document.getElementById("labelsContainer");
  const addLabelBtn = document.getElementById("addLabelBtn");
  const addLabelModal = document.getElementById("addLabelModal");
  const saveLabelBtn = document.getElementById("saveLabelBtn");
  const cancelLabelBtn = document.getElementById("cancelLabelBtn");
  const labelNameInput = document.getElementById("labelNameInput");
  const labelColorInput = document.getElementById("labelColorInput");

  // --- Initial UI Updates & Event Listeners ---
  function updateToolbarDisplays() {
    const state = data.getState();
    if (currentYearDisplay) {
      currentYearDisplay.textContent = state.currentDisplayYear;
    }
    // if (currentWeekDisplay && data.currentWeeklyViewStartDate) {
    //   const endDate = new Date(data.currentWeeklyViewStartDate);
    //   endDate.setDate(data.currentWeeklyViewStartDate.getDate() + 6);
    //   currentWeekDisplay.textContent = `${formatDate(
    //     data.currentWeeklyViewStartDate
    //   )} - ${formatDate(endDate)}`;
    // }
    // weekJumpInput의 초기 값 및 변경 시 값 설정
    if (weekJumpInput && todayForInit) { // 초기 로드 시 todayForInit 사용
      if (!weekJumpInput.value) { // 이미 값이 설정되어 있지 않은 경우에만 초기화
           weekJumpInput.value = formatDate(todayForInit);
      }
    }
  }

  updateToolbarDisplays();

  // --- Global Event Listener ---
  // Listens for any data change and triggers a full UI refresh.
  eventBus.on("dataChanged", (payload) => {
    console.log( // <<< 로그 추가: 이 리스너가 몇 번 호출되는지 확인
        `APP.JS: eventBus 'dataChanged' received. Source: ${payload?.source}. Timestamp: ${new Date().toLocaleTimeString()}`
    );

    const state = data.getState(); //최신 상태 가져오기

    // 1. 툴바의 라벨 목록 업데이트
    renderLabels(); // <<< 이 줄을 추가합니다!

    // 2. 연간 달력의 셀 내용(프로젝트 막대, 할 일 박스) 업데이트
    if (typeof renderAllYearlyCellContent === "function") {
      // yearlyCalendar.js가 로드되었는지 확인
      renderAllYearlyCellContent();
    } else {
      console.error(
        "renderAllYearlyCellContent is not a function or not imported in app.js"
      );
    }

    // 3. 주간 달력 업데이트
    if (typeof renderWeeklyCalendar === "function") {
      // weeklyCalendar.js가 로드되었는지 확인
      renderWeeklyCalendar(state.currentWeeklyViewStartDate);
    }

    // 4. 백로그 목록 업데이트
    if (typeof renderBacklog === "function") {
      // backlog.js가 로드되었는지 확인
      renderBacklog();
    }
  });

  // --- Navigation Listeners (Update to use getState and render functions) ---
  // Yearly Navigation
  // if (prevYearBtn)
  //   prevYearBtn.addEventListener("click", () => {
  //     const currentState = data.getState();
  //     data.updateCurrentDisplayYear(currentState.currentDisplayYear - 1);
  //     updateToolbarDisplays();
  //     renderYearlyCalendar(data.getState().currentDisplayYear);
  //   });

  // if (nextYearBtn)
  //   nextYearBtn.addEventListener("click", () => {
  //     const currentState = data.getState();
  //     data.updateCurrentDisplayYear(currentState.currentDisplayYear + 1);
  //     updateToolbarDisplays();
  //     renderYearlyCalendar(data.getState().currentDisplayYear); // Call actual render
  //   });

  // Weekly Navigation (Still stubs rendering weekly, but updates state)
  // if (prevWeekBtn)
  //   prevWeekBtn.addEventListener("click", () => {
  //     const state = data.getState();
  //     const newStartDate = new Date(state.currentWeeklyViewStartDate);
  //     newStartDate.setDate(newStartDate.getDate() - 7);
  //     data.updateCurrentWeeklyViewStartDate(newStartDate);
  //     updateToolbarDisplays();
  //     renderWeeklyCalendar(data.getState().currentWeeklyViewStartDate);
  //   });
  // if (nextWeekBtn)
  //   nextWeekBtn.addEventListener("click", () => {
  //     const state = data.getState();
  //     const newStartDate = new Date(state.currentWeeklyViewStartDate);
  //     newStartDate.setDate(newStartDate.getDate() + 7);
  //     data.updateCurrentWeeklyViewStartDate(newStartDate);
  //     updateToolbarDisplays();
  //     renderWeeklyCalendar(data.getState().currentWeeklyViewStartDate);
  //   });
  if (weekJumpInput) {
    weekJumpInput.addEventListener("change", (event) => {
        const selectedDate = new Date(event.target.value || todayForInit); // 유효하지 않은 값일 경우 todayForInit 사용
        data.updateCurrentWeeklyViewStartDate(getMondayOfWeek(selectedDate));
        // updateToolbarDisplays(); // weekJumpInput의 값은 사용자가 직접 변경했으므로 여기서 다시 설정할 필요 없음
        renderWeeklyCalendar(data.getState().currentWeeklyViewStartDate);
    });
  }

  // --- Label Management ---
  let draggedLabelId = null; // For label reordering

  function renderLabels() {
    if (!labelsContainer) return;
    const { labels } = data.getState();

    // 라벨 아이템들만 지웁니다. 이제 addLabelBtn은 labelsContainer의 자식이 아닙니다.
    labelsContainer.innerHTML = ''; // 간결하게 모든 자식 제거

    labels.forEach((label) => {
      const labelEl = document.createElement("div");
      labelEl.className = "label-item";
      labelEl.dataset.labelId = label.id;
      labelEl.draggable = true;

      const colorSwatch = document.createElement("div");
      colorSwatch.className = "label-color-swatch";
      colorSwatch.style.backgroundColor = label.color;
      labelEl.appendChild(colorSwatch);

      const nameEl = document.createElement("span");
      nameEl.className = "label-name";
      nameEl.textContent = label.name;
      labelEl.appendChild(nameEl);

      labelEl.addEventListener("click", () => {
        // 1. 현재 클릭한 라벨이 이미 선택된 상태인지 확인합니다.
        const isAlreadySelected = labelEl.classList.contains(
          "selected-for-drawing"
        );

        // 2. 일단 모든 라벨의 선택 효과를 제거합니다.
        const allLabelItems = labelsContainer.querySelectorAll(".label-item");
        allLabelItems.forEach((item) =>
          item.classList.remove("selected-for-drawing")
        );

        // 3. 이미 선택된 상태였다면, 선택을 해제하고 상태를 초기화합니다.
        if (isAlreadySelected) {
          data.setSelectedLabel(null);
          // console.log(
          //   "APP.JS: Label deselected. Current selectedLabel:",
          //   data.getState().selectedLabel
          // ); // 로그 추가
        } else {
          labelEl.classList.add("selected-for-drawing");
          data.setSelectedLabel(label); // 'label'은 forEach 루프의 현재 라벨 객체여야 합니다.
          // console.log("APP.JS: Label selected. Clicked label object:", label); // 로그 추가
          // console.log(
          //   "APP.JS: Current selectedLabel in dataManager:",
          //   data.getState().selectedLabel
          // ); // 로그 추가
        }
      });

      // Drag and Drop for reordering labels
      labelEl.addEventListener("dragstart", (e) => {
        draggedLabelId = label.id;
        e.target.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", label.id); // Required for Firefox
      });
      labelEl.addEventListener("dragend", (e) => {
        e.target.classList.remove("dragging");
        draggedLabelId = null;
      });

      labelsContainer.appendChild(labelEl); // Insert before the "+" button
    });
  }

  // Drag over/drop on the container for reordering
  if (labelsContainer) {
    labelsContainer.addEventListener("dragover", (e) => {
      e.preventDefault(); // Allow drop

      const draggingEl = labelsContainer.querySelector(".label-item.dragging");
      if (!draggingEl) return;

      const afterElement = getDragAfterElementForLabels(
        labelsContainer,
        e.clientX
      );
      if (afterElement == null) { // 컨테이너의 끝에 드롭하는 경우
        labelsContainer.appendChild(draggingEl);
      } else {
        labelsContainer.insertBefore(draggingEl, afterElement);
      }
    });

    labelsContainer.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!draggedLabelId) return;

      // 현재 DOM 순서를 기반으로 새 라벨 ID 순서 배열 생성
      // addLabelBtn은 label-item이 아니므로 querySelectorAll에서 제외하거나, filter로 걸러내야 합니다.
      const newLabelOrderIds = Array.from(
        labelsContainer.querySelectorAll(".label-item") // 이제 addLabelBtn이 없으므로 간단해짐
      ).map((el) => el.dataset.labelId);
      data.reorderLabels(newLabelOrderIds);
      renderLabels(); 
      draggedLabelId = null; 
    });
  }

  function getDragAfterElementForLabels(container, x) {
    const draggableElements = [
      ...container.querySelectorAll(".label-item:not(.dragging)") // addLabelBtn 제외 불필요
    ];
    return draggableElements.reduce(
      (closest, child) => {
          const box = child.getBoundingClientRect();
          const offset = x - box.left - box.width / 2;
          if (offset < 0 && offset > closest.offset) {
              return { offset: offset, element: child };
          } else {
              return closest;
          }
        },
        { offset: Number.NEGATIVE_INFINITY }
    ).element;
  }

  if (addLabelBtn)
    addLabelBtn.addEventListener("click", () => {
      if (addLabelModal) addLabelModal.style.display = "flex";
      if (labelNameInput) {
        labelNameInput.value = "";
        labelNameInput.focus();
      }
      if (labelColorInput) labelColorInput.value = "#ff0000";
    });
  if (cancelLabelBtn)
    cancelLabelBtn.addEventListener("click", () => {
      if (addLabelModal) addLabelModal.style.display = "none";
    });
  if (saveLabelBtn)
    saveLabelBtn.addEventListener("click", () => {
      const name = labelNameInput.value.trim();
      const color = labelColorInput.value;
      if (name) {
        const newLabel = { id: generateId(), name, color };
        data.addLabel(newLabel); // Using the function from dataManager
        renderLabels();
        if (addLabelModal) addLabelModal.style.display = "none";
      } else {
        alert("Label name cannot be empty.");
      }
    });

  // --- === PHASE 4: SAVE & LOAD IMPLEMENTATION === ---
  const saveDataBtn = document.getElementById("saveDataBtn");
  const loadDataBtn = document.getElementById("loadDataBtn");
  const fileInput = document.getElementById("fileInput");

  function handleSaveData() {
    const state = data.getState();
    const dataToSave = {
      fileVersion: "1.2.0",
      savedAt: new Date().toISOString(),
      calendarData: data.getAllDataForSave(),
    };

    const jsonString = JSON.stringify(dataToSave, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `yearly-calendar-${state.currentDisplayYear}-data.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleLoadData(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (
      data.getState().events.length > 0 ||
      data.getState().labels.length > 0
    ) {
      if (
        !confirm("현재 작업 내용이 있습니다. 불러온 파일로 덮어쓰시겠습니까?")
      ) {
        event.target.value = ""; // Reset file input
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const loadedData = JSON.parse(e.target.result);
        if (loadedData && loadedData.calendarData) {
          data.loadAllData(loadedData.calendarData);

          // --- Trigger Full UI Refresh ---
          updateToolbarDisplays();
          renderLabels();
          renderYearlyCalendar(data.getState().currentDisplayYear);
          renderWeeklyCalendar(data.getState().currentWeeklyViewStartDate); // <<< RENDER LOADED WEEKLY
          renderBacklog();
          eventBus.dispatch("dataChanged", { source: "fileLoad" });

          alert("데이터를 성공적으로 불러왔습니다.");
        } else {
          throw new Error("Invalid file format. 'calendarData' key not found.");
        }
      } catch (error) {
        console.error("Error loading or parsing file:", error);
        alert(`파일을 불러오는 중 오류가 발생했습니다: ${error.message}`);
      } finally {
        event.target.value = ""; // Reset file input
      }
    };
    reader.onerror = () => {
      alert("파일을 읽을 수 없습니다.");
      event.target.value = "";
    };
    reader.readAsText(file);
  }

  // Connect event listeners
  if (saveDataBtn) saveDataBtn.addEventListener("click", handleSaveData);
  if (loadDataBtn)
    loadDataBtn.addEventListener("click", () => fileInput.click());
  if (fileInput) fileInput.addEventListener("change", handleLoadData);

  // Keyboard shortcut for save
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      handleSaveData();
    }
  });

  // --- File Operations Stubs (from Phase 1) ---
  // ... (saveDataBtn, loadDataBtn, fileInput listeners remain as stubs)

  // --- Initial Renders ---
  updateToolbarDisplays(); // Must be called before renders to set text
  initBacklog();
  initWeeklyCalendar();

  renderYearlyCalendar(data.getState().currentDisplayYear);
  renderLabels();
  renderBacklog();
  renderWeeklyCalendar(data.getState().currentWeeklyViewStartDate); // Initial render of weekly calendar

  console.log("Phase 5 Initialized Successfully.");
});
