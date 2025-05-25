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
  data.updateCurrentWeeklyViewStartDate(todayForInit);

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
    // weekJumpInput의 값을 포커싱된 주의 월요일로 설정
    if (weekJumpInput && state.currentWeeklyViewStartDate) {
      weekJumpInput.value = formatDate(state.currentWeeklyViewStartDate);
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
    updateToolbarDisplays(); // 툴바 표시 (연도, weekJumpInput 값 등) 업데이트
    renderLabels(); // <<< 이 줄을 추가합니다!

    // 연간 달력 업데이트
    if (payload?.source === 'updateCurrentWeeklyViewStartDate' || payload?.source === 'updateCurrentDisplayYear' || payload?.source === 'fileLoad' || payload?.source === 'addEvent' || payload?.source === 'deleteEvent' || payload?.source === 'updateEventDates' || payload?.source === 'deleteLabelAndEvents' || payload?.source === 'updateLabelName' || payload?.source === 'addLabel') {
      // 위 source들은 연간 달력의 전체 구조 또는 주요 내용 변경을 유발할 수 있음
        if (typeof renderYearlyCalendar === "function") {
          console.log("APP.JS: Re-rendering full Yearly Calendar for year:", state.currentDisplayYear, "due to source:", payload?.source);
          renderYearlyCalendar(state.currentDisplayYear);
      }
    } else if (typeof renderAllYearlyCellContent === "function") {
        if (payload?.source === 'updateCurrentWeeklyViewStartDate' || payload?.source === 'updateCurrentDisplayYear') {
            renderYearlyCalendar(state.currentDisplayYear); // 연도나 주가 바뀌면 연간 달력 다시 그림
        } else {
            renderAllYearlyCellContent(); // 그 외 데이터 변경은 셀 내용만
        }
    }

    if (typeof renderWeeklyCalendar === "function") {
      renderWeeklyCalendar(state.currentWeeklyViewStartDate);
    }
    if (typeof renderBacklog === "function") {
        renderBacklog();
    }
  });

  // --- weekJumpInput 리스너 수정 ---
  if (weekJumpInput) {
    weekJumpInput.addEventListener("change", (event) => {
        const selectedDateValue = event.target.value;
        if (!selectedDateValue) return; // 빈 값 처리

        // Date.UTC를 사용하여 타임존 오프셋 문제 최소화
        const [yearStr, monthStr, dayStr] = selectedDateValue.split('-');
        const selectedDate = new Date(Date.UTC(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr)));

        const newSelectedYear = selectedDate.getUTCFullYear();
        const currentDisplayYearState = data.getState().currentDisplayYear;

        console.log(`APP.JS: weekJumpInput changed. Selected Date: ${selectedDateValue}, New Year: ${newSelectedYear}, Current Display Year: ${currentDisplayYearState}`);

        // 1. 연도가 변경되었는지 확인하고, 변경되었다면 currentDisplayYear 업데이트
        if (newSelectedYear !== currentDisplayYearState) {
            data.updateCurrentDisplayYear(newSelectedYear); 
            // 이 호출은 dataChanged 이벤트를 발생시키고, app.js의 리스너가 renderYearlyCalendar를 호출합니다.
        }
        
        // 2. currentWeeklyViewStartDate 업데이트 (항상 선택된 날짜가 포함된 주의 월요일로)
        // 이 호출도 dataChanged 이벤트를 발생시킵니다.
        data.updateCurrentWeeklyViewStartDate(selectedDate); 

        // 직접 renderWeeklyCalendar 호출 제거 -> eventBus가 처리하도록 함
        // renderWeeklyCalendar(data.getState().currentWeeklyViewStartDate); 
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
        const isAlreadySelected = labelEl.classList.contains("selected-for-drawing");
        const allLabelItems = labelsContainer.querySelectorAll(".label-item");
        allLabelItems.forEach((item) => item.classList.remove("selected-for-drawing"));
    
        if (isAlreadySelected) {
            data.setSelectedLabel(null);
            console.log("APP.JS (Label Click): Label DESELECTED. state.selectedLabel is now:", JSON.stringify(data.getState().selectedLabel));
        } else {
            // 'label' 변수는 forEach 루프의 현재 라벨 객체입니다.
            console.log("APP.JS (Label Click): Selecting label. Object from forEach:", JSON.stringify(label));
            if (!label || !label.id) {
                console.error("APP.JS (Label Click): Clicked label object is invalid or missing ID!", label);
            }
            data.setSelectedLabel(label); // dataManager의 setSelectedLabel 호출
            
            const currentSelected = data.getState().selectedLabel;
            console.log("APP.JS (Label Click): state.selectedLabel in dataManager AFTER set:", JSON.stringify(currentSelected));
            if (currentSelected && !currentSelected.id) {
                console.error("APP.JS (Label Click): state.selectedLabel was set BUT IS MISSING ID!", currentSelected);
            }
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
            const newLabel = { id: generateId(), name, color }; // generateId() 호출 확인!
            console.log("APP.JS (Save Label): Creating new label:", JSON.stringify(newLabel)); // 생성된 newLabel 확인
            data.addLabel(newLabel); 
            // renderLabels(); // data.addLabel이 eventBus를 호출하고, app.js의 리스너가 renderLabels를 호출하므로 중복일 수 있음
                              // 하지만 직접 호출하는 것이 즉각적인 피드백에는 더 좋을 수 있습니다. 현재 코드는 유지.
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
