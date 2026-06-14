import "../../styles/dashboard.css";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import ThemeToggle from "../ThemeToggle";

function DashboardLayout({ title, subtitle, children }) {
  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  return (
    <div className="dashboard-layout">
      <Sidebar role={user?.role} />

      <main className="dashboard-main">
        <Navbar title={title} subtitle={subtitle} user={user} />

        <ThemeToggle />

        <section className="dashboard-content">{children}</section>
      </main>
    </div>
  );
}

export default DashboardLayout;
