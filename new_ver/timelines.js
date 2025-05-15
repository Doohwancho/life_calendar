// timelines.js

// --- Module-Scoped Variables for Timelines ---
let blockData = {};       // Data for Current Timeline (timeGrid)
let goalBlockData = {};   // Data for Goal Timeline (goalTimeGrid)

let timeGridActualDomId = '';
let goalGridActualDomId = '';

let timeGridStartColors = new Map(); // For current timeline, store original colors when drag starts
let goalGridStartColors = new Map(); // For goal timeline, store original colors when drag starts

let activeGridIdInternal = null; // Tracks which grid is being interacted with
let selectedCellsInternal = new Set();
let isDraggingInternal = false;
let dragStartCellInternal = null;
let currentlyEditingCellInternal = null; // Cell being edited in a modal

// --- Callbacks & Refs from Main Script ---
let getSelectedColorCallback = () => 'rgb(255,255,255)';
let isDarkColorCallback = () => false;
let normalizeColorCallback = color => color;
let onTimeGridDataChangeCallback = () => {}; // Called when blockData changes


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
    return cell;
}

function storeCurrentColorsForGrid(internalGridKey) {  // internalGridKey is 'timeGrid' or 'goalTimeGrid'
    const dataStore = internalGridKey === 'timeGrid' ? blockData : goalBlockData;
    const colorStoreMap = internalGridKey === 'timeGrid' ? timeGridStartColors : goalGridStartColors;
    colorStoreMap.clear();

    const actualDomId = internalGridKey === 'timeGrid' ? timeGridActualDomId : goalGridActualDomId;
    if (!actualDomId) {
        console.error("DOM ID not set for grid key:", internalGridKey);
        return;
    }

    document.querySelectorAll(`#${actualDomId} .grid-cell`).forEach(cell => { // Use actualDomId
        const key = `<span class="math-inline">\{cell\.dataset\.hour\}\-</span>{cell.dataset.block}`;
        const currentBlockData = dataStore[key];
        const colorToStore = currentBlockData ? currentBlockData.color : cell.style.backgroundColor;
        colorStoreMap.set(key, colorToStore || 'rgb(255,255,255)');
    });
}

function internalSaveBlock(blockKey, text, cell, gridId, newColor, previousColorForTriangle) {
    const dataStore = gridId === 'timeGrid' ? blockData : goalBlockData;

    if (!dataStore[blockKey]) {
        dataStore[blockKey] = { text: '', color: 'rgb(255,255,255)', previousColor: null };
    }

    dataStore[blockKey].text = text;
    dataStore[blockKey].color = newColor || dataStore[blockKey].color; // Use newColor if provided

    // Handle previousColor for triangle
    // previousColorForTriangle is the color *before* the current coloring action started
    const normalizedNewColor = normalizeColorCallback(dataStore[blockKey].color);
    const normalizedPrevColorForTriangle = normalizeColorCallback(previousColorForTriangle);

    if (previousColorForTriangle && normalizedNewColor !== normalizedPrevColorForTriangle) {
        dataStore[blockKey].previousColor = previousColorForTriangle; // This is what the triangle shows
        cell.classList.add('color-changed');
        cell.style.setProperty('--previous-color', previousColorForTriangle);
    } else {
        // If new color is same as what triangle would show, or no triangle needed
        dataStore[blockKey].previousColor = null;
        cell.classList.remove('color-changed');
        cell.style.removeProperty('--previous-color');
    }
    
    cell.textContent = text;
    cell.style.backgroundColor = dataStore[blockKey].color;
    cell.style.color = isDarkColorCallback(dataStore[blockKey].color) ? 'white' : 'black';

    if (gridId === 'timeGrid') {
        onTimeGridDataChangeCallback();
    }
}


function handleCellClickInternal(event, gridId) {
    const cell = event.target.closest('.grid-cell');
    if (!cell) return;

    activeGridIdInternal = gridId;
    currentlyEditingCellInternal = cell;

    const dataStore = gridId === 'timeGrid' ? blockData : goalBlockData;
    const blockKey = `${cell.dataset.hour}-${cell.dataset.block}`;
    const cellData = dataStore[blockKey] || { text: '', color: cell.style.backgroundColor, previousColor: null };

    // --- Modal creation and handling ---
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    const textarea = document.createElement('textarea');
    textarea.className = 'editing-textarea';
    textarea.value = cellData.text;

    // Style modal based on cell color
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
        currentlyEditingCellInternal = null;
    };

    const handleEscKey = (e) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', handleEscKey);

    saveBtn.addEventListener('click', () => {
        // When saving text, color is cell's current color. Previous color logic handled by coloring actions.
        internalSaveBlock(blockKey, textarea.value, cell, gridId, cell.style.backgroundColor, dataStore[blockKey]?.previousColor);
        closeModal();
    });
    cancelBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            internalSaveBlock(blockKey, textarea.value, cell, gridId, cell.style.backgroundColor, dataStore[blockKey]?.previousColor);
            closeModal();
        }
    });

    buttonsDiv.appendChild(cancelBtn); buttonsDiv.appendChild(saveBtn);
    modalContent.appendChild(textarea); modalContent.appendChild(buttonsDiv);
    modalOverlay.appendChild(modalContent); document.body.appendChild(modalOverlay);
    textarea.focus();

    // Apply selected color from palette IF it's different from cell's current color
    const selectedColor = getSelectedColorCallback();
    const normalizedSelectedColor = normalizeColorCallback(selectedColor);
    const normalizedCellColor = normalizeColorCallback(cell.style.backgroundColor);

    if (normalizedSelectedColor !== normalizedCellColor) {
        const colorStoreMap = gridId === 'timeGrid' ? timeGridStartColors : goalGridStartColors;
        const colorBeforeInteraction = colorStoreMap.get(blockKey) || cell.style.backgroundColor;
        internalSaveBlock(blockKey, cellData.text, cell, gridId, selectedColor, colorBeforeInteraction);
        // Update modal appearance if color changed
        modalContent.style.backgroundColor = selectedColor;
        textarea.style.color = isDarkColorCallback(selectedColor) ? 'white' : 'black';
    }
}


function handleDragPaintInternal(dragStartCell, currentHoverCell, gridId) {
    const dataStore = gridId === 'timeGrid' ? blockData : goalBlockData;
    const colorStoreMap = gridId === 'timeGrid' ? timeGridStartColors : goalGridStartColors; // Colors at the start of the drag

    const startHour = parseInt(dragStartCell.dataset.hour);
    const startBlock = parseInt(dragStartCell.dataset.block);
    const currentHour = parseInt(currentHoverCell.dataset.hour);
    const currentBlock = parseInt(currentHoverCell.dataset.block);

    const minHour = Math.min(startHour, currentHour);
    const maxHour = Math.max(startHour, currentHour);
    const minBlock = Math.min(startBlock, currentBlock);
    const maxBlock = Math.max(startBlock, currentBlock);

    const newColor = getSelectedColorCallback();

    for (let h = minHour; h <= maxHour; h++) {
        for (let b = minBlock; b <= maxBlock; b++) {
            const cellKey = `${h}-${b}`;
            const cellElement = document.querySelector(`#${gridId} .grid-cell[data-hour="${h}"][data-block="${b}"]`);
            if (cellElement) {
                const colorBeforeThisDragInteraction = colorStoreMap.get(cellKey) || cellElement.style.backgroundColor;
                const currentText = dataStore[cellKey]?.text || '';
                internalSaveBlock(cellKey, currentText, cellElement, gridId, newColor, colorBeforeThisDragInteraction);
            }
        }
    }
    // onTimeGridDataChangeCallback will be called by internalSaveBlock if gridId is 'timeGrid'
}

// --- Exported Functions ---

export function initTimelines(timeGridDomId, goalGridDomId, callbacks) {
    timeGridActualDomId = timeGridDomId; // Store actual DOM ID
    goalGridActualDomId = goalGridDomId; // Store actual DOM ID

    if (callbacks) {
        getSelectedColorCallback = callbacks.getSelectedColor || getSelectedColorCallback;
        isDarkColorCallback = callbacks.isDarkColor || isDarkColorCallback;
        normalizeColorCallback = callbacks.normalizeColor || normalizeColorCallback;
        onTimeGridDataChangeCallback = callbacks.onTimeGridDataChange || onTimeGridDataChangeCallback;
    }

    applyPreviousColorStyle();
    initializeGridInternal(timeGridDomId, 'timeGrid'); // 'timeGrid' is our internal key for blockData
    initializeGridInternal(goalGridDomId, 'goalTimeGrid'); // 'goalTimeGrid' for goalBlockData

    // Global mouseup listener for drag operations
    document.addEventListener('mouseup', () => {
        if (isDraggingInternal) {
            if (activeGridIdInternal === 'timeGrid') {
                 // Data change callback already called during drag by internalSaveBlock
            }
        }
        isDraggingInternal = false;
        dragStartCellInternal = null;
        selectedCellsInternal.clear();
        timeGridStartColors.clear(); // Clear both, or be specific based on activeGridIdInternal if needed
        goalGridStartColors.clear();
        activeGridIdInternal = null;
    });
}

function initializeGridInternal(gridDomId, internalGridKey) { // internalGridKey is 'timeGrid' or 'goalTimeGrid'
    const gridElement = document.getElementById(gridDomId);
    if (!gridElement) {
        console.error(`Grid element with ID "${gridDomId}" not found.`);
        return;
    }
    const dataStore = internalGridKey === 'timeGrid' ? blockData : goalBlockData;

    gridElement.innerHTML = ''; // Clear previous content

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
            const blockKey = `${hour}-${block}`;

            if (!dataStore[blockKey]) {
                dataStore[blockKey] = { text: '', color: 'rgb(255, 255, 255)', previousColor: null };
            }
            const cellData = dataStore[blockKey];
            cell.style.backgroundColor = cellData.color;
            cell.textContent = cellData.text;
            cell.style.color = isDarkColorCallback(cellData.color) ? 'white' : 'black';

            if (cellData.previousColor && normalizeColorCallback(cellData.previousColor) !== normalizeColorCallback(cellData.color)) {
                cell.classList.add('color-changed');
                cell.style.setProperty('--previous-color', cellData.previousColor);
            }

            cell.addEventListener('mousedown', (e) => {
                isDraggingInternal = false;
                dragStartCellInternal = cell;
                activeGridIdInternal = internalGridKey; // Set active grid key
                selectedCellsInternal.clear();
                storeCurrentColorsForGrid(internalGridKey); // Use internalGridKey
                selectedCellsInternal.add(`${cell.dataset.hour}-${cell.dataset.block}`);
            });

            cell.addEventListener('mousemove', (e) => {
                if (e.buttons === 1 && dragStartCellInternal && activeGridIdInternal === internalGridKey) {
                    const currentCellKey = `${cell.dataset.hour}-${cell.dataset.block}`;
                    if (!selectedCellsInternal.has(currentCellKey)) {
                        selectedCellsInternal.add(currentCellKey);
                    }
                    if (cell !== dragStartCellInternal) { // If moved to a different cell
                        isDraggingInternal = true;
                    }
                    if (isDraggingInternal) {
                        handleDragPaintInternal(dragStartCellInternal, cell, internalGridKey);
                    }
                }
            });

            cell.addEventListener('mouseup', (e) => { // This mouseup is cell-specific
                if (dragStartCellInternal && activeGridIdInternal === internalGridKey) {
                    if (!isDraggingInternal) { // Click
                        handleCellClickInternal(e, internalGridKey);
                    } else { // Drag end on a cell
                        // drag paint already handled data changes, onTimeGridDataChangeCallback called if 'timeGrid'
                    }
                }
                // Don't reset global drag states here, let the document mouseup handle it
                // to cover drags ending outside cells.
            });
            gridElement.appendChild(cell);
        }
    }
}


export function getTimelineBlockData() {
    return { ...blockData }; // Return a copy
}

export function getTimelineGoalData() {
    return { ...goalBlockData }; // Return a copy
}

export function setTimelineBlockDataAndRender(newData, timeGridDomId) {
    blockData = newData || {};
    initializeGridInternal(timeGridDomId, 'timeGrid');
    onTimeGridDataChangeCallback(); // Notify main script of data change
}

export function setTimelineGoalDataAndRender(newGoalData, goalGridDomId) {
    goalBlockData = newGoalData || {};
    initializeGridInternal(goalGridDomId, 'goalTimeGrid');
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
    const dataStoresToProcess = [];
    const domIdsToQuery = []; // Use actual DOM IDs for querying

    if (internalGridKeyToClear === 'timeGrid' || internalGridKeyToClear === 'all') {
        dataStoresToProcess.push(blockData);
        if (timeGridActualDomId) domIdsToQuery.push(timeGridActualDomId);
    }
    if (internalGridKeyToClear === 'goalTimeGrid' || internalGridKeyToClear === 'all') {
        dataStoresToProcess.push(goalBlockData);
        if (goalGridActualDomId) domIdsToQuery.push(goalGridActualDomId);
    }

    dataStoresToProcess.forEach(dataStore => {
        Object.keys(dataStore).forEach(key => {
            if (dataStore[key]) {
                dataStore[key].previousColor = null;
            }
        });
    });

    domIdsToQuery.forEach(domId => { // Iterate over actual DOM IDs
        const gridElement = document.getElementById(domId);
        if (gridElement) {
            gridElement.querySelectorAll('.grid-cell.color-changed').forEach(cell => {
                cell.classList.remove('color-changed');
                cell.style.removeProperty('--previous-color');
            });
        }
    });
}