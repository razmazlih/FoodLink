import React, { useState } from 'react';
import UsersList from '../components/Users/UsersList';
import UserForm from '../components/Users/UserForm';

function UsersPage() {
  const [selectedUser, setSelectedUser] = useState(null);

  const handleSuccess = () => {
    setSelectedUser(null);
    window.location.reload();
  };

  return (
    <div>
      {selectedUser ? (
        <UserForm userId={selectedUser} onSuccess={handleSuccess} />
      ) : (
        <UsersList />
      )}
    </div>
  );
}

export default UsersPage;