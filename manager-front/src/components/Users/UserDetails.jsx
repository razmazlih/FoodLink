import React, { useState, useEffect } from 'react';
import axios from 'axios';

function UserForm({ userId, onSuccess }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      const fetchUser = async () => {
        try {
          const response = await axios.get(`${process.env.REACT_APP_API_URL}/users/${userId}`);
          setName(response.data.name);
          setEmail(response.data.email);
          setRole(response.data.role);
        } catch (error) {
          console.error('Error fetching user:', error);
        }
      };

      fetchUser();
    }
  }, [userId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (userId) {
        // Update existing user
        await axios.put(`${process.env.REACT_APP_API_URL}/users/${userId}`, { name, email, role });
        alert('User updated successfully.');
      } else {
        // Add new user
        await axios.post(`${process.env.REACT_APP_API_URL}/users`, { name, email, role });
        alert('User added successfully.');
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
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>
      <button type="submit" disabled={loading}>
        {loading ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}

export default UserForm;