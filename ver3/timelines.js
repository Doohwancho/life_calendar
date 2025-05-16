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
    timeGridActualDomId = timeGridDomId;
    goalGridActualDomId = goalGridDomId;

    if (callbacks) {
        getSelectedColorCallback = callbacks.getSelectedColor || getSelectedColorCallback;
        isDarkColorCallback = callbacks.isDarkColor || isDarkColorCallback;
        normalizeColorCallback = callbacks.normalizeColor || normalizeColorCallback;
        onTimeGridDataChangeCallback = callbacks.onTimeGridDataChange || onTimeGridDataChangeCallback;
    }

    applyPreviousColorStyle();
    initializeGridInternal(timeGridActualDomId, 'timeGrid'); // DOM ID 전달
    initializeGridInternal(goalGridActualDomId, 'goalTimeGrid'); // DOM ID 전달

    document.addEventListener('mouseup', () => {
        if (isDraggingInternal) {
            if (activeGridIdInternal === 'timeGrid') {
                // onTimeGridDataChangeCallback(); // internalSaveBlock에서 이미 처리됨
            }
        }
        isDraggingInternal = false;
        dragStartCellInternal = null;
        activeGridIdInternal = null; 
        // timeGridStartColors 와 goalGridStartColors 는 mousedown 시점에 채워지므로 여기서 반드시 비울 필요는 없음
        // 필요하다면 여기서 clear() 호출:
        // timeGridStartColors.clear();
        // goalGridStartColors.clear();
    });
}

function initializeGridInternal(gridDomId, internalGridKey) {
    const gridElement = document.getElementById(gridDomId);
    if (!gridElement) {
        console.error(`Grid element with ID "${gridDomId}" not found.`);
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

export function setTimelineBlockDataAndRender(newData, timeGridDomIdToRender) {
    blockData = newData || {}; // Expects {text, color, previousColor}
    initializeGridInternal(timeGridDomIdToRender, 'timeGrid');
    onTimeGridDataChangeCallback(); 
}
export function setTimelineGoalDataAndRender(newGoalData, goalGridDomIdToRender) {
    goalBlockData = {}; // Clear first
    if (newGoalData) { // Strip previousColor if present from old files
        for (const key in newGoalData) {
            goalBlockData[key] = {
                text: newGoalData[key].text,
                color: newGoalData[key].color
                // previousColor is deliberately omitted
            };
        }
    }
    initializeGridInternal(goalGridDomIdToRender, 'goalTimeGrid');
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