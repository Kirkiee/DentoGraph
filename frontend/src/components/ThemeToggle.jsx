function ThemeToggle() {
  const currentTheme = localStorage.getItem("dentograph-theme") || "light";

  const toggleTheme = () => {
    const nextTheme = currentTheme === "dark" ? "light" : "dark";

    localStorage.setItem("dentograph-theme", nextTheme);

    document.body.classList.remove("light-mode", "dark-mode");
    document.body.classList.add(
      nextTheme === "dark" ? "dark-mode" : "light-mode",
    );

    window.dispatchEvent(new Event("dentograph-theme-change"));
  };

  return (
    <button
      type="button"
      className="theme-toggle-button"
      onClick={toggleTheme}
      title={
        currentTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
    >
      {currentTheme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
    </button>
  );
}

export default ThemeToggle;
