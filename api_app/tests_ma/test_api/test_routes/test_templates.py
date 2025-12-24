import pytest
from mock import patch

from starlette import status

from services.authentication import get_current_admin_user
from models.domain.resource import ResourceType
from models.schemas.resource_template import ResourceTemplateInformation
from resources import strings

pytestmark = pytest.mark.asyncio


class TestTemplateRoutes:
    @pytest.fixture(autouse=True, scope='class')
    def _prepare(self, app, admin_user):
        app.dependency_overrides[get_current_admin_user] = admin_user
        yield
        app.dependency_overrides = {}

    # GET /templates
    @patch("api.routes.templates.ResourceTemplateRepository.get_all_templates_information")
    async def test_get_templates_returns_all_templates(self, get_all_templates_information_mock, app, client):
        expected_templates = [
            ResourceTemplateInformation(name="template1", title="template 1", description="description1", version="1.0", resourceType=ResourceType.Workspace),
            ResourceTemplateInformation(name="template2", title="template 2", description="description2", version="1.0", resourceType=ResourceType.WorkspaceService),
            ResourceTemplateInformation(name="template3", title="template 3", description="description3", version="1.0", resourceType=ResourceType.SharedService),
            ResourceTemplateInformation(name="template4", title="template 4", description="description4", version="1.0", resourceType=ResourceType.UserResource, parentWorkspaceService="parent_service"),
        ]
        get_all_templates_information_mock.return_value = expected_templates

        response = await client.get(app.url_path_for(strings.API_GET_TEMPLATES))

        assert response.status_code == status.HTTP_200_OK
        actual_templates = response.json()["templates"]
        assert len(actual_templates) == len(expected_templates)
        for template in expected_templates:
            assert template in actual_templates
