import { notify } from '../Feedback/Feedback';
import React, { useState, useEffect } from 'react';
import { userApi } from '../../services/api'; // שימוש ב-userApi
import './UserForm.css';

function UserForm({ userId, onSuccess }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('customer');
  const [initialRole, setInitialRole] = useState('customer'); // Default role
  const [loading, setLoading] = useState(false);

  // Fetch user details if userId is provided (edit mode)
  useEffect(() => {
    if (userId) {
      const fetchUser = async () => {
        try {
          const response = await userApi.get(`/users/${encodeURIComponent(userId)}/`); // שימוש ב-userApi
          setName(response.data.name);
          setEmail(response.data.email);
          setRole(response.data.role);
          setInitialRole(response.data.role);
        } catch (error) {
          console.error('Error fetching user details:', error);
        }
      };

      fetchUser();
    }
  }, [userId]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (userId) {
        // Update existing user
        await userApi.put(`/users/${encodeURIComponent(userId)}/`, { name, email, ...(role !== initialRole ? { role } : {}) }); // שימוש ב-userApi
        notify('User updated successfully!');
      } else {
        // Create new user
        await userApi.post('/users/', { name, email, role }); // שימוש ב-userApi
        notify('User created successfully!');
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving user:', error);
      notify('Failed to save user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-form-container">
      <form className="user-form" onSubmit={handleSubmit}>
        <h2>{userId ? 'Edit User' : 'Add New User'}</h2>
        <label className="field-label" htmlFor="user-name">Full name</label>
        <input
          id="user-name"
          aria-label="Name"
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <label className="field-label" htmlFor="user-email">Email address</label>
        <input
          id="user-email"
          aria-label="Email"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label className="field-label" htmlFor="user-role">Account role</label>
        <select id="user-role" aria-label="Account role" value={role} onChange={(e) => setRole(e.target.value)} required>
          <option value="customer">User</option>
          <option value="restaurant_owner">Restaurant owner</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save'}
        </button>
      </form>
    </div>
  );
}

export default UserForm;