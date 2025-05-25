import * as data from "./dataManager.js";
import {
  formatDate,
  getMondayOfWeek,
  getDayNameKO,
  isSameDate,
} from "./uiUtils.js";

const weeklyCalendarArea = document.getElementById("weekly-calendar-area");
const today = new Date(); // Use provided date as "today"

let draggedTodoId = null; // 드래그 중인 할 일 ID (모듈 스코프)
let draggedTodoOriginalDate = null; // 드래그 시작 시 할 일의 원래 날짜


/**
 * Creates the UI for Today's Quick Note.
 * @param {string} dateStr - The date string for today (YYYY-MM-DD).
 * @returns {HTMLElement}
 */
// function createTodaysQuickNoteElement(dateStr) {
//   const noteArea = document.createElement("div");
//   noteArea.className = "todays-quick-note-area";

//   const noteDisplay = document.createElement("span");
//   noteDisplay.className = "quick-note-display";
//   noteDisplay.textContent =
//     data.getTodaysQuickNote(dateStr) || "오늘의 퀵노트...";

//   const noteInput = document.createElement("input");
//   noteInput.type = "text";
//   noteInput.className = "quick-note-input";
//   noteInput.style.display = "none";

//   noteArea.append(noteDisplay, noteInput);

//   // Event Listeners for editing
//   noteDisplay.addEventListener("click", () => {
//     noteDisplay.style.display = "none";
//     noteInput.style.display = "block";
//     noteInput.value = data.getTodaysQuickNote(dateStr);
//     noteInput.focus();
//   });

//   const finishEditing = () => {
//     const newText = noteInput.value.trim();
//     data.updateTodaysQuickNote(dateStr, newText);

//     noteDisplay.textContent = newText || "오늘의 퀵노트...";
//     noteInput.style.display = "none";
//     noteDisplay.style.display = "block";
//   };

//   noteInput.addEventListener("blur", finishEditing);
//   noteInput.addEventListener("keydown", (e) => {
//     if (e.key === "Enter") {
//       finishEditing();
//     } else if (e.key === "Escape") {
//       noteInput.value = data.getTodaysQuickNote(dateStr); // Revert
//       finishEditing();
//     }
//   });

//   return noteArea;
// }

/**
 * Renders the entire weekly calendar for a given week.
 * @param {Date} weekStartDate - A Date object for Monday of the week to display.
 */
export function renderWeeklyCalendar(weekStartDate) {
  if (!weeklyCalendarArea) return;
  weeklyCalendarArea.innerHTML = ""; // Clear previous content

  const header = document.createElement("header");
  header.className = "weekly-header";

  const grid = document.createElement("div");
  grid.className = "weekly-grid";

  const datesOfWeek = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStartDate);
    date.setDate(weekStartDate.getDate() + i);
    datesOfWeek.push(date);
    // 요일 헤더 생성 (header.appendChild)
    const dayHeaderEl = document.createElement('div');
    dayHeaderEl.className = 'weekly-day-header';
    dayHeaderEl.innerHTML = `${date.getDate()}<br>${getDayNameKO(date)}`;
    if (isSameDate(date, today)) dayHeaderEl.style.color = '#007bff';
    header.appendChild(dayHeaderEl);
  }

  // Render Day Cells
  datesOfWeek.forEach((date) => {
    const dateStr = formatDate(date);
    const dayCell = document.createElement("div");
    dayCell.className = "weekly-day-cell";
    dayCell.dataset.date = dateStr;

    // --- Cell Header with Add Button ---
    const cellHeader = document.createElement("div");
    cellHeader.className = "weekly-cell-header";
    // const dayInfo = document.createElement("span");
    // dayInfo.className = "weekly-cell-day-info";
    // dayInfo.innerHTML = `${date.getDate()}<br>${getDayNameKO(date)}`;
    const addTodoBtn = document.createElement("button");
    addTodoBtn.className = "add-todo-in-weekly";
    addTodoBtn.textContent = "+";
    addTodoBtn.title = "Add Todo";
    addTodoBtn.addEventListener("click", (e) =>
      handleAddTodoInWeekly(e, dateStr)
    );
    cellHeader.append(addTodoBtn);
    dayCell.appendChild(cellHeader);

    // --- Cell Content ---
    const cellContentContainer = document.createElement("div");
    cellContentContainer.className = "weekly-cell-content";
    renderWeeklyDayCellContent(dateStr, cellContentContainer);
    dayCell.appendChild(cellContentContainer);

    if (isSameDate(date, today)) {
      dayCell.classList.add("today");
      // Add Today's Quick Note element
      // const quickNoteEl = createTodaysQuickNoteElement(dateStr);
      // dayCell.appendChild(quickNoteEl);
    }

    // --- Drag & Drop Listeners for the Cell (Drop Zone for todos) ---
    dayCell.addEventListener('dragover', (e) => {
        e.preventDefault();
        const source = e.dataTransfer.getData('source');
        if (source === 'weekly-todo' || source === 'backlog') {
            e.dataTransfer.dropEffect = 'move';
            dayCell.classList.add('drag-over');
        }
    });
    dayCell.addEventListener('dragleave', (e) => {
        dayCell.classList.remove('drag-over');
    });
    dayCell.addEventListener('drop', (e) => {
      e.preventDefault();
      dayCell.classList.remove('drag-over');
      
      const droppedTodoIdFromData = e.dataTransfer.getData('text/plain');
      const source = e.dataTransfer.getData('source');
      const targetDate = dayCell.dataset.date; // 드롭된 셀의 날짜

      if (!droppedTodoIdFromData) return;

      if (source === 'weekly-todo' && draggedTodoOriginalDate === targetDate) {
          // 같은 날짜 셀 내에서의 순서 변경
          const currentCellContentContainer = dayCell.querySelector('.weekly-cell-content');
          const todoElements = Array.from(currentCellContentContainer.querySelectorAll('.weekly-todo-item'));
          const targetDropElement = e.target.closest('.weekly-todo-item');
          
          let newOrderedIds = todoElements.map(el => el.dataset.todoId);
          const draggedItemIndex = newOrderedIds.indexOf(droppedTodoIdFromData);

          if (draggedItemIndex !== -1) {
              newOrderedIds.splice(draggedItemIndex, 1); // 기존 위치에서 제거
          }

          if (targetDropElement && targetDropElement.dataset.todoId !== droppedTodoIdFromData) {
              let targetIndex = newOrderedIds.indexOf(targetDropElement.dataset.todoId);
              const rect = targetDropElement.getBoundingClientRect();
              if (e.clientY < rect.top + rect.height / 2) { // 타겟 요소의 위쪽 절반에 드롭
                  newOrderedIds.splice(targetIndex, 0, droppedTodoIdFromData);
              } else { // 타겟 요소의 아래쪽 절반에 드롭
                  newOrderedIds.splice(targetIndex + 1, 0, droppedTodoIdFromData);
              }
          } else if (targetDropElement && targetDropElement.dataset.todoId === droppedTodoIdFromData) {
              // 같은 아이템 위에 드롭된 경우 (순서 변경 없음)
              newOrderedIds.splice(draggedItemIndex, 0, droppedTodoIdFromData); // 원래 위치로
          }
           else { // 빈 공간 또는 다른 요소 위에 드롭 시 맨 뒤로
              newOrderedIds.push(droppedTodoIdFromData);
          }
          data.reorderCalendarCellTodos(targetDate, newOrderedIds);

      } else if (source === 'backlog') {
          data.moveBacklogTodoToCalendar(droppedTodoIdFromData, targetDate);
      } else if (source === 'weekly-todo' && draggedTodoOriginalDate !== targetDate) {
          // 다른 날짜에서 온 weekly-todo 처리
          const todoToMove = data.getState().calendarCellTodos.find(t => t.id === droppedTodoIdFromData);
          if(todoToMove){
              // dataManager에 moveCalendarCellTodo(todoId, newDate) 함수를 만드는 것이 이상적
              data.deleteCalendarTodo(droppedTodoIdFromData); // dataChanged 발생
              // delete가 dataChanged를 발생시키므로, add는 다음 이벤트 루프에서 처리될 수 있도록 setTimeout 사용
              setTimeout(() => {
                  data.addCalendarTodo({ date: targetDate, text: todoToMove.text, color: todoToMove.color }); // type도 복사해야 할 수 있음
              }, 0);
          }
      }
      // 전역 드래그 상태 초기화
      draggedTodoId = null;
      draggedTodoOriginalDate = null;
    });

    grid.appendChild(dayCell);
  });

  weeklyCalendarArea.append(header, grid);
}

export function initWeeklyCalendar() {
  if (!weeklyCalendarArea) {
    console.error("Weekly calendar area not found!");
    return;
  }
  console.log("Weekly Calendar Initialized.");
}

/**
 * 특정 날짜 셀의 내용을 렌더링합니다. (프로젝트, 할 일 포함)
 */
function renderWeeklyDayCellContent(dateStr, cellContentContainer) {
  cellContentContainer.innerHTML = ""; 
  const { events, calendarCellTodos, labels } = data.getState(); // labels 추가
  const itemsToRender = [];

  // 1. 이 날짜에 해당하는 프로젝트 이벤트들을 찾아서 itemsToRender에 추가
  events.forEach((event) => {
      const eventStartDate = new Date(event.startDate);
      const eventEndDate = new Date(event.endDate);
      const currentDate = new Date(dateStr);
      // 시간은 무시하고 날짜만 비교
      eventStartDate.setHours(0,0,0,0);
      eventEndDate.setHours(0,0,0,0);
      currentDate.setHours(0,0,0,0);

      if (currentDate >= eventStartDate && currentDate <= eventEndDate) {
          const label = labels.find(l => l.id === event.labelId);
          itemsToRender.push({ 
              ...event, 
              itemType: "project", 
              displayName: label ? label.name : "Project", // 라벨 이름 사용
              displayColor: label ? label.color : "#ccc" // 라벨 색상 사용
          });
      }
  });

  // 2. 이 날짜에 해당하는 calendarCellTodos를 찾아서 itemsToRender에 추가
  calendarCellTodos.forEach((todo) => {
      if (todo.date === dateStr) {
          itemsToRender.push({ ...todo, itemType: "todo", displayName: todo.text, displayColor: todo.color });
      }
  });

  // (선택) 여기서 itemsToRender를 특정 기준(예: 타입, 생성 시간 등)으로 정렬할 수 있습니다.
  // 예: 프로젝트를 할 일보다 위에 표시
  itemsToRender.sort((a, b) => {
      if (a.itemType === 'project' && b.itemType !== 'project') return -1;
      if (a.itemType !== 'project' && b.itemType === 'project') return 1;
      return 0; // 같은 타입 내에서는 순서 유지 (또는 다른 기준으로 정렬)
  });
  
    // 4. 렌더링
    itemsToRender.forEach(item => {
      let itemEl;
      if (item.itemType === "project") {
          itemEl = document.createElement("div");
          itemEl.className = "project-bar"; // 주간 달력용 project-bar 스타일 필요시 추가
          itemEl.style.backgroundColor = item.displayColor;
          itemEl.textContent = item.displayName;
          itemEl.title = item.displayName;
          itemEl.style.position = "relative";
          itemEl.style.marginBottom = "2px";
          itemEl.style.height = "18px";
          itemEl.style.lineHeight = "18px";
          // 프로젝트 바에 대한 이벤트 리스너는 필요시 추가
      } else if (item.itemType === "todo") {
          itemEl = createWeeklyTodoElement(item); // 기존 함수 재활용
      }
      if (itemEl) {
          cellContentContainer.appendChild(itemEl);
      }
  });
}

/**
 * 주간 달력 셀 내의 할 일 DOM 요소를 생성합니다.
 * @param {object} todo - 할 일 객체
 * @returns {HTMLElement}
 */
function createWeeklyTodoElement(todo) {
  const item = document.createElement("div");
  item.className = "weekly-todo-item";
  item.style.backgroundColor = todo.color || '#6c757d'; // 기본 색상 적용
  item.dataset.todoId = todo.id;
  item.draggable = true; // 드래그 가능하도록 설정

  const textSpan = document.createElement("span");
  textSpan.className = 'todo-text-display'; // 클래스 추가
  textSpan.textContent = todo.text;

  const actionsDiv = document.createElement("div");
  actionsDiv.className = "todo-actions";
  const editBtn = document.createElement("button");
  editBtn.innerHTML = "✏️";
  editBtn.title = "Edit Todo";
  const deleteBtn = document.createElement("button");
  deleteBtn.innerHTML = "🗑️";
  deleteBtn.title = "Delete Todo";

  // 수정 기능 구현
  editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (item.querySelector('.todo-edit-input')) return; // 이미 편집 중이면 중복 실행 방지

      textSpan.style.display = 'none';
      const editInput = document.createElement('input');
      editInput.type = 'text';
      editInput.value = todo.text;
      editInput.className = 'todo-edit-input'; // 스타일링을 위해 클래스 부여 가능

      item.insertBefore(editInput, actionsDiv); // 버튼 앞에 삽입
      editInput.focus();
      editInput.select();

      const finishTodoEditing = () => {
        const newText = editInput.value.trim();
        // 입력 필드가 DOM에서 제거되었는지 확인 (blur와 Enter 동시 처리 방지)
        if (!editInput.parentElement) return;

        editInput.remove(); // 입력 필드 제거
        textSpan.style.display = ''; // 원래 텍스트 스팬 다시 표시 (내용은 dataChanged 후 리렌더링으로 업데이트됨)

        if (newText && newText !== todo.text) {
            data.updateCalendarTodoText(todo.id, newText); // dataManager 호출 -> dataChanged 이벤트 발생
        } else {
            // 변경 없으면 UI만 원복 (이미 위에서 textSpan 표시함)
        }
    };

      editInput.addEventListener('blur', () => {
          // 약간의 딜레이를 주어 'Enter'와의 충돌 방지 및 저장 로직 실행 보장
          setTimeout(finishTodoEditing, 50);
      });
      editInput.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
              ev.preventDefault(); // 폼 제출 방지 등
              finishTodoEditing();
          } else if (ev.key === 'Escape') {
              editInput.remove();
              textSpan.style.display = ''; // 편집 취소 시 UI 원복
              // editInput.remove(); // 편집 취소 시 입력 필드 제거
              // textSpan.style.display = 'inline'; // 원래 텍스트 다시 표시
              // -> eventBus에 의한 리렌더링이 없다면 이 코드가 필요
          }
      });
  });
  // --- 수정 기능 구현 끝 ---->>>

  // 삭제 기능
  deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm(`"${todo.text}" 할 일을 삭제하시겠습니까?`)) {
          data.deleteCalendarTodo(todo.id); // dataManager가 dataChanged 이벤트 발생시킴
      }
  });

  actionsDiv.append(editBtn, deleteBtn);
  item.append(textSpan, actionsDiv);

  // 드래그 앤 드롭 리스너
  item.addEventListener('dragstart', (e) => {
      e.stopPropagation(); // 부모 셀의 드래그 이벤트와 충돌 방지
      draggedTodoId = todo.id;
      draggedTodoOriginalDate = todo.date; // 원래 날짜 저장
      e.dataTransfer.setData('text/plain', todo.id);
      e.dataTransfer.setData('source', 'weekly-todo');
      e.dataTransfer.effectAllowed = 'move';
      item.classList.add('dragging'); // 스타일링을 위해
  });

  item.addEventListener('dragend', (e) => {
      item.classList.remove('dragging');
      // draggedTodoId = null;
      // draggedTodoOriginalDate = null;
  });

  return item;
}


function handleAddTodoInWeekly(e, dateStr) {
  e.stopPropagation();
  console.log(`WEEKLY_CALENDAR: handleAddTodoInWeekly called for date ${dateStr}. Event type: ${e.type}`); // <<< 로그 추가
  
  const text = prompt(`"${dateStr}"에 추가할 할 일 내용을 입력하세요:`);
  if (text && text.trim()) {
    data.addCalendarTodo({ date: dateStr, text: text.trim() });
  }
}
