import DashboardLayout from '../components/dashboard/DashboardLayout';

function PatientDashboard() {
    return (
        <DashboardLayout
            title="Patient Dashboard"
            subtitle="View your appointments, records, and X-ray history"
        >
            <div className="dashboard-grid">
                <div className="dashboard-card">
                    <h3>Upcoming Appointments</h3>
                    <strong>0</strong>
                </div>

                <div className="dashboard-card">
                    <h3>Dental Records</h3>
                    <strong>0</strong>
                </div>

                <div className="dashboard-card">
                    <h3>X-ray Images</h3>
                    <strong>0</strong>
                </div>

                <div className="dashboard-card">
                    <h3>Notifications</h3>
                    <strong>0</strong>
                </div>
            </div>

            <div className="dashboard-section">
                <h2>Welcome to DentoGraph</h2>
                <p>
                    This is your patient portal where you can manage appointments, view your
                    dental records, and access uploaded X-ray files once your clinic adds them.
                </p>
            </div>
        </DashboardLayout>
    );
}

export default PatientDashboard;