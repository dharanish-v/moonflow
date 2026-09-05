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
    if (!dateStr) return `<div class="calendar-day aspect-square flex items-center justify-center"><span class="invisible w-[2.5rem] h-[2.5rem] rounded-full"></span></div>`;

    const dayNum = Number(dateStr.split('-')[2]);
    const isFuture = diffDays(todayStr, dateStr) > 0;
    const isToday = dateStr === todayStr;
    let stateClass = '';
    if (loggedPeriodDates.has(dateStr)) stateClass = 'bg-accent-rose text-accent-rose-text';
    else if (dateStr === fertilePeak) stateClass = 'bg-fertile-tint-peak border-[1.5px] border-accent-gold font-medium';
    else if (fertileDates.has(dateStr)) stateClass = 'bg-fertile-tint text-ink';
    else if (predictedDates.has(dateStr)) stateClass = 'border-[1.5px] border-dashed border-accent-rose text-accent-rose';

    const todayClass = isToday ? ' border-[1.5px] border-ink' : '';
    const futureClass = isFuture ? ' cursor-default' : '';
    const disabled = isFuture ? 'disabled' : '';

    // Full spoken state for VoiceOver — color alone (period/fertile/predicted)
    // is never the only signal (edge-case rules in moonflow-design-system.md).
    const spokenParts = [toDate(dateStr).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })];
    if (loggedPeriodDates.has(dateStr)) spokenParts.push('period day');
    else if (dateStr === fertilePeak) spokenParts.push('peak fertile day');
    else if (fertileDates.has(dateStr)) spokenParts.push('fertile window');
    else if (predictedDates.has(dateStr)) spokenParts.push('predicted period');
    if (isToday) spokenParts.push('today');
    const spokenLabel = spokenParts.join(', ');

    return `<div class="calendar-day aspect-square flex items-center justify-center"><button type="button" class="w-[2.5rem] h-[2.5rem] rounded-full flex items-center justify-center text-flow-small text-ink-secondary bg-transparent border-0 font-[inherit] cursor-pointer p-0 ${stateClass}${todayClass}${futureClass}" data-date="${dateStr}" aria-label="${spokenLabel}" ${disabled}>${dayNum}</button></div>`;
  }).join('');

  const monthLabel = firstOfMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return `
    <div class="flex-1 flex flex-col w-full max-w-[26rem] mx-auto box-border py-flow-6 px-flow-5">
      <div class="flex justify-between items-center mb-flow-4">
        <button type="button" class="w-[2.75rem] h-[2.75rem] flex items-center justify-center bg-transparent border-0 text-ink-inactive cursor-pointer p-0" data-month-nav="prev" aria-label="Previous month">${ICONS['chevron-left'].replace('<svg ', '<svg class="w-[0.9rem] h-[0.9rem]" ')}</button>
        <span class="text-flow-nav font-medium text-ink">${monthLabel}</span>
        <button type="button" class="w-[2.75rem] h-[2.75rem] flex items-center justify-center bg-transparent border-0 text-ink-inactive cursor-pointer p-0" data-month-nav="next" aria-label="Next month">${ICONS['chevron-right'].replace('<svg ', '<svg class="w-[0.9rem] h-[0.9rem]" ')}</button>
      </div>
      <div class="grid grid-cols-7">${WEEKDAY_LABELS.map(l => `<span class="text-center text-flow-micro text-ink-inactive pb-flow-2">${l}</span>`).join('')}</div>
      <div class="grid grid-cols-7 gap-[0.375rem]">${dayCells}</div>
      <div class="flex gap-flow-4 justify-center mt-flow-4 text-flow-micro text-ink-muted">
        <span><span class="inline-block w-2 h-2 rounded-full mr-flow-1 align-middle bg-accent-rose"></span>Period</span>
        <span><span class="inline-block w-2 h-2 rounded-full mr-flow-1 align-middle bg-fertile-tint-peak"></span>Fertile</span>
        <span><span class="inline-block w-2 h-2 rounded-full mr-flow-1 align-middle border-[1.5px] border-dashed border-accent-rose"></span>Predicted</span>
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
