import React, { useEffect, useState } from 'react';
import API from '../api/axios';
import DashboardLayout from '../components/dashboard/DashboardLayout';

function DentistProfile() {
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    license_number: '',
    specialization: '',
    availability: '',
    account_status: '',
    profile_status: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await API.get('/api/dentists/profile', authHeaders);
      const dentist = response.data.dentist;

      setProfile({
        name: dentist.name || '',
        email: dentist.email || '',
        license_number: dentist.license_number || '',
        specialization: dentist.specialization || '',
        availability: dentist.availability || '',
        account_status: dentist.account_status || '',
        profile_status: dentist.profile_status || '',
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load dentist profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setProfile((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !profile.name ||
      !profile.email ||
      !profile.license_number ||
      !profile.specialization ||
      !profile.availability
    ) {
      setError('Please complete all required fields.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');
      setError('');

      const response = await API.put(
        '/api/dentists/profile',
        {
          name: profile.name,
          email: profile.email,
          license_number: profile.license_number,
          specialization: profile.specialization,
          availability: profile.availability,
        },
        authHeaders
      );

      const updatedDentist = response.data.dentist;

      setProfile({
        name: updatedDentist.name || '',
        email: updatedDentist.email || '',
        license_number: updatedDentist.license_number || '',
        specialization: updatedDentist.specialization || '',
        availability: updatedDentist.availability || '',
        account_status: updatedDentist.account_status || '',
        profile_status: updatedDentist.profile_status || '',
      });

      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        localStorage.setItem(
          'user',
          JSON.stringify({
            ...user,
            name: updatedDentist.name,
            email: updatedDentist.email,
          })
        );
      }

      setMessage('Profile updated successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update dentist profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout role="Dentist">
      <div className="profile-container">
        <div className="profile-card">
          <h2>My Profile</h2>
          <p>
            Manage your dentist account details, professional information, and
            availability.
          </p>

          {message && <div className="profile-success">{message}</div>}
          {error && <div className="profile-error">{error}</div>}

          {loading ? (
            <p>Loading profile...</p>
          ) : (
            <form className="profile-form" onSubmit={handleSubmit}>
              <div className="profile-grid">
                <div className="profile-field">
                  <label>Name</label>
                  <input
                    type="text"
                    name="name"
                    value={profile.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="profile-field">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={profile.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="profile-field">
                  <label>License Number</label>
                  <input
                    type="text"
                    name="license_number"
                    value={profile.license_number}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="profile-field">
                  <label>Specialization</label>
                  <input
                    type="text"
                    name="specialization"
                    value={profile.specialization}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="profile-field">
                  <label>Account Status</label>
                  <input
                    type="text"
                    value={profile.account_status || 'Active'}
                    disabled
                  />
                </div>

                <div className="profile-field">
                  <label>Profile Status</label>
                  <input
                    type="text"
                    value={profile.profile_status || 'Active'}
                    disabled
                  />
                </div>
              </div>

              <div className="profile-field">
                <label>Availability</label>
                <textarea
                  name="availability"
                  value={profile.availability}
                  onChange={handleChange}
                  placeholder="Example: Monday to Friday, 9:00 AM - 5:00 PM"
                  required
                />
              </div>

              <button
                type="submit"
                className="profile-button"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default DentistProfile;