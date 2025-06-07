// timelines.js

// --- Module-Scoped Variables ---
let blockData = {};
let goalBlockData = {};
let scheduledTasks = [];

let timeGridActualDomId = '';
let goalGridActualDomId = '';
let timeGridStartColors = new Map();
let goalGridStartColors = new Map();

let activeGridIdInternal = null;
let isDraggingInternal = false;
let dragStartCellInternal = null;
let currentlyEditingCellInternal = null;

let isResizingTask = false;
let resizingTaskInfo = {
    taskId: null,
    handle: null, // 'left' or 'right'
    initialX: 0,
    initialStartCellIndex: 0,
    initialNumBlocks: 0,
    lastProcessedCellIndex: -1 
};

const MINUTES_PER_BLOCK = 10; // 각 블록당 분 (기존에도 있었음)
const BLOCKS_PER_HOUR = 60 / MINUTES_PER_BLOCK; // 시간당 블록 수
const ACTUAL_DAY_STARTS_AT_HOUR = 6; 

const DEFAULT_SCHEDULED_TASK_BORDER_COLOR = '#4A90E2';

// --- 기본값 정의 ---
const DEFAULT_TIME_BLOCK_COLOR = 'rgb(255,255,255)';
const DEFAULT_GOAL_BLOCK_COLOR = 'rgb(255,255,255)';
const DEFAULT_BLOCK_TEXT = "";
// const DEFAULT_PREVIOUS_COLOR = null;

// --- Callbacks & Refs ---
let getSelectedColorCallback = () => 'rgb(255,255,255)';
let isDarkColorCallback = () => false;
let normalizeColorCallback = color => color;
let onTimeGridDataChangeCallback = () => {};

// --- Core Timeline Functions ---
function createCell(text, className) {
    const cell = document.createElement('div');
    cell.className = className;
    cell.textContent = text;
    if (className === 'dv-grid-cell') {
        cell.style.backgroundColor = 'rgb(255, 255, 255)';
    }
    return cell;
}

function storeCurrentColorsForGrid(internalGridKey) {
    const dataStore = internalGridKey === 'timeGrid' ? blockData : goalBlockData;
    const colorStoreMap = internalGridKey === 'timeGrid' ? timeGridStartColors : goalGridStartColors;
    colorStoreMap.clear();

    const actualDomId = internalGridKey === 'timeGrid' ? timeGridActualDomId : goalGridActualDomId;
    if (!actualDomId) return;

    // << 수정됨: 쿼리 셀렉터에 dv- 접두사 추가
    document.querySelectorAll(`#${actualDomId} .dv-grid-cell`).forEach(cell => {
        const key = `${cell.dataset.hour}-${cell.dataset.block}`;
        const currentCellData = dataStore[key];
        const colorToStore = currentCellData ? currentCellData.color : 'rgb(255,255,255)';
        colorStoreMap.set(key, colorToStore);
    });
}

function internalSaveBlock(blockKey, text, cellElement, internalGridKey, newColor, previousColorForInteractionStart) {
    const dataStore = internalGridKey === 'timeGrid' ? blockData : goalBlockData;
    const defaultColor = internalGridKey === 'timeGrid' ? DEFAULT_TIME_BLOCK_COLOR : DEFAULT_GOAL_BLOCK_COLOR;

    if (!dataStore[blockKey]) {
        dataStore[blockKey] = {
            text: DEFAULT_BLOCK_TEXT,
            color: defaultColor
        };
        // [주석 처리 1-1] Goal 타임라인과 동일하게 prevColor 필드 생성 로직 비활성화
        // if (internalGridKey === 'timeGrid') {
        //     dataStore[blockKey].previousColor = DEFAULT_PREVIOUS_COLOR;
        // }
    }

    dataStore[blockKey].text = text;
    dataStore[blockKey].color = newColor;

    // ▼▼▼ [주석 처리 1-2] 이전 색상을 저장하고, 관련 클래스 및 CSS 변수를 설정하는 로직 전체 비활성화 ▼▼▼
    // if (internalGridKey === 'timeGrid') {
    //     const normalizedNewColor = normalizeColorCallback(newColor);
    //     const normalizedPrevColor = normalizeColorCallback(previousColorForInteractionStart);

    //     if (previousColorForInteractionStart && normalizedNewColor !== normalizedPrevColor) {
    //         dataStore[blockKey].previousColor = previousColorForInteractionStart;
    //         cellElement.classList.add('color-changed'); // 이 클래스는 접두사 없음
    //         cellElement.style.setProperty('--previous-color', previousColorForInteractionStart);
    //     } else {
    //         dataStore[blockKey].previousColor = DEFAULT_PREVIOUS_COLOR;
    //         cellElement.classList.remove('color-changed');
    //         cellElement.style.removeProperty('--previous-color');
    //     }
    // } else {
    //     delete dataStore[blockKey].previousColor;
    //     cellElement.classList.remove('color-changed');
    //     cellElement.style.removeProperty('--previous-color');
    // }
    
    cellElement.style.backgroundColor = newColor;
    cellElement.textContent = text;
    cellElement.style.color = isDarkColorCallback(newColor) ? 'white' : 'black';

    if (onTimeGridDataChangeCallback) {
        onTimeGridDataChangeCallback();
    }
}


function handleCellClickInternal(event, internalGridKey) {
    // << 수정됨: 쿼리 셀렉터에 dv- 접두사 추가
    const cell = event.target.closest('.dv-grid-cell');
    if (!cell) return;

    activeGridIdInternal = internalGridKey;
    currentlyEditingCellInternal = cell;

    const dataStore = internalGridKey === 'timeGrid' ? blockData : goalBlockData;
    const colorStoreMap = internalGridKey === 'timeGrid' ? timeGridStartColors : goalGridStartColors;
    const blockKey = `${cell.dataset.hour}-${cell.dataset.block}`;
    
    let cellData = dataStore[blockKey];
    if (!cellData) {
        console.warn(`[TIMELINES] Data for ${blockKey} not pre-initialized. Using defaults.`);
        const defaultColor = internalGridKey === 'timeGrid' ? DEFAULT_TIME_BLOCK_COLOR : DEFAULT_GOAL_BLOCK_COLOR;
        cellData = { text: DEFAULT_BLOCK_TEXT, color: defaultColor };
        dataStore[blockKey] = cellData;
   }

    // 모달 생성 (클래스 이름들에 dv- 접두사 추가)
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'dv-modal-overlay';
    const modalContent = document.createElement('div');
    modalContent.className = 'dv-modal-content';
    const textarea = document.createElement('textarea');
    textarea.className = 'dv-editing-textarea';
    textarea.value = cellData.text;

    // modalContent.style.backgroundColor = cellData.color;
    // textarea.style.color = isDarkColorCallback(cellData.color) ? 'white' : 'black';

    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'dv-modal-buttons';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'dv-modal-button dv-save-text-button'; saveBtn.textContent = 'Save';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'dv-modal-button dv-cancel-text-button'; cancelBtn.textContent = 'Cancel';

    const closeModal = () => {
        modalOverlay.remove();
        document.removeEventListener('keydown', handleEscKey);
        currentlyEditingCellInternal = null;
    };
    const handleEscKey = (e) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', handleEscKey);

    saveBtn.addEventListener('click', () => {
        const currentCellColor = cell.style.backgroundColor;
        const originalColorAtInteractionStart = colorStoreMap.get(blockKey) || cellData.color;
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
    
    // if(modalContent) modalContent.style.backgroundColor = selectedColorFromPicker;
    // if(textarea) textarea.style.color = isDarkColorCallback(selectedColorFromPicker) ? 'white' : 'black';
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
            // << 수정됨: 쿼리 셀렉터에 dv- 접두사 추가
            const cellElement = document.querySelector(`#${actualDomId} .dv-grid-cell[data-hour="${h}"][data-block="${b}"]`);
            if (cellElement) {
                const colorBeforeDragStarted = startColorsMap.get(cellKey);
                const currentText = dataStore[cellKey]?.text || '';
                const effectivePreviousColor = internalGridKey === 'timeGrid' ? colorBeforeDragStarted : null;
                internalSaveBlock(cellKey, currentText, cellElement, internalGridKey, newColorFromPicker, effectivePreviousColor);
            }
        }
    }
}

export function initTimelines(timeGridDomId, goalGridDomId, callbacks) {
    timeGridActualDomId = timeGridDomId;
    goalGridActualDomId = goalGridDomId;
    // currentTimeIndicators = {}; // 초기화 시 이전 인디케이터 정보 초기화

    if (callbacks) {
        getSelectedColorCallback = callbacks.getSelectedColor || getSelectedColorCallback;
        isDarkColorCallback = callbacks.isDarkColor || isDarkColorCallback;
        normalizeColorCallback = callbacks.normalizeColor || normalizeColorCallback;
        onTimeGridDataChangeCallback = callbacks.onTimeGridDataChange || onTimeGridDataChangeCallback;
    }

    // applyPreviousColorStyle();
    addPassedTimeAndLineStyle(); // NEW: Add styles for passed time stripes and current time line

    buildGridStructure(timeGridActualDomId, 'timeGrid');
    buildGridStructure(goalGridActualDomId, 'goalTimeGrid');
    
    // 오버레이 컨테이너는 그리드 구조 생성 후, 시간선 표시 전에 설정
    setupTaskOverlayContainer(timeGridActualDomId); 
    setupTaskOverlayContainer(goalGridActualDomId);

    document.addEventListener('mouseup', handleGlobalMouseUp);
    // document.addEventListener('mouseup', () => {
    //     isDraggingInternal = false;
    //     dragStartCellInternal = null;
    //     activeGridIdInternal = null;
    // });
}

function buildGridStructure(gridDomId, internalGridKey) {
    const gridElement = document.getElementById(gridDomId);
    if (!gridElement) {
        console.error(`[TIMELINES] CRITICAL: Grid element with ID "${gridDomId}" NOT FOUND.`);
        return;
    }
    gridElement.innerHTML = '';

    // 헤더 셀 생성 (클래스 이름에 dv- 접두사 적용)
    gridElement.appendChild(createCell('Hour', 'dv-header-cell'));
    for (let i = 1; i <= BLOCKS_PER_HOUR; i++) {
        gridElement.appendChild(createCell(`${i}0m`, 'dv-header-cell'));
    }

    // 데이터 셀 생성 및 이벤트 리스너 부착
    for (let hour = 0; hour < 24; hour++) { // This hour is the grid's internal hour (0 for 06:00, 1 for 07:00, etc.)
        const displayHour = (hour + ACTUAL_DAY_STARTS_AT_HOUR) % 24; // Calculate displayed hour (06, 07 .. 00 .. 05)
        
        const timeCell = createCell(`${String(displayHour).padStart(2, '0')}:00`, 'dv-time-cell');
        timeCell.dataset.hour = String(hour); // Store grid's internal hour
        gridElement.appendChild(timeCell);
        
        for (let block = 0; block < BLOCKS_PER_HOUR; block++) {
            const cell = createCell('', 'dv-grid-cell');
            cell.dataset.hour = String(hour); // Store grid's internal hour
            cell.dataset.block = String(block);
            
            // 페인팅 관련 리스너
            cell.addEventListener('mousedown', (e) => {
                // 리사이즈 핸들을 클릭한 경우, 색칠 시작 로직을 실행하지 않음
                if (e.target.classList.contains('dv-resize-handle')) {
                    return;
                }
                isDraggingInternal = false;
                dragStartCellInternal = cell;
                activeGridIdInternal = internalGridKey;
                storeCurrentColorsForGrid(internalGridKey);
            });

            cell.addEventListener('mousemove', (e) => {
                // 리사이즈 중일 때는 색칠 기능을 완전히 비활성화
                if (isResizingTask) return; 

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
                    }
                }
            });

            // Todo 드롭 관련 리스너
            cell.addEventListener('dragenter', (e) => {
                e.preventDefault();
                const types = e.dataTransfer.types;
                if (types && types.includes('application/json')) {
                    e.dataTransfer.dropEffect = 'copy';
                } else {
                    e.dataTransfer.dropEffect = 'none';
                }
            });
            cell.addEventListener('dragover', (e) => {
                e.preventDefault();
                const types = e.dataTransfer.types;
                if (types && types.includes('application/json')) {
                    e.dataTransfer.dropEffect = 'copy';
                    // << 수정됨: dv- 접두사 추가
                    cell.classList.add('dv-timeline-drop-target-hover');
                } else {
                    e.dataTransfer.dropEffect = 'none';
                    cell.classList.remove('dv-timeline-drop-target-hover');
                }
            });
            cell.addEventListener('dragleave', (e) => {
                // << 수정됨: dv- 접두사 추가
                cell.classList.remove('dv-timeline-drop-target-hover');
            });
            cell.addEventListener('drop', (e) => {
                e.preventDefault();
                // << 수정됨: dv- 접두사 추가
                cell.classList.remove('dv-timeline-drop-target-hover');
                const jsonData = e.dataTransfer.getData('application/json');
                if (jsonData) {
                    try {
                        const droppedData = JSON.parse(jsonData);
                        if (droppedData && droppedData.type === 'todo-item-for-timeline') {
                            addScheduledTaskToTimeline(droppedData, hour, block, internalGridKey);
                        }
                    } catch (err) {
                        console.error("[TIMELINES] Error parsing dropped data:", err, jsonData);
                    }
                }
            });
            gridElement.appendChild(cell);
        }
    }
    refreshGridContent(gridDomId, internalGridKey);
}

function refreshGridContent(gridDomId, internalGridKey) {
    const gridElement = document.getElementById(gridDomId);
    if (!gridElement) return;

    const dataStore = internalGridKey === 'timeGrid' ? blockData : goalBlockData;
    const defaultColor = internalGridKey === 'timeGrid' ? DEFAULT_TIME_BLOCK_COLOR : DEFAULT_GOAL_BLOCK_COLOR;

    for (let hour = 0; hour < 24; hour++) {
        for (let blockIdx = 0; blockIdx < 6; blockIdx++) {
            // << 수정됨: 쿼리 셀렉터에 dv- 접두사 추가
            const cell = gridElement.querySelector(`.dv-grid-cell[data-hour="${hour}"][data-block="${blockIdx}"]`);
            if (!cell) continue;

            const blockKey = `${hour}-${blockIdx}`;
            if (!dataStore[blockKey]) {
                dataStore[blockKey] = {
                    text: DEFAULT_BLOCK_TEXT,
                    color: defaultColor,
                };
                // if (internalGridKey === 'timeGrid') {
                //     dataStore[blockKey].previousColor = DEFAULT_PREVIOUS_COLOR;
                // }
            }
            const cellData = dataStore[blockKey];
            cell.style.backgroundColor = cellData.color;
            cell.textContent = cellData.text;
            cell.style.color = isDarkColorCallback(cellData.color) ? 'white' : 'black';

            // if (internalGridKey === 'timeGrid' && cellData.previousColor &&
            //     normalizeColorCallback(cellData.previousColor) !== normalizeColorCallback(cellData.color)) {
            //     cell.classList.add('color-changed');
            //     cell.style.setProperty('--previous-color', cellData.previousColor);
            // } else {
            //     cell.classList.remove('color-changed');
            //     cell.style.removeProperty('--previous-color');
            // }
        }
    }
    renderScheduledTasksOnGrid(internalGridKey);
}

function setupTaskOverlayContainer(gridDomId) {
    const gridElement = document.getElementById(gridDomId);
    // << 수정됨: 쿼리 셀렉터에 dv- 접두사 추가
    if (gridElement && !gridElement.querySelector('.dv-task-overlay-container')) {
        const overlayContainer = document.createElement('div');
        // << 수정됨: dv- 접두사 추가
        overlayContainer.className = 'dv-task-overlay-container';
        gridElement.style.position = 'relative';
        gridElement.appendChild(overlayContainer);
    }
}

function renderScheduledTasksOnGrid(gridKey) {
    const actualDomId = gridKey === 'timeGrid' ? timeGridActualDomId : goalGridActualDomId;
    const gridElement = document.getElementById(actualDomId);
    if (!gridElement) return;

    let overlayContainer = gridElement.querySelector('.dv-task-overlay-container');
    if (!overlayContainer) {
        setupTaskOverlayContainer(actualDomId);
        overlayContainer = gridElement.querySelector('.dv-task-overlay-container');
    }
    if (!overlayContainer) return;

    overlayContainer.innerHTML = '';
    const tasksForThisGrid = scheduledTasks.filter(task => task.gridKey === gridKey);
    if (tasksForThisGrid.length === 0) return;

    const sampleCell = gridElement.querySelector('.dv-grid-cell');
    if (!sampleCell) return;
    const cellWidth = sampleCell.offsetWidth;
    const cellHeight = sampleCell.offsetHeight;

    tasksForThisGrid.forEach(task => {
        let currentHour = task.startHour;
        let currentBlockInHour = task.startBlock;
        let blocksProcessed = 0;
        const totalBlocksToProcess = task.numBlocks;

        while (blocksProcessed < totalBlocksToProcess && currentHour < 24) {
            const blocksInCurrentRow = Math.min(6 - currentBlockInHour, totalBlocksToProcess - blocksProcessed);
            const firstCellInSegment = gridElement.querySelector(`.dv-grid-cell[data-hour="${currentHour}"][data-block="${currentBlockInHour}"]`);
            if (!firstCellInSegment) {
                currentHour++;
                currentBlockInHour = 0;
                continue;
            }

            const segmentOverlay = document.createElement('div');
            segmentOverlay.className = 'dv-scheduled-task-segment-overlay';
            segmentOverlay.style.position = 'absolute';
            segmentOverlay.style.top = `${firstCellInSegment.offsetTop}px`;
            segmentOverlay.style.left = `${firstCellInSegment.offsetLeft}px`;
            segmentOverlay.style.width = `${blocksInCurrentRow * cellWidth}px`;
            segmentOverlay.style.height = `${cellHeight}px`;
            segmentOverlay.style.borderColor = task.color || DEFAULT_SCHEDULED_TASK_BORDER_COLOR;

            const textElement = document.createElement('span');
            textElement.className = 'dv-scheduled-task-text';
            textElement.textContent = task.text;
            segmentOverlay.appendChild(textElement);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'dv-scheduled-task-delete-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = 'Remove this task from timeline';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                scheduledTasks = scheduledTasks.filter(st => st.id !== task.id);
                renderScheduledTasksOnGrid(gridKey);
                if (onTimeGridDataChangeCallback) {
                    onTimeGridDataChangeCallback();
                }
            });
            segmentOverlay.appendChild(deleteBtn);

            const leftHandle = document.createElement('div');
            leftHandle.className = 'dv-resize-handle dv-resize-handle-left';
            leftHandle.addEventListener('mousedown', (e) => handleResizeStart(e, task.id, 'left'));
            segmentOverlay.appendChild(leftHandle);
            
            const rightHandle = document.createElement('div');
            rightHandle.className = 'dv-resize-handle dv-resize-handle-right';
            rightHandle.addEventListener('mousedown', (e) => handleResizeStart(e, task.id, 'right'));
            segmentOverlay.appendChild(rightHandle);

            overlayContainer.appendChild(segmentOverlay);

            blocksProcessed += blocksInCurrentRow;
            currentBlockInHour += blocksInCurrentRow;
            if (currentBlockInHour >= 6) {
                currentBlockInHour = 0;
                currentHour++;
            }
        }
    });
}

/*******************************8
 * 타임라인 태스크 리사이즈 핸들 이벤트 핸들러
 */
function handleResizeStart(e, taskId, handleType) {
    e.preventDefault();
    e.stopPropagation();

    const task = scheduledTasks.find(t => t.id === taskId);
    if (!task) return;

    isResizingTask = true;
    resizingTaskInfo = {
        taskId: taskId,
        handle: handleType,
        initialX: e.clientX,
        initialStartCellIndex: task.startHour * BLOCKS_PER_HOUR + task.startBlock,
        initialNumBlocks: task.numBlocks,
        lastProcessedCellIndex: -1
    };

    // 마우스가 오버레이를 통과하도록 body에 클래스 추가
    document.body.classList.add('dv-task-resizing'); 
    document.body.style.cursor = 'ew-resize';
}

function handleResizeMove(e) {
    if (!isResizingTask) return;

    const targetCell = e.target.closest('.dv-grid-cell');
    if (!targetCell) return;

    const targetHour = parseInt(targetCell.dataset.hour, 10);
    const targetBlock = parseInt(targetCell.dataset.block, 10);
    const targetCellIndex = targetHour * BLOCKS_PER_HOUR + targetBlock;

    if (targetCellIndex === resizingTaskInfo.lastProcessedCellIndex) {
        return;
    }
    resizingTaskInfo.lastProcessedCellIndex = targetCellIndex;

    const task = scheduledTasks.find(t => t.id === resizingTaskInfo.taskId);
    if (!task) return;

    // --- 디버깅을 위한 로그 ---
    console.clear(); // 콘솔을 깨끗하게 유지
    console.log(`%cResizing Task: ${task.text}`, "color: blue; font-weight: bold;");
    console.log(`Handle: ${resizingTaskInfo.handle}`);
    // -------------------------

    if (resizingTaskInfo.handle === 'right') {
        const startCellIndex = task.startHour * BLOCKS_PER_HOUR + task.startBlock;
        let newNumBlocks;

        // 드래그 위치가 시작점보다 왼쪽에 오면, 블록 크기는 1로 고정
        if (targetCellIndex < startCellIndex) {
            newNumBlocks = 1;
        } else {
            newNumBlocks = targetCellIndex - startCellIndex + 1;
        }
        
        task.numBlocks = newNumBlocks;
        
        console.log(`Start Index: ${startCellIndex}, Target Index: ${targetCellIndex}, New Block Count: ${newNumBlocks}`);


    } else if (resizingTaskInfo.handle === 'left') {
        const endCellIndex = resizingTaskInfo.initialStartCellIndex + resizingTaskInfo.initialNumBlocks - 1;
        
        let newStartCellIndex = targetCellIndex;
        if (newStartCellIndex > endCellIndex) {
            newStartCellIndex = endCellIndex;
        }

        const newNumBlocks = endCellIndex - newStartCellIndex + 1;

        task.startHour = Math.floor(newStartCellIndex / BLOCKS_PER_HOUR);
        task.startBlock = newStartCellIndex % BLOCKS_PER_HOUR;
        task.numBlocks = newNumBlocks;
        
        console.log(`End Index (fixed): ${endCellIndex}, New Start Index: ${newStartCellIndex}, New Block Count: ${newNumBlocks}`);
    }

    renderScheduledTasksOnGrid(task.gridKey);
}

function handleResizeEnd() {
    if (isResizingTask) {
        // body에 추가했던 클래스와 커서 스타일 제거
        document.body.classList.remove('dv-task-resizing');
        document.body.style.cursor = '';
        
        isResizingTask = false;
        resizingTaskInfo = {};
        if (onTimeGridDataChangeCallback) {
            onTimeGridDataChangeCallback();
        }
    }
}

function handleGlobalMouseUp() {
    // 1. 블록 페인팅(색칠) 종료 처리
    if (isDraggingInternal) {
        isDraggingInternal = false;
        dragStartCellInternal = null;
        activeGridIdInternal = null;
    }
    // 2. 스케줄된 태스크 리사이즈 종료 처리
    if (isResizingTask) {
        handleResizeEnd();
    }
}


// --- 외부 인터페이스 및 데이터 관리 함수들 (나머지 코드는 동일하게 유지) ---

// 불필요해진 함수들은 주석 처리하거나 삭제합니다.
// initializeGridInternal 함수는 buildGridStructure 와 refreshGridContent 로 분리되어 더 이상 사용되지 않습니다.

function isBlockDefault(block, isGoalBlock = false) {
    if (!block) return true;
    const normColor = typeof normalizeColorCallback === 'function' ? normalizeColorCallback : (c) => c;
    const defaultColor = isGoalBlock ? DEFAULT_GOAL_BLOCK_COLOR : DEFAULT_TIME_BLOCK_COLOR;
    const textIsDefault = (block.text === DEFAULT_BLOCK_TEXT || typeof block.text === 'undefined');
    const colorIsDefault = (normColor(block.color) === normColor(defaultColor) || typeof block.color === 'undefined');
    if (isGoalBlock) {
        return textIsDefault && colorIsDefault;
    } else {
        // const previousColorIsDefault = (block.previousColor === DEFAULT_PREVIOUS_COLOR || typeof block.previousColor === 'undefined');
        return textIsDefault && colorIsDefault; // && previousColorIsDefault;
    }
}

export function getTimelineBlockData() {
    const filteredBlockData = {};
    for (const key in blockData) {
        if (!isBlockDefault(blockData[key], false)) {
            filteredBlockData[key] = { ...blockData[key] };
        }
    }
    return filteredBlockData;
}

export function getTimelineGoalData() {
    const filteredGoalData = {};
    for (const key in goalBlockData) {
        if (!isBlockDefault(goalBlockData[key], true)) {
            filteredGoalData[key] = { ...goalBlockData[key] };
        }
    }
    return filteredGoalData;
}

export function setTimelineBlockDataAndRender(newData, domIdToRender) {
    blockData = newData || {};
    refreshGridContent(domIdToRender, 'timeGrid');
}

export function setTimelineGoalDataAndRender(newGoalData, domIdToRender) {
    goalBlockData = {};
    if (newGoalData) {
        for (const key in newGoalData) {
            goalBlockData[key] = {
                text: newGoalData[key].text,
                color: newGoalData[key].color
            };
        }
    }
    refreshGridContent(domIdToRender, 'goalTimeGrid');
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

        // << 수정됨: 모달 관련 쿼리 셀렉터에 dv- 접두사 추가
        const modalContent = document.querySelector('.dv-modal-content');
        const textarea = document.querySelector('.dv-editing-textarea');
        if (modalContent && textarea) {
            modalContent.style.backgroundColor = selectedColor;
            textarea.style.color = isDarkColorCallback(selectedColor) ? 'white' : 'black';
        }
    }
}

export function clearCurrentlyEditingCellFlag() {
    currentlyEditingCellInternal = null;
}

// export function clearAllPreviousColorMarkers(internalGridKeyToClear) {
//     if (internalGridKeyToClear === 'timeGrid' || internalGridKeyToClear === 'all') {
//         Object.keys(blockData).forEach(key => {
//             if (blockData[key]) {
//                 blockData[key].previousColor = null;
//             }
//         });
//         if (timeGridActualDomId) {
//             const gridElement = document.getElementById(timeGridActualDomId);
//             if (gridElement) {
//                 // << 수정됨: dv- 접두사 추가
//                 gridElement.querySelectorAll('.dv-grid-cell.color-changed').forEach(cell => {
//                     cell.classList.remove('color-changed');
//                     cell.style.removeProperty('--previous-color');
//                 });
//             }
//         }
//     }
// }

function addScheduledTaskToTimeline(todoData, startHourStr, startBlockStr, gridKey) {
    const durationMinutes = parseInt(todoData.time) || 0;
    if (durationMinutes <= 0) return;

    const numBlocks = Math.ceil(durationMinutes / MINUTES_PER_BLOCK);
    const startHour = parseInt(startHourStr);
    const startBlock = parseInt(startBlockStr);

    const newTask = {
        id: generateId('sch_'),
        originalTodoId: todoData.id,
        text: todoData.text,
        startHour: startHour,
        startBlock: startBlock,
        numBlocks: numBlocks,
        durationMinutes: durationMinutes,
        gridKey: gridKey,
    };
    scheduledTasks.push(newTask);
    renderScheduledTasksOnGrid(gridKey);
    if (onTimeGridDataChangeCallback) {
        onTimeGridDataChangeCallback();
    }
}

export function getScheduledTasksData() {
    return JSON.parse(JSON.stringify(scheduledTasks));
}

export function setScheduledTasksDataAndRender(newDataArray, gridKeysToRender = ['timeGrid', 'goalTimeGrid']) {
    scheduledTasks = (newDataArray || []).map(task => ({
        id: task.id || generateId('sch_'),
        originalTodoId: task.originalTodoId,
        text: task.text || '',
        startHour: parseInt(task.startHour),
        startBlock: parseInt(task.startBlock),
        numBlocks: parseInt(task.numBlocks) || 1,
        durationMinutes: parseInt(task.durationMinutes) || MINUTES_PER_BLOCK,
        gridKey: task.gridKey,
        color: task.color,
    }));
    const validGridKeys = [];
    if (gridKeysToRender.includes('timeGrid') && document.getElementById(timeGridActualDomId)) {
        validGridKeys.push('timeGrid');
    }
    if (gridKeysToRender.includes('goalTimeGrid') && document.getElementById(goalGridActualDomId)) {
        validGridKeys.push('goalTimeGrid');
    }
    validGridKeys.forEach(key => renderScheduledTasksOnGrid(key));
}

function generateId(prefix = 'tl_') {
    return prefix + Math.random().toString(36).substr(2, 9);
}

function addPassedTimeAndLineStyle() {
    const styleId = 'dvTimelinePassedTimeStyle';
    if (document.getElementById(styleId)) return;

    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = `
        .dv-elapsed-time {
            position: relative;
        }
        .dv-elapsed-time::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
            z-index: 2; /* Should be above cell background but below cell content/text if any */
        }
        .dv-elapsed-time.dv-light-bg::after {
            background-image: linear-gradient(45deg, rgba(0,0,0,0.07) 25%, transparent 25%, transparent 50%, rgba(0,0,0,0.07) 50%, rgba(0,0,0,0.07) 75%, transparent 75%);
            background-size: 8px 8px;
        }
        .dv-elapsed-time.dv-dark-bg::after {
            background-image: linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%);
            background-size: 8px 8px;
        }
        .dv-current-time-block {
            position: relative;
        }
        /* Style for the red line will be dynamically injected by updatePassedTimeVisuals */
    `;
    document.head.appendChild(styleElement);
}


// --- Core Timeline Functions ---
// function applyPreviousColorStyle() {
//     const styleId = 'timelinePreviousColorStyle';
//     if (document.getElementById(styleId)) return;
//     const previousColorStyle = `
//         .dv-grid-cell.color-changed { 
//             padding-left: 16px; /* This padding makes space for the triangle */
//             position: relative; 
//         }
//         .dv-grid-cell.color-changed::before { /* This is the prevColor triangle */
//             content: ''; 
//             position: absolute; 
//             top: -1px; 
//             left: -1px;
//             border-style: solid; 
//             border-width: 10px 10px 0 0;
//             border-right-color: transparent; 
//             border-bottom-color: transparent;
//             border-top-color: var(--previous-color); 
//             z-index: 0; /* Lower z-index */
//         }`;
//     const styleSheet = document.createElement("style");
//     styleSheet.id = styleId;
//     styleSheet.textContent = previousColorStyle;
//     document.head.appendChild(styleSheet);
// }


// --- NEW: Function to update passed time visuals (stripes and red line) ---
export function updatePassedTimeVisuals(gridDomIdToUpdate, isTimelineEffectivelyToday, dateOfTimelineString) {
    const gridElement = document.getElementById(gridDomIdToUpdate);
    if (!gridElement) return;

    const allDataCells = gridElement.querySelectorAll('.dv-grid-cell');

    // 먼저 이전 시각 효과들 제거
    allDataCells.forEach(cell => {
        cell.classList.remove('dv-elapsed-time', 'dv-light-bg', 'dv-dark-bg', 'dv-current-time-block');
        const dynamicStyleId = `dynamic-redline-style-${gridDomIdToUpdate}-${cell.dataset.hour}-${cell.dataset.block}`;
        const styleElement = document.getElementById(dynamicStyleId);
        if (styleElement) {
            styleElement.remove();
        }
    });

    // 이 타임라인이 현재 시점에서 유효한 '오늘' 타임라인이 아니면 아무것도 그리지 않음
    if (!isTimelineEffectivelyToday) {
        return;
    }

    const now = new Date();
    let currentHourForGridLogic = now.getHours(); // 실제 현재 시간 (0-23)
    const currentMinute = now.getMinutes();

    // dateOfTimelineString (예: "2025-05-31")과 현재 날짜 비교
    const [tlYear, tlMonth, tlDay] = dateOfTimelineString.split('-').map(Number);
    const timelineDateObject = new Date(tlYear, tlMonth - 1, tlDay); // JS 월은 0부터 시작
    const todayObject = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 핵심 로직:
    // 만약 현재 시간이 새벽(00:00-05:59)이고, 우리가 업데이트하려는 타임라인이 *어제* 날짜라면,
    // currentHourForGridLogic을 24시간 더해서 어제 타임라인의 연속으로 취급한다.
    if (currentHourForGridLogic < ACTUAL_DAY_STARTS_AT_HOUR && timelineDateObject.getTime() < todayObject.getTime()) {
        // 예: 현재 6월 1일 새벽 1시 (currentHourForGridLogic = 1)
        // dateOfTimelineString은 "2025-05-31" (timelineDateObject < todayObject 만족)
        // -> 5월 31일 타임라인에 새벽 1시는 25시로 계산되어야 함
        currentHourForGridLogic += 24; // 1 + 24 = 25
    }

    // 그리드 시간 계산 (06시를 0으로 하는 인덱스, 0~23 범위)
    // 예1: currentHourForGridLogic = 6 (오전 6시) => gridHourIndex = (6 - 6 + 24) % 24 = 0
    // 예2: currentHourForGridLogic = 25 (위에서 조정된 새벽 1시) => gridHourIndex = (25 - 6 + 24) % 24 = 19
    //      (06시가 0, 07시가 1 ... 00시가 18, 01시가 19 ... 05시가 23)
    const gridHourIndex = (currentHourForGridLogic - ACTUAL_DAY_STARTS_AT_HOUR + 24) % 24;
    const gridBlockIndexInHour = Math.floor(currentMinute / MINUTES_PER_BLOCK);

    // 타임라인의 시작(06:00)부터 현재 시간까지 총 몇 개의 10분 블록이 지났는지 계산
    // gridHourIndex 자체가 06시부터 경과된 시간(hour) 수를 의미
    const totalPassedBlocksInGridTimeline = (gridHourIndex * BLOCKS_PER_HOUR) + gridBlockIndexInHour;

    allDataCells.forEach(cell => {
        const cellDataHour = parseInt(cell.dataset.hour, 10); // 셀의 그리드 시간 인덱스 (0은 06시)
        const cellDataBlock = parseInt(cell.dataset.block, 10);
        const cellOverallBlockIndexInGrid = (cellDataHour * BLOCKS_PER_HOUR) + cellDataBlock;

        // 지나간 시간 블록 빗금 처리
        if (cellOverallBlockIndexInGrid < totalPassedBlocksInGridTimeline) {
            cell.classList.add('dv-elapsed-time');
            if (typeof isDarkColorCallback === 'function') { // isDarkColorCallback은 timelines.js 스코프에 있어야 함
                const cellBgColor = cell.style.backgroundColor || window.getComputedStyle(cell).backgroundColor;
                cell.classList.toggle('dv-dark-bg', isDarkColorCallback(cellBgColor));
                cell.classList.toggle('dv-light-bg', !isDarkColorCallback(cellBgColor));
            }
        }
        // 현재 시간 블록에 빨간 줄 표시
        else if (cellDataHour === gridHourIndex && cellDataBlock === gridBlockIndexInHour) {
            cell.classList.add('dv-current-time-block');
            const percentageThroughBlock = (currentMinute % MINUTES_PER_BLOCK) / MINUTES_PER_BLOCK * 100;

            const dynamicStyleId = `dynamic-redline-style-${gridDomIdToUpdate}-${cellDataHour}-${cellDataBlock}`;
            let dynamicStyleElement = document.getElementById(dynamicStyleId);
            if (!dynamicStyleElement) {
                dynamicStyleElement = document.createElement('style');
                dynamicStyleElement.id = dynamicStyleId;
                document.head.appendChild(dynamicStyleElement);
            }
            dynamicStyleElement.innerHTML = `
                #${gridDomIdToUpdate} .dv-grid-cell[data-hour="${cellDataHour}"][data-block="${cellDataBlock}"].dv-current-time-block::before {
                    content: ''; position: absolute; top: 0; bottom: 0;
                    left: ${percentageThroughBlock}%; width: 2px;
                    background-color: red; z-index: 3; pointer-events: none;
                    border: none !important; box-sizing: border-box !important;
                }
            `;
        }
    });
}

document.addEventListener('mousemove', (e) => {
    if (isResizingTask) {
        handleResizeMove(e);
    }
});