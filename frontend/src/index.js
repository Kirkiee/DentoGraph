import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

document.documentElement.classList.remove("light-mode");
document.documentElement.classList.add("dark-mode");

document.body.classList.remove("light-mode");
document.body.classList.add("dark-mode");

localStorage.setItem("dentograph-theme", "dark");

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

reportWebVitals();
