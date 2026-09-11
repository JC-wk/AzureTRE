from enum import StrEnum
from typing import Optional

from pydantic import Field

from models.domain.azuretremodel import AzureTREModel


class WorkspaceAddressAllocationState(StrEnum):
    Allocated = "allocated"
    Releasing = "releasing"
    ReleaseReady = "release_ready"
    Released = "released"


class WorkspaceAddressAllocation(AzureTREModel):
    id: str
    workspaceId: str
    workspaceServiceId: str
    addressSpace: str
    state: WorkspaceAddressAllocationState = WorkspaceAddressAllocationState.Allocated
    operationId: Optional[str] = None
    cleanupOperationId: Optional[str] = None
    createdWhen: float = 0.0
    updatedWhen: float = 0.0
    etag: str = Field("", alias="_etag")
