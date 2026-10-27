import React, { useEffect, useState } from 'react';
import { userApi } from '../../services/api';
import './UsersList.css';

function UsersList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await userApi.get('/users');
        setUsers(response.data);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch users.');
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  if (loading) {
    return <div className="users-loading">Loading users...</div>;
  }

  if (error) {
    return <div className="users-error">{error}</div>;
  }

  return (
    <div className="users-list-container">
      <h1>Users</h1>
      <table className="users-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.role}</td>
              <td>
                <button onClick={() => handleEdit(user.id)}>Edit</button>
                <button onClick={() => handleDelete(user.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const handleEdit = (id) => {
  console.log(`Editing user ${id}`);
  // Navigate to edit form or open a modal
};

const handleDelete = async (id) => {
  if (window.confirm('Are you sure you want to delete this user?')) {
    try {
      await userApi.delete(`/users/${id}`); // שימוש ב-userApi למחיקה
      alert('User deleted successfully.');
      window.location.reload();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user.');
    }
  }
};

export default UsersList;