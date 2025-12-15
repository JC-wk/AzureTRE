import React, { useEffect, useState } from 'react';
import { Operation } from '../../../models/operation';
import { armRequest } from '../../../store/tre';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Admin: React.FC = () => {
  const [operations, setOperations] = useState<Operation[]>([]);

  useEffect(() => {
    const fetchOperations = async () => {
      try {
        const response = await armRequest('/api/operations', 'GET');
        const data = await response.json();
        setOperations(data.operations);
      } catch (error) {
        toast.error('Failed to fetch operations');
      }
    };
    fetchOperations();
  }, []);

  const handleDelete = async (operationId: string) => {
    if (window.confirm('Are you sure you want to delete this operation?')) {
      try {
        await armRequest(`/api/admin/operations/${operationId}`, 'DELETE');
        setOperations(operations.filter((op) => op.id !== operationId));
        toast.success('Operation deleted successfully');
      } catch (error) {
        toast.error('Failed to delete operation');
      }
    }
  };

  return (
    <div>
      <ToastContainer />
      <h1>Admin</h1>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Resource ID</th>
            <th>Status</th>
            <th>Action</th>
            <th>Created</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {operations.map((op: Operation) => (
            <tr key={op.id}>
              <td>{op.id}</td>
              <td>{op.resourceId}</td>
              <td>{op.status}</td>
              <td>{op.action}</td>
              <td>{new Date(op.createdWhen * 1000).toLocaleString()}</td>
              <td>{new Date(op.updatedWhen * 1000).toLocaleString()}</td>
              <td>
                <button onClick={() => handleDelete(op.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Admin;
