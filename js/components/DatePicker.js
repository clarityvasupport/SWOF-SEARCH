// =========================================================
// DatePicker – Range picker with Clear & Today
// =========================================================

/**
 * Attach a range date picker to a pair of inputs.
 * @param {HTMLInputElement} startInput - The "From" input.
 * @param {HTMLInputElement} endInput   - The "To" input.
 * @param {Object} options
 * @param {string} options.initialStart - Initial start date (yyyy-mm-dd)
 * @param {string} options.initialEnd   - Initial end date (yyyy-mm-dd)
 * @param {function} options.onChange   - Callback when range changes
 */
export function attachRangeDatePicker(startInput, endInput, options = {}) {
  if (!startInput || !endInput) return;

  const { initialStart = '', initialEnd = '', onChange = null } = options;

  // --- Internal state (civil dates only) ---
  let currentMonth = new Date();
  let rangeStart = initialStart ? parseDate(initialStart) : null;
  let rangeEnd = initialEnd ? parseDate(initialEnd) : null;
  let selectingStart = true;
  let isOpen = false;

  // --- Helper: parse yyyy-mm-dd to Date (civil, no timezone) ---
  function parseDate(str) {
    if (!str) return null;
    const parts = str.split('-').map(Number);
    if (parts.length !== 3) return null;
    const [y, m, d] = parts;
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return date;
  }

  // --- Helper: format Date to yyyy-mm-dd ---
  function toDateString(date) {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // --- Normalize range: ensure start <= end ---
  function normalizeRange() {
    if (rangeStart && rangeEnd && rangeStart > rangeEnd) {
      [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
    }
  }

  // --- Update both inputs and notify ---
  function updateInputs() {
    startInput.value = rangeStart ? toDateString(rangeStart) : '';
    endInput.value = rangeEnd ? toDateString(rangeEnd) : '';
    if (onChange) onChange(startInput.value, endInput.value);
    startInput.dispatchEvent(new Event('change', { bubbles: true }));
    endInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // --- Set today ---
  function setToday() {
    const today = new Date();
    rangeStart = today;
    rangeEnd = today;
    normalizeRange();
    updateInputs();
    closePopover();
    renderCalendar();
  }

  // --- Clear range ---
  function clearRange() {
    rangeStart = null;
    rangeEnd = null;
    selectingStart = true;
    updateInputs();
    closePopover();
    renderCalendar();
  }

  // --- Render the calendar ---
  function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    let html = `
      <div class="flex items-center justify-between mb-3">
        <button class="dp-prev-month px-2 py-1 rounded hover:bg-black/5 text-black/70">‹</button>
        <span class="font-bold text-black/80">${monthNames[month]} ${year}</span>
        <button class="dp-next-month px-2 py-1 rounded hover:bg-black/5 text-black/70">›</button>
      </div>
      <div class="grid grid-cols-7 gap-1 text-center text-xs font-bold text-black/50 mb-2">
        <span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
      </div>
      <div class="grid grid-cols-7 gap-1">
    `;

    for (let i = 0; i < startOffset; i++) html += `<div></div>`;

    const today = new Date();
    const todayStr = toDateString(today);
    const startStr = rangeStart ? toDateString(rangeStart) : '';
    const endStr = rangeEnd ? toDateString(rangeEnd) : '';

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dateStr = toDateString(dateObj);
      const isToday = dateStr === todayStr;
      const isStart = dateStr === startStr;
      const isEnd = dateStr === endStr;
      const isInRange = rangeStart && rangeEnd && dateStr >= startStr && dateStr <= endStr;
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

      let classes = 'w-8 h-8 flex items-center justify-center rounded-full text-sm cursor-pointer hover:bg-black/10 transition';
      if (isStart || isEnd) {
        classes += ' bg-brand-teal text-white hover:bg-[#2A5454]';
      } else if (isInRange) {
        classes += ' bg-brand-teal/20 text-black/80';
      }
      if (isToday && !isStart && !isEnd) {
        classes += ' border border-brand-teal';
      }
      if (isWeekend && !isStart && !isEnd && !isInRange) {
        classes += ' text-black/30';
      } else if (!isStart && !isEnd && !isInRange) {
        classes += ' text-black/80';
      }

      html += `<button class="${classes}" data-date="${dateStr}">${d}</button>`;
    }

    html += `</div>`;

    // --- Footer: Clear + Today buttons ---
    html += `
      <div class="flex items-center justify-between mt-3 pt-3 border-t border-black/10">
        <button class="dp-clear text-xs font-bold text-red-500 hover:text-red-700 transition px-2 py-1 rounded hover:bg-red-50">Clear</button>
        <button class="dp-today text-xs font-bold text-brand-teal hover:text-[#2A5454] transition px-2 py-1 rounded hover:bg-brand-teal/10">Today</button>
      </div>
    `;

    popover.innerHTML = html;

    // --- Day click ---
    popover.querySelectorAll('[data-date]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dateStr = btn.dataset.date;
        const date = parseDate(dateStr);
        if (!date) return;

        if (!rangeStart || (rangeStart && rangeEnd)) {
          rangeStart = date;
          rangeEnd = null;
          selectingStart = false;
        } else {
          rangeEnd = date;
          normalizeRange();
          selectingStart = true;
          setTimeout(closePopover, 300);
        }
        updateInputs();
        renderCalendar();
      });
    });

    // --- Month nav ---
    popover.querySelector('.dp-prev-month').addEventListener('click', (e) => {
      e.stopPropagation();
      currentMonth.setMonth(currentMonth.getMonth() - 1);
      renderCalendar();
    });
    popover.querySelector('.dp-next-month').addEventListener('click', (e) => {
      e.stopPropagation();
      currentMonth.setMonth(currentMonth.getMonth() + 1);
      renderCalendar();
    });

    // --- Clear button ---
    popover.querySelector('.dp-clear').addEventListener('click', (e) => {
      e.stopPropagation();
      clearRange();
    });

    // --- Today button ---
    popover.querySelector('.dp-today').addEventListener('click', (e) => {
      e.stopPropagation();
      setToday();
    });
  }

  // --- Popover element ---
  const popover = document.createElement('div');
  popover.className = 'date-picker-popover hidden absolute z-50 mt-1 bg-white rounded-xl shadow-2xl border border-black/10 p-3 w-[280px]';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', 'Date range picker');

  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  startInput.parentNode.insertBefore(wrapper, startInput);
  wrapper.appendChild(startInput);
  wrapper.appendChild(popover);

  // --- Toggle popover ---
  function togglePopover(e) {
    e.stopPropagation();
    if (isOpen) {
      closePopover();
    } else {
      openPopover();
    }
  }

  function openPopover() {
    if (isOpen) return;
    if (rangeStart && rangeEnd) {
      selectingStart = true;
    }
    popover.classList.remove('hidden');
    isOpen = true;
    if (rangeStart) {
      currentMonth = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    }
    renderCalendar();
    const rect = startInput.getBoundingClientRect();
    popover.style.top = (rect.height + 4) + 'px';
    popover.style.left = '0';
    const popoverRect = popover.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (popoverRect.right > vw) {
      popover.style.left = (vw - popoverRect.width - 10) + 'px';
    }
    if (popoverRect.bottom > vh) {
      popover.style.top = (rect.top - popoverRect.height - 10) + 'px';
    }
  }

  function closePopover() {
    if (!isOpen) return;
    popover.classList.add('hidden');
    isOpen = false;
  }

  // --- Click toggles ---
  startInput.addEventListener('click', togglePopover);
  endInput.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!isOpen) openPopover();
    startInput.focus();
  });

  // --- Close on outside click ---
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target) && !popover.contains(e.target)) {
      closePopover();
    }
  });

  // --- Keyboard: Escape closes ---
  startInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePopover();
      e.preventDefault();
    }
  });

  // --- Set initial values ---
  if (initialStart) {
    rangeStart = parseDate(initialStart);
    startInput.value = initialStart;
  }
  if (initialEnd) {
    rangeEnd = parseDate(initialEnd);
    endInput.value = initialEnd;
  }
  normalizeRange();
  updateInputs();

  // --- Public API ---
  return {
    destroy: () => wrapper.remove(),
    setRange: (start, end) => {
      rangeStart = start ? parseDate(start) : null;
      rangeEnd = end ? parseDate(end) : null;
      normalizeRange();
      updateInputs();
      if (isOpen) renderCalendar();
    },
    getRange: () => ({
      start: rangeStart ? toDateString(rangeStart) : '',
      end: rangeEnd ? toDateString(rangeEnd) : '',
    }),
  };
}