window.addEventListener("DOMContentLoaded", async () => {
  const response = await fetch("/api/messages");
  const messages = await response.json();

  if (messages.error && messages.error.length > 0) {
    messages.error.forEach((msg) => {
      alert(msg);
    });
  }

  if (messages.success && messages.success.length > 0) {
    messages.success.forEach((msg) => {
      alert(msg);
    });
  }
});
