// timelines.js

// --- Module-Scoped Variables (이전과 동일) ---
let blockData = {};
let goalBlockData = {};
let timeGridActualDomId = ''; // initTimelines에서 설정됨
let goalGridActualDomId = ''; // initTimelines에서 설정됨
let timeGridStartColors = new Map();
let goalGridStartColors = new Map();

let activeGridIdInternal = null; // 'timeGrid' 또는 'goalTimeGrid' (내부 키)
let isDraggingInternal = false;
let dragStartCellInternal = null; // 드래그 시작 셀 (DOM 요소)
let currentlyEditingCellInternal = null;

// todo.js에서 드래그 앤 드롭 시 사용되는 변수
let scheduledTasks = []; // 타임라인에 드롭된 투두 작업들을 저장할 배열
const DEFAULT_SCHEDULED_TASK_BORDER_COLOR = '#4A90E2'; // 예시 테두리 색상 (진한 파란색)
const MINUTES_PER_BLOCK = 10; // 각 그리드 셀이 나타내는 시간 (분)

// --- Callbacks & Refs (이전과 동일) ---
let getSelectedColorCallback = () => 'rgb(255,255,255)';
let isDarkColorCallback = () => false;
let normalizeColorCallback = color => color;
let onTimeGridDataChangeCallback = () => {};

// --- Core Timeline Functions ---
function applyPreviousColorStyle() {
    const styleId = 'timelinePreviousColorStyle';
    if (document.getElementById(styleId)) return;
    const previousColorStyle = `
        .grid-cell.color-changed { padding-left: 16px; position: relative; }
        .grid-cell.color-changed::before {
            content: ''; position: absolute; top: -1px; left: -1px;
            border-style: solid; border-width: 10px 10px 0 0;
            border-right-color: transparent; border-bottom-color: transparent;
            border-top-color: var(--previous-color); z-index: 0;
        }`;
    const styleSheet = document.createElement("style");
    styleSheet.id = styleId;
    styleSheet.textContent = previousColorStyle;
    document.head.appendChild(styleSheet);
}

function createCell(text, className) {
    const cell = document.createElement('div');
    cell.className = className;
    cell.textContent = text;
    if (className === 'grid-cell') {
        cell.style.backgroundColor = 'rgb(255, 255, 255)'; // Default white
    }
    return cell; // 이 return 문이 반드시 있어야 합니다.
}

function storeCurrentColorsForGrid(internalGridKey) {
    const dataStore = internalGridKey === 'timeGrid' ? blockData : goalBlockData;
    const colorStoreMap = internalGridKey === 'timeGrid' ? timeGridStartColors : goalGridStartColors;
    colorStoreMap.clear();

    const actualDomId = internalGridKey === 'timeGrid' ? timeGridActualDomId : goalGridActualDomId;
    if (!actualDomId) return;

    document.querySelectorAll(`#${actualDomId} .grid-cell`).forEach(cell => {
        const key = `${cell.dataset.hour}-${cell.dataset.block}`;
        const currentCellData = dataStore[key];
        const colorToStore = currentCellData ? currentCellData.color : 'rgb(255,255,255)';
        colorStoreMap.set(key, colorToStore);
    });
}

function internalSaveBlock(blockKey, text, cellElement, internalGridKey, newColor, previousColorForInteractionStart) {
    const dataStore = internalGridKey === 'timeGrid' ? blockData : goalBlockData;

    if (!dataStore[blockKey]) { // Initialize if new
        if (internalGridKey === 'timeGrid') {
            dataStore[blockKey] = { text: '', color: 'rgb(255,255,255)', previousColor: null };
        } else { // goalTimeGrid
            dataStore[blockKey] = { text: '', color: 'rgb(255,255,255)' };
        }
    }

    dataStore[blockKey].text = text;
    dataStore[blockKey].color = newColor;

    if (internalGridKey === 'timeGrid') {
        const normalizedNewColor = normalizeColorCallback(newColor);
        const normalizedPrevColor = normalizeColorCallback(previousColorForInteractionStart);

        if (previousColorForInteractionStart && normalizedNewColor !== normalizedPrevColor) {
            dataStore[blockKey].previousColor = previousColorForInteractionStart;
            cellElement.classList.add('color-changed');
            cellElement.style.setProperty('--previous-color', previousColorForInteractionStart);
        } else {
            dataStore[blockKey].previousColor = null;
            cellElement.classList.remove('color-changed');
            cellElement.style.removeProperty('--previous-color');
        }
        onTimeGridDataChangeCallback(); // Only for Current Timeline
    } else { // For goalTimeGrid
        delete dataStore[blockKey].previousColor; // Ensure no previousColor property
        cellElement.classList.remove('color-changed');
        cellElement.style.removeProperty('--previous-color');
    }
    
    cellElement.style.backgroundColor = newColor;
    cellElement.textContent = text;
    cellElement.style.color = isDarkColorCallback(newColor) ? 'white' : 'black';
}


function handleCellClickInternal(event, internalGridKey) {
    const cell = event.target.closest('.grid-cell');
    if (!cell) return;

    activeGridIdInternal = internalGridKey;
    currentlyEditingCellInternal = cell;

    const dataStore = internalGridKey === 'timeGrid' ? blockData : goalBlockData;
    const colorStoreMap = internalGridKey === 'timeGrid' ? timeGridStartColors : goalGridStartColors;
    const blockKey = `${cell.dataset.hour}-${cell.dataset.block}`;
    
    let cellData = dataStore[blockKey];
    if (!cellData) { // Should ideally be pre-initialized
        if (internalGridKey === 'timeGrid') {
            cellData = { text: cell.textContent, color: cell.style.backgroundColor || 'rgb(255,255,255)', previousColor: null };
        } else {
            cellData = { text: cell.textContent, color: cell.style.backgroundColor || 'rgb(255,255,255)' };
        }
        dataStore[blockKey] = cellData;
    }

    // 모달 생성
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    const textarea = document.createElement('textarea');
    textarea.className = 'editing-textarea';
    textarea.value = cellData.text;

    modalContent.style.backgroundColor = cellData.color;
    textarea.style.color = isDarkColorCallback(cellData.color) ? 'white' : 'black';

    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'modal-buttons';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'modal-button save-text-button'; saveBtn.textContent = 'Save';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'modal-button cancel-text-button'; cancelBtn.textContent = 'Cancel';

    const closeModal = () => {
        modalOverlay.remove();
        document.removeEventListener('keydown', handleEscKey);
        currentlyEditingCellInternal = null; // clearCurrentlyEditingCellFlag()와 동일한 역할
    };
    const handleEscKey = (e) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', handleEscKey);

    saveBtn.addEventListener('click', () => {
        const currentCellColor = cell.style.backgroundColor; // The color visual on cell
        const originalColorAtInteractionStart = colorStoreMap.get(blockKey) || cellData.color; // Color when mousedown happened
        
        // If current timeline, previousColor is the one from interaction start.
        // If goal timeline, previousColor is irrelevant for triangle.
        const effectivePreviousColor = internalGridKey === 'timeGrid' ? originalColorAtInteractionStart : null;

        internalSaveBlock(blockKey, textarea.value, cell, internalGridKey, currentCellColor, effectivePreviousColor);
        closeModal();
    });
    cancelBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            internalSaveBlock(blockKey, textarea.value, cell, internalGridKey, cell.style.backgroundColor, dataStore[blockKey]?.previousColor);
            closeModal();
        }
    });
    buttonsDiv.appendChild(cancelBtn); buttonsDiv.appendChild(saveBtn);
    modalContent.appendChild(textarea); modalContent.appendChild(buttonsDiv);
    modalOverlay.appendChild(modalContent); document.body.appendChild(modalOverlay);
    textarea.focus();

    const selectedColorFromPicker = getSelectedColorCallback();
    const colorBeforeThisClick = colorStoreMap.get(blockKey) || cellData.color;

    internalSaveBlock(blockKey, cellData.text, cell, internalGridKey, selectedColorFromPicker, colorBeforeThisClick);
    
    if(modalContent) modalContent.style.backgroundColor = selectedColorFromPicker;
    if(textarea) textarea.style.color = isDarkColorCallback(selectedColorFromPicker) ? 'white' : 'black';
}


function handleDragPaintInternal(draggedStartCell, currentHoverCell, internalGridKey) {
    const actualDomId = internalGridKey === 'timeGrid' ? timeGridActualDomId : goalGridActualDomId;
    if (!actualDomId) { return; }

    const dataStore = internalGridKey === 'timeGrid' ? blockData : goalBlockData;
    const startColorsMap = internalGridKey === 'timeGrid' ? timeGridStartColors : goalGridStartColors;

    const minHour = Math.min(parseInt(draggedStartCell.dataset.hour), parseInt(currentHoverCell.dataset.hour));
    const maxHour = Math.max(parseInt(draggedStartCell.dataset.hour), parseInt(currentHoverCell.dataset.hour));
    const minBlock = Math.min(parseInt(draggedStartCell.dataset.block), parseInt(currentHoverCell.dataset.block));
    const maxBlock = Math.max(parseInt(draggedStartCell.dataset.block), parseInt(currentHoverCell.dataset.block));

    const newColorFromPicker = getSelectedColorCallback();

    for (let h = minHour; h <= maxHour; h++) {
        for (let b = minBlock; b <= maxBlock; b++) {
            const cellKey = `${h}-${b}`;
            const cellElement = document.querySelector(`#${actualDomId} .grid-cell[data-hour="${h}"][data-block="${b}"]`);
            if (cellElement) {
                const colorBeforeDragStarted = startColorsMap.get(cellKey); // Color from mousedown state
                const currentText = dataStore[cellKey]?.text || '';
                
                // For goal timeline, previousColorForInteractionStart is not used for triangle, so pass null or undefined
                const effectivePreviousColor = internalGridKey === 'timeGrid' ? colorBeforeDragStarted : null;

                internalSaveBlock(cellKey, currentText, cellElement, internalGridKey, newColorFromPicker, effectivePreviousColor);
            }
        }
    }
}

export function initTimelines(timeGridDomId, goalGridDomId, callbacks) {
    console.log("[TIMELINES] initTimelines CALLED. TimeGrid DOM ID:", timeGridDomId, "GoalGrid DOM ID:", goalGridDomId);
    timeGridActualDomId = timeGridDomId;
    goalGridActualDomId = goalGridDomId;

    if (callbacks) {
        getSelectedColorCallback = callbacks.getSelectedColor || getSelectedColorCallback;
        isDarkColorCallback = callbacks.isDarkColor || isDarkColorCallback;
        normalizeColorCallback = callbacks.normalizeColor || normalizeColorCallback;
        onTimeGridDataChangeCallback = callbacks.onTimeGridDataChange || onTimeGridDataChangeCallback;
    }

    applyPreviousColorStyle();

    // 1. 그리드 구조와 이벤트 리스너는 여기서 한 번만 생성 및 부착
    buildGridStructure(timeGridActualDomId, 'timeGrid');
    buildGridStructure(goalGridActualDomId, 'goalTimeGrid');

    // 2. 오버레이 컨테이너 설정
    setupTaskOverlayContainer(timeGridActualDomId);
    setupTaskOverlayContainer(goalGridActualDomId);

    // 3. (선택사항) 만약 로컬스토리지 등에서 scheduledTasks를 바로 로드한다면 여기서 렌더링
    // loadScheduledTasks(); // 예시: scheduledTasks 배열을 채우는 함수
    // renderScheduledTasksOnGrid('timeGrid');
    // renderScheduledTasksOnGrid('goalTimeGrid');
    
    // main.js에서 setTimelineBlockDataAndRender 등을 통해 데이터가 설정되면 refreshGridContent가 호출될 것임

    document.addEventListener('mouseup', () => {
        if (isDraggingInternal) {
            // 드래그 종료 시의 로직 (예: onTimeGridDataChangeCallback 호출)
            if (activeGridIdInternal === 'timeGrid' && onTimeGridDataChangeCallback) {
                // onTimeGridDataChangeCallback(); // internalSaveBlock에서 이미 처리될 수 있음
            }
        }
        isDraggingInternal = false;
        dragStartCellInternal = null;
        activeGridIdInternal = null;
    });
}

// 신규: 그리드 DOM 구조 생성 및 이벤트 리스너 부착 (최초 1회 실행)
function buildGridStructure(gridDomId, internalGridKey) {
    console.log(`[TIMELINES] buildGridStructure CALLED for gridDomId: ${gridDomId}, internalGridKey: ${internalGridKey}`);
    const gridElement = document.getElementById(gridDomId);
    if (!gridElement) {
        console.error(`[TIMELINES] CRITICAL: Grid element with ID "${gridDomId}" NOT FOUND during build.`);
        return;
    }
    gridElement.innerHTML = ''; // 여기서만 DOM 초기화

    // 헤더 셀 생성 (기존 initializeGridInternal 로직과 유사)
    gridElement.appendChild(createCell('Hour', 'header-cell'));
    for (let i = 1; i <= 6; i++) {
        gridElement.appendChild(createCell(`${i}0m`, 'header-cell'));
    }

    // 데이터 셀 생성 및 이벤트 리스너 부착
    for (let hour = 0; hour < 24; hour++) {
        const displayHour = (hour + 6) % 24;
        gridElement.appendChild(createCell(`${String(displayHour).padStart(2, '0')}:00`, 'time-cell'));

        for (let block = 0; block < 6; block++) {
            const cell = createCell('', 'grid-cell'); // 내용은 refreshGridContent에서 채움
            cell.dataset.hour = String(hour); // 문자열로 저장 권장
            cell.dataset.block = String(block); // 문자열로 저장 권장

            console.log(`[TIMELINES] Attaching listeners to cell H:${hour} B:${block} for ${internalGridKey}`); // 리스너 부착 직전 로그

            // -- logging -- 
            cell.addEventListener('mouseover', (e) => {
                console.log(`[TIMELINES] MOUSEOVER on ${internalGridKey} cell H:${hour} B:${block}`);
            });
            
            cell.addEventListener('click', (e) => {
                console.log(`[TIMELINES] CLICK on ${internalGridKey} cell H:${hour} B:${block}`);
            });



            // --- 모든 셀 이벤트 리스너는 여기서 한 번만 부착 ---
            // 1. 페인팅(색상 변경) 관련 리스너
            cell.addEventListener('mousedown', (e) => {
                isDraggingInternal = false; // 클릭 시작 시 드래그 아님
                dragStartCellInternal = cell;
                activeGridIdInternal = internalGridKey;
                storeCurrentColorsForGrid(internalGridKey); // 드래그 시작 전 색상 저장
            });
            cell.addEventListener('mousemove', (e) => {
                if (e.buttons === 1 && dragStartCellInternal && activeGridIdInternal === internalGridKey) {
                    if (cell !== dragStartCellInternal && !isDraggingInternal) {
                        isDraggingInternal = true; // 실제 드래그 시작됨
                    }
                    if (isDraggingInternal) {
                        handleDragPaintInternal(dragStartCellInternal, cell, internalGridKey);
                    }
                }
            });
            cell.addEventListener('mouseup', (e) => {
                if (activeGridIdInternal === internalGridKey) {
                    if (!isDraggingInternal) { // 단순 클릭이었으면
                        handleCellClickInternal(e, internalGridKey);
                    } else { // 드래그 페인팅이었으면
                        if (internalGridKey === 'timeGrid') {
                            // onTimeGridDataChangeCallback(); // internalSaveBlock에서 이미 호출됨
                        }
                    }
                }
                // isDraggingInternal, dragStartCellInternal 등은 document mouseup에서 초기화
            });

            // 2. Todo 드롭 관련 리스너
            // cell.addEventListener('dragover', (e) => {
            //     e.preventDefault(); // <<<< 항상 호출하도록 변경!
            
            //     const types = e.dataTransfer.types;
            //     console.log(`[TIMELINES] DRAGOVER on ${internalGridKey} cell H:${hour} B:${block}. Types:`, types); // 로그는 유지해도 좋음
            
            //     if (types && types.includes('application/json')) {
            //         e.dataTransfer.dropEffect = 'copy'; // 허용되는 드롭 효과
            //         cell.classList.add('timeline-drop-target-hover');
            //     } else {
            //         e.dataTransfer.dropEffect = 'none'; // 허용되지 않는 드롭 효과
            //         cell.classList.remove('timeline-drop-target-hover'); // 유효하지 않으면 하이라이트 제거
            //     }
            // });

            cell.addEventListener('dragenter', (e) => { // dragenter도 추가하여 테스트
                console.log(`[TIMELINES] DRAGENTER on ${internalGridKey} cell H:${hour} B:${block}`);
                // dragenter에서도 preventDefault와 dropEffect를 설정해주는 것이 좋습니다.
                e.preventDefault();
                const types = e.dataTransfer.types;
                if (types && types.includes('application/json')) {
                    e.dataTransfer.dropEffect = 'copy';
                } else {
                    e.dataTransfer.dropEffect = 'none';
                }
            });

            cell.addEventListener('dragover', (e) => {
                console.log(`[TIMELINES] DRAGOVER event on ${internalGridKey} cell H:${hour} B:${block}`); // 핸들러 진입 확인 최우선 로그
                e.preventDefault(); // <<<< 무조건 호출하여 브라우저 기본 동작을 막고, 이 요소를 드롭 대상으로 만듭니다.
            
                const types = e.dataTransfer.types;
                // console.log(`[TIMELINES] DRAGOVER on ${internalGridKey} cell H:${hour} B:${block}. Types:`, types); // 로그 확인용
            
                if (types && types.includes('application/json')) {
                    e.dataTransfer.dropEffect = 'copy'; // 'copy' 작업 허용
                    cell.classList.add('timeline-drop-target-hover');
                } else {
                    e.dataTransfer.dropEffect = 'none'; // 다른 데이터 타입이면 드롭 비허용
                    cell.classList.remove('timeline-drop-target-hover');
                }
            });
            

            cell.addEventListener('dragleave', (e) => {
                cell.classList.remove('timeline-drop-target-hover');
            });

            cell.addEventListener('drop', (e) => {
                // alert(`[TIMELINES] DROP! Cell H:${hour}, B:${block} for ${internalGridKey}`); // <<<< 실행 여부 확인용 alert
                console.log(`[TIMELINES] DROP event fired on ${internalGridKey} cell H:${hour} B:${block}. Event object:`, e);
                e.preventDefault(); // 여기서도 호출하는 것이 안전합니다.
                cell.classList.remove('timeline-drop-target-hover');
            
                const jsonData = e.dataTransfer.getData('application/json');
                console.log('[TIMELINES] Raw jsonData from drop:', jsonData);
            
                if (jsonData) {
                    try {
                        const droppedData = JSON.parse(jsonData);
                        console.log('[TIMELINES] Parsed droppedData:', droppedData);
                        if (droppedData && droppedData.type === 'todo-item-for-timeline') {
                            console.log('[TIMELINES] Correct data type. Calling addScheduledTaskToTimeline...');
                            addScheduledTaskToTimeline(droppedData, hour, block, internalGridKey); // hour, block 변수가 클로저로 접근 가능해야 함
                        } else {
                            console.warn('[TIMELINES] Incorrect data type or data missing type:', droppedData);
                        }
                    } catch (err) {
                        console.error("[TIMELINES] Error parsing dropped data:", err, jsonData);
                    }
                } else {
                    console.warn('[TIMELINES] No jsonData found in dataTransfer.');
                }
            });

            gridElement.appendChild(cell);
        }
    }
    // 초기 데이터로 셀 내용 채우기 (선택사항: 또는 set...DataAndRender 함수가 refresh를 호출하도록 함)
    refreshGridContent(gridDomId, internalGridKey);
    console.log(`[TIMELINES] Finished buildGridStructure for grid: ${gridDomId}`);
}

// 신규: 이미 생성된 그리드 셀들의 내용(색상, 텍스트 등)만 업데이트
function refreshGridContent(gridDomId, internalGridKey) {
    console.log(`[TIMELINES] refreshGridContent CALLED for gridDomId: ${gridDomId}, internalGridKey: ${internalGridKey}`);
    const gridElement = document.getElementById(gridDomId);
    if (!gridElement) {
        console.error(`[TIMELINES] Grid element with ID "${gridDomId}" NOT FOUND during refresh.`);
        return;
    }
    const dataStore = internalGridKey === 'timeGrid' ? blockData : goalBlockData;

    for (let hour = 0; hour < 24; hour++) {
        for (let block = 0; block < 6; block++) {
            const cell = gridElement.querySelector(`.grid-cell[data-hour="${hour}"][data-block="${block}"]`);
            if (!cell) {
                // console.warn(`Cell H:${hour} B:${block} not found during refresh for ${gridDomId}`);
                continue;
            }

            const blockKey = `${hour}-${block}`;
            // 데이터가 없으면 기본값으로 초기화 (중요: dataStore가 비어있을 수 있음)
            if (!dataStore[blockKey]) {
                dataStore[blockKey] = { text: '', color: 'rgb(255,255,255)', previousColor: (internalGridKey === 'timeGrid' ? null : undefined) };
            }
            const cellData = dataStore[blockKey];

            cell.style.backgroundColor = cellData.color;
            cell.textContent = cellData.text; // 예약된 작업 텍스트는 오버레이로 표시되므로, 셀 자체 텍스트는 기존 방식 유지
            cell.style.color = isDarkColorCallback(cellData.color) ? 'white' : 'black';

            // 이전 색상 표시 로직 (Current Timeline 전용)
            if (internalGridKey === 'timeGrid' && cellData.previousColor &&
                normalizeColorCallback(cellData.previousColor) !== normalizeColorCallback(cellData.color)) {
                cell.classList.add('color-changed');
                cell.style.setProperty('--previous-color', cellData.previousColor);
            } else {
                cell.classList.remove('color-changed');
                cell.style.removeProperty('--previous-color');
            }
        }
    }
    // 셀 내용 새로고침 후, 예약된 작업 오버레이도 다시 그림
    renderScheduledTasksOnGrid(internalGridKey);
    console.log(`[TIMELINES] Finished refreshGridContent for grid: ${gridDomId}`);
}


// --- 추가: 오버레이 컨테이너 설정 함수 ---
function setupTaskOverlayContainer(gridDomId) {
    const gridElement = document.getElementById(gridDomId);
    if (gridElement && !gridElement.querySelector('.task-overlay-container')) {
        const overlayContainer = document.createElement('div');
        overlayContainer.className = 'task-overlay-container';
        gridElement.style.position = 'relative'; // 오버레이 컨테이너의 기준점
        gridElement.appendChild(overlayContainer);
    }
}

function initializeGridInternal(gridDomId, internalGridKey) {
    console.log(`[TIMELINES] initializeGridInternal CALLED for gridDomId: ${gridDomId}, internalGridKey: ${internalGridKey}`); // 로그 추가
    const gridElement = document.getElementById(gridDomId);
    if (!gridElement) {
        console.error(`[TIMELINES] CRITICAL: Grid element with ID "${gridDomId}" NOT FOUND.`);
        return;
    }
    const dataStore = internalGridKey === 'timeGrid' ? blockData : goalBlockData;

    gridElement.innerHTML = ''; 

    gridElement.appendChild(createCell('Hour', 'header-cell'));
    for (let i = 1; i <= 6; i++) {
        gridElement.appendChild(createCell(`${i}0m`, 'header-cell'));
    }

    for (let hour = 0; hour < 24; hour++) {
        const displayHour = (hour + 6) % 24;
        gridElement.appendChild(createCell(`${String(displayHour).padStart(2, '0')}:00`, 'time-cell'));

        for (let block = 0; block < 6; block++) {
            const cell = createCell('', 'grid-cell');
            cell.dataset.hour = hour;
            cell.dataset.block = block;
            
            // ***** blockKey 선언이 이 위치에 있어야 합니다 *****
            const blockKey = `${hour}-${block}`; 

            // 이제 blockKey가 정의되었으므로 아래 라인에서 에러가 발생하지 않아야 합니다.
            if (!dataStore[blockKey]) {
                if (internalGridKey === 'timeGrid') {
                    dataStore[blockKey] = { text: '', color: 'rgb(255,255,255)', previousColor: null };
                } else { // goalTimeGrid
                    dataStore[blockKey] = { text: '', color: 'rgb(255,255,255)' }; // No previousColor
                }
            }
            const cellData = dataStore[blockKey];
            
            cell.style.backgroundColor = cellData.color;
            cell.textContent = cellData.text;
            cell.style.color = isDarkColorCallback(cellData.color) ? 'white' : 'black';

            if (internalGridKey === 'timeGrid' && cellData.previousColor && 
                normalizeColorCallback(cellData.previousColor) !== normalizeColorCallback(cellData.color)) {
                cell.classList.add('color-changed');
                cell.style.setProperty('--previous-color', cellData.previousColor);
            } else { // Goal timeline or no change on current timeline
                cell.classList.remove('color-changed');
                cell.style.removeProperty('--previous-color');
            }

            cell.addEventListener('mousedown', (e) => {
                isDraggingInternal = false; 
                dragStartCellInternal = cell; 
                activeGridIdInternal = internalGridKey; 
                storeCurrentColorsForGrid(internalGridKey); 
                // selectedCellsInternal.clear(); // 드래그 로직에서 selectedCellsInternal을 적극적으로 사용하지 않으므로 필수 아님
                // selectedCellsInternal.add(blockKey); // 필요시 추가
            });

            cell.addEventListener('mousemove', (e) => {
                if (e.buttons === 1 && dragStartCellInternal && activeGridIdInternal === internalGridKey) {
                    if (cell !== dragStartCellInternal && !isDraggingInternal) { 
                        isDraggingInternal = true;
                    }
                    if (isDraggingInternal) {
                        handleDragPaintInternal(dragStartCellInternal, cell, internalGridKey);
                    }
                }
            });

            cell.addEventListener('mouseup', (e) => {
                if (activeGridIdInternal === internalGridKey) { 
                    if (!isDraggingInternal) { 
                        handleCellClickInternal(e, internalGridKey); 
                    } else {
                        if (internalGridKey === 'timeGrid') {
                            // onTimeGridDataChangeCallback(); // 필요시, 하지만 internalSaveBlock 에서 이미 호출될 수 있음
                        }
                    }
                }
            });

            cell.addEventListener('dragover', (e) => {
                e.preventDefault(); // 드롭을 허용하기 위해 필수
                const jsonData = e.dataTransfer.types.find(type => type === 'application/json');
                if (jsonData) { // todo.js에서 설정한 타입이 있는지 확인 (더 구체적으로 data.type 체크는 drop에서)
                    e.dataTransfer.dropEffect = 'copy';
                    cell.classList.add('timeline-drop-target-hover'); // 드롭 대상 시각적 피드백
                }
            });

            cell.addEventListener('dragleave', (e) => {
                cell.classList.remove('timeline-drop-target-hover');
            }); 

            cell.addEventListener('drop', (e) => {
                console.log(`[TIMELINES] DROP event on <span class="math-inline">\{internalGridKey\} cell H\:</span>{cell.dataset.hour}, B:${cell.dataset.block}`); // << 가장 먼저 실행되어야 할 로그
        
                e.preventDefault();
                cell.classList.remove('timeline-drop-target-hover');
                const jsonData = e.dataTransfer.getData('application/json');

                console.log('[TIMELINES] Raw jsonData from drop:', jsonData);
    
                if (jsonData) {
                    try {
                        const droppedData = JSON.parse(jsonData);
                        console.log('[TIMELINES] Parsed droppedData:', droppedData);
                        if (droppedData && droppedData.type === 'todo-item-for-timeline') {
                            console.log('[TIMELINES] Correct data type. Calling addScheduledTaskToTimeline...');
                            addScheduledTaskToTimeline(droppedData, cell.dataset.hour, cell.dataset.block, internalGridKey);
                        } else {
                            console.warn('[TIMELINES] Incorrect data type or data missing type:', droppedData);
                        }
                    } catch (err) {
                        console.error("[TIMELINES] Error parsing dropped data:", err, jsonData);
                    }
                } else {
                    console.warn('[TIMELINES] No jsonData found in dataTransfer.');
                }
            });

            gridElement.appendChild(cell);
        }
    }
}

export function getTimelineBlockData() { return JSON.parse(JSON.stringify(blockData)); } // Deep copy
export function getTimelineGoalData() {
    // Ensure goal data doesn't have previousColor (it shouldn't due to internalSaveBlock)
    const cleanGoalData = {};
    for (const key in goalBlockData) {
        cleanGoalData[key] = {
            text: goalBlockData[key].text,
            color: goalBlockData[key].color
        };
    }
    return JSON.parse(JSON.stringify(cleanGoalData)); // Deep copy
}

// 데이터 설정 함수들은 이제 refreshGridContent를 호출
export function setTimelineBlockDataAndRender(newData, domIdToRender) {
    blockData = newData || {};
    refreshGridContent(domIdToRender, 'timeGrid'); // 전체 구조 재설정 대신 내용만 새로고침
    if(onTimeGridDataChangeCallback) onTimeGridDataChangeCallback();
}

export function setTimelineGoalDataAndRender(newGoalData, domIdToRender) {
    goalBlockData = {}; // Clear first
    if (newGoalData) {
        for (const key in newGoalData) { // previousColor 제거 (Goal 그리드용)
            goalBlockData[key] = {
                text: newGoalData[key].text,
                color: newGoalData[key].color
            };
        }
    }
    refreshGridContent(domIdToRender, 'goalTimeGrid'); // 전체 구조 재설정 대신 내용만 새로고침
}


export function applySelectedColorToCurrentlyEditingCell() {
    if (currentlyEditingCellInternal && activeGridIdInternal) {
        const selectedColor = getSelectedColorCallback();
        const blockKey = `${currentlyEditingCellInternal.dataset.hour}-${currentlyEditingCellInternal.dataset.block}`;
        const dataStore = activeGridIdInternal === 'timeGrid' ? blockData : goalBlockData;
        const colorStoreMap = activeGridIdInternal === 'timeGrid' ? timeGridStartColors : goalGridStartColors;

        const colorBeforeInteraction = colorStoreMap.get(blockKey) || currentlyEditingCellInternal.style.backgroundColor;
        const currentText = dataStore[blockKey]?.text || '';

        internalSaveBlock(blockKey, currentText, currentlyEditingCellInternal, activeGridIdInternal, selectedColor, colorBeforeInteraction);

        // Update modal appearance if open
        const modalContent = document.querySelector('.modal-content'); // Assumes only one modal
        const textarea = document.querySelector('.editing-textarea');
        if (modalContent && textarea) {
            modalContent.style.backgroundColor = selectedColor;
            textarea.style.color = isDarkColorCallback(selectedColor) ? 'white' : 'black';
        }
    }
}

// Called from main when modal is closed by means other than save (e.g., Esc, Cancel)
export function clearCurrentlyEditingCellFlag() {
    currentlyEditingCellInternal = null;
}

// Helper: Function to reset previousColor markers after summary/saving
export function clearAllPreviousColorMarkers(internalGridKeyToClear // 'timeGrid' or 'goalTimeGrid' or 'all'
) {
    if (internalGridKeyToClear === 'timeGrid' || internalGridKeyToClear === 'all') {
        Object.keys(blockData).forEach(key => {
            if (blockData[key]) {
                blockData[key].previousColor = null;
            }
        });
        if (timeGridActualDomId) {
            const gridElement = document.getElementById(timeGridActualDomId);
            if (gridElement) {
                gridElement.querySelectorAll('.grid-cell.color-changed').forEach(cell => {
                    cell.classList.remove('color-changed');
                    cell.style.removeProperty('--previous-color');
                });
            }
        }
    }
}

// timelines.js 내 addScheduledTaskToTimeline 함수 수정
function addScheduledTaskToTimeline(todoData, startHourStr, startBlockStr, gridKey) {
    console.log("[TIMELINES] addScheduledTaskToTimeline CALLED. Data:", todoData, "StartH:", startHourStr, "StartB:", startBlockStr, "Grid:", gridKey);

    const durationMinutes = parseInt(todoData.time) || 0;
    if (durationMinutes <= 0) {
        console.warn("[Timeline Drop] Invalid or zero duration, task not added:", durationMinutes);
        return;
    }

    const numBlocks = Math.ceil(durationMinutes / MINUTES_PER_BLOCK);
    const startHour = parseInt(startHourStr);
    const startBlock = parseInt(startBlockStr);

    const newTask = {
        id: generateId('sch_'), // <<<< 이제 이 부분에서 오류가 발생하지 않아야 합니다.
        originalTodoId: todoData.id,
        text: todoData.text,
        startHour: startHour,
        startBlock: startBlock,
        numBlocks: numBlocks,
        durationMinutes: durationMinutes,
        gridKey: gridKey,
    };
    console.log("[Timeline Drop] New scheduled task object created:", newTask);

    scheduledTasks.push(newTask);
    console.log("[Timeline Drop] scheduledTasks array after push:", JSON.parse(JSON.stringify(scheduledTasks)));

    renderScheduledTasksOnGrid(gridKey);
    if (onTimeGridDataChangeCallback) { // 데이터 변경 알림
        onTimeGridDataChangeCallback();
    }
    // saveScheduledTasks(); // 필요 시 주석 해제
}

// timelines.js 내 renderScheduledTasksOnGrid 함수 수정
function renderScheduledTasksOnGrid(gridKey) {
    const actualDomId = gridKey === 'timeGrid' ? timeGridActualDomId : goalGridActualDomId;
    const gridElement = document.getElementById(actualDomId);

    console.log(`[Render Tasks] Called for gridKey: ${gridKey}, actualDomId: ${actualDomId}`); // 로그 추가

    if (!gridElement) {
        console.error(`[Render Tasks] Grid element not found for ID: ${actualDomId}`);
        return;
    }

    let overlayContainer = gridElement.querySelector('.task-overlay-container');
    if (!overlayContainer) {
        console.warn(`[Render Tasks] Overlay container not found for ${actualDomId}, attempting to re-setup.`);
        setupTaskOverlayContainer(actualDomId); // setup 함수가 DOM ID를 받도록 수정되었다면 이렇게 호출
        overlayContainer = gridElement.querySelector('.task-overlay-container');
    }

    if (!overlayContainer) {
        console.error(`[Render Tasks] CRITICAL: Overlay container still not found for ${actualDomId} after setup attempt.`);
        return;
    }
    console.log("[Render Tasks] Overlay container found:", overlayContainer); // 로그 추가

    overlayContainer.innerHTML = ''; // Clear previous overlays

    const tasksForThisGrid = scheduledTasks.filter(task => task.gridKey === gridKey);
    console.log(`[Render Tasks] Tasks for grid ${gridKey}:`, JSON.parse(JSON.stringify(tasksForThisGrid))); // 로그 추가

    if (tasksForThisGrid.length === 0) {
        console.log(`[Render Tasks] No tasks to render for grid ${gridKey}.`);
        return;
    }

    const sampleCell = gridElement.querySelector(`.grid-cell[data-hour="0"][data-block="0"]`);
    if (!sampleCell) {
        console.error("[Render Tasks] Sample cell not found to determine dimensions.");
        return;
    }
    const cellWidth = sampleCell.offsetWidth;
    const cellHeight = sampleCell.offsetHeight;

    if (cellWidth === 0 || cellHeight === 0) {
        console.warn("[Render Tasks] Sample cell dimensions are zero. Grid might not be fully rendered or visible.", `Width: ${cellWidth}, Height: ${cellHeight}`);
        // 이 경우, 렌더링을 잠시 지연시키거나, 사용자에게 알리는 등의 처리가 필요할 수 있습니다.
        // 또는 display:none 상태에서 offsetWidth/Height가 0이 될 수 있습니다.
    }
    console.log(`[Render Tasks] Sample cell dimensions: Width=${cellWidth}, Height=${cellHeight}`);


    tasksForThisGrid.forEach(task => {
        console.log("[Render Tasks] Processing task:", task.text, task.id);
        let currentHour = task.startHour;
        let currentBlockInHour = task.startBlock;
        let blocksProcessed = 0;
        const totalBlocksToProcess = task.numBlocks;

        while (blocksProcessed < totalBlocksToProcess && currentHour < 24) {
            const blocksInCurrentRow = Math.min(6 - currentBlockInHour, totalBlocksToProcess - blocksProcessed);
            const firstCellInSegment = gridElement.querySelector(`.grid-cell[data-hour="${currentHour}"][data-block="${currentBlockInHour}"]`);

            if (!firstCellInSegment) {
                console.error(`[Render Tasks] First cell in segment not found for task ${task.id} at H:${currentHour} B:${currentBlockInHour}`);
                currentHour++; // 다음 시간으로 넘어가서 계속 시도 (또는 오류 처리)
                currentBlockInHour = 0;
                if(currentHour >= 24 && blocksProcessed < totalBlocksToProcess) {
                     console.warn("[Render Tasks] Task duration exceeds available timeline space after cell not found.", task);
                }
                continue;
            }
            
            if (blocksInCurrentRow <= 0) { // 현재 줄에 그릴 블록이 없으면 (이론상 루프 조건에서 걸러져야 함)
                 console.warn("[Render Tasks] blocksInCurrentRow is zero or negative.", task, blocksInCurrentRow);
                 break; // 현재 task 처리를 중단하거나 다음 줄로 넘김
            }


            const segmentOverlay = document.createElement('div');
            segmentOverlay.className = 'scheduled-task-segment-overlay';
            segmentOverlay.style.position = 'absolute';
            segmentOverlay.style.top = `${firstCellInSegment.offsetTop}px`;
            segmentOverlay.style.left = `${firstCellInSegment.offsetLeft}px`;
            
            // offsetWidth/Height 가 0이 되는 경우를 대비해 최소 크기 보장
            const calculatedWidth = blocksInCurrentRow * (cellWidth > 0 ? cellWidth : 15); // 최소 15px 너비 가정
            const calculatedHeight = cellHeight > 0 ? cellHeight : 20; // 최소 20px 높이 가정

            segmentOverlay.style.width = `${calculatedWidth}px`;
            segmentOverlay.style.height = `${calculatedHeight}px`;
            segmentOverlay.style.borderColor = task.color || DEFAULT_SCHEDULED_TASK_BORDER_COLOR;

            console.log(`[Render Tasks] Creating overlay for task ${task.id} (segment):`, 
                { top: segmentOverlay.style.top, left: segmentOverlay.style.left, width: segmentOverlay.style.width, height: segmentOverlay.style.height });


            const textElement = document.createElement('span');
            textElement.className = 'scheduled-task-text';
            textElement.textContent = task.text;
            segmentOverlay.appendChild(textElement);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'scheduled-task-delete-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = 'Remove this task from timeline';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                scheduledTasks = scheduledTasks.filter(st => st.id !== task.id);
                renderScheduledTasksOnGrid(gridKey);
                // saveScheduledTasks(); // 필요 시 주석 해제
                if (onTimeGridDataChangeCallback) { 
                    onTimeGridDataChangeCallback();
                }
            });
            segmentOverlay.appendChild(deleteBtn);

            overlayContainer.appendChild(segmentOverlay);
            console.log(`[Render Tasks] Appended overlay for task ${task.id} to container.`);


            blocksProcessed += blocksInCurrentRow;
            currentBlockInHour += blocksInCurrentRow;

            if (currentBlockInHour >= 6) {
                currentBlockInHour = 0;
                currentHour++;
            }
             if (currentHour >= 24 && blocksProcessed < totalBlocksToProcess) {
                console.warn("[Render Tasks] Task duration ran out of timeline hours.", task);
                break; // 더 이상 그릴 시간이 없음
            }
        }
    });
}

// (선택 사항) 예약된 작업 저장/로드 함수
function saveScheduledTasks() {
    // localStorage.setItem('timelineScheduledTasks', JSON.stringify(scheduledTasks));
    // 이 부분은 전체 앱 데이터 저장 로직에 통합하는 것이 더 좋을 수 있습니다.
    // (예: main.js의 getTimelineDataForSave, loadTimelineFromFile 등)
    // 지금은 onTimeGridDataChangeCallback()을 호출하여 변경 알림만.
    if (onTimeGridDataChangeCallback) onTimeGridDataChangeCallback();
}

function loadScheduledTasks() {
    // const stored = localStorage.getItem('timelineScheduledTasks');
    // if (stored) {
    // try { scheduledTasks = JSON.parse(stored); } catch (e) { scheduledTasks = [];}
    // }
    // 이 역시 전체 앱 데이터 로드 로직에 통합.
}

// getTimelineBlockData, getTimelineGoalData 등 데이터 내보내는 함수에 scheduledTasks도 포함할지 고려
// 또는 별도의 getScheduledTasksData 함수 제공
export function getScheduledTasksData() {
    return JSON.parse(JSON.stringify(scheduledTasks));
}
// setTimelineBlockDataAndRender 등 데이터 설정 함수에 scheduledTasks 설정 및 렌더링 로직 추가
export function setScheduledTasksDataAndRender(newDataArray, gridKeysToRender = ['timeGrid', 'goalTimeGrid']) {
    if (Array.isArray(newDataArray)) {
        scheduledTasks = newDataArray.map(task => ({ // 데이터 정합성 확보
            id: task.id || generateId('sch_'),
            originalTodoId: task.originalTodoId,
            text: task.text,
            startHour: parseInt(task.startHour),
            startBlock: parseInt(task.startBlock),
            numBlocks: parseInt(task.numBlocks),
            durationMinutes: parseInt(task.durationMinutes),
            gridKey: task.gridKey,
            // color: task.color, // 색상 정보도 저장했다면 포함
        }));
    } else {
        scheduledTasks = []; // 유효하지 않은 데이터면 빈 배열로 초기화
    }

    // 지정된 그리드 또는 모든 관련 그리드에 렌더링
    const validGridKeys = [];
    if (gridKeysToRender.includes('timeGrid') && document.getElementById(timeGridActualDomId)) {
        validGridKeys.push('timeGrid');
    }
    if (gridKeysToRender.includes('goalTimeGrid') && document.getElementById(goalGridActualDomId)) {
        validGridKeys.push('goalTimeGrid');
    }
    
    validGridKeys.forEach(key => renderScheduledTasksOnGrid(key));

    // 데이터가 설정된 후 변경 콜백을 호출할지 여부는 선택사항입니다.
    // 로드 시에는 보통 다른 후속 작업(summary 업데이트 등)이 onTimeGridDataChangeCallback에 연결되어 있다면 호출하는 것이 좋습니다.
    if (onTimeGridDataChangeCallback) {
        // onTimeGridDataChangeCallback(); // 필요에 따라 주석 해제
    }
}

function generateId(prefix = 'tl_') { // prefix를 'tl_' (timeline) 또는 'sch_' (schedule) 등으로 구분해도 좋습니다.
    return prefix + Math.random().toString(36).substr(2, 9);
}

