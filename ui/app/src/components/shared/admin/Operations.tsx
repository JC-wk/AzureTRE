import React, { useEffect, useState } from 'react';
import { Stack, DefaultButton } from '@fluentui/react';
import { Operation } from '../../../models/operation';
import { useAuthApiCall, HttpMethod } from '../../../hooks/useAuthApiCall';

interface OperationsProps {
    onClose: () => void;
}

const Operations: React.FC<OperationsProps> = ({ onClose }) => {
    const [operations, setOperations] = useState<Operation[]>([]);
    const api = useAuthApiCall();

    useEffect(() => {
        const fetchOperations = async () => {
            try {
                const data = await api('/operations', HttpMethod.Get);
                setOperations(data.operations || []);
            } catch (error) {
                console.error('Failed to fetch operations', error);
                setOperations([]);
            }
        };

        fetchOperations();
    }, [api]);

    const handleDelete = async (operationId: string) => {
        if (!window.confirm('Are you sure you want to delete this operation?')) return;

        try {
            await api(`/admin/operations/${operationId}`, HttpMethod.Delete);
            setOperations(operations.filter((op) => op.id !== operationId));
        } catch (error) {
            console.error('Failed to delete operation', error);
        }
    };

    return (
        <Stack className="tre-panel tre-resource-panel">
            <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                <h2 style={{ margin: 0 }}>Operations</h2>
                <DefaultButton text="Close" onClick={onClose} />
            </Stack>

            <div style={{ overflowX: 'auto', marginTop: 10 }}>
                <table className="tre-table">
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
                                    <DefaultButton text="Delete" onClick={() => handleDelete(op.id)} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Stack>
    );
};

export default Operations;
