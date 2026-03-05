// Script pro získání aktuálního roku a zobrazení ve footeru pro všechny html stránky
const currentYearElement = document.getElementById("current-year");

currentYearElement.textContent = new Date().getFullYear();
