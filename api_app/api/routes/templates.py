from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from api.helpers import get_repository
from db.repositories.resource_templates import ResourceTemplateRepository
from db.repositories.resources import ResourceRepository
from models.domain.resource import ResourceType
from auth.rbac import require_tre_admin


templates_router = APIRouter(dependencies=[Depends(require_tre_admin)])


@templates_router.get("/templates/usage", name="get_template_usage", status_code=status.HTTP_200_OK)
async def get_template_usage(
    resource_repo: ResourceRepository = Depends(get_repository(ResourceRepository)),
    user=Depends(require_tre_admin)
) -> List[dict]:
    """
    Get template usage (name, version) for all active resources
    """
    usage = await resource_repo.get_resource_usage()
    return usage


@templates_router.get("/templates", name="get_all_templates", status_code=status.HTTP_200_OK)
async def get_all_templates(
    template_repo: ResourceTemplateRepository = Depends(get_repository(ResourceTemplateRepository)),
    user=Depends(require_tre_admin)
) -> List[dict]:
    """
    Get all templates (all types, all versions) for admin management
    """
    templates = await template_repo.get_all_templates()
    return templates


@templates_router.delete("/templates/{template_id}", name="delete_template_by_id", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template_by_id(
    template_id: str,
    template_repo: ResourceTemplateRepository = Depends(get_repository(ResourceTemplateRepository)),
    user=Depends(require_tre_admin)
) -> None:
    """
    Delete a specific template version by its ID
    """
    try:
        await template_repo.delete_template_by_id(template_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Template not found: {str(e)}")


@templates_router.delete("/templates/{resource_type}/{template_name}", name="delete_templates_by_name", status_code=status.HTTP_200_OK)
async def delete_templates_by_name(
    template_name: str,
    resource_type: ResourceType,
    template_repo: ResourceTemplateRepository = Depends(get_repository(ResourceTemplateRepository)),
    user=Depends(require_tre_admin)
) -> dict:
    """
    Delete all versions of a template by name and resource type
    """
    try:
        deleted_count = await template_repo.delete_templates_by_name(template_name, resource_type)
        return {"deleted_count": deleted_count, "message": f"Deleted {deleted_count} version(s) of template {template_name}"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error deleting templates: {str(e)}")
