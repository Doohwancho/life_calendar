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
    tr.classList.add('routine-table-row'); // Class for common row styling & hover
    if (isEditingThisRow) {
        tr.classList.add('editing-row');
        tr.draggable = false; // Disable drag when editing
    } else {
        tr.draggable = true;
    }

    // Drag and Drop event listeners for the row (tr)
    tr.addEventListener('dragstart', (e) => {
        if (isEditingThisRow) { e.preventDefault(); return; } // Don't drag if editing
        draggedRoutine = {
            id: routineItem.id,
            element: tr,
            originalIndex: routines.findIndex(r => r.id === routineItem.id)
        };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', routineItem.id); // Necessary for Firefox
        setTimeout(() => tr.classList.add('dragging-routine'), 0);
    });

    tr.addEventListener('dragover', (e) => {
        if (isEditingThisRow || !draggedRoutine || draggedRoutine.id === routineItem.id) return;
        e.preventDefault();
        // 이전 표시자 클래스 모두 제거
        document.querySelectorAll('.routine-table-row').forEach(row => {
            row.classList.remove('drag-over-indicator-top', 'drag-over-indicator-bottom');
        });
    
        const rect = tr.getBoundingClientRect();
        const isDropOnUpperHalf = e.clientY < rect.top + rect.height / 2;
        if (isDropOnUpperHalf) {
            tr.classList.add('drag-over-indicator-top');
        } else {
            tr.classList.add('drag-over-indicator-bottom');
        }
        e.dataTransfer.dropEffect = 'move';
    });
    
    // tr에 'dragleave' 이벤트 리스너 수정
    tr.addEventListener('dragleave', (e) => {
        // 실제 tr 요소를 떠날 때만 제거 (자식 요소로 들어갈 때는 유지)
        if (e.target === tr && (!tr.contains(e.relatedTarget) || e.relatedTarget === null)) {
          tr.classList.remove('drag-over-indicator-top', 'drag-over-indicator-bottom');
        }
    });

    tr.addEventListener('drop', (e) => {
        if (isEditingThisRow || !draggedRoutine || draggedRoutine.id === routineItem.id) return;
        e.preventDefault();
        tr.classList.remove('drag-over-routine');

        const targetIndex = routines.findIndex(r => r.id === routineItem.id);
        const itemToMove = routines.splice(draggedRoutine.originalIndex, 1)[0];
        
        if (itemToMove) {
            // Adjust targetIndex if originalIndex was before targetIndex in the array
            const adjustedTargetIndex = draggedRoutine.originalIndex < targetIndex ? targetIndex -1 : targetIndex;
             // Insert at the correct new position
            const currentTargetIndex = routines.findIndex(r => r.id === routineItem.id); // get fresh index
            const rect = tr.getBoundingClientRect();
            const isDropOnUpperHalf = e.clientY < rect.top + rect.height / 2;

            if(isDropOnUpperHalf) {
                routines.splice(currentTargetIndex, 0, itemToMove);
            } else {
                routines.splice(currentTargetIndex + 1, 0, itemToMove);
            }
        }

        saveRoutinesToLocalBackup();
        renderRoutinesTableInternal(); // Re-render the whole table to reflect new order
        draggedRoutine = null;
    });

    tr.addEventListener('dragend', (e) => {
        tr.classList.remove('dragging-routine');
        document.querySelectorAll('.drag-over-routine').forEach(el => el.classList.remove('drag-over-routine'));
        draggedRoutine = null;
    });


    // Column 1-1: Time of Day
    const tdTimeOfDay = document.createElement('td');
    if (isEditingThisRow) {
        const select = document.createElement('select');
        select.className = 'routine-edit-timeofday';
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
        input.type = 'text'; input.className = 'routine-edit-activity';
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
        textarea.className = 'routine-edit-memo';
        textarea.value = originalEditingRoutineData?.memo || routineItem.memo;
        textarea.placeholder = '메모'; textarea.rows = 2;
        tdMemo.appendChild(textarea);
    } else {
        tdMemo.textContent = routineItem.memo;
    }

    tr.appendChild(tdTimeOfDay);
    tr.appendChild(tdActivity);
    tr.appendChild(tdMemo);

    // Action Buttons Container (appended to tr, positioned with CSS)
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'routine-row-actions-container';

    if (isEditingThisRow) {
        const confirmButton = document.createElement('button');
        confirmButton.innerHTML = '✔️'; confirmButton.title = 'Confirm Edit';
        confirmButton.className = 'routine-action-btn routine-confirm-btn'; // Always visible in edit
        confirmButton.onclick = (e) => {
            e.stopPropagation();
            const currentItem = routines.find(r => r.id === routineItem.id);
            if (currentItem) {
                currentItem.timeOfDay = tr.querySelector('.routine-edit-timeofday').value;
                currentItem.activity = tr.querySelector('.routine-edit-activity').value.trim();
                currentItem.memo = tr.querySelector('.routine-edit-memo').value.trim();
            }
            editingRoutineId = null; originalEditingRoutineData = null;
            saveRoutinesToLocalBackup();
            renderRoutinesTableInternal();
        };

        const cancelButton = document.createElement('button');
        cancelButton.innerHTML = '❌'; cancelButton.title = 'Cancel Edit';
        cancelButton.className = 'routine-action-btn routine-cancel-btn'; // Always visible in edit
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
        editButton.className = 'routine-action-btn routine-edit-btn'; // Shown on hover
        editButton.onclick = (e) => {
            e.stopPropagation();
            editingRoutineId = routineItem.id;
            originalEditingRoutineData = JSON.parse(JSON.stringify(routineItem));
            renderRoutinesTableInternal();
        };

        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '🗑️'; deleteButton.title = 'Delete Routine';
        deleteButton.className = 'routine-action-btn routine-delete-btn'; // Shown on hover
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
    tr.appendChild(actionsContainer); // Append actions container to the row itself

    return tr;
}

function renderRoutinesTableInternal() {
    if (!routinesContainerElement) return;

    // 기존 버튼이 있다면 삭제 후 컨테이너 하단에 새로 추가
    let addRoutineBtnOld = routinesContainerElement.querySelector('#add-routine-btn');
    if (addRoutineBtnOld) addRoutineBtnOld.remove();

    let tableWrapper = routinesContainerElement.querySelector('.routines-table-wrapper');
    if (!tableWrapper) {
        // 최초 렌더링 시 또는 전체 클리어 시 wrapper 와 table 기본 구조 생성
        routinesContainerElement.innerHTML = ''; // Clear all content if no wrapper
        tableWrapper = document.createElement('div');
        tableWrapper.className = 'routines-table-wrapper';

        const table = document.createElement('table');
        table.className = 'routines-table';
        
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
        tbody.className = 'routines-table-body';
        table.appendChild(tbody);
        
        tableWrapper.appendChild(table);
        routinesContainerElement.appendChild(tableWrapper);
    }

    const tbody = tableWrapper.querySelector('.routines-table-body');
    tbody.innerHTML = ''; // Clear existing rows

    if (routines.length > 0) {
        routines.forEach(item => {
            tbody.appendChild(createRoutineRowElement(item));
        });
    } else {
        const trEmpty = document.createElement('tr');
        const tdEmpty = document.createElement('td');
        tdEmpty.colSpan = 3; 
        tdEmpty.textContent = '등록된 루틴이 없습니다. 아래 영역에 마우스를 올리면 버튼이 나타납니다.';
        tdEmpty.className = 'empty-routines-message';
        trEmpty.appendChild(tdEmpty);
        tbody.appendChild(trEmpty);
    }

    // "+ 새 루틴 추가" 버튼을 routinesContainerElement의 자식으로, tableWrapper 다음에 추가
    let addRoutineBtn = document.createElement('button');
    addRoutineBtn.id = 'add-routine-btn';
    addRoutineBtn.textContent = '+ 새 루틴 추가';
    addRoutineBtn.addEventListener('click', () => {
        // ... (새 루틴 추가 로직은 이전과 동일)
        const newRoutineId = generateId();
        originalEditingRoutineData = { id: newRoutineId, timeOfDay: TIME_OF_DAY_OPTIONS[0], activity: '', memo: '' };
        editingRoutineId = newRoutineId;
        const tempNewRoutineForRender = {...originalEditingRoutineData};
        const emptyRowMsg = tbody.querySelector('.empty-routines-message');
        if(emptyRowMsg) tbody.innerHTML = ''; 
        const editingRowElement = createRoutineRowElement(tempNewRoutineForRender);
        tbody.appendChild(editingRowElement);
        editingRowElement.querySelector('.routine-edit-activity')?.focus();
        const confirmButton = editingRowElement.querySelector('.routine-confirm-btn');
        if(confirmButton){
            confirmButton.onclick = (e) => {
                e.stopPropagation();
                const newActivity = editingRowElement.querySelector('.routine-edit-activity').value.trim();
                if (newActivity) {
                    const finalNewRoutine = {
                        id: originalEditingRoutineData.id,
                        timeOfDay: editingRowElement.querySelector('.routine-edit-timeofday').value,
                        activity: newActivity,
                        memo: editingRowElement.querySelector('.routine-edit-memo').value.trim()
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

// --- Exported Functions (initRoutinesApp, setRoutinesDataAndRender, getRoutinesData) ---
// 이전 답변과 동일하게 유지 (단, init 시 기본 데이터 구조 확인)
export function initRoutinesApp(containerSelector, initialData, dataChangedCallback = () => {}) {
    const container = document.querySelector(containerSelector);
    if (!container) { console.error(`Routines app container "${containerSelector}" not found.`); return; }
    routinesContainerElement = container;
    onRoutinesDataChangeCallback = dataChangedCallback;

    // --- [Phase 5] 수정 --- 데이터 초기화 로직 단순화
    // main.js가 항상 초기 데이터를 제공하므로, localStorage나 기본 데이터 생성 로직이 필요 없습니다.
    setRoutinesDataAndRender(initialData || []);
}
export function setRoutinesDataAndRender(newData) {
    routines = Array.isArray(newData) ? newData : [];
    
    // --- [Phase 5] 수정 --- set... 함수에서 콜백을 다시 호출할 필요가 없습니다.
    // saveRoutinesToLocalBackup();
    
    renderRoutinesTableInternal();
}

export function getRoutinesData() {
    return JSON.parse(JSON.stringify(routines));
}