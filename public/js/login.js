const form = document.getElementById("login-form");
const email = document.getElementById("email");
const password = document.getElementById("password");
const messageBox = document.getElementById("message-box");

form.addEventListener("submit", (event) => {
  // Kontrola, zda jsou všechna pole vyplněna
  if (!email.value.trim()) {
    event.preventDefault();
    messageBox.textContent = "";
    const el = document.createElement("div");
    el.className = "message message--error";
    el.textContent = "E-mail is required.";
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

  // Kontrola formátu e-mailu
  if (!email.checkValidity()) {
    event.preventDefault();
    messageBox.textContent = "";
    const el = document.createElement("div");
    el.className = "message message--error";
    el.textContent = "Please enter a valid e-mail address.";
    messageBox.appendChild(el);
    return;
  }
});
