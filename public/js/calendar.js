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

  // Převod hodnot z inputů do formátu pro API (all-day normalizuje čas na 00:00)
  function toApiDateValue(value, allDay) {
    if (!value) return null;
    return allDay ? `${value.split("T")[0]}T00:00` : value;
  }

  // Převod hodnot z API do formátu pro datetime-local inputy (pokud chybí čas, doplní 00:00)
  function toInputDateValue(value) {
    if (!value) return "";
    const dateStr = String(value);
    if (dateStr.includes("T")) {
      return dateStr;
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
    startInput.value = toInputDateValue(event.startStr);
    endInput.value = toInputDateValue(event.endStr);
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
      startInput.value = toInputDateValue(info.dateStr);
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
        showErrorModal("Error updating event");
      }
    },
    // Načte události z API pro aktuální zobrazení
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

      // Aktualizace události v kalendáři
      selectedEvent.setProp("title", trimmedTitle);
      if (startInput.value) {
        selectedEvent.setStart(
          toApiDateValue(startInput.value, allDayInput.checked),
        );
      }
      selectedEvent.setEnd(toApiDateValue(endInput.value, allDayInput.checked));
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
      const res = await fetch(`/api/events/${selectedEvent.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete event");

      selectedEvent.remove();
      setEditorState(null);
    } catch (error) {
      showErrorModal("Error deleting event");
    }
  });

  setEditorState(null);
});
