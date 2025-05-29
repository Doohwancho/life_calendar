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

const DEFAULT_SCHEDULED_TASK_BORDER_COLOR = '#4A90E2';
const MINUTES_PER_BLOCK = 10;

// --- 기본값 정의 ---
const DEFAULT_TIME_BLOCK_COLOR = 'rgb(255,255,255)';
const DEFAULT_GOAL_BLOCK_COLOR = 'rgb(255,255,255)';
const DEFAULT_BLOCK_TEXT = "";
const DEFAULT_PREVIOUS_COLOR = null;

// --- Callbacks & Refs ---
let getSelectedColorCallback = () => 'rgb(255,255,255)';
let isDarkColorCallback = () => false;
let normalizeColorCallback = color => color;
let onTimeGridDataChangeCallback = () => {};

// --- Core Timeline Functions ---
function applyPreviousColorStyle() {
    const styleId = 'timelinePreviousColorStyle';
    if (document.getElementById(styleId)) return;
    // << 수정됨: 셀렉터에 dv- 접두사 추가 (color-changed는 유지)
    const previousColorStyle = `
        .dv-grid-cell.color-changed { padding-left: 16px; position: relative; }
        .dv-grid-cell.color-changed::before {
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
    cell.className = className; // className은 이미 dv- 접두사가 붙어서 전달됨
    cell.textContent = text;
    // << 수정됨: dv-grid-cell 클래스를 기준으로 기본값 설정
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
        if (internalGridKey === 'timeGrid') {
            dataStore[blockKey].previousColor = DEFAULT_PREVIOUS_COLOR;
        }
    }

    dataStore[blockKey].text = text;
    dataStore[blockKey].color = newColor;

    if (internalGridKey === 'timeGrid') {
        const normalizedNewColor = normalizeColorCallback(newColor);
        const normalizedPrevColor = normalizeColorCallback(previousColorForInteractionStart);

        if (previousColorForInteractionStart && normalizedNewColor !== normalizedPrevColor) {
            dataStore[blockKey].previousColor = previousColorForInteractionStart;
            cellElement.classList.add('color-changed'); // 이 클래스는 접두사 없음
            cellElement.style.setProperty('--previous-color', previousColorForInteractionStart);
        } else {
            dataStore[blockKey].previousColor = DEFAULT_PREVIOUS_COLOR;
            cellElement.classList.remove('color-changed');
            cellElement.style.removeProperty('--previous-color');
        }
    } else {
        delete dataStore[blockKey].previousColor;
        cellElement.classList.remove('color-changed');
        cellElement.style.removeProperty('--previous-color');
    }
    
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
        cellData = { text: DEFAULT_BLOCK_TEXT, color: defaultColor, previousColor: internalGridKey === 'timeGrid' ? DEFAULT_PREVIOUS_COLOR : undefined };
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

    modalContent.style.backgroundColor = cellData.color;
    textarea.style.color = isDarkColorCallback(cellData.color) ? 'white' : 'black';

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

    if (callbacks) {
        getSelectedColorCallback = callbacks.getSelectedColor || getSelectedColorCallback;
        onTimeGridDataChangeCallback = callbacks.onTimeGridDataChange || onTimeGridDataChangeCallback;
    }

    applyPreviousColorStyle();
    buildGridStructure(timeGridActualDomId, 'timeGrid');
    buildGridStructure(goalGridActualDomId, 'goalTimeGrid');
    setupTaskOverlayContainer(timeGridActualDomId);
    setupTaskOverlayContainer(goalGridActualDomId);

    document.addEventListener('mouseup', () => {
        isDraggingInternal = false;
        dragStartCellInternal = null;
        activeGridIdInternal = null;
    });
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
    for (let i = 1; i <= 6; i++) {
        gridElement.appendChild(createCell(`${i}0m`, 'dv-header-cell'));
    }

    // 데이터 셀 생성 및 이벤트 리스너 부착
    for (let hour = 0; hour < 24; hour++) {
        const displayHour = (hour + 6) % 24;
        gridElement.appendChild(createCell(`${String(displayHour).padStart(2, '0')}:00`, 'dv-time-cell'));

        for (let block = 0; block < 6; block++) {
            const cell = createCell('', 'dv-grid-cell'); // dv- 접두사 적용
            cell.dataset.hour = String(hour);
            cell.dataset.block = String(block);

            // 페인팅 관련 리스너
            cell.addEventListener('mousedown', (e) => {
                isDraggingInternal = false;
                dragStartCellInternal = cell;
                activeGridIdInternal = internalGridKey;
                storeCurrentColorsForGrid(internalGridKey);
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
                if (internalGridKey === 'timeGrid') {
                    dataStore[blockKey].previousColor = DEFAULT_PREVIOUS_COLOR;
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
            } else {
                cell.classList.remove('color-changed');
                cell.style.removeProperty('--previous-color');
            }
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

    // << 수정됨: 쿼리 셀렉터 및 fallback 생성에 dv- 접두사 추가
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
            // << 수정됨: 쿼리 셀렉터에 dv- 접두사 추가
            const firstCellInSegment = gridElement.querySelector(`.dv-grid-cell[data-hour="${currentHour}"][data-block="${currentBlockInHour}"]`);
            if (!firstCellInSegment) {
                currentHour++;
                currentBlockInHour = 0;
                continue;
            }

            const segmentOverlay = document.createElement('div');
            // << 수정됨: 클래스 이름에 dv- 접두사 추가
            segmentOverlay.className = 'dv-scheduled-task-segment-overlay';
            segmentOverlay.style.position = 'absolute';
            segmentOverlay.style.top = `${firstCellInSegment.offsetTop}px`;
            segmentOverlay.style.left = `${firstCellInSegment.offsetLeft}px`;
            segmentOverlay.style.width = `${blocksInCurrentRow * cellWidth}px`;
            segmentOverlay.style.height = `${cellHeight}px`;
            segmentOverlay.style.borderColor = task.color || DEFAULT_SCHEDULED_TASK_BORDER_COLOR;

            const textElement = document.createElement('span');
            textElement.className = 'dv-scheduled-task-text'; // << 수정됨
            textElement.textContent = task.text;
            segmentOverlay.appendChild(textElement);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'dv-scheduled-task-delete-btn'; // << 수정됨
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
        const previousColorIsDefault = (block.previousColor === DEFAULT_PREVIOUS_COLOR || typeof block.previousColor === 'undefined');
        return textIsDefault && colorIsDefault && previousColorIsDefault;
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

export function clearAllPreviousColorMarkers(internalGridKeyToClear) {
    if (internalGridKeyToClear === 'timeGrid' || internalGridKeyToClear === 'all') {
        Object.keys(blockData).forEach(key => {
            if (blockData[key]) {
                blockData[key].previousColor = null;
            }
        });
        if (timeGridActualDomId) {
            const gridElement = document.getElementById(timeGridActualDomId);
            if (gridElement) {
                // << 수정됨: dv- 접두사 추가
                gridElement.querySelectorAll('.dv-grid-cell.color-changed').forEach(cell => {
                    cell.classList.remove('color-changed');
                    cell.style.removeProperty('--previous-color');
                });
            }
        }
    }
}

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