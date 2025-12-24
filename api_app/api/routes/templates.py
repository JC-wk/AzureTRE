from fastapi import APIRouter, Depends

from api.helpers import get_repository
from db.repositories.resource_templates import ResourceTemplateRepository
from models.schemas.resource_template import ResourceTemplateInformationInList
from resources import strings
from services.authentication import get_current_admin_user


templates_admin_router = APIRouter(dependencies=[Depends(get_current_admin_user)])


@templates_admin_router.get("/templates", response_model=ResourceTemplateInformationInList, name=strings.API_GET_TEMPLATES)
async def get_templates(template_repo=Depends(get_repository(ResourceTemplateRepository))) -> ResourceTemplateInformationInList:
    templates_infos = await template_repo.get_all_templates_information()
    return ResourceTemplateInformationInList(templates=templates_infos)
