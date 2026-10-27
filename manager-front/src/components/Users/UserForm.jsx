import React, { useState, useEffect } from 'react';
import { userApi } from '../../services/api'; // שימוש ב-userApi
import './UserForm.css';

function UserForm({ userId, onSuccess }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user'); // Default role
  const [loading, setLoading] = useState(false);

  // Fetch user details if userId is provided (edit mode)
  useEffect(() => {
    if (userId) {
      const fetchUser = async () => {
        try {
          const response = await userApi.get(`/users/${userId}`); // שימוש ב-userApi
          setName(response.data.name);
          setEmail(response.data.email);
          setRole(response.data.role);
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
        await userApi.put(`/users/${userId}`, { name, email, role }); // שימוש ב-userApi
        alert('User updated successfully!');
      } else {
        // Create new user
        await userApi.post('/users', { name, email, role }); // שימוש ב-userApi
        alert('User created successfully!');
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Failed to save user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-form-container">
      <form className="user-form" onSubmit={handleSubmit}>
        <h2>{userId ? 'Edit User' : 'Add New User'}</h2>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <select value={role} onChange={(e) => setRole(e.target.value)} required>
          <option value="user">User</option>
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