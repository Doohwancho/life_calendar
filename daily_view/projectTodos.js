// projectTodos.js
const PROJECT_TODOS_STORAGE_KEY = 'projectTodos_v_fresh_start_1';

// --- 전역 변수 ---
let projects = []; // 더 이상 자체적으로 데이터를 관리하지 않고, init 시 주입받음
let onDataChangeCallback = () => {}; // (projectId, todoId, completed) 형식의 콜백

// --- 모듈 UI 상세 변수 ---
let projectListContainerElement = null; // #project-todo-app-container (CSS에서 .dv-left-pane-top)
let projectsScrollAreaElement = null;   // 프로젝트 아이템들을 담고 스크롤될 영역
let addProjectBtnElement = null;
let floatingDropdownElement = null;     // 투두 목록을 보여줄 단일 플로팅 div
let openProjectId = null;               // 현재 열려있는 프로젝트의 ID

// --- 드래그 상태 변수 ---
let draggedProjectInfo = null; // { id, element } - 프로젝트 드래그용
let draggedSubTodoInfo = null; // { projectId, todoId, element } - 서브 투두 드래그용

// --- 유틸리티 함수 ---
function generateId(prefix = 'id_') {
    return prefix + Math.random().toString(36).substr(2, 9);
}

// --- 프로젝트 데이터 관련 헬퍼 함수 ---
function findProjectById(projectId) {
    return projects.find(p => p.id === projectId);
}

// --- 데이터 변경 알림 ---
/**
 * 데이터에 변경이 있을 때마다 dailyViewHandler에 정의된 콜백을 호출합니다.
 * @param {object} changeInfo - 변경 정보를 담은 객체. 예: { type: 'UPDATE_PROJECT', payload: project }
 */
function notifyDataChange(changeInfo) {
    onDataChangeCallback(changeInfo);
}

// --- 핵심 DOM 렌더링 함수 ---

// 프로젝트 목록 전체 (스크롤 영역 내부) 렌더링
function renderProjectList() {
    if (!projectsScrollAreaElement) return;

    const currentScroll = projectsScrollAreaElement.scrollTop; // 스크롤 위치 기억
    projectsScrollAreaElement.innerHTML = ''; // 기존 내용 지우기

    projects.forEach(project => {
        const projectEl = createProjectElement(project);
        projectsScrollAreaElement.appendChild(projectEl);
    });

    // "+ New Project List" 버튼 추가 (항상 마지막에)
    if (addProjectBtnElement) { // 버튼이 init에서 생성되었는지 확인
        projectsScrollAreaElement.appendChild(addProjectBtnElement);
    }
    projectsScrollAreaElement.scrollTop = currentScroll; // 스크롤 위치 복원
}

// 개별 프로젝트 아이템(헤더) DOM 생성
function createProjectElement(project) {
    const wrapper = document.createElement('div');
    // << 수정됨: dv- 접두사 추가
    wrapper.className = `dv-project-item-wrapper ${project.id === openProjectId ? 'open' : ''}`;
    wrapper.dataset.projectId = project.id;
    // wrapper.draggable = true;

    const header = document.createElement('div');
    header.className = 'dv-project-header'; // << 수정됨

    const arrow = document.createElement('span');
    arrow.className = 'dv-project-arrow'; // << 수정됨
    arrow.textContent = '▶';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'dv-project-name'; // << 수정됨
    nameSpan.textContent = project.name || 'Unnamed Project';
    nameSpan.title = project.name || 'Unnamed Project';
    nameSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        editProjectName(project, nameSpan);
    });

    const completionSpan = document.createElement('span');
    completionSpan.className = 'dv-project-completion'; // << 수정됨
    updateProjectCompletionDisplay(project, completionSpan);


    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'dv-project-controls'; // << 수정됨

    const editBtn = document.createElement('button');
    // << 수정됨: dv- 접두사 추가
    editBtn.className = 'dv-project-action-btn dv-project-edit-btn';
    editBtn.innerHTML = '✏️';
    editBtn.title = 'Rename Project';
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editProjectName(project, nameSpan);
    });

    // const deleteBtn = document.createElement('button');
    // // << 수정됨: dv- 접두사 추가
    // deleteBtn.className = 'dv-project-action-btn dv-project-delete-btn';
    // deleteBtn.innerHTML = '🗑️';
    // deleteBtn.title = 'Delete Project';
    // deleteBtn.addEventListener('click', (e) => {
    //     e.stopPropagation();
    //     if (confirm(`Are you sure you want to delete project "${project.name || 'this project'}"?`)) {
    //         if (project.id === openProjectId) {
    //             hideFloatingDropdown();
    //         }
    //         projects = projects.filter(p => p.id !== project.id);
    //         notifyDataChange();
    //         renderProjectList(); // Re-render the whole list
    //     }
    // });

    controlsDiv.appendChild(editBtn);
    // controlsDiv.appendChild(deleteBtn);

    header.appendChild(arrow);
    header.appendChild(nameSpan);
    header.appendChild(completionSpan);
    header.appendChild(controlsDiv);
    wrapper.appendChild(header);

    header.addEventListener('click', () => {
        handleProjectHeaderClick(project.id, header, wrapper);
    });

    // Project Drag & Drop
    wrapper.addEventListener('dragstart', (e) => handleProjectDragStart(e, project, wrapper));
    wrapper.addEventListener('dragend', () => handleProjectDragEnd(wrapper));

    return wrapper;
}

function editProjectName(project, nameSpanElement) {
    if (project.id === openProjectId) {
        hideFloatingDropdown();
    }
    const currentName = project.name;
    const newName = prompt("Enter new project name:", currentName);
    if (newName !== null && newName.trim() !== "") {
        project.name = newName.trim();
        nameSpanElement.textContent = project.name;
        nameSpanElement.title = project.name; // title도 업데이트
        notifyDataChange({ type: 'UPDATE_PROJECT', payload: { project } });
    } else if (newName !== null && newName.trim() === "" && currentName !== "Unnamed Project") {
        project.name = "Unnamed Project";
        nameSpanElement.textContent = project.name;
        nameSpanElement.title = project.name;
        notifyDataChange({ type: 'UPDATE_PROJECT', payload: { project } });
    }
}


// 플로팅 드롭다운에 특정 프로젝트의 투두 목록 렌더링
function renderTodosInDropdown(project) {
    if (!floatingDropdownElement || !project) {
        console.error("renderTodosInDropdown: Invalid project or floating container.", project, floatingDropdownElement);
        return;
    }
    floatingDropdownElement.innerHTML = ''; // 이전 내용 지우기

    const todoListUl = document.createElement('ul');
    todoListUl.className = 'dv-sub-todo-list'; // << 수정됨
    todoListUl.dataset.projectId = project.id;

    if (project.todos && project.todos.length > 0) {
        project.todos.forEach((todo, index) => {
            const todoEl = createSubTodoElement(todo, project.id, index);
            todoListUl.appendChild(todoEl);
        });
    }
    floatingDropdownElement.appendChild(todoListUl);

    const addTaskBtn = document.createElement('button');
    addTaskBtn.className = 'dv-add-sub-task-btn'; // << 수정됨
    addTaskBtn.textContent = '+ Add Task';
    addTaskBtn.addEventListener('click', () => {
        const newTodo = { id: generateId('todo_'), text: 'New Task', completed: false };
        project.todos.push(newTodo);
        notifyDataChange({ type: 'UPDATE_PROJECT', payload: { project } });
        renderTodosInDropdown(project);

        // << 수정됨: 쿼리 셀렉터에 dv- 접두사 추가
        const projectWrapper = projectsScrollAreaElement.querySelector(`.dv-project-item-wrapper[data-project-id="${project.id}"]`);
        if (projectWrapper) {
            updateProjectCompletionDisplay(project, projectWrapper.querySelector('.dv-project-completion'));
        }

        setTimeout(() => {
            // << 수정됨: 쿼리 셀렉터에 dv- 접두사 추가
            const newTodoListUl = floatingDropdownElement.querySelector('.dv-sub-todo-list');
            if (!newTodoListUl) return;

            const newTodoElement = newTodoListUl.querySelector('.dv-sub-todo-item:last-of-type');
            if (newTodoElement) {
                const textSpanToEdit = newTodoElement.querySelector('.dv-sub-todo-text');
                const deleteBtnOfNew = newTodoElement.querySelector('.dv-sub-todo-delete-btn');
                const todoObject = project.todos[project.todos.length - 1];
                
                if (textSpanToEdit && deleteBtnOfNew && todoObject) {
                    makeTodoTextEditable(todoObject, textSpanToEdit, deleteBtnOfNew);
                }
            }
        }, 0);
    });
    floatingDropdownElement.appendChild(addTaskBtn);

    todoListUl.addEventListener('dragover', (e) => handleSubTodoDragOver(e, project.id));
    todoListUl.addEventListener('drop', (e) => handleSubTodoDrop(e, project.id, todoListUl));
}

// 개별 서브 투두 아이템 DOM 생성
function createSubTodoElement(todo, projectId, index) {
    const li = document.createElement('li');
    // << 수정됨: dv- 접두사 추가
    li.className = `dv-sub-todo-item ${todo.completed ? 'completed' : ''}`;
    li.dataset.todoId = todo.id;
    // li.draggable = true; //드래그 기능은 일단 비활성화 

    const numberSpan = document.createElement('span');
    numberSpan.className = 'dv-sub-todo-number'; // << 수정됨
    numberSpan.textContent = `${index + 1}. `;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'dv-sub-todo-checkbox'; // << 수정됨
    checkbox.checked = todo.completed;
    checkbox.addEventListener('change', () => {
        todo.completed = checkbox.checked;
        li.classList.toggle('completed', todo.completed);
        if(textSpan) textSpan.classList.toggle('completed', todo.completed);
        const project = findProjectById(projectId);
        // << 수정됨: 쿼리 셀렉터에 dv- 접두사 추가
        const projectWrapper = projectsScrollAreaElement.querySelector(`.dv-project-item-wrapper[data-project-id="${projectId}"]`);
        if (project && projectWrapper) {
            updateProjectCompletionDisplay(project, projectWrapper.querySelector('.dv-project-completion'));
        }
        notifyDataChange({ 
            type: 'TOGGLE_TODO', 
            payload: { projectId, todoId: todo.id, completed: checkbox.checked }
        });
        li.classList.toggle('completed', checkbox.checked);
    });

    const textSpan = document.createElement('span');
    textSpan.className = 'dv-sub-todo-text'; // << 수정됨
    textSpan.textContent = todo.text || 'New Task';
    if (todo.completed) textSpan.classList.add('completed');

    const deleteBtn = document.createElement('button');
    // << 수정됨: dv- 접두사 추가
    deleteBtn.className = 'dv-sub-todo-delete-btn dv-project-action-btn';
    deleteBtn.innerHTML = '✕';
    deleteBtn.title = 'Delete Task';
    deleteBtn.addEventListener('click', () => {
        const project = findProjectById(projectId);
        if (!project) return;
        project.todos = project.todos.filter(t => t.id !== todo.id);
        notifyDataChange({ type: 'UPDATE_PROJECT', payload: { project } });
        renderTodosInDropdown(project);
        // << 수정됨: 쿼리 셀렉터에 dv- 접두사 추가
        const projectWrapper = projectsScrollAreaElement.querySelector(`.dv-project-item-wrapper[data-project-id="${projectId}"]`);
        if (projectWrapper) {
            updateProjectCompletionDisplay(project, projectWrapper.querySelector('.dv-project-completion'));
        }
    });

    textSpan.addEventListener('dblclick', () => {
        makeTodoTextEditable(todo, textSpan, deleteBtn);
    });

    li.appendChild(numberSpan);
    li.appendChild(checkbox);
    li.appendChild(textSpan);
    li.appendChild(deleteBtn);

    li.addEventListener('dragstart', (e) => handleSubTodoDragStart(e, projectId, todo.id, li));
    li.addEventListener('dragend', () => handleSubTodoDragEnd(li));

    return li;
}

function makeTodoTextEditable(todo, textSpanElement, nextSiblingForInput) {
    if (textSpanElement.style.display === 'none') return;

    textSpanElement.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'dv-sub-todo-text-edit'; // << 수정됨
    input.value = todo.text;

    textSpanElement.parentElement.insertBefore(input, nextSiblingForInput);
    input.focus();
    input.select();

    const saveTodoText = () => {
        const newText = input.value.trim();
        todo.text = newText === "" ? (todo.text || "New Task") : newText;
        textSpanElement.textContent = todo.text;
        textSpanElement.style.display = '';
        if (input.parentElement) {
            input.parentElement.removeChild(input);
        }
        notifyDataChange({ type: 'UPDATE_PROJECT' }); // 텍스트만 변경되어도 전체 프로젝트를 dirty 마킹
    };
    input.addEventListener('blur', saveTodoText);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        } else if (e.key === 'Escape'){
            input.value = todo.text;
            input.blur();
        }
    });
}

// --- 드롭다운 위치 및 표시/숨김 ---
function handleProjectHeaderClick(projectId, headerElement, wrapperElement) {
    const project = findProjectById(projectId);
    if (!project) {
        console.error("Project not found for ID:", projectId);
        return;
    }

    if (openProjectId === projectId) {
        hideFloatingDropdown();
    } else {
        if (openProjectId) {
            // << 수정됨: 쿼리 셀렉터에 dv- 접두사 추가
            const previouslyOpenWrapper = projectsScrollAreaElement.querySelector(`.dv-project-item-wrapper[data-project-id="${openProjectId}"]`);
            previouslyOpenWrapper?.classList.remove('open');
        }
        openProjectId = projectId;
        wrapperElement.classList.add('open');
        renderTodosInDropdown(project);
        positionAndShowDropdown(headerElement);
    }
}

function positionAndShowDropdown(headerElement) {
    if (!floatingDropdownElement || !headerElement || !projectListContainerElement) return;
    const headerRect = headerElement.getBoundingClientRect();
    floatingDropdownElement.style.top = `${headerRect.bottom}px`;
    floatingDropdownElement.style.left = `${headerRect.left}px`;
    floatingDropdownElement.style.width = `${headerRect.width}px`;
    floatingDropdownElement.style.display = 'block';
}

function hideFloatingDropdown() {
    if (floatingDropdownElement) {
        floatingDropdownElement.style.display = 'none';
        floatingDropdownElement.innerHTML = '';
    }
    if (openProjectId && projectsScrollAreaElement) {
        // << 수정됨: 쿼리 셀렉터에 dv- 접두사 추가
        const openWrapper = projectsScrollAreaElement.querySelector(`.dv-project-item-wrapper[data-project-id="${openProjectId}"]`);
        openWrapper?.classList.remove('open');
    }
    openProjectId = null;
}

// --- 완료 상태 업데이트 ---
function updateProjectCompletionDisplay(project, completionSpanElement) {
    if (!project || !completionSpanElement) return;
    const totalTodos = project.todos ? project.todos.length : 0;
    const completedTodos = project.todos ? project.todos.filter(t => t.completed).length : 0;
    const percentage = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
    completionSpanElement.textContent = `${completedTodos}/${totalTodos} (${percentage}%)`;
}


// --- 드래그 앤 드롭 핸들러 ---
// Project Dragging
function handleProjectDragStart(event, project, projectElement) {
    // << 수정됨: dv- 접두사 추가
    if (event.target.matches('input, button, [contenteditable=true], .dv-project-action-btn')) {
        event.preventDefault(); return;
    }
    event.stopPropagation();
    draggedProjectInfo = { id: project.id, element: projectElement };
    event.dataTransfer.setData('text/plain', project.id);
    event.dataTransfer.effectAllowed = 'move';
    projectElement.classList.add('dragging-project');
    if (project.id === openProjectId) {
        hideFloatingDropdown();
    }
}

function handleProjectDragEnd(projectElement) {
    if (projectElement) projectElement.classList.remove('dragging-project');
    projectsScrollAreaElement?.querySelectorAll('.drag-over-project-top, .drag-over-project-bottom').forEach(el => {
        el.classList.remove('drag-over-project-top', 'drag-over-project-bottom');
    });
    draggedProjectInfo = null;
}

function handleProjectsScrollAreaDragOver(event) {
    event.preventDefault();
    if (!draggedProjectInfo) return;
    event.dataTransfer.dropEffect = 'move';

    projectsScrollAreaElement.querySelectorAll('.drag-over-project-top, .drag-over-project-bottom').forEach(el => {
        el.classList.remove('drag-over-project-top', 'drag-over-project-bottom');
    });

    const afterElement = getDragAfterProject(event.clientY);
    const draggingElement = draggedProjectInfo.element;

    if (afterElement && afterElement !== draggingElement) {
        const rect = afterElement.getBoundingClientRect();
        if (event.clientY < rect.top + rect.height / 2) {
            afterElement.classList.add('drag-over-project-top');
        } else {
            afterElement.classList.add('drag-over-project-bottom');
        }
    } else if (!afterElement && projects.length > 0) {
        // << 수정됨: 쿼리 셀렉터에 dv- 접두사 추가
        const lastVisibleProjectElement = projectsScrollAreaElement.querySelector('.dv-project-item-wrapper:not(.dragging-project):last-of-type');
        if (lastVisibleProjectElement && lastVisibleProjectElement !== draggingElement) {
            lastVisibleProjectElement.classList.add('drag-over-project-bottom');
        }
    }
}

function handleProjectsScrollAreaDrop(event) {
    event.preventDefault();
    if (!draggedProjectInfo) return;

    projectsScrollAreaElement.querySelectorAll('.drag-over-project-top, .drag-over-project-bottom').forEach(el => {
        el.classList.remove('drag-over-project-top', 'drag-over-project-bottom');
    });

    const draggedId = draggedProjectInfo.id;
    const oldProjectIndex = projects.findIndex(p => p.id === draggedId);
    if (oldProjectIndex === -1) { draggedProjectInfo = null; return; }

    const [movedProjectData] = projects.splice(oldProjectIndex, 1);
    const afterElement = getDragAfterProject(event.clientY);

    if (afterElement) {
        const afterElementId = afterElement.dataset.projectId;
        let targetIndexInArray = projects.findIndex(p => p.id === afterElementId);
        if (targetIndexInArray === -1) {
            projects.push(movedProjectData);
        } else {
            const rect = afterElement.getBoundingClientRect();
            if (event.clientY < rect.top + rect.height / 2) {
                projects.splice(targetIndexInArray, 0, movedProjectData);
            } else {
                projects.splice(targetIndexInArray + 1, 0, movedProjectData);
            }
        }
    } else {
        projects.push(movedProjectData);
    }

    draggedProjectInfo = null;
    notifyDataChange();
    renderProjectList();
}

function getDragAfterProject(y) {
    // << 수정됨: 쿼리 셀렉터에 dv- 접두사 추가
    const projectElements = [...projectsScrollAreaElement.querySelectorAll('.dv-project-item-wrapper:not(.dragging-project)')];
    return projectElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        }
        return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}


// Sub-Todo Dragging
function handleSubTodoDragStart(event, projectId, todoId, todoElement) {
    event.stopPropagation();
    draggedSubTodoInfo = { projectId, todoId, element: todoElement };
    event.dataTransfer.setData('text/plain', todoId);
    event.dataTransfer.effectAllowed = 'move';
    todoElement.classList.add('dragging-sub-todo');
}

function handleSubTodoDragEnd(todoElement) {
    if (todoElement) todoElement.classList.remove('dragging-sub-todo');
}

function handleSubTodoDragOver(event, targetProjectId) {
    event.preventDefault();
    if (!draggedSubTodoInfo || draggedSubTodoInfo.projectId !== targetProjectId) return;
    event.dataTransfer.dropEffect = 'move';

    const ul = event.currentTarget;
    const afterElement = getDragAfterSubTodo(ul, event.clientY);
    const draggingElement = draggedSubTodoInfo.element;
    
    // << 수정됨: 쿼리 셀렉터에 dv- 접두사 추가
    ul.querySelectorAll('.dv-sub-todo-item').forEach(item => {
        item.classList.remove('drag-over-sub-todo-top', 'drag-over-sub-todo-bottom');
    });

    if (afterElement && afterElement !== draggingElement) {
        const rect = afterElement.getBoundingClientRect();
        if (event.clientY < rect.top + rect.height / 2) {
            afterElement.classList.add('drag-over-sub-todo-top');
        } else {
            afterElement.classList.add('drag-over-sub-todo-bottom');
        }
    } else if (!afterElement && draggingElement.parentElement === ul) {
        // << 수정됨: 쿼리 셀렉터에 dv- 접두사 추가
        const lastItem = ul.querySelector('.dv-sub-todo-item:not(.dragging-sub-todo):last-child');
        if(lastItem && lastItem !== draggingElement) lastItem.classList.add('drag-over-sub-todo-bottom');
    }
    
    const actualDraggingElement = draggedSubTodoInfo.element;
    if (actualDraggingElement.parentElement === ul) {
        if (afterElement) {
            if (afterElement !== actualDraggingElement) ul.insertBefore(actualDraggingElement, afterElement);
        } else {
            ul.appendChild(actualDraggingElement);
        }
    }
}

function handleSubTodoDrop(event, targetProjectId, todoListUl) {
    event.preventDefault();
    // << 수정됨: 쿼리 셀렉터에 dv- 접두사 추가
    todoListUl.querySelectorAll('.dv-sub-todo-item').forEach(item => {
        item.classList.remove('drag-over-sub-todo-top', 'drag-over-sub-todo-bottom');
    });
    if (!draggedSubTodoInfo || draggedSubTodoInfo.projectId !== targetProjectId) {
        draggedSubTodoInfo = null; return;
    }

    const project = findProjectById(targetProjectId);
    if (!project) { draggedSubTodoInfo = null; return; }

    const todoId = draggedSubTodoInfo.todoId;
    const oldArrayIndex = project.todos.findIndex(t => t.id === todoId);
    if (oldArrayIndex === -1) { draggedSubTodoInfo = null; return; }

    const [movedTodo] = project.todos.splice(oldArrayIndex, 1);
    const newDomIndex = Array.from(todoListUl.children).indexOf(draggedSubTodoInfo.element);

    if (newDomIndex === -1) {
        project.todos.push(movedTodo);
    } else {
        project.todos.splice(newDomIndex, 0, movedTodo);
    }

    draggedSubTodoInfo = null;
    notifyDataChange();
    renderTodosInDropdown(project);
    // << 수정됨: 쿼리 셀렉터에 dv- 접두사 추가
    const projectWrapper = projectsScrollAreaElement.querySelector(`.dv-project-item-wrapper[data-project-id="${project.id}"]`);
    if (projectWrapper) {
        updateProjectCompletionDisplay(project, projectWrapper.querySelector('.dv-project-completion'));
    }
}


function getDragAfterSubTodo(ulElement, y) {
    // << 수정됨: 쿼리 셀렉터에 dv- 접두사 추가
    const todoElements = [...ulElement.querySelectorAll('.dv-sub-todo-item:not(.dragging-sub-todo)')];
    return todoElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        }
        return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}


// --- 초기화 ---
export function initProjectTodoApp(containerSelector, initialExternalData, dataChangeCb) {
    projectListContainerElement = document.querySelector(containerSelector);
    if (!projectListContainerElement) {
        console.error("Project todo app container not found:", containerSelector);
        return;
    }
    onDataChangeCallback = dataChangeCb || (() => {});

    // 1. 스크롤 영역 생성
    if (!projectListContainerElement.querySelector('.dv-projects-scroll-area')) {
        projectsScrollAreaElement = document.createElement('div');
        projectsScrollAreaElement.className = 'dv-projects-scroll-area';
        projectListContainerElement.innerHTML = ''; // 기존 내용 초기화
        projectListContainerElement.appendChild(projectsScrollAreaElement);
    } else {
        projectsScrollAreaElement = projectListContainerElement.querySelector('.dv-projects-scroll-area');
    }

    // 2. 플로팅 드롭다운 생성 (최초 한 번만)
    if (!document.querySelector('.dv-floating-project-dropdown')) {
        floatingDropdownElement = document.createElement('div');
        floatingDropdownElement.className = 'dv-sub-todo-list-container dv-floating-project-dropdown';
        floatingDropdownElement.style.display = 'none';
        floatingDropdownElement.style.position = 'fixed';
        floatingDropdownElement.style.zIndex = '1001';
        document.body.appendChild(floatingDropdownElement);
    } else {
        floatingDropdownElement = document.querySelector('.dv-floating-project-dropdown');
    }

    // 3. "Add Project" 버튼 생성
    addProjectBtnElement = document.createElement('button');
    addProjectBtnElement.className = 'dv-add-project-btn';
    addProjectBtnElement.textContent = '+ New Project List';
    addProjectBtnElement.addEventListener('click', () => {
        // 이 버튼은 이제 dataManager의 addLabel을 직접 호출하는 것이 더 명확합니다.
        // mainViewHandler를 통해 콜백을 넘겨받거나, data 모듈을 직접 import해서 사용해야 합니다.
        // 현재 구조에서는 data 모듈 참조가 없으므로 alert를 유지합니다.
        alert("프로젝트 추가는 Main Page의 프로젝트 관리 메뉴에서 진행해주세요.");
    });

    // 4. 전역 이벤트 리스너 설정
    // document.addEventListener('click', (event) => {
    //     if (!floatingDropdownElement || floatingDropdownElement.style.display === 'none' || !projectsScrollAreaElement) return;
    //     const isClickInsideDropdown = floatingDropdownElement.contains(event.target);
    //     // << 수정됨: 쿼리 셀렉터에 dv- 접두사 추가
    //     const openProjectHeaderElement = openProjectId ? projectsScrollAreaElement.querySelector(`.dv-project-item-wrapper[data-project-id="${openProjectId}"] .dv-project-header`) : null;
    //     const isClickOnOpenHeader = openProjectHeaderElement ? openProjectHeaderElement.contains(event.target) : false;
    //     // << 수정됨: dv- 접두사 추가
    //     const isClickOnEditInput = event.target.matches('.dv-project-name-input, .dv-sub-todo-text-edit');
    //     if (!isClickInsideDropdown && !isClickOnOpenHeader && !isClickOnEditInput) {
    //         hideFloatingDropdown();
    //     }
    // }, true);
    document.removeEventListener('click', hideDropdownOnOutsideClick, true); 
    document.addEventListener('click', hideDropdownOnOutsideClick, true);

    
    projectsScrollAreaElement.addEventListener('scroll', () => { /* ... */ });
    projectsScrollAreaElement.addEventListener('dragover', handleProjectsScrollAreaDragOver);
    projectsScrollAreaElement.addEventListener('drop', handleProjectsScrollAreaDrop);
    projectsScrollAreaElement.addEventListener('dragleave', (e) => { /* ... */ });
    
    setProjectTodoDataAndRender(initialExternalData);
}

function hideDropdownOnOutsideClick(event) {
    if (!floatingDropdownElement || floatingDropdownElement.style.display === 'none' || !projectsScrollAreaElement) return;
    const isClickInsideDropdown = floatingDropdownElement.contains(event.target);
    const openProjectHeaderElement = openProjectId ? projectsScrollAreaElement.querySelector(`.dv-project-item-wrapper[data-project-id="${openProjectId}"] .dv-project-header`) : null;
    const isClickOnOpenHeader = openProjectHeaderElement ? openProjectHeaderElement.contains(event.target) : false;
    const isClickOnEditInput = event.target.matches('.dv-project-name-input, .dv-sub-todo-text-edit');

    if (!isClickInsideDropdown && !isClickOnOpenHeader && !isClickOnEditInput) {
        hideFloatingDropdown();
    }
}


// --- 외부 인터페이스 (Export) ---
export function getProjectTodoData() {
    // 이 함수는 이제 dataManager에 직접 데이터를 저장하므로 사실상 불필요해짐.
    // 하지만 handleDataChange에서 호출하므로 빈 배열을 반환하도록 유지.
    return [];
}

export function setProjectTodoDataAndRender(newDataArray) {
    projects = Array.isArray(newDataArray) ? newDataArray : [];
    
    openProjectId = null;
    hideFloatingDropdown();
    renderProjectList();
}