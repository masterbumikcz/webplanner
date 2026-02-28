// Skript pro kontrolu hesla na frontendu a zobrazení chybových zpráv
const params = new URLSearchParams(window.location.search);
const token = params.get("token");
const tokenInput = document.getElementById("token");
const form = document.getElementById("reset-form");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const messageBox = document.getElementById("message-box");
if (tokenInput && token) {
  tokenInput.value = token;
}

form.addEventListener("submit", (event) => {
  // Kontrola, zda jsou všechna pole vyplněna
  if (!tokenInput || !tokenInput.value.trim()) {
    event.preventDefault();
    messageBox.textContent = "";
    const el = document.createElement("div");
    el.className = "message message--error";
    el.textContent =
      "Reset token is missing. Please open the reset link again.";
    messageBox.appendChild(el);
    return;
  }

  if (!password.value.trim()) {
    event.preventDefault();
    messageBox.textContent = "";
    const el = document.createElement("div");
    el.className = "message message--error";
    el.textContent = "Password is required.";
    messageBox.appendChild(el);
    return;
  }

  if (!confirmPassword.value.trim()) {
    event.preventDefault();
    messageBox.textContent = "";
    const el = document.createElement("div");
    el.className = "message message--error";
    el.textContent = "Please confirm your password.";
    messageBox.appendChild(el);
    return;
  }

  // Kontrola délky hesla
  if (password.value.length < 8) {
    event.preventDefault();
    messageBox.textContent = "";
    const el = document.createElement("div");
    el.className = "message message--error";
    el.textContent = "Password must be at least 8 characters long.";
    messageBox.appendChild(el);
    return;
  }

  // Kontrola shody hesel
  if (password.value !== confirmPassword.value) {
    event.preventDefault();
    messageBox.textContent = "";
    const el = document.createElement("div");
    el.className = "message message--error";
    el.textContent = "Passwords do not match.";
    messageBox.appendChild(el);
  }
});
