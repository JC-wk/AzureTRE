from typing import List
from fastapi import APIRouter, Depends, HTTPException
from starlette import status

from api.helpers import get_repository
from db.errors import EntityDoesNotExist
from db.repositories.operations import OperationRepository
from db.repositories.resource_templates import ResourceTemplateRepository
from db.repositories.resources import ResourceRepository
from models.domain.resource import ResourceType
from services.authentication import get_current_admin_user
from resources import strings


admin_router = APIRouter(dependencies=[Depends(get_current_admin_user)])


@admin_router.delete("/operations/{operation_id}", name=strings.API_DELETE_OPERATION, status_code=status.HTTP_204_NO_CONTENT)
async def delete_operation(operation_id: str,
                           operations_repo: OperationRepository = Depends(get_repository(OperationRepository)),
                           current_user=Depends(get_current_admin_user)) -> None:
    # ensure override-based test users without admin role are rejected
    try:
        if not hasattr(current_user, "roles") or "TREAdmin" not in current_user.roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=strings.ACCESS_USER_DOES_NOT_HAVE_REQUIRED_ROLE)
        operation = await operations_repo.get_operation_by_id(operation_id)
    except EntityDoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=strings.OPERATION_DOES_NOT_EXIST)
    await operations_repo.delete_operation(operation)


@admin_router.get("/templates/usage", name="get_template_usage", status_code=status.HTTP_200_OK)
async def get_template_usage(
    resource_repo: ResourceRepository = Depends(get_repository(ResourceRepository)),
    current_user=Depends(get_current_admin_user)
) -> List[dict]:
    """
    Get template usage (name, version) for all active resources
    """
    if not hasattr(current_user, "roles") or "TREAdmin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=strings.ACCESS_USER_DOES_NOT_HAVE_REQUIRED_ROLE)

    usage = await resource_repo.get_resource_usage()
    return usage


@admin_router.get("/templates", name="get_all_templates", status_code=status.HTTP_200_OK)
async def get_all_templates(
    template_repo: ResourceTemplateRepository = Depends(get_repository(ResourceTemplateRepository)),
    current_user=Depends(get_current_admin_user)
) -> List[dict]:
    """
    Get all templates (all types, all versions) for admin management
    """
    if not hasattr(current_user, "roles") or "TREAdmin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=strings.ACCESS_USER_DOES_NOT_HAVE_REQUIRED_ROLE)

    templates = await template_repo.get_all_templates()
    return templates


@admin_router.delete("/templates/{template_id}", name="delete_template_by_id", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template_by_id(
    template_id: str,
    template_repo: ResourceTemplateRepository = Depends(get_repository(ResourceTemplateRepository)),
    current_user=Depends(get_current_admin_user)
) -> None:
    """
    Delete a specific template version by its ID
    """
    if not hasattr(current_user, "roles") or "TREAdmin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=strings.ACCESS_USER_DOES_NOT_HAVE_REQUIRED_ROLE)

    try:
        await template_repo.delete_template_by_id(template_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Template not found: {str(e)}")


@admin_router.delete("/templates/{resource_type}/{template_name}", name="delete_templates_by_name", status_code=status.HTTP_200_OK)
async def delete_templates_by_name(
    template_name: str,
    resource_type: ResourceType,
    template_repo: ResourceTemplateRepository = Depends(get_repository(ResourceTemplateRepository)),
    current_user=Depends(get_current_admin_user)
) -> dict:
    """
    Delete all versions of a template by name and resource type
    """
    if not hasattr(current_user, "roles") or "TREAdmin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=strings.ACCESS_USER_DOES_NOT_HAVE_REQUIRED_ROLE)

    try:
        deleted_count = await template_repo.delete_templates_by_name(template_name, resource_type)
        return {"deleted_count": deleted_count, "message": f"Deleted {deleted_count} version(s) of template {template_name}"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error deleting templates: {str(e)}")
