from fastapi import APIRouter, Depends, HTTPException
from starlette import status

from api.helpers import get_repository
from db.repositories.operations import OperationRepository
from services.authentication import get_current_admin_user
from resources import strings


admin_router = APIRouter(dependencies=[Depends(get_current_admin_user)])


@admin_router.delete("/operations/{operation_id}", name=strings.API_DELETE_OPERATION, status_code=status.HTTP_204_NO_CONTENT)
async def delete_operation(operation_id: str, operations_repo: OperationRepository = Depends(get_repository(OperationRepository))) -> None:
    operation = await operations_repo.get_operation_by_id(operation_id)
    if not operation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=strings.OPERATION_DOES_NOT_EXIST)
    await operations_repo.delete_operation(operation)
