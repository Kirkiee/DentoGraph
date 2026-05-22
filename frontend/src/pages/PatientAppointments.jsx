import React, { useEffect, useState } from 'react';
import API from '../api/axios';
import DashboardLayout from '../components/dashboard/DashboardLayout';

function PatientAppointments() {
    const [appointments, setAppointments] = useState([]);
    const [formData, setFormData] = useState({
        dentist_id: '',
        appointment_date: '',
        appointment_type: 'Dental Consultation',
        notes: '',
    });

    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const token = localStorage.getItem('token');

    const authHeaders = {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    };

    useEffect(() => {
        fetchAppointments();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchAppointments = async () => {
        try {
            const response = await API.get('/api/appointments/my-appointments', authHeaders);
            setAppointments(response.data.appointments || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Unable to load appointments.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    const handleBookAppointment = async (e) => {
        e.preventDefault();
        setBooking(true);
        setMessage('');
        setError('');

        try {
            await API.post(
                '/api/appointments',
                {
                    dentist_id: Number(formData.dentist_id),
                    appointment_date: formData.appointment_date.replace('T', ' '),
                    appointment_type: formData.appointment_type,
                    notes: formData.notes,
                },
                authHeaders
            );

            setMessage('Appointment booked successfully. Please wait for confirmation.');

            setFormData({
                dentist_id: '',
                appointment_date: '',
                appointment_type: 'Dental Consultation',
                notes: '',
            });

            fetchAppointments();
        } catch (err) {
            setError(err.response?.data?.error || 'Unable to book appointment.');
        } finally {
            setBooking(false);
        }
    };

    const handleCancelAppointment = async (appointmentId) => {
        const reason = window.prompt('Please enter your reason for cancellation:');

        if (reason === null) return;

        try {
            await API.put(
                `/api/appointments/${appointmentId}/cancel`,
                {
                    cancellation_reason: reason || 'No reason provided',
                },
                authHeaders
            );

            setMessage('Appointment cancelled successfully.');
            fetchAppointments();
        } catch (err) {
            setError(err.response?.data?.error || 'Unable to cancel appointment.');
        }
    };

    const handleRescheduleAppointment = async (appointmentId) => {
        const newDate = window.prompt(
            'Enter new appointment date and time using this format: YYYY-MM-DD HH:MM:SS'
        );

        if (!newDate) return;

        try {
            await API.put(
                `/api/appointments/${appointmentId}/reschedule`,
                {
                    new_appointment_date: newDate,
                },
                authHeaders
            );

            setMessage('Reschedule request submitted successfully.');
            fetchAppointments();
        } catch (err) {
            setError(err.response?.data?.error || 'Unable to request reschedule.');
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'Scheduled':
                return 'status-badge status-scheduled';
            case 'Completed':
                return 'status-badge status-completed';
            case 'Cancelled':
                return 'status-badge status-cancelled';
            default:
                return 'status-badge status-pending';
        }
    };

    return (
        <DashboardLayout
            title="Appointments"
            subtitle="Book appointments and manage your dental visit requests"
        >
            <div className="appointments-layout">
                <div className="appointment-form-card">
                    <h2>Book New Appointment</h2>
                    <p>
                        Select your preferred dentist, appointment date, and visit type. Your
                        appointment will be marked as pending until confirmed by the clinic.
                    </p>

                    {message && <div className="profile-success">{message}</div>}
                    {error && <div className="profile-error">{error}</div>}

                    <form onSubmit={handleBookAppointment} className="appointment-form">
                        <div className="profile-field">
                            <label>Dentist ID</label>
                            <input
                                type="number"
                                name="dentist_id"
                                placeholder="Enter dentist ID"
                                value={formData.dentist_id}
                                onChange={handleChange}
                                required
                            />
                            <small>
                                For now, enter the dentist ID from the database. Later, this can be changed into a dropdown.
                            </small>
                        </div>

                        <div className="profile-field">
                            <label>Appointment Date and Time</label>
                            <input
                                type="datetime-local"
                                name="appointment_date"
                                value={formData.appointment_date}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="profile-field">
                            <label>Appointment Type</label>
                            <select
                                name="appointment_type"
                                value={formData.appointment_type}
                                onChange={handleChange}
                                required
                            >
                                <option value="Dental Consultation">Dental Consultation</option>
                                <option value="Cleaning">Cleaning</option>
                                <option value="Tooth Extraction">Tooth Extraction</option>
                                <option value="Dental Filling">Dental Filling</option>
                                <option value="Orthodontic Consultation">Orthodontic Consultation</option>
                                <option value="X-ray Review">X-ray Review</option>
                            </select>
                        </div>

                        <div className="profile-field">
                            <label>Notes</label>
                            <textarea
                                name="notes"
                                placeholder="Describe your concern or reason for visit"
                                value={formData.notes}
                                onChange={handleChange}
                                rows="4"
                            />
                        </div>

                        <button type="submit" className="profile-button" disabled={booking}>
                            {booking ? 'Booking...' : 'Book Appointment'}
                        </button>
                    </form>
                </div>

                <div className="appointments-list-card">
                    <div className="appointments-header">
                        <div>
                            <h2>My Appointments</h2>
                            <p>Track your appointment requests and confirmed schedules.</p>
                        </div>
                    </div>

                    {loading ? (
                        <p>Loading appointments...</p>
                    ) : appointments.length === 0 ? (
                        <div className="empty-state">
                            <h3>No appointments yet</h3>
                            <p>Your booked appointments will appear here.</p>
                        </div>
                    ) : (
                        <div className="appointments-list">
                            {appointments.map((appointment) => (
                                <div className="appointment-item" key={appointment.appointment_id}>
                                    <div className="appointment-info">
                                        <div className="appointment-title-row">
                                            <h3>{appointment.appointment_type}</h3>
                                            <span className={getStatusClass(appointment.status)}>
                                                {appointment.status}
                                            </span>
                                        </div>

                                        <p>
                                            <strong>Dentist:</strong>{' '}
                                            {appointment.dentist_name || `Dentist ID ${appointment.dentist_id}`}
                                        </p>

                                        <p>
                                            <strong>Date:</strong>{' '}
                                            {new Date(appointment.appointment_date).toLocaleString()}
                                        </p>

                                        {appointment.notes && (
                                            <p>
                                                <strong>Notes:</strong> {appointment.notes}
                                            </p>
                                        )}

                                        {appointment.cancellation_reason && (
                                            <p>
                                                <strong>Cancellation Reason:</strong>{' '}
                                                {appointment.cancellation_reason}
                                            </p>
                                        )}
                                    </div>

                                    {appointment.status !== 'Cancelled' &&
                                        appointment.status !== 'Completed' && (
                                            <div className="appointment-actions">
                                                <button
                                                    className="secondary-button"
                                                    onClick={() =>
                                                        handleRescheduleAppointment(appointment.appointment_id)
                                                    }
                                                >
                                                    Reschedule
                                                </button>

                                                <button
                                                    className="danger-button"
                                                    onClick={() =>
                                                        handleCancelAppointment(appointment.appointment_id)
                                                    }
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}

export default PatientAppointments;