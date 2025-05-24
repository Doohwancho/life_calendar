# Yearly Calendar Project - Development Document

**Version:** 0.3.0
**Date:** 2025-05-21
**Project Goal:** A full-screen, interactive yearly calendar application for 2025 with integrated weekly view and backlog/todo management to visualize and manage long-term project schedules and daily tasks. Features include colored labels, date range highlighting, save/load functionality, and dynamic data synchronization between views.

---

## 1. Core Features Overview

### 1.1. Main Application Layout
* **Grid-Based Structure:** The application interface will be divided into a main grid:
    * **Toolbar:** Top section for controls (label management, file operations, calendar navigation controls).
    * **Yearly Calendar View:** Main central area.
    * **Weekly Calendar View:** Positioned below the Yearly Calendar.
    * **Backlog (Todo List) Panel:** Positioned on the right side.
* **Full-Screen Utilization:** The application will occupy the entire browser viewport.

### 1.2. Yearly Calendar Module
* **Display:** Annual view with months as rows and days as columns. Default year can be current or configurable (e.g., 2025).
    * **Navigation:** Buttons to navigate to the previous or next year.
    * **Today's Date Highlight:** The cell corresponding to the current date will be visually highlighted.
    * **Current Week Outline:** Cells belonging to the current week (Monday-Sunday) will have a distinct outline.
    * **Month Names:** Displayed horizontally in Korean (e.g., "1월", "2월").
* **Project Event Highlighting:**
    * Labels (color + name) can be created and selected.
    * Dragging on calendar cells with a selected label creates a "project event".
    * Project events are displayed as **thin horizontal bars** within day cells.
    * Multiple project bars on the same day will **stack vertically** without overlapping.
    * Highlighting logic during drag operations will correctly cover all cells across multiple rows/months.
    * Prevent creation of duplicate project events for the same label and exact same date range.
* **Project Event Manipulation:**
    * **Direct Editing & Deleting:** Rendered project bars on the Yearly Calendar can be directly manipulated (e.g., selected, resized for date changes, deleted).
* **Todo Integration:** Todos dragged from the Backlog will appear as distinct "small boxes" within day cells.
* **Display Priority:** If a cell has both projects and todos and space is limited, project bars will be prioritized for display.

### 1.3. Weekly Calendar Module
* **Display:** 7 columns (Monday to Sunday).
    * **Navigation:** Buttons to navigate to the previous or next week. An input field to jump to a specific week or date.
    * **Today's Date Highlight & Quick Input:** The cell corresponding to the current date will be visually highlighted and will feature a dedicated UI space for a quick text note.
* **Synchronization:**
    * Project events from the Yearly Calendar spanning dates in the displayed week will appear in the corresponding weekly cells.
    * Todos (from Backlog or added directly) on dates in the displayed week will appear.
* **Direct Todo Management:**
    * Todos can be added directly to weekly cells.
    * Hovering over a todo in a weekly cell allows for update/delete actions.
    * Cells with many todos will be scrollable (`scroll-y`).
* **Backlog Integration:** Todos can be dragged from the Backlog panel and dropped onto weekly calendar cells, which will also reflect on the Yearly Calendar and update the main data.

### 1.4. Backlog (Todo List) Module
* **Display:** A vertical panel on the right side of the screen.
* **Todo Management:**
    * **Add Todo:** "+" button to add new todo items.
    * **Update/Delete:** Hovering over a todo item reveals options to update its text or delete it.
    * **Priority/Color:** Each todo item will have a settable priority (0-3), which determines its display color:
        * 0: Blue
        * 1: Red
        * 2: Orange
        * 3: Yellow
* **Drag and Drop:**
    * Todos can be dragged from the Backlog panel and dropped onto:
        * The Yearly Calendar (appears as a "small box" on the target date).
        * The Weekly Calendar (appears in the target date cell).
    * Upon successful drop, the todo is removed from the Backlog list and added to the calendar data.

### 1.5. Label Management (For Project Events)
* **Creation & Display:** As per v0.2.0 (Toolbar area, "+" button, name/color input).
* **Selection for Drawing:** Clicking a label selects it for creating project event highlights.
* **Draggable Reordering:** Labels in the toolbar can be reordered via drag and drop.

### 1.6. Data Persistence (Save/Load)
* **Functionality:** Save and Load buttons, `Cmd/Ctrl + S` shortcut for saving.
* **File Format:** `.json` file containing all relevant data (labels, project events, backlog todos, calendar cell todos). (See Section 7 for updated JSON structure).

### 1.7. User Interface & User Experience (UI/UX)
* Intuitive controls and clear visual feedback for all actions.
* Efficient DOM manipulation for smooth interactions.
* Data safety warnings (e.g., overwrite confirmation on load).

---

## 2. Technical Stack

* **Frontend:**
    * **HTML5:** Semantic structure for the new grid layout and components.
    * **CSS3:** Styling for all views, Flexbox/Grid for layout, visual distinction for new item types and states.
    * **JavaScript (Vanilla JS):**
        * Dynamic calendar generation and updates for both Yearly and Weekly views.
        * DOM manipulation and event handling.
        * Logic for label management, project event highlighting, backlog and todo management.
        * Drag and drop interactions between components.
        * Save/Load functionality.
        * **Modularity:** JavaScript code will be structured into modules (e.g., `yearlyCalendar.js`, `weeklyCalendar.js`, `backlog.js`, `dataManager.js`, `uiUtils.js`) imported into a main `script.js` or `app.js` to manage complexity.

---
### 3. Overall Page Layout (Conceptual)
* A main CSS Grid will define the primary areas: Toolbar, Yearly Calendar, Weekly Calendar, Backlog.
```
* `app-container` (Flex column)
    * `toolbar-container` 
        <div class="calendar-navigation">
            <div class="yearly-nav">
                <button id="prevYearBtn">&lt; Prev Year</button>
                <span id="currentYearDisplay">2025</span>
                <button id="nextYearBtn">Next Year &gt;</button>
            </div>
            <div class="weekly-nav">
                <button id="prevWeekBtn">&lt; Prev Week</button>
                <input type="date" id="weekJumpInput" title="Jump to week containing this date">
                <span id="currentWeekDisplay">May 19 - May 25</span> <button id="nextWeekBtn">Next Week &gt;</button>
            </div>
        </div>
        * `main-content-grid` (CSS Grid)
        * `yearly-calendar-area`
        * `weekly-calendar-area`
        * `backlog-panel-area`
```
---

## 4. Yearly Calendar Module Details

### 4.1. Features (Recap & Enhancements)
* Korean month names (horizontal: 1월, 2월 ...).
* Corrected highlight offset bug (A.3.2.1.2).
* Corrected multi-row drag highlighting bug (A.3.2.1.3).
* Prevention of identical project event creation for the same label and date range.
* Today's date cell highlighted.
* Current week's cells outlined.
* Project highlights are thin, stackable bars within cells.
* Todos from backlog appear as small boxes, distinct from project bars.
* Display priority: projects over todos if cell space is limited.
* Navigation: Ability to switch to the previous or next year's view.
* Event Manipulation: Direct editing (e.g., resizing start/end dates) and deletion of project bars.

### 4.2. Data Representation within Day Cells
* Each day cell (`.day-cell`) will not directly store data in its DOM attributes extensively. Instead, it acts as a rendering target.
* The central `events` array defines project ranges.
* A new `calendarCellTodos` array stores todos placed on specific dates:
    `calendarCellTodos = [{ id, date, text, originalBacklogId (optional), color, type: 'todo' }]`
* Rendering logic for a given `data-date` will:
    1.  Iterate through `events` to find projects covering this date. For each, add a project bar to the cell's internal layout.
    2.  Iterate through `calendarCellTodos` for items on this date. For each, add a todo box.
    3.  Manage vertical stacking and Y-offsets for these items within the cell.

### 4.3. Detailed Logic
* **Calendar Generation (`renderYearlyCalendar(yearToDisplay)`):**
    * The `YEAR` constant becomes a state variable like `currentDisplayYear`. This function now takes `yearToDisplay` as a parameter.
    * Month headers: Use an array `["1월", "2월", ..., "12월"]`.
    * Day cells: Add classes for "today" and "current-week-day" based on current date relative to `yearToDisplay`.
    * **Navigation Logic:**
        * "Previous Year" / "Next Year" buttons in the toolbar will decrement/increment `currentDisplayYear` and call `renderYearlyCalendar(currentDisplayYear)`.
        * The displayed year in the toolbar should be updated.
* **Project Event Highlighting:** (기존 내용 유지, 단, 모든 날짜 계산 시 `currentDisplayYear` 사용)
* **Editing and Deleting Project Events (New Sub-section):**
    * **Selection:** Clicking on a rendered project bar (within a day cell) will select it. Selected bars should be visually distinct. Multiple segments of the same event (if rendered as such across days) should all indicate selection.
    * **Interaction UI:**
        * **Deletion:** A delete icon/button appears on/near the selected bar, or via a context menu. Clicking it removes the event from the `events` array and triggers re-rendering.
        * **Resizing (Date Change):** Selected bars (especially their start/end segments) could display resize handles. Dragging these handles would modify the `startDate` or `endDate` of the event. This requires:
            * Identifying which bar segment is clicked (it belongs to an event in the `events` array).
            * Mouse event handling (`mousedown` on handle, `mousemove` to track new date, `mouseup` to finalize).
            * Updating the corresponding event object in the `events` array.
            * Re-rendering the Yearly Calendar (and potentially Weekly Calendar if affected).
        * **Changing Label (Future/Optional for this iteration):** Could be via a context menu or a properties panel for the selected event, allowing to choose a different label from the `labels` array.
    * **Implementation Notes:** Each rendered bar segment needs to be identifiable (e.g., `data-event-id`). Event listeners will be attached to these segments.
* **Rendering Cell Content (`renderDayCellContent(date)`):**
    * This new function will be called for each day cell that needs updating.
    * Clears previous bars/todos from the cell.
    * Gets all projects from `events` that span `date`.
    * Gets all todos from `calendarCellTodos` for `date`.
    * Renders project bars (thin, stacked).
    * Renders todo boxes (distinct style, stacked).
    * Implements display priority if space is tight (projects first).

### 4.4. HTML Structure (Conceptual Changes)
* `.month-header`: Content changed to Korean month names.
* `.day-cell`: Might contain multiple child `div`s for stacked project bars and todo boxes.
```html
<div class="day-cell" data-date="2025-01-15">
        <div class="project-bar" data-event-id="evt1" style="background-color: red; top: 0px; height: 8px;">Project A</div>
        <div class="project-bar" data-event-id="evt2" style="background-color: blue; top: 9px; height: 8px;">Project B</div>
        <div class="todo-box" style="background-color: orange; top: 18px;">Todo 1 Text</div>
    </div>
```
### 4.5. CSS Styling Notes
* `.month-header`: Update for horizontal Korean text.
* `.day-cell.today`: Specific style for today's date.
* `.day-cell.current-week`: Outline style for current week days.
* `.project-bar`: New style for thin, horizontal bars within cells.
    * `.project-bar.selected`: Style for selected project bars.
    * `.resize-handle`: Style for resize handles on project bars.
* `.todo-box-in-calendar`: New style for todos appearing in calendar cells.
* CSS for stacking elements within a day cell might use `position: absolute` relative to the cell.
* Styles for navigation buttons/inputs in the toolbar.

---
## 5. Weekly Calendar Module Details

### 5.1. Features
* 7-column layout (Mon-Sun).
* Navigation: Buttons to go to the previous/next week; an input field (e.g., date picker) to jump to a week containing a specific date.
* "Today" highlight.
* Today's Quick Note Input: A dedicated text input area within the "today" cell of the weekly view.
* Displays project events and todos relevant to the shown week, synced from main data.
* Allows direct addition/management of todos within its cells.
* Todos dragged from backlog can be dropped here.

### 5.2. Detailed Logic
* **State:** Maintain a `currentWeeklyViewStartDate` (e.g., the Monday of the week being viewed).
* **Rendering (`renderWeeklyCalendar(weekStartDateToDisplay)`):**
    * This function already accepts `weekStartDateToDisplay`.
    * Calculate dates for Monday to Sunday of the target week.
    * Update the week display in the toolbar (e.g., "May 19 - May 25").
    * Create 7 day columns with date headers.
    * For each day cell:
        * Apply "today" highlight if applicable.
        * **If the cell is "today", render the "Today's Quick Note Input" UI element within it.** This UI might include a small text display area and an input field (e.g., `<input type="text">` or a small `<textarea>`), possibly toggled by a click or always visible if space allows.
        * Call `renderWeeklyDayCellContent(date)` to populate with regular todos/projects
* **Navigation Logic:**
    * **"Previous Week" / "Next Week" Buttons:** Modify `currentWeeklyViewStartDate` by +/- 7 days and call `renderWeeklyCalendar(currentWeeklyViewStartDate)`.
    * **Date Input Jump:** When a date is selected in `weekJumpInput`:
        * Calculate the start of the week (e.g., the preceding Monday) for the selected date.
        * Set `currentWeeklyViewStartDate` to this calculated Monday.
        * Call `renderWeeklyCalendar(currentWeeklyViewStartDate)`.
* **Today's Quick Note Logic:**
    * **Data Storage:** Quick notes for specific dates will be stored in a new dedicated object in the main data structure, e.g., `todaysQuickNotes: { "YYYY-MM-DD": "note text", ... }`.
    * **Input Handling:** Text entered into the input field should be saved to the `todaysQuickNotes` object for the current date (e.g., on 'blur' event of the input field, or when 'Enter' is pressed).
    * **Display:** The saved note for "today" should be displayed within its dedicated area in the "today" cell.
* **Data Sync (`renderWeeklyDayCellContent(date)`):**
    * Fetch relevant project `events` spanning this `date`.
    * Fetch `calendarCellTodos` for this `date`.
    * Render them (styles might differ slightly from yearly view but should be consistent).
* **Direct Todo Management:**
    * Clicking "+" in a weekly cell or a dedicated add button opens an input.
    * Saves new todo to `calendarCellTodos` array with the cell's date.
    * Re-render affected views (weekly cell, potentially yearly cell if visible).
    * Hover on todo item shows update/delete icons.
* **Drag and Drop from Backlog:**
    * On drop, determine target date from cell.
    * Create new todo in `calendarCellTodos` (or update existing if it was a placeholder).
    * Remove from `backlogTodos`.
    * Re-render all relevant views.

### 5.3. HTML Structure (Conceptual)
```html
<div id="weeklyCalendarContainer">
    <div class="weekly-header"> </div>
    <div class="weekly-grid">
        <div class="weekly-day-cell today" data-date="2025-05-21"> <div class="todays-quick-note-area">
                <span class="quick-note-display">User's quick note text here...</span>
                <input type="text" class="quick-note-input" placeholder="Quick note for today..." style="display:none;">
                </div>
        </div>
        </div>
</div>
```

### 5.4. CSS Styling Notes
* Styles for weekly grid, day cells, headers.
* `.weekly-day-cell.today` highlight.
* Styles for `.todays-quick-note-area`, `.quick-note-display`, and `.quick-note-input` within the "today" cell.
* Styles for todo items within weekly cells (potentially different from backlog item style).
* `overflow-y: auto;` for weekly cells if they contain many todos.

---

## 6. Backlog Module Details

### 6.1. Features
* Right-side panel.
* Add, update, delete todos.
* Priority (0-3) determines color (Blue, Red, Orange, Yellow).
* Drag todos to Yearly or Weekly calendars.

### 6.2. Detailed Logic
* **Data Structure:** `backlogTodos = [{ id, text, priority, color }]`
* **Rendering (`renderBacklog`):**
    * Iterate `backlogTodos` and create DOM elements for each.
    * Apply color based on `priority`.
    * Attach event listeners for update/delete (on hover).
    * Make items draggable (`draggable="true"`, `dragstart` event).
* **CRUD Operations:**
    * **Add:** Input form, creates new todo object, adds to `backlogTodos`, re-renders.
    * **Update:** Inline editing or modal, updates object in `backlogTodos`, re-renders.
    * **Delete:** Removes from `backlogTodos`, re-renders.
* **Priority/Color Logic:** A mapping function `getPriorityColor(priority)` will return the hex code.
    * 0: Blue (`#007bff`)
    * 1: Red (`#dc3545`)
    * 2: Orange (`#fd7e14`)
    * 3: Yellow (`#ffc107`)
* **Drag and Drop (`dragstart`, `drop` on calendar targets):**
    * `dragstart`: Store `todo.id` in `dataTransfer`.
    * Calendar `drop` handlers:
        * Identify target date.
        * Create a new entry in `calendarCellTodos` based on the dragged backlog todo.
        * Remove the todo from `backlogTodos` array using its ID.
        * Re-render backlog, yearly, and weekly views as needed.

### 6.3. HTML Structure (Conceptual)

    <div id="backlogPanel">
        <button id="addBacklogTodoBtn">+</button>
        <div id="backlogListContainer">
            </div>
    </div>

### 6.4. CSS Styling Notes
* Styles for the backlog panel itself.
* Styles for individual todo items, including color indicators for priority (e.g., a left border or background).
* Styles for input fields (text, priority number).
* Hover effects for showing action buttons (edit/delete).

---

## 7. Data Persistence (Save/Load)

### 7.1. JSON Data Structure (Updated)
The `.json` file will be updated to include backlog todos, todos placed directly on calendar cells, and today's quick notes.

    {
      "fileVersion": "1.2.0", // Version bump for new structure
      "savedAt": "YYYY-MM-DDTHH:mm:ss.sssZ",
      "calendarData": {
        "labels": [
          { "id": "lbl1", "name": "Project Phoenix", "color": "#FF0000" }
        ],
        "events": [
          {
            "id": "evt1",
            "labelId": "lbl1",
            "startDate": "2025-01-15",
            "endDate": "2025-01-20",
            "color": "#FF0000",
            "name": "Project Phoenix"
          }
        ],
        "backlogTodos": [
          { "id": "bt1", "text": "Initial planning", "priority": 0, "color": "#007bff" }
        ],
        "calendarCellTodos": [
          { 
            "id": "ct1", 
            "originalBacklogId": "bt1",
            "date": "2025-01-15", 
            "text": "Initial planning session", 
            "color": "#007bff"
          }
        ],
        "todaysQuickNotes": { // New field for today's quick notes
          "2025-05-21": "Remember to call John.",
          "2025-05-22": "Draft proposal due."
        }
      }
    }

* **`labels`**: Defines available labels for project events.
* **`events`**: Defines date ranges for project highlights (rendered as bars in Yearly Calendar).
* **`backlogTodos`**: Stores todos currently in the backlog panel.
* **`calendarCellTodos`**: Stores todos that are placed directly onto a date in the yearly or weekly calendar.
* **`todaysQuickNotes`**: An object where keys are dates (YYYY-MM-DD) and values are the quick note strings for those dates. Primarily interacted with via the "today" cell in the weekly view.

### 7.2. Save Data Logic
* Collect data from `labels`, `events`, `backlogTodos`, and `calendarCellTodos` JavaScript arrays.
* Package into the defined JSON structure.
* Trigger download as previously defined.

### 7.3. Load Data Logic
* Parse JSON file.
* Validate structure (check for all expected arrays and `fileVersion` if necessary for future migrations).
* Populate the corresponding JavaScript arrays.
* Re-render all components: Yearly Calendar (including project bars and cell todos based on loaded `events` and `calendarCellTodos`), Weekly Calendar (reflecting the loaded data for the current/default week), and Backlog (from `backlogTodos`).

---

## 8. Future Enhancements (Updated)

* **More Robust Overlap Detection/Handling:** For project events (e.g., visual indication or choice for user when overlaps occur for the same label or different labels).
* **Advanced Validation for Loaded JSON:** More granular checks of data integrity.
* **Auto-Save to LocalStorage:** As a backup or for seamless sessions without manual save/load.
* **Search/Filter:**
    * For todos in the Backlog.
    * For project events or todos within the Yearly/Weekly Calendars.
* **Recurring Events/Todos:** Ability to define events or todos that repeat (daily, weekly, monthly).
* **User Accounts & Cloud Sync:** (Major feature) For multi-device access and collaboration.
* **More detailed Todo properties:** Due dates within todos, sub-tasks, descriptions, attachments.
* **Context Menus:** Right-click for quick actions on calendar items, cells, or backlog todos.
* **Responsive Design Improvements:** Enhanced usability on smaller screens, though primarily designed for larger displays due to data density.
* **Time Support:** Currently date-based; adding time support for events/todos within a day.
* **Customizable Colors/Themes:** Allow users to customize application theme or label/priority colors beyond defaults.
* **Notifications/Reminders.**
* **Undo/Redo functionality.**

---


# Yearly Calendar Project - Development Roadmap

**Document Version:** 0.4.0 (Based on latest discussed features)

This roadmap outlines the step-by-step development plan for the Yearly Calendar Project. Each phase builds upon the previous one, prioritizing foundational elements and core functionality.

---

## Phase 1: Foundation & Core Layout Setup

**Goal:** Establish the basic project structure, main UI layout, core data stores, and essential utilities. This phase prepares the canvas for all subsequent features.

1.  **Project Initialization:**
    * Create `index.html` with basic DOM structure for toolbar, yearly calendar, weekly calendar, and backlog areas.
    * Create `style.css` and link it. Define basic body styles and full-screen app container.
    * Create main JavaScript file (e.g., `app.js` or `main.js`) and set up module import/export structure (e.g., create empty files for `yearlyCalendar.js`, `weeklyCalendar.js`, `backlog.js`, `dataManager.js`, `uiUtils.js`, `constants.js`).
2.  **Core Data Structures (`dataManager.js`):**
    * Define initial empty arrays/objects for:
        * `labels = []`
        * `events = []` (for project highlights)
        * `backlogTodos = []`
        * `calendarCellTodos = []` (for todos placed on calendar)
        * `todaysQuickNotes = {}`
    * Define state variables (e.g., `currentDisplayYear`, `currentWeeklyViewStartDate`, `selectedLabel`).
3.  **Overall Page Layout (CSS):**
    * Implement the main application grid using CSS Grid or Flexbox in `style.css`:
        * Toolbar area at the top.
        * Yearly Calendar area (main central).
        * Weekly Calendar area (below Yearly).
        * Backlog Panel area (right side).
    * Ensure these areas are placeholders but correctly positioned.
4.  **Basic Toolbar UI (`index.html`, `uiUtils.js`):**
    * Add HTML elements for:
        * Yearly navigation (`prevYearBtn`, `currentYearDisplay`, `nextYearBtn`).
        * Weekly navigation (`prevWeekBtn`, `weekJumpInput`, `currentWeekDisplay`, `nextWeekBtn`).
        * Label management (`addLabelBtn`, `labelsContainer`).
        * File operations (`saveDataBtn`, `loadDataBtn`, hidden `fileInput`).
    * Style them minimally. Initial event listeners can be stubbed.
5.  **Utility Functions (`uiUtils.js`, `constants.js`):**
    * ID generation function (`generateId`).
    * Date helper functions (e.g., `getDaysInMonth`, `getMondayOfWeek`, date formatting).
    * Constants for month names (Korean), day names, priority colors.

---

## Phase 2: Yearly Calendar - Basic Display & Core Features

**Goal:** Implement the visual rendering of the Yearly Calendar, core navigation, and essential visual cues.

1.  **Yearly Calendar Rendering (`yearlyCalendar.js`):**
    * Implement `renderYearlyCalendar(yearToDisplay)` function.
    * Dynamically generate month rows and day cells for the given `yearToDisplay`.
    * Display month names horizontally in Korean (e.g., "1월").
    * Display day number headers (1-31).
2.  **Yearly Calendar Navigation (`app.js`, `yearlyCalendar.js`):**
    * Connect `prevYearBtn`, `nextYearBtn` to update `currentDisplayYear` and re-render the yearly calendar.
    * Update `currentYearDisplay` in the toolbar.
    * Set an initial `currentDisplayYear` (e.g., 2025).
3.  **Visual Highlights (Yearly) (`yearlyCalendar.js`, `style.css`):**
    * Implement "Today's Date Highlight": Add a specific class to the current day's cell.
    * Implement "Current Week Outline": Add classes to cells belonging to the current week.
4.  **Label Management (`app.js`, `uiUtils.js`, `dataManager.js`):**
    * Implement "Add Label" modal functionality (open, close, input for name/color).
    * Save new labels to the `labels` array.
    * Render labels in the `labelsContainer` in the toolbar (color swatch + name).
    * Implement selection of a label (sets `selectedLabel` state, visual feedback on selected label).
    * Implement draggable reordering of labels in the toolbar.

---

## Phase 3: Yearly Calendar - Project Event Highlighting & Cell Content

**Goal:** Implement the core functionality of creating and displaying project events as thin, stackable bars, and address related bug fixes.

1.  **Data Representation for Cell Content (`dataManager.js`, `yearlyCalendar.js`):**
    * Refine how `events` and `calendarCellTodos` will be processed to determine what goes into each day cell.
2.  **Rendering Cell Content (`yearlyCalendar.js`):**
    * Implement `renderDayCellContent(date, cellElement)` function. This will be called by `renderYearlyCalendar` for each relevant day.
    * Inside `renderDayCellContent`:
        * Fetch projects from `events` that span the given `date`.
        * Render each project as a thin horizontal bar. Implement logic for vertical stacking within the cell if multiple projects occur on the same day. Each bar should be identifiable (e.g., `data-event-id`).
        * (Stub for later) Fetch `calendarCellTodos` for the date and render them as small boxes, respecting stacking and display priority (projects first).
3.  **Create Project Events (`yearlyCalendar.js`, `app.js`):**
    * Implement `mousedown`, `mousemove`, `mouseup` event listeners on yearly calendar day cells.
    * During drag (`mousemove`): Implement temporary highlight logic that correctly covers all cells from drag start to current, across multiple rows/months (Addresses Bug A.3.2.1.3).
    * On `mouseup`:
        * Create a new event object and add it to the `events` array.
        * Ensure `startDate` <= `endDate`.
        * Prevent creation of identical events (same label, same dates) (Addresses Bug A.3.2.1.4).
        * Trigger re-rendering of affected cells/month rows.
4.  **Bug Fixes for Highlighting:**
    * Ensure correct positioning of project bars within cells to fix any offset issues (Addresses Bug A.3.2.1.2). This is largely tied to the new `renderDayCellContent` logic.

---

## Phase 4: Data Persistence (Save & Load)

**Goal:** Enable users to save their work and load it back, ensuring all relevant data is included.

1.  **JSON Data Structure Definition (`dataManager.js` or documentation):**
    * Finalize the JSON structure (as per `Version 1.2.0` in the tech docs), including `labels`, `events`, `backlogTodos`, `calendarCellTodos`, and `todaysQuickNotes`.
    * Include `fileVersion` and `savedAt` timestamp.
2.  **Save Functionality (`dataManager.js`, `app.js`):**
    * Implement `handleSaveData` function.
    * Collect all necessary data arrays/objects.
    * Convert to JSON string and trigger file download.
    * Implement `Cmd/Ctrl + S` shortcut.
3.  **Load Functionality (`dataManager.js`, `app.js`):**
    * Implement `handleLoadData` triggered by `fileInput` change.
    * Read file, parse JSON.
    * Basic validation of loaded data structure.
    * Populate application's data arrays/objects.
    * Trigger a full re-render of all components (Yearly, Weekly, Backlog, Labels).

---

## Phase 5: Backlog Module - Core Functionality

**Goal:** Implement the backlog panel with basic todo management.

1.  **Backlog UI (`backlog.js`, `style.css`):**
    * Style the backlog panel on the right side.
    * Add "+" button for adding new todos.
    * Define structure for backlog list container.
2.  **Render Backlog Todos (`backlog.js`):**
    * Implement `renderBacklog` function to display todos from `backlogTodos` array.
    * Each todo item should show its text and be styled according to its priority/color.
    * Implement `getPriorityColor(priority)` helper.
3.  **Backlog Todo CRUD (`backlog.js`, `dataManager.js`):**
    * **Add:** UI for inputting new todo text and selecting priority. Save to `backlogTodos`.
    * **Update/Delete:** Add UI elements (e.g., shown on hover) for editing text and deleting a todo. Update/remove from `backlogTodos` and re-render.
    * Make backlog items draggable (`draggable="true"`).

---

## Phase 6: Weekly Calendar - Basic Display & Today's Note

**Goal:** Implement the visual rendering of the Weekly Calendar, its navigation, and the "Today's Quick Note" feature.

1.  **Weekly Calendar Rendering (`weeklyCalendar.js`):**
    * Implement `renderWeeklyCalendar(weekStartDateToDisplay)` function.
    * Display 7 columns (Mon-Sun) for the given `weekStartDateToDisplay`.
    * Display day/date headers for each column.
2.  **Weekly Calendar Navigation (`app.js`, `weeklyCalendar.js`):**
    * Connect `prevWeekBtn`, `nextWeekBtn`, and `weekJumpInput` to update `currentWeeklyViewStartDate` and re-render the weekly calendar.
    * Update `currentWeekDisplay` in the toolbar.
    * Set an initial `currentWeeklyViewStartDate` (e.g., Monday of the current week).
3.  **Visual Highlights (Weekly) (`weeklyCalendar.js`, `style.css`):**
    * Implement "Today's Date Highlight" for the current day's cell.
4.  **Today's Quick Note Input (`weeklyCalendar.js`, `dataManager.js`):**
    * When rendering the "today" cell in the weekly view, include the UI elements for displaying and inputting the quick note (as per tech docs HTML conceptual structure).
    * Implement logic to save the input (e.g., on blur) to the `todaysQuickNotes` object, keyed by date.
    * Display the saved note.

---

## Phase 7: Inter-Module Interactions & Synchronization

**Goal:** Enable drag & drop between modules and ensure data changes are reflected across relevant views.

1.  **Drag & Drop: Backlog to Yearly Calendar (`backlog.js`, `yearlyCalendar.js`, `dataManager.js`):**
    * Implement `drop` handling on Yearly Calendar cells.
    * When a backlog todo is dropped:
        * Create a new entry in `calendarCellTodos` with the target date and todo details.
        * Remove the todo from `backlogTodos`.
        * Re-render Backlog and the affected Yearly Calendar cell(s) to show the new "small box" todo.
2.  **Drag & Drop: Backlog to Weekly Calendar (`backlog.js`, `weeklyCalendar.js`, `dataManager.js`):**
    * Implement `drop` handling on Weekly Calendar cells.
    * When a backlog todo is dropped:
        * Create a new entry in `calendarCellTodos` with the target date and todo details.
        * Remove the todo from `backlogTodos`.
        * Re-render Backlog, the affected Weekly Calendar cell, and the corresponding Yearly Calendar cell.
3.  **Data Synchronization: Display Items in Weekly Calendar (`weeklyCalendar.js`):**
    * Implement `renderWeeklyDayCellContent(date, cellElement)`.
    * Fetch and display project `events` that span this date.
    * Fetch and display `calendarCellTodos` for this date.
    * Ensure this content is also displayed alongside "Today's Quick Note" if it's today's cell.

---

## Phase 8: Advanced Item Manipulation

**Goal:** Implement direct editing and deletion of project events on the Yearly Calendar and full todo management within Weekly Calendar cells.

1.  **Yearly Calendar: Project Event Editing (`yearlyCalendar.js`):**
    * Implement selection of rendered project bars.
    * Implement UI for resizing (e.g., drag handles on selected bars) to change `startDate`/`endDate`.
    * Update the corresponding event in the `events` array and re-render.
2.  **Yearly Calendar: Project Event Deletion (`yearlyCalendar.js`):**
    * Implement UI for deleting selected project bars (e.g., a delete icon or context menu option).
    * Remove the event from the `events` array and re-render.
3.  **Weekly Calendar: Direct Todo Management (`weeklyCalendar.js`, `dataManager.js`):**
    * Implement UI for adding new todos directly within a weekly cell (similar to backlog add, but associated with the cell's date). Save to `calendarCellTodos`.
    * Implement UI (e.g., on hover) for updating and deleting todos listed within weekly cells. Update/remove from `calendarCellTodos`.
    * Implement `scroll-y` for weekly cells if todo content overflows.

---

## Phase 9: Refinements, Testing & Bug Fixing

**Goal:** Polish the application, conduct thorough testing, and address any remaining issues.

1.  **Comprehensive Testing:**
    * Test all features across different scenarios and data inputs.
    * Test save/load with complex data.
    * Test drag and drop interactions thoroughly.
    * Test navigation and date boundary conditions.
2.  **UI/UX Polish:**
    * Review all visual elements for consistency and clarity.
    * Improve user feedback for actions (e.g., loading states, success/error messages).
    * Ensure intuitive controls and interactions.
3.  **Bug Fixing:**
    * Address any bugs identified during testing.
    * Focus on stability and correctness of data manipulation.
4.  **Performance Review:**
    * Identify and optimize any performance bottlenecks, especially in rendering functions with large amounts of data.
5.  **Code Review & Refactoring:**
    * Review JavaScript module structure and overall code quality.
    * Refactor for clarity and maintainability where needed.
6.  **Final Document Review:**
    * Ensure the final application aligns with the technical documentation.

---