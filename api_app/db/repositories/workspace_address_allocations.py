from datetime import UTC, datetime
import inspect
from typing import List, Optional

from pydantic import TypeAdapter

from core import config
from db.repositories.base import BaseRepository
from models.domain.workspace_address_allocation import (
    WorkspaceAddressAllocation,
    WorkspaceAddressAllocationState,
)


class WorkspaceAddressAllocationRepository(BaseRepository):
    @classmethod
    async def create(cls):
        allocation_repository = WorkspaceAddressAllocationRepository()
        await super().create(config.STATE_STORE_WORKSPACE_ADDRESS_ALLOCATIONS_CONTAINER)
        return allocation_repository

    @staticmethod
    def get_timestamp() -> float:
        return datetime.now(UTC).timestamp()

    async def get_by_workspace_id(self, workspace_id: str) -> List[WorkspaceAddressAllocation]:
        query = "SELECT * FROM c WHERE c.workspaceId = @workspaceId"
        allocations = await self.query(
            query=query,
            parameters=[{"name": "@workspaceId", "value": str(workspace_id)}],
        )
        return TypeAdapter(List[WorkspaceAddressAllocation]).validate_python(allocations)

    async def get_active_address_spaces(self) -> List[str]:
        query = "SELECT c.addressSpace FROM c WHERE c.state != @released"
        allocations = await self.query(
            query=query,
            parameters=[{"name": "@released", "value": WorkspaceAddressAllocationState.Released}],
        )
        return [allocation["addressSpace"] for allocation in allocations]

    async def get_by_workspace_service_id(self, workspace_service_id: str) -> Optional[WorkspaceAddressAllocation]:
        query = "SELECT * FROM c WHERE c.workspaceServiceId = @workspaceServiceId AND c.state != @released"
        allocations = await self.query(
            query=query,
            parameters=[
                {"name": "@workspaceServiceId", "value": str(workspace_service_id)},
                {"name": "@released", "value": WorkspaceAddressAllocationState.Released},
            ],
        )
        if not allocations:
            return None
        return TypeAdapter(WorkspaceAddressAllocation).validate_python(allocations[0])

    async def get_deployed_address_spaces(self, workspace_id: str) -> List[str]:
        allocations = await self.get_by_workspace_id(workspace_id)
        return [
            allocation.addressSpace
            for allocation in allocations
            if allocation.state in (
                WorkspaceAddressAllocationState.Allocated,
                WorkspaceAddressAllocationState.Releasing,
            )
        ]

    async def create_allocation(
        self,
        workspace_id: str,
        workspace_service_id: str,
        address_space: str,
    ) -> WorkspaceAddressAllocation:
        timestamp = self.get_timestamp()
        allocation = WorkspaceAddressAllocation(
            id=workspace_service_id,
            workspaceId=workspace_id,
            workspaceServiceId=workspace_service_id,
            addressSpace=address_space,
            createdWhen=timestamp,
            updatedWhen=timestamp,
        )
        created = self.container.create_item(body=allocation.model_dump(by_alias=True))
        if inspect.isawaitable(created):
            created = await created
        return TypeAdapter(WorkspaceAddressAllocation).validate_python(created) if isinstance(created, dict) else allocation

    async def update_state(
        self,
        allocation: WorkspaceAddressAllocation,
        state: WorkspaceAddressAllocationState,
        operation_id: Optional[str] = None,
    ) -> WorkspaceAddressAllocation:
        allocation.state = state
        allocation.operationId = operation_id or allocation.operationId
        allocation.updatedWhen = self.get_timestamp()
        updated = self.container.replace_item(
            item=allocation.id,
            body=allocation.model_dump(by_alias=True),
            partition_key=allocation.workspaceId,
            etag=allocation.etag,
        )
        if inspect.isawaitable(updated):
            updated = await updated
        return TypeAdapter(WorkspaceAddressAllocation).validate_python(updated) if isinstance(updated, dict) else allocation
