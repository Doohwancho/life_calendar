import { DAY_NAMES_KO_SHORT } from './constants.js';


export function generateId() {
    return `id_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
}

/**
 * Get the number of days in a specific month and year.
 * @param {number} year - The full year (e.g., 2025).
 * @param {number} month - The month (0-indexed, 0 for January, 11 for December).
 * @returns {number} The number of days in the month.
 */
export function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

/**
 * Get the Date object for Monday of the week that the given date falls into.
 * @param {Date} date - The input date.
 * @returns {Date} A new Date object representing Monday of that week.
 */
export function getMondayOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay(); // Sunday - 0, Monday - 1, ..., Saturday - 6
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust if Sunday
    return new Date(d.setDate(diff));
}

/**
 * Formats a Date object into YYYY-MM-DD string.
 * @param {Date} date - The Date object to format.
 * @returns {string} The formatted date string.
 */
export function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date)) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Checks if two Date objects represent the same date (ignores time).
 * @param {Date} date1
 * @param {Date} date2
 * @returns {boolean}
 */
export function isSameDate(date1, date2) {
    if (!date1 || !date2) return false;
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

/**
 * Checks if a date falls within the current week (Monday to Sunday).
 * @param {Date} dateToCheck - The date to check.
 * @param {Date} today - The current date (or reference 'today').
 * @returns {boolean}
 */
export function isDateInCurrentWeek(dateToCheck, today = new Date()) {
    const mondayOfCurrentWeek = getMondayOfWeek(today);
    const sundayOfCurrentWeek = new Date(mondayOfCurrentWeek);
    sundayOfCurrentWeek.setDate(mondayOfCurrentWeek.getDate() + 6);

    // Normalize times to avoid issues if one date has time and other doesn't
    const checkDate = new Date(dateToCheck.getFullYear(), dateToCheck.getMonth(), dateToCheck.getDate());
    const monday = new Date(mondayOfCurrentWeek.getFullYear(), mondayOfCurrentWeek.getMonth(), mondayOfCurrentWeek.getDate());
    const sunday = new Date(sundayOfCurrentWeek.getFullYear(), sundayOfCurrentWeek.getMonth(), sundayOfCurrentWeek.getDate());
    
    return checkDate >= monday && checkDate <= sunday;
}

/**
 * Returns an array of Date objects between a start and end date (inclusive).
 * @param {Date | string} startDate - The start date.
 *-
 * @param {Date | string} endDate - The end date.
 * @returns {Date[]}
 */
 export function getDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dateArray = [];
    let currentDate = new Date(start);

    // Normalize to avoid time-related issues
    currentDate.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    while (currentDate <= end) {
        dateArray.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dateArray;
}

export function getDayNameKO(date) {
    return DAY_NAMES_KO_SHORT[date.getDay()];
}