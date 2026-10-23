from fastapi import APIRouter, Depends, HTTPException, Query, status

from api.helpers import get_repository
from db.errors import EntityDoesNotExist
from db.repositories.operations import OperationRepository
from models.schemas.operation import OperationInList
from resources import strings
from auth.rbac import require_tre_user_or_admin, require_tre_admin


operations_router = APIRouter(dependencies=[Depends(require_tre_user_or_admin)])


@operations_router.get("/operations", response_model=OperationInList, name=strings.API_GET_MY_OPERATIONS)
async def get_my_operations(user=Depends(require_tre_user_or_admin), operations_repo=Depends(get_repository(OperationRepository))) -> OperationInList:
    operations = await operations_repo.get_my_operations(user_id=user.id)
    return OperationInList(operations=operations)


@operations_router.get("/operations/all", response_model=OperationInList, name="get_all_operations", dependencies=[Depends(require_tre_admin)])
async def get_all_operations(limit: int = Query(default=100, ge=1, le=1000), operations_repo=Depends(get_repository(OperationRepository)), user=Depends(require_tre_admin)) -> OperationInList:
    operations = await operations_repo.get_all_operations(limit=limit)
    return OperationInList(operations=operations)


@operations_router.delete("/operations/{operation_id}", name=strings.API_DELETE_OPERATION, status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_tre_admin)])
async def delete_operation(operation_id: str,
                           operations_repo: OperationRepository = Depends(get_repository(OperationRepository)),
                           user=Depends(require_tre_admin)) -> None:
    try:
        operation = await operations_repo.get_operation_by_id(operation_id)
    except EntityDoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=strings.OPERATION_DOES_NOT_EXIST)
    await operations_repo.delete_operation(operation)
