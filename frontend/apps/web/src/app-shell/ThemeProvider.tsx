const THEME_INIT_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem("ssot-theme");
    var dark = t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme:dark)").matches);
    var theme = dark ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.classList.toggle("light", !dark);
  } catch(e) {}
})();
`;

export function ThemeInitScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
}
