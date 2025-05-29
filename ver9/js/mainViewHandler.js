// js/mainViewHandler.js

import * as dirtyFileService from './dirtyFileService.js';
import { renderYearlyCalendar } from './yearlyCalendar.js';
import { initWeeklyCalendar, renderWeeklyCalendar } from './weeklyCalendar.js';
import { initBacklog, renderBacklog } from './backlog.js';
import { generateId, formatDate } from './uiUtils.js';
// dataManager와 eventBus는 initMainCalendarView 함수의 인자로 전달받습니다.
// import { navigate } from './spaRouter.js'; // 다른 뷰로 네비게이션 시 필요 (예: yearlyCalendar에서 dailyView로)

// 모듈 스코프 변수 (기존 app.js의 전역 변수 역할)
let activeLabelContextMenu = null;
let draggedLabelId = null;

// dataManager와 eventBus 인스턴스를 저장할 모듈 스코프 변수
let data; // dataManager 모듈 참조
let eventBus; // eventBus 모듈 참조

// 이 뷰 핸들러에서 추가한 이벤트 리스너들을 추적하기 위한 배열
const activeEventListeners = [];

// --- Helper Functions (기존 app.js에서 가져오거나 수정) ---

function removeActiveLabelContextMenu() {
    if (activeLabelContextMenu) {
        if (activeLabelContextMenu.parentNode) { // DOM에 아직 있는지 확인
            activeLabelContextMenu.remove();
        }
        activeLabelContextMenu = null;
    }
    // handleOutsideContextMenuClick 리스너는 추가될 때 { once: true }로 추가되므로,
    // 명시적으로 여기서 항상 제거할 필요는 없을 수 있으나, 안전하게 제거
    window.removeEventListener("click", handleOutsideContextMenuClick);
}

function handleOutsideContextMenuClick(e) {
    if (activeLabelContextMenu && !activeLabelContextMenu.contains(e.target)) {
        removeActiveLabelContextMenu();
    }
}

function updateToolbarDisplays() {
    // 메인 뷰 템플릿이 로드된 후 DOM 요소 참조
    const currentYearDisplay = document.getElementById("currentYearDisplay");
    // const weekJumpInput = document.getElementById("weekJumpInput"); // 현재 HTML에서 주석처리됨

    if (!data) return; // dataManager가 아직 설정되지 않았으면 종료
    const state = data.getState();

    if (currentYearDisplay) {
        currentYearDisplay.textContent = state.currentDisplayYear;
    }
    // if (weekJumpInput && state.currentWeeklyViewStartDate) { // 현재 HTML에서 주석 처리됨
    //     weekJumpInput.value = formatDate(state.currentWeeklyViewStartDate);
    // }
}

function renderLabels() {
    const labelsContainer = document.getElementById("labelsContainer");
    if (!labelsContainer || !data) return;

    const state = data.getState();
    const labels = state.labels || [];
    const selectedLabelId = state.selectedLabel ? state.selectedLabel.id : null;

    labelsContainer.innerHTML = ""; // 기존 라벨들 지우기

    labels.forEach((label) => {
        const labelEl = document.createElement("div");
        labelEl.className = "mv-label-item"; // CSS 접두사 일관성 확인
        labelEl.dataset.labelId = label.id;
        labelEl.draggable = true;

        if (label.id === selectedLabelId) {
            labelEl.classList.add("mv-selected-for-drawing"); // CSS 접두사 일관성 확인
        }

        const colorSwatch = document.createElement("div");
        colorSwatch.className = "mv-label-color-swatch"; // CSS 접두사 일관성 확인
        colorSwatch.style.backgroundColor = label.color;
        labelEl.appendChild(colorSwatch);

        const nameEl = document.createElement("span");
        nameEl.className = "mv-label-name"; // CSS 접두사 일관성 확인
        nameEl.textContent = label.name;
        labelEl.appendChild(nameEl);

        // --- 이벤트 핸들러들을 activeEventListeners에 등록 ---
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
            e.target.classList.add("mv-dragging"); // CSS 접두사 일관성 확인
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
            removeActiveLabelContextMenu(); // 기존 메뉴 제거

            activeLabelContextMenu = document.createElement("div");
            activeLabelContextMenu.id = "customLabelContextMenu"; // ID 사용 (CSS에서 스타일링)
            activeLabelContextMenu.className = "mv-custom-context-menu"; // 클래스도 추가 (CSS 접두사)
            activeLabelContextMenu.style.position = "absolute";
            activeLabelContextMenu.style.left = `${e.pageX}px`;
            activeLabelContextMenu.style.top = `${e.pageY}px`;
            // 나머지 스타일은 CSS 파일에서 (.mv-custom-context-menu)

            const editNameItem = document.createElement("div");
            editNameItem.textContent = `이름 변경 ("${label.name}")`;
            editNameItem.className = "mv-context-menu-item"; // CSS 접두사
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
            deleteLabelItem.className = "mv-context-menu-item"; // CSS 접두사
            deleteLabelItem.style.color = "red";
            deleteLabelItem.onclick = () => {
                if (confirm(`"${label.name}" 라벨과 이 라벨을 사용하는 모든 프로젝트 일정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
                    data.deleteLabelAndAssociatedEvents(label.id);
                }
                removeActiveLabelContextMenu();
            };
            activeLabelContextMenu.appendChild(deleteLabelItem);

            document.body.appendChild(activeLabelContextMenu);
            // 바깥 클릭 시 메뉴 닫기 리스너는 window에 추가되므로 activeEventListeners에 등록
            setTimeout(() => { // 현재 이벤트 전파 후 리스너 추가
                window.addEventListener("click", handleOutsideContextMenuClick, { once: true });
                // 이 once 리스너는 자동 제거되지만, cleanup에서 명시적으로 제거하는 것이 더 안전할 수 있음.
                // 하지만 once: true 이므로 cleanup에서 특별히 제거 안해도 문제는 없음.
                // 만약 추적하려면 activeEventListeners에 추가할 수 있으나, 콜백이 동일해야 함.
            }, 0);
        };
        labelEl.addEventListener("contextmenu", labelContextMenuHandler);
        activeEventListeners.push({ element: labelEl, type: 'contextmenu', handler: labelContextMenuHandler });

        labelsContainer.appendChild(labelEl);
    });
}

function getDragAfterElementForLabels(container, x) {
    const draggableElements = [
        ...container.querySelectorAll(".mv-label-item:not(.mv-dragging)") // CSS 접두사 일관성
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
        alert(`${currentYear}년의 데이터가 ${zipFilename}으로 저장(다운로드)되었습니다.`);
        data.clearAllDirtyFilesForYear(currentYear); // dataManager에 export된 함수 사용
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
    if (!confirm(`${year}년 데이터를 불러오면 현재 ${year}년의 모든 내용이 덮어써집니다. 계속하시겠습니까?`)) {
        event.target.value = ""; return;
    }
    const reader = new FileReader();
    reader.onload = async (e_reader) => { // 변수명 충돌 방지 e -> e_reader
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
            // alert(`${year}년 데이터를 성공적으로 불러왔습니다.`); // dataChanged 이벤트가 UI를 업데이트
        } catch (error) {
            console.error("Error loading or parsing yearly backup:", error);
            alert(`연간 백업 파일 처리 중 오류가 발생했습니다: ${error.message}`);
        } finally {
            event.target.value = ""; // 파일 입력 초기화
        }
    };
    reader.readAsArrayBuffer(file);
}

// --- Main View 초기화 함수 ---
export async function initMainCalendarView(dataModule, eventBusModule, params, query) {
    console.log('[MainViewHandler] 메인 캘린더 뷰 초기화 시작');
    data = dataModule;
    eventBus = eventBusModule;
    activeEventListeners.length = 0; // 핸들러 초기화 시 리스너 배열 초기화
    draggedLabelId = null; // 드래그 상태 초기화
    removeActiveLabelContextMenu(); // 혹시 남아있을 컨텍스트 메뉴 제거

    // 1. DOM 요소 참조 (메인 뷰 템플릿이 로드된 후)
    const currentYearDisplay = document.getElementById("currentYearDisplay");
    const labelsContainer = document.getElementById("labelsContainer");
    const addLabelBtn = document.getElementById("addLabelBtn");
    const addLabelModal = document.getElementById("addLabelModal"); // 메인 뷰 템플릿에 있는 모달
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
        const state = data.getState();
        updateToolbarDisplays(); 
        if (labelsContainer) renderLabels(); // labelsContainer가 실제로 DOM에 있는지 확인 후 호출
        
        // 각 render 함수는 내부적으로 DOM 요소를 찾거나, init 함수에서 설정된 변수를 사용합니다.
        renderYearlyCalendar(state.currentDisplayYear);
        renderWeeklyCalendar(state.currentWeeklyViewStartDate);
        renderBacklog();
    };
    eventBus.on("dataChanged", dataChangedHandler);
    activeEventListeners.push({ target: eventBus, type: 'dataChanged', handler: dataChangedHandler, isEventBus: true });

    // 3. 각 하위 컴포넌트 초기화
    initBacklog(); // 내부에서 필요한 DOM 요소 참조
    initWeeklyCalendar(); // 내부에서 필요한 DOM 요소 참조

    // 4. 이벤트 리스너 설정
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
            if (labelColorInput) labelColorInput.value = "#ff0000";
        };
        addLabelBtn.addEventListener("click", addLabelBtnClickHandler);
        activeEventListeners.push({ element: addLabelBtn, type: 'click', handler: addLabelBtnClickHandler });
    }

    if (cancelLabelBtn && addLabelModal) { // addLabelModal도 확인
        const cancelLabelBtnClickHandler = () => { addLabelModal.style.display = "none"; };
        cancelLabelBtn.addEventListener("click", cancelLabelBtnClickHandler);
        activeEventListeners.push({ element: cancelLabelBtn, type: 'click', handler: cancelLabelBtnClickHandler });
    }

    if (saveLabelBtn && addLabelModal && labelNameInput && labelColorInput) { // 관련된 모든 요소 확인
        const saveLabelBtnClickHandler = () => {
            const name = labelNameInput.value.trim();
            const color = labelColorInput.value;
            if (name) {
                data.addLabel({ id: generateId(), name, color });
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
    if (loadDataBtn && fileInput) { // fileInput도 확인
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
    document.addEventListener("keydown", keydownHandler); // document에 등록
    activeEventListeners.push({ target: document, type: 'keydown', handler: keydownHandler });
    
    // 5. 초기 데이터 로드 (또는 UI 업데이트 트리거)
    // params.year 등을 활용하여 특정 연도로 로드할 수 있지만, 기본적으로 현재 연도 또는 dataManager의 상태를 따름
    const yearToLoad = parseInt(params?.year, 10) || data.getState().currentDisplayYear || new Date().getFullYear();
    if (!data.getState().yearlyData || data.getState().currentDisplayYear !== yearToLoad) {
        await data.loadDataForYear(yearToLoad); // dataChanged 이벤트를 발생시켜 UI 렌더링
    } else {
        dataChangedHandler({ source: 'initMainViewWithExistingData' }); // 이미 데이터 있으면 UI만 다시 그림
    }

    console.log('[MainViewHandler] 메인 캘린더 뷰 초기화 완료');
}

// --- Main View 정리 함수 ---
export function cleanupMainCalendarView() {
    console.log('[MainViewHandler] 메인 캘린더 뷰 정리 시작');
    
    activeEventListeners.forEach((listener, index) => {
        const target = listener.target || listener.element; // 이벤트 타겟 결정
        
        console.log(`[Cleanup] Processing listener ${index}:`, listener); // 어떤 리스너를 처리하는지 확인
        console.log(`[Cleanup] Target for listener ${index}:`, target);

        if (target) {
            if (listener.isEventBus) {
                console.log(`[Cleanup] Listener ${index} is for EventBus. Target type: ${typeof target}, Has 'off' method: ${typeof target.off === 'function'}`);
                if (typeof target.off === 'function') {
                    target.off(listener.type, listener.handler); // eventBus의 경우 off 사용
                    console.log(`[Cleanup] Successfully called target.off() for listener ${index}`);
                } else {
                    console.error(`[Cleanup] ERROR: target.off is not a function for EventBus listener ${index}! Target:`, target);
                }
            } else {
                // DOM 요소의 이벤트 리스너 제거
                if (typeof target.removeEventListener === 'function') {
                    target.removeEventListener(listener.type, listener.handler);
                    // console.log(`[Cleanup] Successfully called target.removeEventListener() for listener ${index}`);
                } else {
                    console.warn(`[Cleanup] Target for listener ${index} does not have removeEventListener method:`, target);
                }
            }
        } else {
            console.warn(`[Cleanup] Target is null or undefined for listener ${index}:`, listener);
        }
    });
    activeEventListeners.length = 0; // 배열 비우기

    removeActiveLabelContextMenu(); // 컨텍스트 메뉴 및 관련 window 리스너 확실히 제거

    // 각 하위 모듈의 cleanup 함수가 있다면 호출 (현재는 없음)
    // if (typeof cleanupBacklog === 'function') cleanupBacklog();
    // if (typeof cleanupWeeklyCalendar === 'function') cleanupWeeklyCalendar();
    // if (typeof cleanupYearlyCalendar === 'function') cleanupYearlyCalendar();

    console.log('[MainViewHandler] 메인 캘린더 뷰 정리 완료');
}