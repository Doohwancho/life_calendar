// js/mainViewHandler.js

import * as dirtyFileService from './dirtyFileService.js';
import { renderYearlyCalendar } from './yearlyCalendar.js';
import { initWeeklyCalendar, renderWeeklyCalendar } from './weeklyCalendar.js';
// ▼▼▼ [수정] backlog.js에서 필요한 함수들을 import 합니다. ▼▼▼
import { 
    initBacklog, 
    renderBacklog, 
    handleAddNewTodo, // 새 할 일 추가 핸들러
    handleBacklogDragOver, // 백로그 드래그 오버 핸들러
    handleBacklogDrop      // 백로그 드롭 핸들러
} from './backlog.js';
// ▲▲▲ [수정] ▲▲▲
import { generateId, formatDate } from './uiUtils.js';

let activeLabelContextMenu = null;
let draggedLabelId = null;

let data;
let eventBus;

const activeEventListeners = [];

// --- Helper Functions (기존과 동일) ---
function removeActiveLabelContextMenu() {
    if (activeLabelContextMenu) {
        if (activeLabelContextMenu.parentNode) {
            activeLabelContextMenu.remove();
        }
        activeLabelContextMenu = null;
    }
    window.removeEventListener("click", handleOutsideContextMenuClick);
}

function handleOutsideContextMenuClick(e) {
    if (activeLabelContextMenu && !activeLabelContextMenu.contains(e.target)) {
        removeActiveLabelContextMenu();
    }
}

function updateToolbarDisplays() {
    const currentYearDisplay = document.getElementById("currentYearDisplay");
    if (!data) return;
    const state = data.getState();
    if (currentYearDisplay) {
        currentYearDisplay.textContent = state.currentDisplayYear;
    }
}

function renderLabels() {
    const labelsContainer = document.getElementById("labelsContainer");
    if (!labelsContainer || !data) return;

    const state = data.getState();
    const labels = state.labels || [];
    const selectedLabelId = state.selectedLabel ? state.selectedLabel.id : null;

    labelsContainer.innerHTML = ""; 

    labels.forEach((label) => {
        const labelEl = document.createElement("div");
        labelEl.className = "mv-label-item";
        labelEl.dataset.labelId = label.id;
        labelEl.draggable = true;

        if (label.id === selectedLabelId) {
            labelEl.classList.add("mv-selected-for-drawing");
        }

        const colorSwatch = document.createElement("div");
        colorSwatch.className = "mv-label-color-swatch";
        colorSwatch.style.backgroundColor = label.color;
        labelEl.appendChild(colorSwatch);

        const nameEl = document.createElement("span");
        nameEl.className = "mv-label-name";
        nameEl.textContent = label.name;
        labelEl.appendChild(nameEl);

        const labelClickHandler = () => {
            const currentSelectedLabel = data.getState().selectedLabel;
            if (currentSelectedLabel && currentSelectedLabel.id === label.id) {
                data.setSelectedLabel(null);
            } else {
                data.setSelectedLabel(label);
            }
        };
        labelEl.addEventListener("click", labelClickHandler);
        activeEventListeners.push({ element: labelEl, type: 'click', handler: labelClickHandler });

        const labelDragStartHandler = (e) => {
            draggedLabelId = label.id;
            e.target.classList.add("mv-dragging");
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", label.id);
        };
        labelEl.addEventListener("dragstart", labelDragStartHandler);
        activeEventListeners.push({ element: labelEl, type: 'dragstart', handler: labelDragStartHandler });

        const labelDragEndHandler = (e) => {
            if (e.target) e.target.classList.remove("mv-dragging");
            draggedLabelId = null;
        };
        labelEl.addEventListener("dragend", labelDragEndHandler);
        activeEventListeners.push({ element: labelEl, type: 'dragend', handler: labelDragEndHandler });
        
        const labelContextMenuHandler = (e) => {
            e.preventDefault();
            removeActiveLabelContextMenu();

            activeLabelContextMenu = document.createElement("div");
            activeLabelContextMenu.id = "customLabelContextMenu";
            activeLabelContextMenu.className = "mv-custom-context-menu";
            activeLabelContextMenu.style.position = "absolute";
            activeLabelContextMenu.style.left = `${e.pageX}px`;
            activeLabelContextMenu.style.top = `${e.pageY}px`;

            const editNameItem = document.createElement("div");
            editNameItem.textContent = `이름 변경 ("${label.name}")`;
            editNameItem.className = "mv-context-menu-item";
            editNameItem.onclick = () => {
                const newName = prompt("새 라벨 이름을 입력하세요:", label.name);
                if (newName !== null && newName.trim() !== "") {
                    data.updateLabelName(label.id, newName.trim());
                }
                removeActiveLabelContextMenu();
            };
            activeLabelContextMenu.appendChild(editNameItem);

            const deleteLabelItem = document.createElement("div");
            deleteLabelItem.textContent = `라벨 삭제 ("${label.name}")`;
            deleteLabelItem.className = "mv-context-menu-item";
            deleteLabelItem.style.color = "red";
            deleteLabelItem.onclick = () => {
                if (confirm(`"${label.name}" 라벨과 이 라벨을 사용하는 모든 프로젝트 일정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
                    data.deleteLabelAndAssociatedEvents(label.id);
                }
                removeActiveLabelContextMenu();
            };
            activeLabelContextMenu.appendChild(deleteLabelItem);

            document.body.appendChild(activeLabelContextMenu);
            setTimeout(() => {
                window.addEventListener("click", handleOutsideContextMenuClick, { once: true });
            }, 0);
        };
        labelEl.addEventListener("contextmenu", labelContextMenuHandler);
        activeEventListeners.push({ element: labelEl, type: 'contextmenu', handler: labelContextMenuHandler });

        labelsContainer.appendChild(labelEl);
    });
}

function getDragAfterElementForLabels(container, x) {
    const draggableElements = [
        ...container.querySelectorAll(".mv-label-item:not(.mv-dragging)")
    ];
    return draggableElements.reduce(
        (closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = x - box.left - box.width / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else { return closest; }
        }, { offset: Number.NEGATIVE_INFINITY }
    ).element;
}

async function handleSaveCurrentYear() {
    if (typeof JSZip === 'undefined') {
        alert("JSZip library is not loaded."); return;
    }
    if (!data) return;
    const currentYear = data.getState().currentDisplayYear;
    const filesToSave = data.getCurrentYearDataForSave();
    if (filesToSave.length === 0) {
        alert(`${currentYear}년에 저장할 데이터가 없습니다.`); return;
    }
    const zip = new JSZip();
    const yearFolder = zip.folder(String(currentYear));
    filesToSave.forEach(fileInfo => {
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
        // alert(`${currentYear}년의 데이터가 ${zipFilename}으로 저장(다운로드)되었습니다.`);
        // data.clearAllDirtyFilesForYear(currentYear);
        console.log(`[MainViewHandler] Data for year ${currentYear} saved to ZIP. LocalStorage dirty data for this year is intentionally kept.`);
    } catch (e) {
        console.error("Error generating yearly backup ZIP:", e);
        alert("연간 백업 파일 생성 중 오류가 발생했습니다.");
    }
}

function handleLoadYearlyData(event) {
    const file = event.target.files[0];
    if (!file || !file.name.endsWith('.zip')) {
        alert("연간 백업(.zip) 파일을 선택해주세요."); return;
    }
    const yearMatch = file.name.match(/backup_(\d{4})\.zip/);
    if (!yearMatch) {
        alert("올바른 형식의 연간 백업 파일이 아닙니다. (예: backup_YYYY.zip)"); return;
    }
    const year = parseInt(yearMatch[1], 10);
    // if (!confirm(`${year}년 데이터를 불러오면 현재 ${year}년의 모든 내용이 덮어써집니다. 계속하시겠습니까?`)) {
    //     event.target.value = ""; return;
    // }
    const reader = new FileReader();
    reader.onload = async (e_reader) => {
        try {
            const zip = await JSZip.loadAsync(e_reader.target.result);
            const filesData = [];
            const promises = [];
            const yearFolder = zip.folder(String(year));
            if (yearFolder) {
                yearFolder.forEach((relativePath, zipEntry) => {
                    if (!zipEntry.dir) {
                        const promise = zipEntry.async('string').then(content => {
                            filesData.push({
                                filenameInZip: `${year}/${relativePath}`,
                                data: JSON.parse(content)
                            });
                        });
                        promises.push(promise);
                    }
                });
            }
            await Promise.all(promises);
            if (!data) return;
            data.loadYearFromBackup(year, filesData);
        } catch (error) {
            console.error("Error loading or parsing yearly backup:", error);
            alert(`연간 백업 파일 처리 중 오류가 발생했습니다: ${error.message}`);
        } finally {
            event.target.value = "";
        }
    };
    reader.readAsArrayBuffer(file);
}

// --- Main View 초기화 함수 ---
export async function initMainCalendarView(dataModule, eventBusModule, params, query) {
    console.log('[MainViewHandler] 메인 캘린더 뷰 초기화 시작');
    data = dataModule;
    eventBus = eventBusModule;
    activeEventListeners.length = 0;
    draggedLabelId = null;
    removeActiveLabelContextMenu();

    // 1. DOM 요소 참조 (일반 UI 요소)
    const currentYearDisplay = document.getElementById("currentYearDisplay"); // Toolbar
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

    // 2. dataChanged 리스너 설정
    const dataChangedHandler = (payload) => {
        console.log(`[MainViewHandler] eventBus 'dataChanged' received. Source: ${payload?.source}`);
        updateToolbarDisplays();
        if (labelsContainer) renderLabels();
        
        const state = data.getState(); // render 함수들이 최신 상태를 사용하도록 여기서 한 번 더 가져옴
        renderYearlyCalendar(state.currentDisplayYear);
        renderWeeklyCalendar(state.currentWeeklyViewStartDate);
        renderBacklog();
    };
    eventBus.on("dataChanged", dataChangedHandler);
    activeEventListeners.push({ target: eventBus, type: 'dataChanged', handler: dataChangedHandler, isEventBus: true });

    // 3. 각 하위 컴포넌트 초기화
    initBacklog(); 
    initWeeklyCalendar();

    // --- 4. 백로그 관련 DOM 요소 참조 및 이벤트 리스너 설정 ---
    // backlog.js에서 ID로 참조하는 요소들을 가져옵니다.
    const showAddTodoFormBtn = document.getElementById("showAddTodoFormBtn");
    const addTodoFormContainer = document.getElementById("addTodoFormContainer");
    const newTodoTextInput = document.getElementById("newTodoTextInput"); // backlog.handleAddNewTodo 내부에서 사용
    const newTodoPriorityInput = document.getElementById("newTodoPriorityInput"); // backlog.handleAddNewTodo 내부에서 사용
    const saveNewTodoBtn = document.getElementById("saveNewTodoBtn");
    const cancelNewTodoBtn = document.getElementById("cancelNewTodoBtn");
    const backlogListContainer = document.getElementById("backlogListContainer");

    if (showAddTodoFormBtn && addTodoFormContainer && newTodoTextInput) {
        const showAddTodoFormClickHandler = () => {
            addTodoFormContainer.style.display = "flex"; // 또는 "block", 폼의 CSS에 따라
            newTodoTextInput.value = ""; // 입력 필드 초기화
            if (newTodoPriorityInput) newTodoPriorityInput.value = 0; // 우선순위 필드 초기화
            newTodoTextInput.focus();
        };
        showAddTodoFormBtn.addEventListener("click", showAddTodoFormClickHandler);
        activeEventListeners.push({ element: showAddTodoFormBtn, type: 'click', handler: showAddTodoFormClickHandler });
    }

    if (saveNewTodoBtn) {
        // backlog.js에서 export된 handleAddNewTodo 함수를 이벤트 리스너로 사용
        saveNewTodoBtn.addEventListener("click", handleAddNewTodo); // 직접 backlog.handleAddNewTodo 참조
        activeEventListeners.push({ element: saveNewTodoBtn, type: 'click', handler: handleAddNewTodo });
    }

    if (cancelNewTodoBtn && addTodoFormContainer && newTodoTextInput && newTodoPriorityInput) {
        const cancelNewTodoClickHandler = () => {
            addTodoFormContainer.style.display = "none";
            newTodoTextInput.value = "";
            newTodoPriorityInput.value = 0;
        };
        cancelNewTodoBtn.addEventListener("click", cancelNewTodoClickHandler);
        activeEventListeners.push({ element: cancelNewTodoBtn, type: 'click', handler: cancelNewTodoClickHandler });
    }

    const handleInputKeydown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault(); // 폼 제출 등 기본 동작 방지
            handleAddNewTodo(); // backlog.js의 함수 호출
        }
    };

    if (newTodoTextInput) {
        newTodoTextInput.addEventListener("keydown", handleInputKeydown);
        activeEventListeners.push({ element: newTodoTextInput, type: 'keydown', handler: handleInputKeydown });
    }

    if (newTodoPriorityInput) {
        // 우선순위 입력칸에서도 엔터 시 추가 (선택 사항)
        newTodoPriorityInput.addEventListener("keydown", handleInputKeydown);
        activeEventListeners.push({ element: newTodoPriorityInput, type: 'keydown', handler: handleInputKeydown });
    }

    if (backlogListContainer) {
        // backlog.js에서 export된 핸들러 사용
        backlogListContainer.addEventListener('dragover', handleBacklogDragOver);
        activeEventListeners.push({ element: backlogListContainer, type: 'dragover', handler: handleBacklogDragOver });
        
        backlogListContainer.addEventListener('drop', handleBacklogDrop);
        activeEventListeners.push({ element: backlogListContainer, type: 'drop', handler: handleBacklogDrop });
    }
    // --- 백로그 관련 이벤트 리스너 설정 끝 ---


    // 4. 나머지 이벤트 리스너 설정 (기존 코드)
    if (labelsContainer) {
        const labelsDragOverHandler = (e) => {
            e.preventDefault();
            const draggingEl = labelsContainer.querySelector(".mv-label-item.mv-dragging");
            if (!draggingEl) return;
            const afterElement = getDragAfterElementForLabels(labelsContainer, e.clientX);
            if (afterElement == null) { labelsContainer.appendChild(draggingEl); }
            else { labelsContainer.insertBefore(draggingEl, afterElement); }
        };
        labelsContainer.addEventListener("dragover", labelsDragOverHandler);
        activeEventListeners.push({ element: labelsContainer, type: 'dragover', handler: labelsDragOverHandler });

        const labelsDropHandler = (e) => {
            e.preventDefault();
            if (!draggedLabelId) return;
            const newLabelOrderIds = Array.from(labelsContainer.querySelectorAll(".mv-label-item"))
                .map((el) => el.dataset.labelId);
            data.reorderLabels(newLabelOrderIds);
            draggedLabelId = null;
        };
        labelsContainer.addEventListener("drop", labelsDropHandler);
        activeEventListeners.push({ element: labelsContainer, type: 'drop', handler: labelsDropHandler });
    }

    if (addLabelBtn) {
        const addLabelBtnClickHandler = () => {
            if (addLabelModal) addLabelModal.style.display = "flex";
            if (labelNameInput) { labelNameInput.value = ""; labelNameInput.focus(); }
            if (labelColorInput) labelColorInput.value = "#ff0000"; // 기본 색상 예시
        };
        addLabelBtn.addEventListener("click", addLabelBtnClickHandler);
        activeEventListeners.push({ element: addLabelBtn, type: 'click', handler: addLabelBtnClickHandler });
    }

    if (cancelLabelBtn && addLabelModal) {
        const cancelLabelBtnClickHandler = () => { addLabelModal.style.display = "none"; };
        cancelLabelBtn.addEventListener("click", cancelLabelBtnClickHandler);
        activeEventListeners.push({ element: cancelLabelBtn, type: 'click', handler: cancelLabelBtnClickHandler });
    }

    if (saveLabelBtn && addLabelModal && labelNameInput && labelColorInput) {
        const saveLabelBtnClickHandler = () => {
            const name = labelNameInput.value.trim();
            const color = labelColorInput.value;
            if (name) {
                data.addLabel({ id: generateId('lbl_'), name, color }); // ID 생성에 prefix 추가
                addLabelModal.style.display = "none";
            } else { alert("Label name cannot be empty."); }
        };
        saveLabelBtn.addEventListener("click", saveLabelBtnClickHandler);
        activeEventListeners.push({ element: saveLabelBtn, type: 'click', handler: saveLabelBtnClickHandler });
    }

    if (saveDataBtn) {
        saveDataBtn.addEventListener("click", handleSaveCurrentYear);
        activeEventListeners.push({ element: saveDataBtn, type: 'click', handler: handleSaveCurrentYear });
    }
    if (loadDataBtn && fileInput) {
        const loadDataBtnClickHandler = () => fileInput.click();
        loadDataBtn.addEventListener("click", loadDataBtnClickHandler);
        activeEventListeners.push({ element: loadDataBtn, type: 'click', handler: loadDataBtnClickHandler });
    }
    if (fileInput) {
        fileInput.addEventListener("change", handleLoadYearlyData);
        activeEventListeners.push({ element: fileInput, type: 'change', handler: handleLoadYearlyData });
    }
    
    const keydownHandler = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
            e.preventDefault();
            handleSaveCurrentYear();
        }
    };
    document.addEventListener("keydown", keydownHandler);
    activeEventListeners.push({ target: document, type: 'keydown', handler: keydownHandler });
    
    // 5. 초기 데이터 로드 및 UI 업데이트
    let yearToLoad;
    if (params?.year) { // URL에 연도 파라미터가 명시적으로 있으면 그것 사용
        yearToLoad = parseInt(params.year, 10);
    } else if (data.getState().settings?.lastOpenedYear) { // 마지막으로 열었던 연도 사용
        yearToLoad = data.getState().settings.lastOpenedYear;
    } else { // 그것도 없으면 dataManager의 현재 표시 연도 또는 실제 현재 연도 사용
        yearToLoad = data.getState().currentDisplayYear || new Date().getFullYear();
    }
    yearToLoad = parseInt(yearToLoad, 10); // 확실히 숫자로

    const currentState = data.getState();

    // 조건: 현재 dataManager에 로드된 연도(currentState.currentDisplayYear)가 yearToLoad와 다르거나,
    //       yearlyData가 아예 없거나, yearlyData의 연도가 yearToLoad와 다를 때만 새로 로드.
    if (currentState.currentDisplayYear !== yearToLoad ||
        !currentState.yearlyData ||
        (currentState.yearlyData && currentState.yearlyData.year !== yearToLoad)
    ) {
        console.log(`[MainViewHandler] Main view needs to load data for year: ${yearToLoad}. Current display year in DM: ${currentState.currentDisplayYear}`);
        await data.loadDataForYear(yearToLoad); 
        // loadDataForYear 내부에서 state.view.currentDisplayYear가 yearToLoad로 설정될 것임.
        // 그리고 settings.lastOpenedYear도 이 시점에 업데이트 해주는 것이 좋음.
        data.updateSettings({ lastOpenedYear: yearToLoad }); // dataManager에 이런 함수가 필요함
    } else {
        console.log(`[MainViewHandler] Data for year ${yearToLoad} is already current in dataManager. Rendering main view.`);
        dataChangedHandler({ source: 'initMainViewWithExistingData' });
    }

    console.log('[MainViewHandler] 메인 캘린더 뷰 초기화 완료');
}

// --- Main View 정리 함수 ---
export function cleanupMainCalendarView() {
    console.log('[MainViewHandler] 메인 캘린더 뷰 정리 시작');
    
    activeEventListeners.forEach((listener) => {
        const target = listener.target || listener.element;
        if (target) {
            if (listener.isEventBus) {
                if (typeof target.off === 'function') {
                    target.off(listener.type, listener.handler);
                }
            } else {
                if (typeof target.removeEventListener === 'function') {
                    target.removeEventListener(listener.type, listener.handler);
                }
            }
        }
    });
    activeEventListeners.length = 0;

    removeActiveLabelContextMenu();
    console.log('[MainViewHandler] 메인 캘린더 뷰 정리 완료');
}