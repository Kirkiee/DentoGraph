import DashboardLayout from '../components/dashboard/DashboardLayout';

function AssistantDashboard() {
    return (
        <DashboardLayout
            title="Dental Assistant Dashboard"
            subtitle="Assist with appointments, records, and X-ray management"
        >
            <div className="dashboard-grid">
                <div className="dashboard-card">
                    <h3>Appointments</h3>
                    <strong>0</strong>
                </div>

                <div className="dashboard-card">
                    <h3>Pending Updates</h3>
                    <strong>0</strong>
                </div>

                <div className="dashboard-card">
                    <h3>X-ray Records</h3>
                    <strong>0</strong>
                </div>

                <div className="dashboard-card">
                    <h3>Notifications</h3>
                    <strong>0</strong>
                </div>
            </div>

            <div className="dashboard-section">
                <h2>Assistant Workspace</h2>
                <p>
                    This area will support appointment handling, record updates, and X-ray
                    upload assistance.
                </p>
            </div>
        </DashboardLayout>
    );
}

export default AssistantDashboard;