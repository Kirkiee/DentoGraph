import React, { useEffect, useState } from 'react';
import API from '../api/axios';
import DashboardLayout from '../components/dashboard/DashboardLayout';

function PatientProfile() {
    const [profile, setProfile] = useState(null);
    const [formData, setFormData] = useState({
        contact_number: '',
        date_of_birth: '',
        address: '',
        gender: '',
        medical_history: '',
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profileExists, setProfileExists] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const token = localStorage.getItem('token');

    const authHeaders = {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    };

    useEffect(() => {
        fetchPatientProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchPatientProfile = async () => {
        try {
            const response = await API.get('/api/patients/profile', authHeaders);

            const patient = response.data.patient;
            setProfile(patient);
            setProfileExists(true);

            setFormData({
                contact_number: patient.contact_number || '',
                date_of_birth: patient.date_of_birth
                    ? patient.date_of_birth.split('T')[0]
                    : '',
                address: patient.address || '',
                gender: patient.gender || '',
                medical_history: patient.medical_history || '',
            });
        } catch (err) {
            if (err.response?.status === 404) {
                setProfileExists(false);
            } else {
                setError('Unable to load patient profile.');
            }
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');
        setError('');

        try {
            if (profileExists) {
                await API.put('/api/patients/profile', formData, authHeaders);
                setMessage('Patient profile updated successfully.');
            } else {
                await API.post('/api/patients/profile', formData, authHeaders);
                setMessage('Patient profile created successfully.');
                setProfileExists(true);
            }

            fetchPatientProfile();
        } catch (err) {
            setError(err.response?.data?.error || 'Unable to save patient profile.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout
                title="Patient Profile"
                subtitle="Manage your personal and medical information"
            >
                <div className="dashboard-section">
                    <p>Loading profile...</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout
            title="Patient Profile"
            subtitle="Manage your personal and medical information"
        >
            <div className="profile-container">
                <div className="profile-card">
                    <h2>{profileExists ? 'Update Patient Profile' : 'Complete Patient Profile'}</h2>
                    <p>
                        Fill in your personal details so the clinic can properly manage your
                        dental records and appointments.
                    </p>

                    {message && <div className="profile-success">{message}</div>}
                    {error && <div className="profile-error">{error}</div>}

                    <form onSubmit={handleSubmit} className="profile-form">
                        <div className="profile-grid">
                            <div className="profile-field">
                                <label>Contact Number</label>
                                <input
                                    type="text"
                                    name="contact_number"
                                    placeholder="09123456789"
                                    value={formData.contact_number}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="profile-field">
                                <label>Date of Birth</label>
                                <input
                                    type="date"
                                    name="date_of_birth"
                                    value={formData.date_of_birth}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="profile-field">
                            <label>Address</label>
                            <input
                                type="text"
                                name="address"
                                placeholder="Enter your address"
                                value={formData.address}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="profile-field">
                            <label>Gender</label>
                            <select
                                name="gender"
                                value={formData.gender}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Select gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Prefer not to say">Prefer not to say</option>
                            </select>
                        </div>

                        <div className="profile-field">
                            <label>Medical History</label>
                            <textarea
                                name="medical_history"
                                placeholder="Enter allergies, existing conditions, medications, or type N/A"
                                value={formData.medical_history}
                                onChange={handleChange}
                                rows="5"
                            />
                        </div>

                        <button type="submit" className="profile-button" disabled={saving}>
                            {saving
                                ? 'Saving...'
                                : profileExists
                                    ? 'Update Profile'
                                    : 'Create Profile'}
                        </button>
                    </form>
                </div>
            </div>
        </DashboardLayout>
    );
}

export default PatientProfile;