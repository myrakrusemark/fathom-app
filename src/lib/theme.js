/**
 * Apply a CSS theme by injecting/swapping a <link> stylesheet that cascades
 * after the base app.css.  Pass null to revert to the default (light) theme.
 */
export function applyTheme(themeId) {
  let link = document.getElementById("fathom-theme");

  if (!themeId) {
    if (link) link.remove();
    localStorage.removeItem("fathom-theme");
    return;
  }

  if (!link) {
    link = document.createElement("link");
    link.id = "fathom-theme";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }

  // Relative path — works via vite proxy (dev) and same-origin (prod)
  const href = `/api/themes/${themeId}.css`;

  if (link.getAttribute("href") !== href) {
    link.href = href;
  }

  localStorage.setItem("fathom-theme", themeId);
}
