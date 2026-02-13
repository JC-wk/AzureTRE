import json
import uuid
from azure.servicebus import ServiceBusMessage
from azure.servicebus.aio import ServiceBusClient
from azure.storage.blob.aio import BlobServiceClient
from azure.identity.aio import DefaultAzureCredential
from shared.logging import logger


async def _get_credential():
    # In VMSS, VMSS_MSI_ID is used. If not set, it will use the system assigned identity or ambient credentials.
    from shared.config import get_config
    config = get_config()
    msi_id = config.get("vmss_msi_id")
    return DefaultAzureCredential(managed_identity_client_id=msi_id) if msi_id else DefaultAzureCredential()


async def send_message(message: ServiceBusMessage, queue: str, config: dict):
    """
    Sends the given message to the given queue in the Service Bus.
    """
    # Claim check pattern
    if config.get("service_bus_messages_storage_account_name"):
        body_str = str(message)
        if len(body_str) > config.get("service_bus_message_offload_threshold", 200000):
            logger.info(f"Message size {len(body_str)} exceeds threshold. Offloading to blob storage.")
            blob_url = await _offload_to_blob(body_str, config)
            offload_message = {
                "claim_check": blob_url
            }
            # We must recreate the ServiceBusMessage because body is read-only
            message = ServiceBusMessage(
                body=json.dumps(offload_message),
                correlation_id=message.correlation_id,
                session_id=message.session_id,
                application_properties=message.application_properties
            )

    credential = await _get_credential()
    async with credential:
        service_bus_client = ServiceBusClient(config["service_bus_namespace"], credential)

        async with service_bus_client:
            sender = service_bus_client.get_queue_sender(queue_name=queue)

            async with sender:
                await sender.send_messages(message)


async def _offload_to_blob(content: str, config: dict) -> str:
    account_url = f"https://{config['service_bus_messages_storage_account_name']}.blob.{config['storage_endpoint_suffix']}"
    credential = await _get_credential()
    async with credential:
        blob_service_client = BlobServiceClient(account_url, credential=credential)
        async with blob_service_client:
            blob_name = f"msg-{uuid.uuid4()}.json"
            blob_client = blob_service_client.get_blob_client(container="sb-messages", blob=blob_name)
            await blob_client.upload_blob(content)
            return f"sb-messages/{blob_name}"


async def receive_message_payload(msg: ServiceBusMessage, config: dict) -> str:
    body_str = str(msg)
    try:
        body_json = json.loads(body_str)
        if "claim_check" in body_json:
            blob_path = body_json["claim_check"]
            logger.info(f"Message has claim check: {blob_path}. Downloading from blob storage.")
            return await _download_from_blob(blob_path, config)
    except json.JSONDecodeError:
        pass

    return body_str


async def _download_from_blob(blob_path: str, config: dict) -> str:
    account_url = f"https://{config['service_bus_messages_storage_account_name']}.blob.{config['storage_endpoint_suffix']}"
    container_name, blob_name = blob_path.split("/", 1)
    credential = await _get_credential()
    async with credential:
        blob_service_client = BlobServiceClient(account_url, credential=credential)
        async with blob_service_client:
            blob_client = blob_service_client.get_blob_client(container=container_name, blob=blob_name)
            download_stream = await blob_client.download_blob()
            content = await download_stream.readall()
            return content.decode("utf-8")
