import json
from azure.eventgrid import EventGridEvent
from azure.eventgrid.aio import EventGridPublisherClient
from core import credentials, config
from service_bus.helpers import _offload_to_blob
from services.logging import logger


async def publish_event(event: EventGridEvent, topic_endpoint: str):
    # Claim check pattern
    if config.SERVICE_BUS_MESSAGES_STORAGE_ACCOUNT_NAME:
        data_str = json.dumps(event.data)
        if len(data_str) > config.SERVICE_BUS_MESSAGE_OFFLOAD_THRESHOLD:
            logger.info(f"Event data size {len(data_str)} exceeds threshold. Offloading to blob storage.")
            blob_url = await _offload_to_blob(data_str)
            event.data = {
                "claim_check": blob_url
            }

    async with credentials.get_credential_async_context() as credential:
        client = EventGridPublisherClient(topic_endpoint, credential)
        async with client:
            await client.send([event])
