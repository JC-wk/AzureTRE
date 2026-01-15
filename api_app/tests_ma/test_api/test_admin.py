import pytest
from httpx import AsyncClient
from mock import MagicMock, AsyncMock, patch

from db.repositories.operations import OperationRepository
from db.repositories.resource_templates import ResourceTemplateRepository
from models.domain.operation import Operation
from models.domain.resource import ResourceType
from services.authentication import get_current_admin_user
from tests_ma.test_api.conftest import create_admin_user, create_non_admin_user, create_test_user
from resources import strings


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


@pytest.fixture
def sample_templates() -> list:
    return [
        {
            "id": "template-1-id",
            "name": "tre-workspace-base",
            "title": "Base Workspace",
            "description": "A base workspace",
            "version": "1.0.0",
            "resourceType": ResourceType.Workspace,
            "current": True
        },
        {
            "id": "template-2-id",
            "name": "tre-workspace-base",
            "title": "Base Workspace",
            "description": "A base workspace",
            "version": "2.0.0",
            "resourceType": ResourceType.Workspace,
            "current": False
        },
        {
            "id": "template-3-id",
            "name": "tre-service-guacamole",
            "title": "Apache Guacamole",
            "description": "Remote desktop service",
            "version": "1.0.0",
            "resourceType": ResourceType.WorkspaceService,
            "current": True
        }
    ]


@pytest.mark.asyncio
async def test_delete_operation_as_admin_returns_204(app, client: AsyncClient, operation: Operation):
    app.dependency_overrides[get_current_admin_user] = create_admin_user

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
    app.dependency_overrides[get_current_admin_user] = create_non_admin_user

    mock_repo = MagicMock()
    mock_repo.get_operation_by_id = AsyncMock(return_value=operation)

    with patch.object(OperationRepository, 'create', return_value=mock_repo):
        url = app.url_path_for(strings.API_DELETE_OPERATION, operation_id=operation.id)
        response = await client.delete(url, headers={"Authorization": "Bearer token"})
        assert response.status_code == 403

    app.dependency_overrides = {}


# Tests for GET /admin/templates
@pytest.mark.asyncio
async def test_get_all_templates_as_admin_returns_200_with_templates(app, client: AsyncClient, sample_templates: list):
    app.dependency_overrides[get_current_admin_user] = create_admin_user

    mock_repo = MagicMock()
    mock_repo.get_all_templates = AsyncMock(return_value=sample_templates)

    with patch.object(ResourceTemplateRepository, 'create', return_value=mock_repo):
        response = await client.get("/admin/templates", headers={"Authorization": "Bearer token"})
        assert response.status_code == 200
        response_data = response.json()
        assert len(response_data) == 3
        assert response_data[0]["name"] == "tre-workspace-base"
        assert response_data[2]["name"] == "tre-service-guacamole"

    app.dependency_overrides = {}


@pytest.mark.asyncio
async def test_get_all_templates_as_admin_returns_empty_list_when_no_templates(app, client: AsyncClient):
    app.dependency_overrides[get_current_admin_user] = create_admin_user

    mock_repo = MagicMock()
    mock_repo.get_all_templates = AsyncMock(return_value=[])

    with patch.object(ResourceTemplateRepository, 'create', return_value=mock_repo):
        response = await client.get("/admin/templates", headers={"Authorization": "Bearer token"})
        assert response.status_code == 200
        assert response.json() == []

    app.dependency_overrides = {}


@pytest.mark.asyncio
async def test_get_all_templates_as_non_admin_returns_403(app, client: AsyncClient):
    app.dependency_overrides[get_current_admin_user] = create_non_admin_user

    response = await client.get("/admin/templates", headers={"Authorization": "Bearer token"})
    assert response.status_code == 403

    app.dependency_overrides = {}


# Tests for DELETE /admin/templates/{template_id}
@pytest.mark.asyncio
async def test_delete_template_by_id_as_admin_returns_204(app, client: AsyncClient):
    app.dependency_overrides[get_current_admin_user] = create_admin_user

    mock_repo = MagicMock()
    mock_repo.delete_template_by_id = AsyncMock()

    with patch.object(ResourceTemplateRepository, 'create', return_value=mock_repo):
        response = await client.delete("/admin/templates/test-template-id", headers={"Authorization": "Bearer token"})
        assert response.status_code == 204
        mock_repo.delete_template_by_id.assert_called_once_with("test-template-id")

    app.dependency_overrides = {}


@pytest.mark.asyncio
async def test_delete_template_by_id_as_non_admin_returns_403(app, client: AsyncClient):
    app.dependency_overrides[get_current_admin_user] = create_non_admin_user

    response = await client.delete("/admin/templates/test-template-id", headers={"Authorization": "Bearer token"})
    assert response.status_code == 403

    app.dependency_overrides = {}


@pytest.mark.asyncio
async def test_delete_template_by_id_returns_404_when_template_not_found(app, client: AsyncClient):
    app.dependency_overrides[get_current_admin_user] = create_admin_user

    mock_repo = MagicMock()
    mock_repo.delete_template_by_id = AsyncMock(side_effect=Exception("Template not found"))

    with patch.object(ResourceTemplateRepository, 'create', return_value=mock_repo):
        response = await client.delete("/admin/templates/non-existent-id", headers={"Authorization": "Bearer token"})
        assert response.status_code == 404
        assert "Template not found" in response.json()["detail"]

    app.dependency_overrides = {}


# Tests for DELETE /admin/templates/{resource_type}/{template_name}
@pytest.mark.asyncio
async def test_delete_templates_by_name_as_admin_returns_200_with_count(app, client: AsyncClient):
    app.dependency_overrides[get_current_admin_user] = create_admin_user

    mock_repo = MagicMock()
    mock_repo.delete_templates_by_name = AsyncMock(return_value=3)

    with patch.object(ResourceTemplateRepository, 'create', return_value=mock_repo):
        response = await client.delete(
            f"/admin/templates/{ResourceType.Workspace}/tre-workspace-base",
            headers={"Authorization": "Bearer token"}
        )
        assert response.status_code == 200
        response_data = response.json()
        assert response_data["deleted_count"] == 3
        assert "tre-workspace-base" in response_data["message"]
        mock_repo.delete_templates_by_name.assert_called_once_with("tre-workspace-base", ResourceType.Workspace)

    app.dependency_overrides = {}


@pytest.mark.asyncio
async def test_delete_templates_by_name_as_admin_returns_zero_when_no_templates_found(app, client: AsyncClient):
    app.dependency_overrides[get_current_admin_user] = create_admin_user

    mock_repo = MagicMock()
    mock_repo.delete_templates_by_name = AsyncMock(return_value=0)

    with patch.object(ResourceTemplateRepository, 'create', return_value=mock_repo):
        response = await client.delete(
            f"/admin/templates/{ResourceType.Workspace}/non-existent-template",
            headers={"Authorization": "Bearer token"}
        )
        assert response.status_code == 200
        response_data = response.json()
        assert response_data["deleted_count"] == 0

    app.dependency_overrides = {}


@pytest.mark.asyncio
async def test_delete_templates_by_name_as_non_admin_returns_403(app, client: AsyncClient):
    app.dependency_overrides[get_current_admin_user] = create_non_admin_user

    response = await client.delete(
        f"/admin/templates/{ResourceType.Workspace}/tre-workspace-base",
        headers={"Authorization": "Bearer token"}
    )
    assert response.status_code == 403

    app.dependency_overrides = {}


@pytest.mark.asyncio
async def test_delete_templates_by_name_returns_500_on_error(app, client: AsyncClient):
    app.dependency_overrides[get_current_admin_user] = create_admin_user

    mock_repo = MagicMock()
    mock_repo.delete_templates_by_name = AsyncMock(side_effect=Exception("Database error"))

    with patch.object(ResourceTemplateRepository, 'create', return_value=mock_repo):
        response = await client.delete(
            f"/admin/templates/{ResourceType.Workspace}/tre-workspace-base",
            headers={"Authorization": "Bearer token"}
        )
        assert response.status_code == 500
        assert "Error deleting templates" in response.json()["detail"]

    app.dependency_overrides = {}


@pytest.mark.asyncio
async def test_delete_templates_by_name_works_for_different_resource_types(app, client: AsyncClient):
    app.dependency_overrides[get_current_admin_user] = create_admin_user

    mock_repo = MagicMock()
    mock_repo.delete_templates_by_name = AsyncMock(return_value=2)

    with patch.object(ResourceTemplateRepository, 'create', return_value=mock_repo):
        # Test with WorkspaceService type
        response = await client.delete(
            f"/admin/templates/{ResourceType.WorkspaceService}/tre-service-guacamole",
            headers={"Authorization": "Bearer token"}
        )
        assert response.status_code == 200
        mock_repo.delete_templates_by_name.assert_called_with("tre-service-guacamole", ResourceType.WorkspaceService)

    app.dependency_overrides = {}
