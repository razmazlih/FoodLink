import { notify } from '../Feedback/Feedback';
import React, { useEffect, useRef, useState } from 'react';
import { userApi } from '../../services/api';
import './UsersList.css';

function UsersList({ onEdit }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const deleteDialog = useRef(null);
  useEffect(() => {
    if (pendingDelete && deleteDialog.current) deleteDialog.current.showModal();
    else deleteDialog.current?.close();
  }, [pendingDelete]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await userApi.delete(`/users/${encodeURIComponent(pendingDelete.id)}/`);
      setUsers((current) => current.filter((user) => user.id !== pendingDelete.id));
      setPendingDelete(null);
      notify('User deleted successfully.');
    } catch {
      notify('Failed to delete user. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await userApi.get('/users/');
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
      <span className="eyebrow">PEOPLE & ACCESS</span>
      <h1>Users</h1>
      <p className="page-description">Manage your community and account permissions.</p>
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
          {users.length === 0 && <tr><td colSpan={5} className="table-empty">No users to show yet.</td></tr>}
          {users.map((user) => (
            <tr key={user.id}>
              <td data-label="ID">{user.id}</td>
              <td data-label="Name">{user.name}</td>
              <td data-label="Email">{user.email}</td>
              <td data-label="Role"><span className="status-badge">{user.role.replaceAll('_', ' ')}</span></td>
              <td data-label="Actions">
                <button onClick={() => onEdit(user.id)}>Edit</button>
                <button onClick={() => setPendingDelete(user)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <dialog className="workspace-dialog" ref={deleteDialog} onCancel={() => setPendingDelete(null)} aria-labelledby="delete-user-title">
        <span className="eyebrow">ACCOUNT MANAGEMENT</span>
        <h2 id="delete-user-title">Delete this user?</h2>
        <p>This will remove {pendingDelete?.name || pendingDelete?.email || 'this user'} from FoodLink. This action cannot be undone.</p>
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={() => setPendingDelete(null)} disabled={deleting} autoFocus>Keep user</button>
          <button type="button" className="danger-button" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete user'}</button>
        </div>
      </dialog>
    </div>
  );
}

export default UsersList;