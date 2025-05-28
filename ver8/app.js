import * as dirtyFileService from './js/dirtyFileService.js';
import * as data from "./js/dataManager.js";
import {
  renderYearlyCalendar,
  // renderAllYearlyCellContent,
} from "./js/yearlyCalendar.js";
import {
  initWeeklyCalendar,
  renderWeeklyCalendar,
} from "./js/weeklyCalendar.js"; // Import weekly functions
import { generateId, formatDate } from "./js/uiUtils.js";
import { initBacklog, renderBacklog } from "./js/backlog.js"; // Import backlog functions
import { eventBus } from "./js/eventBus.js";

let activeLabelContextMenu = null;
// let yearlyViewArea = null; // main-content-grid의 연간 캘린더 영역
// let dailyViewArea = null;  // daily_view 내용을 표시할 새로운 div 영역


function removeActiveLabelContextMenu() {
  if (activeLabelContextMenu) {
      activeLabelContextMenu.remove();
      activeLabelContextMenu = null;
  }
  // 전역 클릭 리스너도 제거 (메뉴가 여러 개 동시에 뜨지 않도록)
  window.removeEventListener("click", handleOutsideContextMenuClick);
}

function handleOutsideContextMenuClick(e) {
  if (activeLabelContextMenu && !activeLabelContextMenu.contains(e.target)) {
      removeActiveLabelContextMenu();
  }
}

// --- [신규] Daily View 로드 및 표시 함수 ---
async function switchToDailyView(dateStr) {
  if (!yearlyViewArea || !dailyViewArea) {
      console.error("View areas not initialized for switching.");
      return;
  }

  try {
      // 1. yearly_view 숨기기, daily_view 보이기
      yearlyViewArea.style.display = 'none';
      // 만약 backlog-panel-area 등 다른 영역도 숨기거나 조정해야 한다면 여기서 처리
      // 예: document.getElementById('backlog-panel-area').style.display = 'none';
      //     document.getElementById('weekly-calendar-area').style.display = 'none';
      //     mainContentGrid.classList.add('daily-view-active'); // CSS로 레이아웃 변경

      dailyViewArea.style.display = 'block'; // 또는 grid 등 원래 display 속성

      // 2. daily_view/index.html의 내용을 fetch하여 dailyViewArea에 삽입
      //    (실제로는 daily_view의 body 내용만 가져오는 것이 좋음)
      const response = await fetch(`daily_view/index.html`);
      if (!response.ok) {
          throw new Error(`Failed to load daily_view/index.html: ${response.statusText}`);
      }
      const dailyViewHtmlContent = await response.text();
      
      // body 내용만 추출 (간단한 파싱)
      const parser = new DOMParser();
      const dailyDoc = parser.parseFromString(dailyViewHtmlContent, 'text/html');
      const dailyBodyContent = dailyDoc.body.innerHTML;
      dailyViewArea.innerHTML = dailyBodyContent;

      // 3. daily_view/main.js 스크립트 동적 로드 및 실행
      //    (URL에 date 파라미터를 전달하는 방식은 유지)
      //    daily_view/main.js는 이제 부모의 dataManager를 직접 import하여 사용 가능
      //    또는 dataManager를 daily_view/main.js 실행 전에 window 객체에 할당 가능
      
      // 전역 dataManager를 daily_view가 접근 가능하도록 설정
      window.currentDailyViewDate = dateStr; // 날짜 전달
      window.dataManagerForDailyView = data; // dataManager 모듈 전달

      // 기존 daily_view/main.js 스크립트가 있다면 제거 후 새로 추가
      const oldScript = document.getElementById('dailyViewMainScript');
      if (oldScript) oldScript.remove();
      
      const script = document.createElement('script');
      script.id = 'dailyViewMainScript';
      script.type = 'module'; // daily_view/main.js가 모듈이라면
      script.src = `daily_view/main.js`; // URL 파라미터는 JS 내에서 location.search로 접근
      document.body.appendChild(script); // 또는 dailyViewArea에 append

      console.log(`Switched to daily view for ${dateStr}`);

  } catch (error) {
      console.error("Error switching to daily view:", error);
      dailyViewArea.innerHTML = `<p>Error loading daily view: ${error.message}</p>`;
      // 에러 발생 시 원래 뷰로 복귀하는 로직 추가 가능
      switchToYearlyView(); 
  }
}

// [신규] Yearly View로 돌아가는 함수 (daily_view에 닫기 버튼 등을 만들 때 사용)
function switchToYearlyView() {
  if (!yearlyViewArea || !dailyViewArea) return;

  dailyViewArea.innerHTML = ''; // 내용 비우기
  dailyViewArea.style.display = 'none';
  yearlyViewArea.style.display = 'block'; // 또는 원래 display 속성
  // document.getElementById('backlog-panel-area').style.display = 'block'; // 원래대로
  // document.getElementById('weekly-calendar-area').style.display = 'block';
  // mainContentGrid.classList.remove('daily-view-active');

  // 필요하다면 연간 달력 다시 렌더링
  const currentYear = data.getState().currentDisplayYear;
  renderYearlyCalendar(currentYear);
}


document.addEventListener("DOMContentLoaded", async () => {
  const todayForInit = new Date(); // Use provided date as "today"

  // data.updateCurrentDisplayYear(todayForInit.getFullYear());
  // data.updateCurrentWeeklyViewStartDate(todayForInit);

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

  const saveDataBtn = document.getElementById("saveDataBtn");
  const loadDataBtn = document.getElementById("loadDataBtn");
  const fileInput = document.getElementById("fileInput");


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

  // updateToolbarDisplays();

  // --- Global Event Listener ---
  // Listens for any data change and triggers a full UI refresh.
  eventBus.on("dataChanged", (payload) => {
    console.log(
      // <<< 로그 추가: 이 리스너가 몇 번 호출되는지 확인
      `APP.JS: eventBus 'dataChanged' received. Source: ${
        payload?.source
      }. Timestamp: ${new Date().toLocaleTimeString()}`
    );

    const state = data.getState(); //최신 상태 가져오기

    // 1. 툴바의 라벨 목록 업데이트
    updateToolbarDisplays(); // 툴바 표시 (연도, weekJumpInput 값 등) 업데이트
    renderLabels(); // <<< 이 줄을 추가합니다!
    renderYearlyCalendar(state.currentDisplayYear); // 이것이 renderAllYearlyCellContent 포함
    renderWeeklyCalendar(state.currentWeeklyViewStartDate);
    renderBacklog();
  });


  // --- weekJumpInput 리스너 수정 ---
  if (weekJumpInput) {
    weekJumpInput.addEventListener("change", (event) => {
      const selectedDateValue = event.target.value;
      if (!selectedDateValue) return; // 빈 값 처리

      // Date.UTC를 사용하여 타임존 오프셋 문제 최소화
      const [yearStr, monthStr, dayStr] = selectedDateValue.split("-");
      const selectedDate = new Date(
        Date.UTC(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr))
      );

      const newSelectedYear = selectedDate.getUTCFullYear();
      const currentDisplayYearState = data.getState().currentDisplayYear;

      console.log(
        `APP.JS: weekJumpInput changed. Selected Date: ${selectedDateValue}, New Year: ${newSelectedYear}, Current Display Year: ${currentDisplayYearState}`
      );

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
    const state = data.getState(); // dataManager의 전체 상태 가져오기
    const labels = state.labels; // 현재 연도의 라벨 목록
    const selectedLabelId = state.selectedLabel ? state.selectedLabel.id : null; // 현재 선택된 라벨의 ID

    // 라벨 아이템들만 지웁니다. 이제 addLabelBtn은 labelsContainer의 자식이 아닙니다.
    labelsContainer.innerHTML = ""; // 간결하게 모든 자식 제거

    labels.forEach((label) => {
      const labelEl = document.createElement("div");
      labelEl.className = "label-item";
      labelEl.dataset.labelId = label.id;
      labelEl.draggable = true;

      if (label.id === selectedLabelId) {
        labelEl.classList.add("selected-for-drawing");
      }

      const colorSwatch = document.createElement("div");
      colorSwatch.className = "label-color-swatch";
      colorSwatch.style.backgroundColor = label.color;
      labelEl.appendChild(colorSwatch);

      const nameEl = document.createElement("span");
      nameEl.className = "label-name";
      nameEl.textContent = label.name;
      labelEl.appendChild(nameEl);

      labelEl.addEventListener("click", () => {
        const currentSelectedLabel = data.getState().selectedLabel; // 클릭 시점의 선택된 라벨
            
        // 이미 선택된 라벨을 다시 클릭하면 선택 해제
        if (currentSelectedLabel && currentSelectedLabel.id === label.id) {
            data.setSelectedLabel(null);
        } else {
            data.setSelectedLabel(label); // 새 라벨 선택
        }

        // const isAlreadySelected = labelEl.classList.contains(
        //   "selected-for-drawing"
        // );
        // const allLabelItems = labelsContainer.querySelectorAll(".label-item");
        // allLabelItems.forEach((item) =>
        //   item.classList.remove("selected-for-drawing")
        // );

        // if (isAlreadySelected) {
        //   data.setSelectedLabel(null);
        //   console.log(
        //     "APP.JS (Label Click): Label DESELECTED. state.selectedLabel is now:",
        //     JSON.stringify(data.getState().selectedLabel)
        //   );
        // } else {
        //   // 'label' 변수는 forEach 루프의 현재 라벨 객체입니다.
        //   console.log(
        //     "APP.JS (Label Click): Selecting label. Object from forEach:",
        //     JSON.stringify(label)
        //   );
        //   if (!label || !label.id) {
        //     console.error(
        //       "APP.JS (Label Click): Clicked label object is invalid or missing ID!",
        //       label
        //     );
        //   }
        //   data.setSelectedLabel(label); // dataManager의 setSelectedLabel 호출

        //   const currentSelected = data.getState().selectedLabel;
        //   console.log(
        //     "APP.JS (Label Click): state.selectedLabel in dataManager AFTER set:",
        //     JSON.stringify(currentSelected)
        //   );
        //   if (currentSelected && !currentSelected.id) {
        //     console.error(
        //       "APP.JS (Label Click): state.selectedLabel was set BUT IS MISSING ID!",
        //       currentSelected
        //     );
        //   }
        // }
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

      labelEl.addEventListener("contextmenu", (e) => {
        e.preventDefault(); // 기본 브라우저 컨텍스트 메뉴 방지
        removeActiveLabelContextMenu(); // 기존 메뉴가 있다면 제거

        activeLabelContextMenu = document.createElement("div");
        activeLabelContextMenu.className = "custom-context-menu"; // CSS 스타일링용
        activeLabelContextMenu.style.position = "absolute";
        activeLabelContextMenu.style.left = `${e.pageX}px`; // pageX, pageY 사용
        activeLabelContextMenu.style.top = `${e.pageY}px`;
        // (스타일은 style.css에 정의하는 것이 좋음)
        activeLabelContextMenu.style.background = "white";
        activeLabelContextMenu.style.border = "1px solid #ccc";
        activeLabelContextMenu.style.borderRadius = "4px";
        activeLabelContextMenu.style.boxShadow = "2px 2px 5px rgba(0,0,0,0.1)";
        activeLabelContextMenu.style.zIndex = "1010"; // 다른 UI 요소 위에 오도록
        activeLabelContextMenu.style.padding = "5px 0";


        // 이름 변경 메뉴 아이템
        const editNameItem = document.createElement("div");
        editNameItem.textContent = `이름 변경 ("${label.name}")`;
        editNameItem.className = "context-menu-item"; // 스타일링용
        editNameItem.onclick = () => {
            const newName = prompt("새 라벨 이름을 입력하세요:", label.name);
            if (newName !== null && newName.trim() !== "") {
                data.updateLabelName(label.id, newName.trim()); // dataManager 함수 호출
            }
            removeActiveLabelContextMenu();
        };
        activeLabelContextMenu.appendChild(editNameItem);

        // 삭제 메뉴 아이템
        const deleteLabelItem = document.createElement("div");
        deleteLabelItem.textContent = `라벨 삭제 ("${label.name}")`;
        deleteLabelItem.className = "context-menu-item"; // 스타일링용
        deleteLabelItem.style.color = "red";
        deleteLabelItem.onclick = () => {
            if (confirm(`"${label.name}" 라벨과 이 라벨을 사용하는 모든 프로젝트 일정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
                data.deleteLabelAndAssociatedEvents(label.id); // dataManager 함수 호출
            }
            removeActiveLabelContextMenu();
        };
        activeLabelContextMenu.appendChild(deleteLabelItem);

        document.body.appendChild(activeLabelContextMenu);

        // 메뉴 바깥 클릭 시 메뉴 닫기 (한 번만 리스너 추가)
        setTimeout(() => { // 현재 이벤트 전파가 끝난 후 리스너 추가
            window.addEventListener("click", handleOutsideContextMenuClick, { once: true });
        }, 0);
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
      if (afterElement == null) {
        // 컨테이너의 끝에 드롭하는 경우
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
      ...container.querySelectorAll(".label-item:not(.dragging)"), // addLabelBtn 제외 불필요
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
        console.log(
          "APP.JS (Save Label): Creating new label:",
          JSON.stringify(newLabel)
        ); // 생성된 newLabel 확인
        data.addLabel(newLabel);
        // renderLabels(); // data.addLabel이 eventBus를 호출하고, app.js의 리스너가 renderLabels를 호출하므로 중복일 수 있음
        // 하지만 직접 호출하는 것이 즉각적인 피드백에는 더 좋을 수 있습니다. 현재 코드는 유지.
        if (addLabelModal) addLabelModal.style.display = "none";
      } else {
        alert("Label name cannot be empty.");
      }
    });

  /**
     * '연간 데이터 저장'을 처리합니다. (저장 아이콘 클릭 시)
     */
  async function handleSaveCurrentYear() {
    if (typeof JSZip === 'undefined') {
        alert("JSZip library is not loaded.");
        return;
    }

    const currentYear = data.getState().currentDisplayYear;
    const filesToSave = data.getCurrentYearDataForSave();

    if (filesToSave.length === 0) {
        alert(`${currentYear}년에 저장할 데이터가 없습니다.`);
        return;
    }

    const zip = new JSZip();
    const yearFolder = zip.folder(String(currentYear)); // 연도 폴더 생성

    filesToSave.forEach(fileInfo => {
        // "2025/2025.json" -> "2025.json"
        const filename = fileInfo.filenameInZip.split('/')[1];
        yearFolder.file(filename, JSON.stringify(fileInfo.data, null, 2));
    });

    try {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const zipFilename = `backup_${currentYear}.zip`;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = zipFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        alert(`${currentYear}년의 데이터가 ${zipFilename}으로 저장되었습니다.`);
    } catch (e) {
        console.error("Error generating yearly backup ZIP:", e);
        alert("연간 백업 파일 생성 중 오류가 발생했습니다.");
    }
  }

  /**
     * '연간 데이터 불러오기'를 처리합니다.
     */
  function handleLoadYearlyData(event) {
    const file = event.target.files[0];
    if (!file || !file.name.endsWith('.zip')) {
        alert("연간 백업(.zip) 파일을 선택해주세요.");
        return;
    }
    
    // 파일명에서 연도 추출 (예: "backup_2025.zip")
    const yearMatch = file.name.match(/backup_(\d{4})\.zip/);
    if (!yearMatch) {
        alert("올바른 형식의 연간 백업 파일이 아닙니다. (예: backup_YYYY.zip)");
        return;
    }
    const year = parseInt(yearMatch[1], 10);

    if (!confirm(`${year}년 데이터를 불러오면 현재 ${year}년의 모든 내용이 덮어써집니다. 계속하시겠습니까?`)) {
        event.target.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const zip = await JSZip.loadAsync(e.target.result);
            const filesData = [];
            const promises = [];

            // ZIP 안의 파일들을 읽어 배열로 만듦
            zip.folder(String(year)).forEach((relativePath, zipEntry) => {
                const promise = zipEntry.async('string').then(content => {
                    filesData.push({
                        filenameInZip: `${year}/${relativePath}`,
                        data: JSON.parse(content)
                    });
                });
                promises.push(promise);
            });

            await Promise.all(promises);
            data.loadYearFromBackup(year, filesData); // dataManager의 함수 호출
            // alert(`${year}년 데이터를 성공적으로 불러왔습니다.`);

        } catch (error) {
            console.error("Error loading or parsing yearly backup:", error);
            alert(`연간 백업 파일 처리 중 오류가 발생했습니다: ${error.message}`);
        } finally {
            event.target.value = "";
        }
    };
    reader.readAsArrayBuffer(file);
  }

  // 저장 
  if (saveDataBtn) saveDataBtn.addEventListener("click", handleSaveCurrentYear);

  // 불러오기 
  if (loadDataBtn) loadDataBtn.addEventListener("click", () => fileInput.click());
  if (fileInput) fileInput.addEventListener("change", handleLoadYearlyData);

  // Keyboard shortcut for save
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      dirtyFileService.triggerPartialSave();
    }
  });

  // updateToolbarDisplays(); // Must be called before renders to set text
  initBacklog();
  initWeeklyCalendar();

  // renderYearlyCalendar(data.getState().currentDisplayYear);
  // renderLabels();
  // renderBacklog();
  // renderWeeklyCalendar(data.getState().currentWeeklyViewStartDate); // Initial render of weekly calendar
  await data.loadDataForYear(new Date().getFullYear()); 

  console.log("Phase 5 Initialized Successfully.");
});
