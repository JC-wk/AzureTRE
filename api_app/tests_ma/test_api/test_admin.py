import pytest
from httpx import AsyncClient
from mock import MagicMock, AsyncMock

from api.helpers import get_repository
from db.repositories.operations import OperationRepository
from models.domain.operation import Operation
from services.authentication import get_current_admin_user
from tests_ma.test_api.conftest import create_admin_user, create_non_admin_user, create_test_user


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
    app.dependency_overrides[get_current_admin_user] = create_admin_user
    mock_repo = MagicMock()
    mock_repo.get_operation_by_id = AsyncMock(return_value=operation)
    mock_repo.delete_operation = AsyncMock()
    app.dependency_overrides[get_repository(OperationRepository)] = lambda: mock_repo
    url = app.url_path_for('API_DELETE_OPERATION', operation_id=operation.id)
    response = await client.delete(url, headers={"Authorization": "Bearer token"})
    assert response.status_code == 204

    app.dependency_overrides = {}


@pytest.mark.asyncio
async def test_delete_operation_as_user_returns_403(app, client: AsyncClient, operation: Operation):
    app.dependency_overrides[get_current_admin_user] = create_non_admin_user
    mock_repo = MagicMock()
    mock_repo.get_operation_by_id = AsyncMock(return_value=operation)
    app.dependency_overrides[get_repository(OperationRepository)] = lambda: mock_repo
    url = app.url_path_for('API_DELETE_OPERATION', operation_id=operation.id)
    response = await client.delete(url, headers={"Authorization": "Bearer token"})
    assert response.status_code == 403
    app.dependency_overrides = {}
