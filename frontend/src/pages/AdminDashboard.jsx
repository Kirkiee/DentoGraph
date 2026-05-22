import DashboardLayout from '../components/dashboard/DashboardLayout';

function AdminDashboard() {
    return (
        <DashboardLayout
            title="Admin Dashboard"
            subtitle="Manage system users, clinics, subscriptions, and reports"
        >
            <div className="dashboard-grid">
                <div className="dashboard-card">
                    <h3>Users</h3>
                    <strong>0</strong>
                </div>

                <div className="dashboard-card">
                    <h3>Clinics</h3>
                    <strong>0</strong>
                </div>

                <div className="dashboard-card">
                    <h3>Subscriptions</h3>
                    <strong>0</strong>
                </div>

                <div className="dashboard-card">
                    <h3>Reports</h3>
                    <strong>0</strong>
                </div>
            </div>

            <div className="dashboard-section">
                <h2>System Management</h2>
                <p>
                    This dashboard will be used for managing clinic subscriptions, users,
                    access roles, and system-wide reports.
                </p>
            </div>
        </DashboardLayout>
    );
}

export default AdminDashboard;