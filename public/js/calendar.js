document.addEventListener("DOMContentLoaded", () => {
  // Inicializace kalendáře po načtení DOM
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;

  const titleInput = document.getElementById("event-title");
  const startInput = document.getElementById("event-start");
  const endInput = document.getElementById("event-end");
  const allDayInput = document.getElementById("event-all-day");
  const addButton = document.getElementById("event-add");
  const saveButton = document.getElementById("event-save");
  const deleteButton = document.getElementById("event-delete");
  const helperText = document.getElementById("event-helper");
  const eventFeedback = document.getElementById("event-feedback");

  // Sleduje aktuálně vybranou událost (event) (null při vytváření nové)
  let selectedEvent = null;

  // Vyčistí zpětnou vazbu pro uživatele
  function clearFeedback() {
    if (!eventFeedback) {
      return;
    }

    eventFeedback.hidden = true;
    eventFeedback.textContent = "";
  }

  // Zobrazí zpětnou vazbu pro uživatele
  function showFeedback(message) {
    if (!eventFeedback) {
      return;
    }

    eventFeedback.textContent = message;
    eventFeedback.hidden = false;
  }

  // Převod JavaScript Date objektu do formátu očekávaného datetime-local inputem
  function toDateTimeInputValue(date) {
    if (!date) return "";
    return date.toISOString().slice(0, 16);
  }

  // Převod hodnot z datetime-local inputů do formátu očekávaného API (odstraní čas pro all-day události)
  function toApiDateValue(value, allDay) {
    if (!value) return null;
    return allDay ? value.split("T")[0] : value;
  }

  // Normalizuje API date strings do formátu očekávaného datetime-local inputem
  function formatDateStringForInput(dateStr) {
    if (!dateStr) return "";
    if (dateStr.includes("T")) {
      return dateStr.slice(0, 16);
    }
    return `${dateStr}T00:00`;
  }

  // Naplní pravou stranu editoru podle vybraného události
  function setEditorState(event) {
    if (!event) {
      selectedEvent = null;
      titleInput.value = "";
      startInput.value = "";
      endInput.value = "";
      allDayInput.checked = true;
      saveButton.disabled = true;
      deleteButton.disabled = true;
      if (helperText) {
        helperText.textContent =
          "Select a date to add, or an event to edit/delete.";
      }
      return;
    }

    selectedEvent = event;
    titleInput.value = event.title || "";
    startInput.value =
      formatDateStringForInput(event.startStr) ||
      toDateTimeInputValue(event.start);
    endInput.value =
      formatDateStringForInput(event.endStr) || toDateTimeInputValue(event.end);
    allDayInput.checked = event.allDay;
    saveButton.disabled = false;
    deleteButton.disabled = false;
    if (helperText) {
      helperText.textContent = "Editing selected event.";
    }
  }

  // Auto-toggle all-day off when a specific time is entered
  function syncAllDayWithTime() {
    if (!allDayInput.checked) return;
    const startTime = startInput.value.split("T")[1] || "";
    const endTime = endInput.value.split("T")[1] || "";
    if (
      (startTime && startTime !== "00:00") ||
      (endTime && endTime !== "00:00")
    ) {
      allDayInput.checked = false;
    }
  }

  // When all-day is enabled, force time to 00:00
  function normalizeAllDayTimes() {
    if (!allDayInput.checked) return;
    if (startInput.value.includes("T")) {
      startInput.value = `${startInput.value.split("T")[0]}T00:00`;
    }
    if (endInput.value.includes("T")) {
      endInput.value = `${endInput.value.split("T")[0]}T00:00`;
    }
  }

  // FullCalendar configuration
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    height: 700,
    expandRows: false,
    fixedWeekCount: true,
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay",
    },
    // Prefill the editor when clicking a day cell
    dateClick: (info) => {
      clearFeedback();
      setEditorState(null);
      startInput.value = formatDateStringForInput(info.dateStr);
      endInput.value = "";
      allDayInput.checked = info.allDay;
      titleInput.focus();
    },
    // Load selected event into the editor
    eventClick: (info) => {
      clearFeedback();
      setEditorState(info.event);
    },
    editable: true,
    // Uložit změny při přetažení události
    eventDrop: async (info) => {
      try {
        const res = await fetch(`/api/events/${info.event.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: info.event.title,
            start: info.event.startStr,
            end: info.event.endStr || null,
            all_day: info.event.allDay,
          }),
        });
        if (!res.ok) throw new Error("Failed to update event");
      } catch (error) {
        info.revert();
        showFeedback("Error updating event");
      }
    },
    // Fetch events from the API for the current view
    events: async (info, successCallback, failureCallback) => {
      try {
        const res = await fetch("/api/events");
        if (!res.ok) throw new Error("Failed to load events");
        const events = await res.json();
        successCallback(
          events.map((event) => ({
            id: event.id,
            title: event.title,
            start: event.start,
            end: event.end || null,
            allDay: Boolean(event.all_day),
          })),
        );
      } catch (error) {
        console.error("Error loading calendar events:", error);
        failureCallback(error);
      }
    },
  });

  calendar.render();

  startInput.addEventListener("input", () => {
    clearFeedback();
    syncAllDayWithTime();
  });
  endInput.addEventListener("input", () => {
    clearFeedback();
    syncAllDayWithTime();
  });
  allDayInput.addEventListener("change", () => {
    clearFeedback();
    normalizeAllDayTimes();
  });
  titleInput.addEventListener("input", clearFeedback);

  // Save edits for the selected event
  saveButton.addEventListener("click", async () => {
    clearFeedback();

    if (!selectedEvent) {
      showFeedback("Select an event first");
      return;
    }

    const trimmedTitle = titleInput.value.trim();
    if (!trimmedTitle) {
      showFeedback("Title is required");
      return;
    }

    try {
      const res = await fetch(`/api/events/${selectedEvent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          start: toApiDateValue(startInput.value, allDayInput.checked),
          end: toApiDateValue(endInput.value, allDayInput.checked),
          all_day: allDayInput.checked,
        }),
      });
      if (!res.ok) throw new Error("Failed to update event");

      selectedEvent.setProp("title", trimmedTitle);
      if (startInput.value) {
        selectedEvent.setStart(
          toApiDateValue(startInput.value, allDayInput.checked),
        );
      }
      selectedEvent.setEnd(toApiDateValue(endInput.value, allDayInput.checked));
      selectedEvent.setAllDay(allDayInput.checked);
    } catch (error) {
      showFeedback("Error updating event");
    }
  });

  // Vytvoření nové události
  addButton.addEventListener("click", async () => {
    clearFeedback();

    const title = titleInput.value.trim();
    if (!title) {
      showFeedback("Title is required");
      return;
    }

    if (!startInput.value) {
      showFeedback("Start date/time is required");
      return;
    }

    if (selectedEvent) {
      showFeedback("Clear selection to add a new event");
      return;
    }

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          start: toApiDateValue(startInput.value, allDayInput.checked),
          end: toApiDateValue(endInput.value, allDayInput.checked),
          all_day: allDayInput.checked,
        }),
      });
      if (!res.ok) throw new Error("Failed to create event");

      titleInput.value = "";
      startInput.value = "";
      endInput.value = "";
      allDayInput.checked = true;
      calendar.refetchEvents();
    } catch (error) {
      showFeedback("Error creating event");
    }
  });

  // Odstranění vybrané události
  deleteButton.addEventListener("click", async () => {
    clearFeedback();

    if (!selectedEvent) {
      showFeedback("Select an event first");
      return;
    }

    try {
      const res = await fetch(`/api/events/${selectedEvent.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete event");

      selectedEvent.remove();
      setEditorState(null);
    } catch (error) {
      showFeedback("Error deleting event");
    }
  });

  setEditorState(null);
});
