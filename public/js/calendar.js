document.addEventListener("DOMContentLoaded", () => {
  // Initialize calendar UI when the DOM is ready
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

  // Tracks the currently selected event (null when creating a new one)
  let selectedEvent = null;

  // Format Date object for datetime-local input value
  const formatDateTimeForInput = (date) => {
    if (!date) return "";
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  // Convert datetime-local value to API format (date only for all-day)
  const normalizeDateValue = (value, allDay) => {
    if (!value) return null;
    return allDay ? value.split("T")[0] : value;
  };

  // Normalize API date strings into datetime-local format
  const formatDateStringForInput = (dateStr) => {
    if (!dateStr) return "";
    if (dateStr.includes("T")) {
      return dateStr.slice(0, 16);
    }
    return `${dateStr}T00:00`;
  };

  // Populate the right-side editor based on selected event
  // Česky: Naplní pravou stranu editoru podle vybraného události
  const setEditorState = (event) => {
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
      formatDateTimeForInput(event.start);
    endInput.value =
      formatDateStringForInput(event.endStr) ||
      formatDateTimeForInput(event.end);
    allDayInput.checked = event.allDay;
    saveButton.disabled = false;
    deleteButton.disabled = false;
    if (helperText) {
      helperText.textContent = "Editing selected event.";
    }
  };

  // Auto-toggle all-day off when a specific time is entered
  const syncAllDayWithTime = () => {
    if (!allDayInput.checked) return;
    const startTime = startInput.value.split("T")[1] || "";
    const endTime = endInput.value.split("T")[1] || "";
    if (
      (startTime && startTime !== "00:00") ||
      (endTime && endTime !== "00:00")
    ) {
      allDayInput.checked = false;
    }
  };

  // When all-day is enabled, force time to 00:00
  const normalizeAllDayTimes = () => {
    if (!allDayInput.checked) return;
    if (startInput.value.includes("T")) {
      startInput.value = `${startInput.value.split("T")[0]}T00:00`;
    }
    if (endInput.value.includes("T")) {
      endInput.value = `${endInput.value.split("T")[0]}T00:00`;
    }
  };

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
    dateClick: async (info) => {
      setEditorState(null);
      startInput.value = formatDateStringForInput(info.dateStr);
      endInput.value = "";
      allDayInput.checked = info.allDay;
      titleInput.focus();
    },
    // Load selected event into the editor
    eventClick: async (info) => {
      setEditorState(info.event);
    },
    editable: true,
    // Persist drag-and-drop updates
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
        alert("Error updating event");
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

  startInput.addEventListener("input", syncAllDayWithTime);
  endInput.addEventListener("input", syncAllDayWithTime);
  allDayInput.addEventListener("change", normalizeAllDayTimes);

  // Save edits for the selected event
  saveButton.addEventListener("click", async () => {
    if (!selectedEvent) {
      alert("Select an event first");
      return;
    }

    const trimmedTitle = titleInput.value.trim();
    if (!trimmedTitle) {
      alert("Title is required");
      return;
    }

    try {
      const res = await fetch(`/api/events/${selectedEvent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          start: normalizeDateValue(startInput.value, allDayInput.checked),
          end: normalizeDateValue(endInput.value, allDayInput.checked),
          all_day: allDayInput.checked,
        }),
      });
      if (!res.ok) throw new Error("Failed to update event");
      selectedEvent.setProp("title", trimmedTitle);
      if (startInput.value) {
        selectedEvent.setStart(
          normalizeDateValue(startInput.value, allDayInput.checked),
        );
      }
      selectedEvent.setEnd(
        normalizeDateValue(endInput.value, allDayInput.checked),
      );
      selectedEvent.setAllDay(allDayInput.checked);
    } catch (error) {
      alert("Error updating event");
    }
  });

  // Create a new event from the editor
  addButton.addEventListener("click", async () => {
    const title = titleInput.value.trim();
    if (!title) {
      alert("Title is required");
      return;
    }

    if (!startInput.value) {
      alert("Start date/time is required");
      return;
    }

    if (selectedEvent) {
      alert("Clear selection to add a new event");
      return;
    }

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          start: normalizeDateValue(startInput.value, allDayInput.checked),
          end: normalizeDateValue(endInput.value, allDayInput.checked),
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
      alert("Error creating event");
    }
  });

  // Delete the selected event
  deleteButton.addEventListener("click", async () => {
    if (!selectedEvent) {
      alert("Select an event first");
      return;
    }

    if (!confirm("Delete this event?")) return;

    try {
      const res = await fetch(`/api/events/${selectedEvent.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete event");
      selectedEvent.remove();
      setEditorState(null);
    } catch (error) {
      alert("Error deleting event");
    }
  });

  setEditorState(null);
});
