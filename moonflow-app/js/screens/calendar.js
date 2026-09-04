// @ts-check
// screens/calendar.js — see "Calendar" in moonflow-design-system.md. Tapping a past
// date opens the log-entry sheet for that date; future dates are non-interactive.

import { ICONS } from '../icons.js';
import { derivePeriods, predictNextPeriod, estimateFertileWindow, diffDays, addDays } from '../cycle-math.js';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** @param {string} dateStr */
function toDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** @param {Date} date */
function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * @param {string} monthStr "YYYY-MM"
 * @param {Array<{date: string, flow: string|null}>} entries
 * @param {{avgCycleLength: number, lastPeriodStart: string|null}} settings
 */
export function renderCalendarScreen(monthStr, entries, settings) {
  const [year, month] = monthStr.split('-').map(Number);
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = firstOfMonth.getDay(); // 0 = Sunday
  const todayStr = toDateString(new Date());

  const periods = derivePeriods(entries);
  const loggedPeriodDates = new Set();
  periods.forEach(p => {
    let d = p.start;
    while (diffDays(d, p.end) >= 0) { loggedPeriodDates.add(d); d = addDays(d, 1); }
  });

  const prediction = predictNextPeriod(periods, settings);
  const predictedDates = new Set();
  if (prediction.confidence === 'confirmed' && prediction.date) {
    // Show the predicted period as a span using the average logged period length, defaulting to 5.
    const lengths = periods.map(p => diffDays(p.start, p.end) + 1);
    const avgLen = lengths.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 5;
    for (let i = 0; i < avgLen; i++) predictedDates.add(addDays(prediction.date, i));
  }

  let fertileDates = new Set();
  let fertilePeak = null;
  if (prediction.confidence === 'confirmed' && prediction.date) {
    const fertile = estimateFertileWindow(prediction.date);
    fertilePeak = fertile.peak;
    let d = fertile.start;
    while (diffDays(d, fertile.end) >= 0) { fertileDates.add(d); d = addDays(d, 1); }
  }

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(toDateString(new Date(year, month - 1, day)));

  const dayCells = cells.map(dateStr => {
    if (!dateStr) return `<div class="calendar-day"><span class="calendar-day__cell calendar-day__cell--empty"></span></div>`;

    const dayNum = Number(dateStr.split('-')[2]);
    const isFuture = diffDays(todayStr, dateStr) > 0;
    const isToday = dateStr === todayStr;
    let stateClass = '';
    if (loggedPeriodDates.has(dateStr)) stateClass = 'calendar-day__cell--period';
    else if (dateStr === fertilePeak) stateClass = 'calendar-day__cell--fertile-peak';
    else if (fertileDates.has(dateStr)) stateClass = 'calendar-day__cell--fertile';
    else if (predictedDates.has(dateStr)) stateClass = 'calendar-day__cell--predicted';

    const todayClass = isToday ? ' calendar-day__cell--today' : '';
    const futureClass = isFuture ? ' calendar-day__cell--future' : '';
    const disabled = isFuture ? 'disabled' : '';

    return `<div class="calendar-day"><button type="button" class="calendar-day__cell ${stateClass}${todayClass}${futureClass}" data-date="${dateStr}" ${disabled}>${dayNum}</button></div>`;
  }).join('');

  const monthLabel = firstOfMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return `
    <div class="screen">
      <div class="calendar-header">
        <button type="button" data-month-nav="prev" aria-label="Previous month">${ICONS['chevron-left']}</button>
        <span class="calendar-header__label">${monthLabel}</span>
        <button type="button" data-month-nav="next" aria-label="Next month">${ICONS['chevron-right']}</button>
      </div>
      <div class="calendar-weekdays">${WEEKDAY_LABELS.map(l => `<span>${l}</span>`).join('')}</div>
      <div class="calendar-grid">${dayCells}</div>
      <div class="calendar-legend">
        <span><span class="calendar-legend__dot" style="background:var(--accent-rose)"></span>Period</span>
        <span><span class="calendar-legend__dot" style="background:var(--fertile-tint-peak)"></span>Fertile</span>
        <span><span class="calendar-legend__dot" style="border:1.5px dashed var(--accent-rose)"></span>Predicted</span>
      </div>
    </div>
  `;
}

/**
 * @param {HTMLElement} container
 * @param {{onSelectDate: (date: string) => void, onChangeMonth: (direction: 'prev'|'next') => void}} handlers
 */
export function mountCalendarScreen(container, { onSelectDate, onChangeMonth }) {
  container.querySelectorAll('[data-date]:not([disabled])').forEach(el => {
    el.addEventListener('click', () => onSelectDate(/** @type {string} */ (el.getAttribute('data-date'))));
  });
  container.querySelectorAll('[data-month-nav]').forEach(el => {
    el.addEventListener('click', () => onChangeMonth(/** @type {'prev'|'next'} */ (el.getAttribute('data-month-nav'))));
  });
}
