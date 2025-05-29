// routines.js

let routines = [];
let routinesContainerElement = null;
let onRoutinesDataChangeCallback = () => {};
let editingRoutineId = null;
let originalEditingRoutineData = null; // Store data before editing for cancellation
const TIME_OF_DAY_OPTIONS = ["아침", "낮", "저녁", "취침"];

function generateId() { return '_r' + Math.random().toString(36).substr(2, 7); }

function saveRoutinesToLocalBackup() {
    onRoutinesDataChangeCallback();
}

let draggedRoutine = null; // To store info about the routine being dragged

function createRoutineRowElement(routineItem) {
    const isEditingThisRow = editingRoutineId === routineItem.id;
    const tr = document.createElement('tr');
    tr.dataset.routineId = routineItem.id;
    tr.classList.add('dv-routine-table-row'); // << 수정됨
    if (isEditingThisRow) {
        tr.classList.add('editing-row'); // 상태 클래스이므로 접두사 없음
        tr.draggable = false;
    } else {
        tr.draggable = true;
    }

    // Drag and Drop event listeners for the row (tr)
    tr.addEventListener('dragstart', (e) => {
        if (isEditingThisRow) { e.preventDefault(); return; }
        draggedRoutine = {
            id: routineItem.id,
            element: tr,
            originalIndex: routines.findIndex(r => r.id === routineItem.id)
        };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', routineItem.id);
        setTimeout(() => tr.classList.add('dragging-routine'), 0); // 상태 클래스
    });

    tr.addEventListener('dragover', (e) => {
        if (isEditingThisRow || !draggedRoutine || draggedRoutine.id === routineItem.id) return;
        e.preventDefault();
        // << 수정됨: dv- 접두사 추가
        document.querySelectorAll('.dv-routine-table-row').forEach(row => {
            row.classList.remove('drag-over-indicator-top', 'drag-over-indicator-bottom'); // 상태 클래스
        });
    
        const rect = tr.getBoundingClientRect();
        const isDropOnUpperHalf = e.clientY < rect.top + rect.height / 2;
        if (isDropOnUpperHalf) {
            tr.classList.add('drag-over-indicator-top'); // 상태 클래스
        } else {
            tr.classList.add('drag-over-indicator-bottom'); // 상태 클래스
        }
        e.dataTransfer.dropEffect = 'move';
    });
    
    tr.addEventListener('dragleave', (e) => {
        if (e.target === tr && (!tr.contains(e.relatedTarget) || e.relatedTarget === null)) {
            tr.classList.remove('drag-over-indicator-top', 'drag-over-indicator-bottom');
        }
    });

    tr.addEventListener('drop', (e) => {
        if (isEditingThisRow || !draggedRoutine || draggedRoutine.id === routineItem.id) return;
        e.preventDefault();
        tr.classList.remove('drag-over-indicator-top', 'drag-over-indicator-bottom');

        const targetIndex = routines.findIndex(r => r.id === routineItem.id);
        const itemToMove = routines.splice(draggedRoutine.originalIndex, 1)[0];
        
        if (itemToMove) {
            const currentTargetIndex = routines.findIndex(r => r.id === routineItem.id);
            const rect = tr.getBoundingClientRect();
            const isDropOnUpperHalf = e.clientY < rect.top + rect.height / 2;

            if(isDropOnUpperHalf) {
                routines.splice(currentTargetIndex, 0, itemToMove);
            } else {
                routines.splice(currentTargetIndex + 1, 0, itemToMove);
            }
        }

        saveRoutinesToLocalBackup();
        renderRoutinesTableInternal();
        draggedRoutine = null;
    });

    tr.addEventListener('dragend', (e) => {
        tr.classList.remove('dragging-routine');
        // << 수정됨: dv- 접두사 추가
        document.querySelectorAll('.dv-routine-table-row').forEach(el => {
            el.classList.remove('drag-over-indicator-top', 'drag-over-indicator-bottom');
        });
        draggedRoutine = null;
    });


    // Column 1-1: Time of Day
    const tdTimeOfDay = document.createElement('td');
    if (isEditingThisRow) {
        const select = document.createElement('select');
        select.className = 'dv-routine-edit-timeofday'; // << 수정됨
        TIME_OF_DAY_OPTIONS.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option; opt.textContent = option;
            if (option === (originalEditingRoutineData?.timeOfDay || routineItem.timeOfDay)) opt.selected = true;
            select.appendChild(opt);
        });
        tdTimeOfDay.appendChild(select);
    } else {
        tdTimeOfDay.textContent = routineItem.timeOfDay;
    }

    // Column 1-2: Activity
    const tdActivity = document.createElement('td');
    if (isEditingThisRow) {
        const input = document.createElement('input');
        input.type = 'text'; input.className = 'dv-routine-edit-activity'; // << 수정됨
        input.value = originalEditingRoutineData?.activity || routineItem.activity;
        input.placeholder = '활동 내용';
        tdActivity.appendChild(input);
    } else {
        tdActivity.textContent = routineItem.activity;
    }

    // Column 2: Memo
    const tdMemo = document.createElement('td');
    if (isEditingThisRow) {
        const textarea = document.createElement('textarea');
        textarea.className = 'dv-routine-edit-memo'; // << 수정됨
        textarea.value = originalEditingRoutineData?.memo || routineItem.memo;
        textarea.placeholder = '메모'; textarea.rows = 2;
        tdMemo.appendChild(textarea);
    } else {
        tdMemo.textContent = routineItem.memo;
    }

    tr.appendChild(tdTimeOfDay);
    tr.appendChild(tdActivity);
    tr.appendChild(tdMemo);

    // Action Buttons Container
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'dv-routine-row-actions-container'; // << 수정됨

    if (isEditingThisRow) {
        const confirmButton = document.createElement('button');
        confirmButton.innerHTML = '✔️'; confirmButton.title = 'Confirm Edit';
        confirmButton.className = 'dv-routine-action-btn dv-routine-confirm-btn'; // << 수정됨
        confirmButton.onclick = (e) => {
            e.stopPropagation();
            const currentItem = routines.find(r => r.id === routineItem.id);
            if (currentItem) {
                currentItem.timeOfDay = tr.querySelector('.dv-routine-edit-timeofday').value; // << 수정됨
                currentItem.activity = tr.querySelector('.dv-routine-edit-activity').value.trim(); // << 수정됨
                currentItem.memo = tr.querySelector('.dv-routine-edit-memo').value.trim(); // << 수정됨
            }
            editingRoutineId = null; originalEditingRoutineData = null;
            saveRoutinesToLocalBackup();
            renderRoutinesTableInternal();
        };

        const cancelButton = document.createElement('button');
        cancelButton.innerHTML = '❌'; cancelButton.title = 'Cancel Edit';
        cancelButton.className = 'dv-routine-action-btn dv-routine-cancel-btn'; // << 수정됨
        cancelButton.onclick = (e) => {
            e.stopPropagation();
            editingRoutineId = null; originalEditingRoutineData = null;
            renderRoutinesTableInternal();
        };
        actionsContainer.appendChild(confirmButton);
        actionsContainer.appendChild(cancelButton);
    } else {
        const editButton = document.createElement('button');
        editButton.innerHTML = '✏️'; editButton.title = 'Edit Routine';
        editButton.className = 'dv-routine-action-btn dv-routine-edit-btn'; // << 수정됨
        editButton.onclick = (e) => {
            e.stopPropagation();
            editingRoutineId = routineItem.id;
            originalEditingRoutineData = JSON.parse(JSON.stringify(routineItem));
            renderRoutinesTableInternal();
        };

        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '🗑️'; deleteButton.title = 'Delete Routine';
        deleteButton.className = 'dv-routine-action-btn dv-routine-delete-btn'; // << 수정됨
        deleteButton.onclick = (e) => {
            e.stopPropagation();
            if (window.confirm(`"${routineItem.activity || '이 루틴'}"을(를) 삭제하시겠습니까?`)) {
                routines = routines.filter(r => r.id !== routineItem.id);
                if (editingRoutineId === routineItem.id) {
                    editingRoutineId = null; originalEditingRoutineData = null;
                }
                saveRoutinesToLocalBackup();
                renderRoutinesTableInternal();
            }
        };
        actionsContainer.appendChild(editButton);
        actionsContainer.appendChild(deleteButton);
    }
    tr.appendChild(actionsContainer);

    return tr;
}

function renderRoutinesTableInternal() {
    if (!routinesContainerElement) return;

    // << 수정됨: ID를 클래스로 변경
    let addRoutineBtnOld = routinesContainerElement.querySelector('.dv-add-routine-btn');
    if (addRoutineBtnOld) addRoutineBtnOld.remove();

    let tableWrapper = routinesContainerElement.querySelector('.dv-routines-table-wrapper');
    if (!tableWrapper) {
        routinesContainerElement.innerHTML = '';
        tableWrapper = document.createElement('div');
        tableWrapper.className = 'dv-routines-table-wrapper'; // << 수정됨

        const table = document.createElement('table');
        table.className = 'dv-routines-table'; // << 수정됨
        
        const colgroup = document.createElement('colgroup');
        ['25%', '40%', '35%'].forEach(width => {
            const col = document.createElement('col'); col.style.width = width;
            colgroup.appendChild(col);
        });
        table.appendChild(colgroup);

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        ['시간대', '활동', '메모'].forEach(text => {
            const th = document.createElement('th'); th.textContent = text;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        const tbody = document.createElement('tbody');
        tbody.className = 'dv-routines-table-body'; // << 수정됨
        table.appendChild(tbody);
        
        tableWrapper.appendChild(table);
        routinesContainerElement.appendChild(tableWrapper);
    }

    const tbody = tableWrapper.querySelector('.dv-routines-table-body'); // << 수정됨
    tbody.innerHTML = '';

    if (routines.length > 0) {
        routines.forEach(item => {
            tbody.appendChild(createRoutineRowElement(item));
        });
    } else {
        const trEmpty = document.createElement('tr');
        const tdEmpty = document.createElement('td');
        tdEmpty.colSpan = 3;
        tdEmpty.textContent = '등록된 루틴이 없습니다. 아래 영역에 마우스를 올리면 버튼이 나타납니다.';
        tdEmpty.className = 'dv-empty-routines-message'; // << 수정됨
        trEmpty.appendChild(tdEmpty);
        tbody.appendChild(trEmpty);
    }

    let addRoutineBtn = document.createElement('button');
    addRoutineBtn.className = 'dv-add-routine-btn'; // << 수정됨: ID를 클래스로 변경
    addRoutineBtn.textContent = '+ 새 루틴 추가';
    addRoutineBtn.addEventListener('click', () => {
        const newRoutineId = generateId();
        originalEditingRoutineData = { id: newRoutineId, timeOfDay: TIME_OF_DAY_OPTIONS[0], activity: '', memo: '' };
        editingRoutineId = newRoutineId;
        const tempNewRoutineForRender = {...originalEditingRoutineData};
        const emptyRowMsg = tbody.querySelector('.dv-empty-routines-message'); // << 수정됨
        if(emptyRowMsg) tbody.innerHTML = '';
        const editingRowElement = createRoutineRowElement(tempNewRoutineForRender);
        tbody.appendChild(editingRowElement);
        editingRowElement.querySelector('.dv-routine-edit-activity')?.focus(); // << 수정됨
        const confirmButton = editingRowElement.querySelector('.dv-routine-confirm-btn'); // << 수정됨
        if(confirmButton){
            confirmButton.onclick = (e) => {
                e.stopPropagation();
                const newActivity = editingRowElement.querySelector('.dv-routine-edit-activity').value.trim(); // << 수정됨
                if (newActivity) {
                    const finalNewRoutine = {
                        id: originalEditingRoutineData.id,
                        timeOfDay: editingRowElement.querySelector('.dv-routine-edit-timeofday').value, // << 수정됨
                        activity: newActivity,
                        memo: editingRowElement.querySelector('.dv-routine-edit-memo').value.trim() // << 수정됨
                    };
                    routines.push(finalNewRoutine);
                    saveRoutinesToLocalBackup();
                }
                editingRoutineId = null; originalEditingRoutineData = null;
                renderRoutinesTableInternal();
            };
        }
    });
    routinesContainerElement.appendChild(addRoutineBtn);
}


export function initRoutinesApp(containerSelector, initialData, dataChangedCallback = () => {}) {
    const container = document.querySelector(containerSelector);
    if (!container) { console.error(`Routines app container "${containerSelector}" not found.`); return; }
    routinesContainerElement = container;
    onRoutinesDataChangeCallback = dataChangedCallback;
    setRoutinesDataAndRender(initialData || []);
}

export function setRoutinesDataAndRender(newData) {
    routines = Array.isArray(newData) ? newData : [];
    renderRoutinesTableInternal();
}

export function getRoutinesData() {
    return JSON.parse(JSON.stringify(routines));
}