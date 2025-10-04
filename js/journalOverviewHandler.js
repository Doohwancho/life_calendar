// journalOverviewHandler.js

import { getState, loadDataForYear } from "./dataManager.js";

let localDataManager;
let currentYear;
let currentMonth;

// DOM Elements
let currentMonthDisplay;
let prevMonthBtn;
let nextMonthBtn;
let journalEntriesList;
let activityGrid;

// --- Initialization ---
export async function initJournalOverview(
  dataModule,
  busModule,
  params,
  query
) {
  console.log("[JournalOverview] Initializing Journal Overview");

  localDataManager = dataModule;

  // Initialize current year and month to current date
  currentYear = new Date().getFullYear();
  currentMonth = new Date().getMonth() + 1; // 1-12
  console.log(
    `[JournalOverview] Initialized: ${currentYear}년 ${currentMonth}월`
  );

  // Initialize DOM elements
  initializeDOMElements();

  // Load data for current year
  await localDataManager.loadDataForYear(currentYear);

  // Update month display
  updateMonthDisplay();

  // Update navigation buttons
  updateNavigationButtons();

  // Render the journal overview
  renderJournalOverview();

  // Render the activity grid
  renderActivityGrid();

  console.log("[JournalOverview] Journal Overview initialized");
}

function initializeDOMElements() {
  currentMonthDisplay = document.getElementById("currentMonthDisplay");
  prevMonthBtn = document.getElementById("prevMonthBtn");
  nextMonthBtn = document.getElementById("nextMonthBtn");
  journalEntriesList = document.getElementById("journalEntriesList");
  activityGrid = document.getElementById("activityGrid");

  // Add event listeners
  prevMonthBtn.addEventListener("click", () => {
    changeMonth(-1);
  });

  nextMonthBtn.addEventListener("click", () => {
    changeMonth(1);
  });
}

function changeMonth(direction) {
  const newMonth = currentMonth + direction;

  // 2025년 1월부터 12월까지만 이동 가능
  if (newMonth < 1 || newMonth > 12) {
    return; // 이동하지 않음
  }

  currentMonth = newMonth;
  console.log(`[JournalOverview] Changed to month: ${currentMonth}`);
  updateMonthDisplay();
  updateNavigationButtons();
  renderJournalOverview();
  renderActivityGrid();
}

function updateMonthDisplay() {
  const monthNames = [
    "1월",
    "2월",
    "3월",
    "4월",
    "5월",
    "6월",
    "7월",
    "8월",
    "9월",
    "10월",
    "11월",
    "12월",
  ];

  console.log(
    `[JournalOverview] Updating display: ${currentYear}년 ${
      monthNames[currentMonth - 1]
    }`
  );
  currentMonthDisplay.textContent = `${currentYear}년 ${
    monthNames[currentMonth - 1]
  }`;
}

function updateNavigationButtons() {
  if (prevMonthBtn && nextMonthBtn) {
    // 1월이면 이전 버튼 비활성화
    prevMonthBtn.disabled = currentMonth === 1;

    // 12월이면 다음 버튼 비활성화
    nextMonthBtn.disabled = currentMonth === 12;
  }
}

function renderJournalOverview() {
  if (!journalEntriesList) return;

  // Clear existing entries
  journalEntriesList.innerHTML = "";

  // Get number of days in current month
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

  // Get diary data for the month
  const monthKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
  const monthData = localDataManager.getRawDailyDataForMonth(monthKey);

  // Create journal entries for each day
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(
      2,
      "0"
    )}-${String(day).padStart(2, "0")}`;
    const dayData = monthData?.dailyData?.[dateStr];
    const diaryData = dayData?.diary || {};

    const journalEntry = createJournalEntryElement(day, diaryData);
    journalEntriesList.appendChild(journalEntry);
  }

  // Ensure the list takes up space even when empty
  if (daysInMonth === 0) {
    const emptyMessage = document.createElement("div");
    emptyMessage.className = "journal-empty-message";
    emptyMessage.textContent = "No entries for this month";
    emptyMessage.style.padding = "2rem";
    emptyMessage.style.textAlign = "center";
    emptyMessage.style.color = "#6c757d";
    emptyMessage.style.fontStyle = "italic";
    journalEntriesList.appendChild(emptyMessage);
  }
}

function createJournalEntryElement(day, diaryData) {
  const entryDiv = document.createElement("div");
  entryDiv.className = "journal-entry-item";

  // Date column
  const dateDiv = document.createElement("div");
  dateDiv.className = "journal-entry-date";
  dateDiv.textContent = day;

  // Content column
  const contentDiv = document.createElement("div");
  contentDiv.className = "journal-entry-content";

  // Summary section
  const summaryDiv = document.createElement("div");
  summaryDiv.className = "journal-entry-summary";

  // Create sections for keep, problem, try
  const sections = [
    { key: "keep", title: "Keep" },
    { key: "problem", title: "Problem" },
    { key: "try", title: "Try" },
  ];

  sections.forEach((section) => {
    const summaryItemDiv = document.createElement("div");
    summaryItemDiv.className = "journal-entry-summary-item";

    const dotDiv = document.createElement("div");
    const text = diaryData[section.key] || "";
    const hasContent = text.trim().length > 0;

    dotDiv.className = `journal-entry-summary-dot ${section.key}${
      !hasContent ? " empty" : ""
    }`;

    const textDiv = document.createElement("div");
    textDiv.className = `journal-entry-summary-text${
      !hasContent ? " empty" : ""
    }`;

    if (hasContent) {
      // Show first 50 characters of the text
      const preview = text.length > 50 ? text.substring(0, 50) + "..." : text;
      textDiv.textContent = preview;
    } else {
      textDiv.textContent = "No entry";
    }

    summaryItemDiv.appendChild(dotDiv);
    summaryItemDiv.appendChild(textDiv);
    summaryDiv.appendChild(summaryItemDiv);
  });

  contentDiv.appendChild(summaryDiv);
  entryDiv.appendChild(dateDiv);
  entryDiv.appendChild(contentDiv);

  // Add click event to show modal
  entryDiv.addEventListener("click", () => {
    showJournalModal(day, diaryData);
  });

  return entryDiv;
}

function showJournalModal(day, diaryData) {
  // Create modal overlay
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "journal-modal-overlay";

  // Create modal content
  const modalContent = document.createElement("div");
  modalContent.className = "journal-modal-content";

  // Create modal header
  const modalHeader = document.createElement("div");
  modalHeader.className = "journal-modal-header";

  const modalTitle = document.createElement("h2");
  modalTitle.className = "journal-modal-title";
  modalTitle.textContent = `${currentYear}년 ${currentMonth}월 ${day}일`;

  const closeBtn = document.createElement("button");
  closeBtn.className = "journal-modal-close";
  closeBtn.innerHTML = "&times;";
  closeBtn.addEventListener("click", () => {
    modalOverlay.remove();
  });

  modalHeader.appendChild(modalTitle);
  modalHeader.appendChild(closeBtn);

  // Create modal sections
  const sectionsDiv = document.createElement("div");
  sectionsDiv.className = "journal-modal-sections";

  const sections = [
    { key: "keep", title: "Keep" },
    { key: "problem", title: "Problem" },
    { key: "try", title: "Try" },
  ];

  sections.forEach((section) => {
    const sectionDiv = document.createElement("div");
    sectionDiv.className = `journal-modal-section ${section.key}`;

    const titleDiv = document.createElement("div");
    titleDiv.className = "journal-modal-section-title";
    titleDiv.textContent = section.title;

    const textarea = document.createElement("textarea");
    const text = diaryData[section.key] || "";
    textarea.className = "journal-modal-section-textarea";
    textarea.value = text;
    textarea.placeholder = `Enter your ${section.title.toLowerCase()}...`;

    sectionDiv.appendChild(titleDiv);
    sectionDiv.appendChild(textarea);
    sectionsDiv.appendChild(sectionDiv);
  });

  // Create save button
  const saveBtn = document.createElement("button");
  saveBtn.className = "journal-modal-save";
  saveBtn.textContent = "Save";
  saveBtn.addEventListener("click", () => {
    saveJournalEntry(day, sections, modalOverlay);
  });

  // Assemble modal
  modalContent.appendChild(modalHeader);
  modalContent.appendChild(sectionsDiv);
  modalContent.appendChild(saveBtn);
  modalOverlay.appendChild(modalContent);

  // Add to document
  document.body.appendChild(modalOverlay);

  // Close modal when clicking outside
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.remove();
    }
  });

  // Close modal with Escape key
  const handleEscape = (e) => {
    if (e.key === "Escape") {
      modalOverlay.remove();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);
}

function renderActivityGrid() {
  if (!activityGrid) return;

  // Clear existing content
  activityGrid.innerHTML = "";

  // Get color palette from yearly data
  const state = localDataManager.getState();
  const colorPalette = state.colorPalette || [];

  if (colorPalette.length === 0) {
    activityGrid.innerHTML =
      "<p style='text-align: center; color: #6c757d; padding: 2rem;'>No color palette data available</p>";
    return;
  }

  // Get number of days in current month
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const monthKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
  const monthData = localDataManager.getRawDailyDataForMonth(monthKey);

  // Create table
  const table = document.createElement("table");
  table.className = "activity-grid-table";

  // Create header row
  const headerRow = document.createElement("tr");

  // Date column header
  const dateHeader = document.createElement("th");
  dateHeader.textContent = "Date";
  dateHeader.className = "activity-grid-date";
  headerRow.appendChild(dateHeader);

  // Color palette column headers
  colorPalette.forEach((color) => {
    const th = document.createElement("th");
    th.textContent = color.name || color.label || "Unknown";
    th.className = "activity-grid-label";
    headerRow.appendChild(th);
  });

  table.appendChild(headerRow);

  // Create data rows for each day
  for (let day = 1; day <= daysInMonth; day++) {
    const row = document.createElement("tr");

    // Date cell
    const dateCell = document.createElement("td");
    dateCell.textContent = day;
    dateCell.className = "activity-grid-date";
    row.appendChild(dateCell);

    // Get day data
    const dateStr = `${currentYear}-${String(currentMonth).padStart(
      2,
      "0"
    )}-${String(day).padStart(2, "0")}`;
    const dayData = monthData?.dailyData?.[dateStr];

    // Check each color palette item
    colorPalette.forEach((color) => {
      const cell = document.createElement("td");
      cell.className = "activity-grid-cell";

      // Check if this color is used in timeBlocks or goalBlocks
      const hasActivity = checkColorUsage(dayData, color);
      if (hasActivity) {
        cell.classList.add("has-activity");
      }

      row.appendChild(cell);
    });

    table.appendChild(row);
  }

  activityGrid.appendChild(table);
}

function checkColorUsage(dayData, color) {
  if (!dayData) return false;

  // Check timeBlocks only (exclude goalBlocks)
  if (dayData.timeBlocks) {
    for (const blockId in dayData.timeBlocks) {
      const block = dayData.timeBlocks[blockId];
      if (block && block.color === color.color) {
        return true;
      }
    }
  }

  return false;
}

function saveJournalEntry(day, sections, modalOverlay) {
  console.log(
    `[JournalOverview] Saving journal entry for ${currentYear}년 ${currentMonth}월 ${day}일`
  );

  // Get current data using dataManager functions
  const monthKey = `${currentYear}-${currentMonth.toString().padStart(2, "0")}`;
  const dateStr = `${currentYear}-${currentMonth
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

  // Get raw month data
  const monthData = localDataManager.getRawDailyDataForMonth(monthKey);

  if (!monthData) {
    console.error(`[JournalOverview] Month data not found for ${monthKey}`);
    return;
  }

  // Get or create day data
  if (!monthData.dailyData) {
    monthData.dailyData = {};
  }
  if (!monthData.dailyData[dateStr]) {
    monthData.dailyData[dateStr] = {
      timeBlocks: {},
      goalBlocks: {},
      scheduledTimelineTasks: [],
      todos: [],
      diary: { keep: "", problem: "", try: "" },
      cellMark: null,
    };
  }

  // Update diary data with textarea values
  sections.forEach((section) => {
    const textarea = modalOverlay.querySelector(
      `.journal-modal-section.${section.key} textarea`
    );
    if (textarea) {
      monthData.dailyData[dateStr].diary[section.key] = textarea.value.trim();
    }
  });

  // Save to data manager using updateDailyData
  localDataManager.updateDailyData(monthKey, monthData);

  console.log(`[JournalOverview] Journal entry saved successfully`);

  // Close modal
  modalOverlay.remove();

  // Refresh the journal overview and activity grid
  renderJournalOverview();
  renderActivityGrid();
}

// --- Cleanup ---
export function cleanupJournalOverview() {
  console.log("[JournalOverview] Cleaning up Journal Overview");

  // Remove event listeners
  if (prevMonthBtn) {
    prevMonthBtn.removeEventListener("click", () => changeMonth(-1));
  }
  if (nextMonthBtn) {
    nextMonthBtn.removeEventListener("click", () => changeMonth(1));
  }

  // Clear references
  localDataManager = null;
  currentMonthDisplay = null;
  prevMonthBtn = null;
  nextMonthBtn = null;
  journalEntriesList = null;
}
