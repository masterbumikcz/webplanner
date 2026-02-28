// DOM elementy pro interakci s uživatelem
const calendarEl = document.getElementById("calendar");
const titleInput = document.getElementById("event-title");
const startInput = document.getElementById("event-start");
const endInput = document.getElementById("event-end");
const allDayInput = document.getElementById("event-all-day");
const addButton = document.getElementById("event-add");
const saveButton = document.getElementById("event-save");
const deleteButton = document.getElementById("event-delete");
const errorModal = document.getElementById("error-modal");
const errorModalMessage = document.getElementById("error-modal-message");
const errorModalClose = document.getElementById("error-modal-close");

// Proměnná pro sledování aktuálně vybrané události (null při vytváření nové)
let selectedEvent = null;

// Error modal funkce pro zobrazení a skrytí chybových zpráv
function showErrorModal(message) {
  errorModalMessage.textContent = message;
  errorModal.classList.add("active");
}

errorModalClose.onclick = () => {
  errorModal.classList.remove("active");
};

// Převod z lokálního formátu pro input typu datetime-local do UTC ISO formátu
function localDateTimeToUtcIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// Převod z UTC ISO formátu do lokálního formátu pro input typu datetime-local
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

// Převod Z API do formátu pro input
function toInputValue(value, allDay = false) {
  if (!value) return "";
  if (allDay) {
    const datePart = String(value).trim().split("T")[0];
    return `${datePart}T00:00`;
  }
  return utcIsoToLocalDateTime(value);
}

// Převod z inputu do formátu pro API
function toApiValue(value, allDay) {
  if (!value) return null;
  if (allDay) {
    return String(value).trim().split("T")[0];
  }
  return localDateTimeToUtcIso(value);
}

// Načtení událostí z API a zobrazení v kalendáři
async function fetchCalendarEvents() {
  const response = await fetch("/api/calendar");
  if (!response.ok) throw new Error("Failed to load events");
  return response.json();
}

// Funkce pro vytvoření nové události v databázi
async function createCalendarEvent(payload) {
  const response = await fetch("/api/calendar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to create event");
}

// Funkce pro aktualizaci existující události v databázi
async function updateCalendarEvent(eventId, payload) {
  const response = await fetch(`/api/calendar/${eventId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to update event");
}

// Funkce pro odstranění události z databáze
async function deleteCalendarEvent(eventId) {
  const response = await fetch(`/api/calendar/${eventId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete event");
}

// Naplní pravou stranu editoru podle vybraného události
function setEditorState(event) {
  // Pokud není žádná událost vybraná, vyprazdní editor pro vytvoření nové události
  if (!event) {
    selectedEvent = null;
    titleInput.value = "";
    startInput.value = "";
    endInput.value = "";
    allDayInput.checked = true;
    addButton.disabled = false;
    saveButton.disabled = true;
    deleteButton.disabled = true;
    return;
  }

  // Pokud je událost vybraná, naplní editor jejími daty pro úpravu
  selectedEvent = event;
  titleInput.value = event.title || "";
  startInput.value = toInputValue(event.startStr, event.allDay);
  endInput.value = toInputValue(event.endStr, event.allDay);
  allDayInput.checked = event.allDay;
  addButton.disabled = true;
  saveButton.disabled = false;
  deleteButton.disabled = false;
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
  // Nastavení vlastností kalendáře pro knihovnu FullCalendar
  initialView: "dayGridMonth",
  timeZone: "local",
  height: 700,
  expandRows: false,
  fixedWeekCount: true,
  dayMaxEvents: true,
  editable: true,
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
  // Načte vybranou událost do editoru při kliknutí na ni
  eventClick: (info) => {
    setEditorState(info.event);
  },
  // Uložení změn při přesunutí události
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

      if (selectedEvent && selectedEvent.id === info.event.id) {
        setEditorState(info.event);
      }
    } catch (error) {
      info.revert();
      showErrorModal("Error updating event");
    }
  },
  // Uložení změn při změně velikosti události
  eventResize: async (info) => {
    try {
      const startValue = toApiValue(info.event.startStr, info.event.allDay);
      const endValue = toApiValue(info.event.endStr, info.event.allDay);

      await updateCalendarEvent(info.event.id, {
        title: info.event.title,
        start: startValue,
        end: endValue,
        all_day: info.event.allDay,
      });

      if (selectedEvent && selectedEvent.id === info.event.id) {
        setEditorState(info.event);
      }
    } catch (error) {
      info.revert();
      showErrorModal("Error updating event");
    }
  },
  // Načte události z API pro aktuální zobrazení
  events: async (_info, successCallback, failureCallback) => {
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

// Synchronizace all-day s časovými poli a naopak
startInput.oninput = syncAllDayWithTime;
endInput.oninput = syncAllDayWithTime;
allDayInput.onchange = () => {
  normalizeAllDayTimes();
};

// Uložení úprav pro vybranou událost
saveButton.onclick = async () => {
  if (!selectedEvent) {
    showErrorModal("Select an event first");
    return;
  }
  const trimmedTitle = titleInput.value.trim();
  if (!trimmedTitle) {
    showErrorModal("Title is required");
    return;
  }
  if (!startInput.value) {
    showErrorModal("Start date/time is required");
    return;
  }

  // Kontrola, že end není před startem
  if (endInput.value && new Date(startInput.value) > new Date(endInput.value)) {
    showErrorModal("End time cannot be before start time.");
    return;
  }

  // Spuštění funkce pro aktualizaci události v databázi
  try {
    await updateCalendarEvent(selectedEvent.id, {
      title: trimmedTitle,
      start: toApiValue(startInput.value, allDayInput.checked),
      end: toApiValue(endInput.value, allDayInput.checked),
      all_day: Boolean(allDayInput.checked),
    });

    // Po úspěšné aktualizaci znovu načte události a obnoví editor
    calendar.refetchEvents();
    setEditorState(null);
  } catch (error) {
    showErrorModal("Error updating event");
  }
};

// Vytvoření nové události
addButton.onclick = async () => {
  // Pokud je již vybraná událost, nedovolí vytvořit novou
  if (selectedEvent) {
    showErrorModal("Clear selection to add a new event");
    return;
  }

  // Kontrola, že je zadán název a start
  const title = titleInput.value.trim();
  if (!title) {
    showErrorModal("Title is required");
    return;
  }

  if (!startInput.value) {
    showErrorModal("Start date/time is required");
    return;
  }

  // Kontrola, že end není před startem
  if (endInput.value && new Date(startInput.value) > new Date(endInput.value)) {
    showErrorModal("End time cannot be before start time.");
    return;
  }

  try {
    // Spuštění funkce pro vytvoření nové události v databázi
    await createCalendarEvent({
      title,
      start: toApiValue(startInput.value, allDayInput.checked),
      end: toApiValue(endInput.value, allDayInput.checked),
      all_day: allDayInput.checked,
    });

    // Po úspěšném vytvoření znovu načte události
    calendar.refetchEvents();
    setEditorState(null);
  } catch (error) {
    showErrorModal("Error creating event");
  }
};

// Odstranění vybrané události
deleteButton.onclick = async () => {
  if (!selectedEvent) {
    showErrorModal("Select an event first");
    return;
  }

  try {
    // Spuštění funkce pro odstranění události v databázi
    await deleteCalendarEvent(selectedEvent.id);

    // Po úspěšném odstranění znovu načte události a obnoví editor
    calendar.refetchEvents();
    setEditorState(null);
  } catch (error) {
    showErrorModal("Error deleting event");
  }
};

// Inicializace kalendáře a nastavení editoru do výchozího stavu
setEditorState(null);
calendar.render();
