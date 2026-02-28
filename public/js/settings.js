const passwordForm = document.getElementById("change-password-form");
const deleteForm = document.getElementById("delete-account-form");
const currentPassword = document.getElementById("current-password");
const newPassword = document.getElementById("new-password");
const confirmPassword = document.getElementById("confirm-password");
const deletePassword = document.getElementById("delete-password");
const messageBox = document.getElementById("message-box");

passwordForm.addEventListener("submit", (event) => {
  // Kontrola, zda jsou všechna pole vyplněna
  if (!currentPassword.value.trim()) {
    event.preventDefault();
    messageBox.textContent = "";
    const el = document.createElement("div");
    el.className = "message message--error";
    el.textContent = "Current password is required.";
    messageBox.appendChild(el);
    return;
  }

  if (!newPassword.value.trim()) {
    event.preventDefault();
    messageBox.textContent = "";
    const el = document.createElement("div");
    el.className = "message message--error";
    el.textContent = "New password is required.";
    messageBox.appendChild(el);
    return;
  }

  if (!confirmPassword.value.trim()) {
    event.preventDefault();
    messageBox.textContent = "";
    const el = document.createElement("div");
    el.className = "message message--error";
    el.textContent = "Please confirm your new password.";
    messageBox.appendChild(el);
    return;
  }

  // Kontrola délky nového hesla
  if (newPassword.value.length < 8) {
    event.preventDefault();
    messageBox.textContent = "";
    const el = document.createElement("div");
    el.className = "message message--error";
    el.textContent = "New password must be at least 8 characters long.";
    messageBox.appendChild(el);
    return;
  }

  // Kontrola shody hesel
  if (newPassword.value !== confirmPassword.value) {
    event.preventDefault();
    messageBox.textContent = "";
    const el = document.createElement("div");
    el.className = "message message--error";
    el.textContent = "New passwords do not match.";
    messageBox.appendChild(el);
    return;
  }
});

deleteForm.addEventListener("submit", (event) => {
  if (!deletePassword.value.trim()) {
    event.preventDefault();
    messageBox.textContent = "";
    const el = document.createElement("div");
    el.className = "message message--error";
    el.textContent = "Password is required.";
    messageBox.appendChild(el);
    return;
  }
});
