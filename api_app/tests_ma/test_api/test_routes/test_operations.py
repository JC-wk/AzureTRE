import pytest
from httpx import AsyncClient
from mock import MagicMock, AsyncMock, patch
from fastapi import HTTPException, status

from db.repositories.operations import OperationRepository
from models.domain.operation import Operation
from auth.rbac import require_tre_admin, require_tre_user_or_admin
from tests_ma.test_api.conftest import create_admin_user, create_non_admin_user, create_test_user
from resources import strings


def forbidden():
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)


@pytest.fixture
def operation() -> Operation:
    operation = Operation(
        id="123",
        resourceId="123",
        resourcePath="/workspaces/123",
        resourceVersion=0,
        status="awaiting_deployment",
        action="install",
        message="",
        createdWhen=0,
        updatedWhen=0,
        user=create_test_user(),
        steps=[],
    )
    return operation


@pytest.mark.asyncio
async def test_delete_operation_as_admin_returns_204(app, client: AsyncClient, operation: Operation):
    app.dependency_overrides[require_tre_user_or_admin] = create_admin_user
    app.dependency_overrides[require_tre_admin] = create_admin_user

    mock_repo = MagicMock()
    mock_repo.get_operation_by_id = AsyncMock(return_value=operation)
    mock_repo.delete_operation = AsyncMock()

    with patch.object(OperationRepository, 'create', return_value=mock_repo):
        url = app.url_path_for(strings.API_DELETE_OPERATION, operation_id=operation.id)
        response = await client.delete(url, headers={"Authorization": "Bearer token"})
        assert response.status_code == 204

    app.dependency_overrides = {}


@pytest.mark.asyncio
async def test_delete_operation_as_user_returns_403(app, client: AsyncClient, operation: Operation):
    app.dependency_overrides[require_tre_user_or_admin] = create_non_admin_user
    app.dependency_overrides[require_tre_admin] = forbidden

    mock_repo = MagicMock()
    mock_repo.get_operation_by_id = AsyncMock(return_value=operation)

    with patch.object(OperationRepository, 'create', return_value=mock_repo):
        url = app.url_path_for(strings.API_DELETE_OPERATION, operation_id=operation.id)
        response = await client.delete(url, headers={"Authorization": "Bearer token"})
        assert response.status_code == 403

    app.dependency_overrides = {}


@pytest.mark.asyncio
async def test_get_all_operations_as_admin_returns_200(app, client: AsyncClient, operation: Operation):
    app.dependency_overrides[require_tre_user_or_admin] = create_admin_user
    app.dependency_overrides[require_tre_admin] = create_admin_user

    mock_repo = MagicMock()
    mock_repo.get_all_operations = AsyncMock(return_value=[operation])

    with patch.object(OperationRepository, 'create', return_value=mock_repo):
        url = app.url_path_for("get_all_operations")
        response = await client.get(url, headers={"Authorization": "Bearer token"})
        assert response.status_code == 200
        assert len(response.json()["operations"]) == 1
        mock_repo.get_all_operations.assert_called_once_with(limit=100)

    app.dependency_overrides = {}
