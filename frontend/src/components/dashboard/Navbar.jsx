function Navbar({ title, subtitle, user }) {
    return (
        <header className="dashboard-navbar">
            <div className="navbar-title">
                <h1>{title}</h1>
                <p>{subtitle}</p>
            </div>

            <div className="navbar-user">
                <strong>{user?.name || 'User'}</strong>
                <span>{user?.role || 'Role'}</span>
            </div>
        </header>
    );
}

export default Navbar;