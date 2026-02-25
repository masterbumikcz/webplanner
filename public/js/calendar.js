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
  const errorModal = document.getElementById("error-modal");
  const errorModalMessage = document.getElementById("error-modal-message");
  const errorModalClose = document.getElementById("error-modal-close");

  // Sleduje aktuálně vybranou událost (event) (null při vytváření nové)
  let selectedEvent = null;

  // Error modal funkce pro zobrazení a skrytí chybových zpráv
  function showErrorModal(message) {
    errorModalMessage.textContent = message;
    errorModal.classList.add("active");
  }

  errorModalClose.onclick = () => {
    errorModal.classList.remove("active");
  };

  function localDateTimeToUtcIso(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function utcIsoToLocalDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function toInputValue(value, allDay = false) {
    if (!value) return "";
    if (allDay) {
      const datePart = String(value).trim().split("T")[0];
      return `${datePart}T00:00`;
    }
    return utcIsoToLocalDateTime(value);
  }

  function toApiValue(value, allDay) {
    if (!value) return null;
    if (allDay) {
      return String(value).trim().split("T")[0];
    }
    return localDateTimeToUtcIso(value);
  }

  async function fetchCalendarEvents() {
    const response = await fetch("/api/events");
    if (!response.ok) throw new Error("Failed to load events");
    return response.json();
  }

  async function createCalendarEvent(payload) {
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Failed to create event");
  }

  async function updateCalendarEvent(eventId, payload) {
    const response = await fetch(`/api/events/${eventId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Failed to update event");
  }

  async function deleteCalendarEvent(eventId) {
    const response = await fetch(`/api/events/${eventId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete event");
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
    startInput.value = toInputValue(event.startStr, event.allDay);
    endInput.value = toInputValue(event.endStr, event.allDay);
    allDayInput.checked = event.allDay;
    saveButton.disabled = false;
    deleteButton.disabled = false;
    if (helperText) {
      helperText.textContent = "Editing selected event.";
    }
  }

  // Automaticky vypne all-day, když je zadán konkrétní čas
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

  // Když je all-day povoleno, vynutí čas 00:00
  function normalizeAllDayTimes() {
    if (!allDayInput.checked) return;
    if (startInput.value.includes("T")) {
      startInput.value = `${startInput.value.split("T")[0]}T00:00`;
    }
    if (endInput.value.includes("T")) {
      endInput.value = `${endInput.value.split("T")[0]}T00:00`;
    }
  }

  // Konfigurace a inicializace FullCalendar
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    timeZone: "local",
    height: 700,
    expandRows: false,
    fixedWeekCount: true,
    dayMaxEvents: true,
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay",
    },
    // Předvyplní editor při kliknutí na prázdnou buňku
    dateClick: (info) => {
      setEditorState(null);
      startInput.value = toInputValue(info.dateStr, info.allDay);
      endInput.value = "";
      allDayInput.checked = info.allDay;
      titleInput.focus();
    },
    // Načte vybranou událost do editoru
    eventClick: (info) => {
      setEditorState(info.event);
    },
    editable: true,
    // Uložit změny při přetažení události
    eventDrop: async (info) => {
      try {
        const startValue = toApiValue(info.event.startStr, info.event.allDay);
        const endValue = toApiValue(info.event.endStr, info.event.allDay);

        await updateCalendarEvent(info.event.id, {
          title: info.event.title,
          start: startValue,
          end: endValue,
          all_day: info.event.allDay,
        });
      } catch (error) {
        info.revert();
        showErrorModal("Error updating event");
      }
    },
    // Načte události z API pro aktuální zobrazení
    events: async (info, successCallback, failureCallback) => {
      try {
        const events = await fetchCalendarEvents();
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
        showErrorModal("Unable to load calendar events. Please try again.");
        failureCallback(error);
      }
    },
  });

  calendar.render();

  const handleDateInputChange = () => {
    syncAllDayWithTime();
  };

  startInput.addEventListener("input", handleDateInputChange);
  endInput.addEventListener("input", handleDateInputChange);
  allDayInput.addEventListener("change", () => {
    normalizeAllDayTimes();
  });

  // Uložení úprav pro vybranou událost
  saveButton.addEventListener("click", async () => {
    if (!selectedEvent) {
      showErrorModal("Select an event first");
      return;
    }
    const trimmedTitle = titleInput.value.trim();
    if (!trimmedTitle) {
      showErrorModal("Title is required");
      return;
    }

    // Odeslání aktualizace na server
    try {
      await updateCalendarEvent(selectedEvent.id, {
        title: trimmedTitle,
        start: toApiValue(startInput.value, allDayInput.checked),
        end: toApiValue(endInput.value, allDayInput.checked),
        all_day: Boolean(allDayInput.checked),
      });

      // Aktualizace události v kalendáři
      selectedEvent.setProp("title", trimmedTitle);
      if (startInput.value) {
        selectedEvent.setStart(
          toApiValue(startInput.value, allDayInput.checked),
        );
      }
      selectedEvent.setEnd(toApiValue(endInput.value, allDayInput.checked));
      selectedEvent.setAllDay(allDayInput.checked);
    } catch (error) {
      showErrorModal("Error updating event");
    }
  });

  // Vytvoření nové události
  addButton.addEventListener("click", async () => {
    const title = titleInput.value.trim();
    if (!title) {
      showErrorModal("Title is required");
      return;
    }

    if (!startInput.value) {
      showErrorModal("Start date/time is required");
      return;
    }

    if (selectedEvent) {
      showErrorModal("Clear selection to add a new event");
      return;
    }

    try {
      await createCalendarEvent({
        title,
        start: toApiValue(startInput.value, allDayInput.checked),
        end: toApiValue(endInput.value, allDayInput.checked),
        all_day: allDayInput.checked,
      });

      titleInput.value = "";
      startInput.value = "";
      endInput.value = "";
      allDayInput.checked = true;
      calendar.refetchEvents();
    } catch (error) {
      showErrorModal("Error creating event");
    }
  });

  // Odstranění vybrané události
  deleteButton.addEventListener("click", async () => {
    if (!selectedEvent) {
      showErrorModal("Select an event first");
      return;
    }

    try {
      await deleteCalendarEvent(selectedEvent.id);

      selectedEvent.remove();
      setEditorState(null);
    } catch (error) {
      showErrorModal("Error deleting event");
    }
  });

  setEditorState(null);
});
