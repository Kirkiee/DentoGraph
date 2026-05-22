import DashboardLayout from '../components/dashboard/DashboardLayout';

function DentistDashboard() {
    return (
        <DashboardLayout
            title="Dentist Dashboard"
            subtitle="Manage patient records, appointments, treatments, and X-rays"
        >
            <div className="dashboard-grid">
                <div className="dashboard-card">
                    <h3>Appointments Today</h3>
                    <strong>0</strong>
                </div>

                <div className="dashboard-card">
                    <h3>Patient Records</h3>
                    <strong>0</strong>
                </div>

                <div className="dashboard-card">
                    <h3>X-rays Uploaded</h3>
                    <strong>0</strong>
                </div>

                <div className="dashboard-card">
                    <h3>Treatments</h3>
                    <strong>0</strong>
                </div>
            </div>

            <div className="dashboard-section">
                <h2>Clinical Overview</h2>
                <p>
                    This dashboard will show assigned appointments, patient dental records,
                    X-ray uploads, and treatment tracking.
                </p>
            </div>
        </DashboardLayout>
    );
}

export default DentistDashboard;