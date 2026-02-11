// Zobrazení flash zpráv po registraci nebo přihlášení
window.addEventListener("DOMContentLoaded", async () => {
  const response = await fetch("/api/messages");
  const messages = await response.json();
  const messageBox = document.getElementById("message-box");
  if (!messageBox) return;

  messageBox.textContent = "";

  const appendMessages = (items, type) => {
    items.forEach((msg) => {
      const el = document.createElement("div");
      el.className = `message message--${type}`;
      el.textContent = msg;
      messageBox.appendChild(el);
    });
  };
  // Zobrazení chybových nebo úspěšných zpráv pokud existují
  if (messages.error && messages.error.length > 0) {
    appendMessages(messages.error, "error");
  }

  if (messages.success && messages.success.length > 0) {
    appendMessages(messages.success, "success");
  }
});
