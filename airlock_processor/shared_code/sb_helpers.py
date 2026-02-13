import json
import uuid
import os
import logging
from azure.storage.blob.aio import BlobServiceClient
from azure.identity.aio import DefaultAzureCredential
from shared_code import constants


async def _get_credential():
    msi_id = os.environ.get("MANAGED_IDENTITY_CLIENT_ID")
    return DefaultAzureCredential(managed_identity_client_id=msi_id) if msi_id else DefaultAzureCredential()


async def receive_message_payload(msg_body: str) -> str:
    try:
        body_json = json.loads(msg_body)
        if "claim_check" in body_json:
            blob_path = body_json["claim_check"]
            logging.info(f"Message has claim check: {blob_path}. Downloading from blob storage.")
            return await _download_from_blob(blob_path)
    except json.JSONDecodeError:
        pass

    return msg_body


async def _download_from_blob(blob_path: str) -> str:
    account_url = f"https://{constants.SERVICE_BUS_MESSAGES_STORAGE_ACCOUNT_NAME}.blob.{constants.STORAGE_ENDPOINT_SUFFIX}"
    container_name, blob_name = blob_path.split("/", 1)
    credential = await _get_credential()
    async with credential:
        blob_service_client = BlobServiceClient(account_url, credential=credential)
        async with blob_service_client:
            blob_client = blob_service_client.get_blob_client(container=container_name, blob=blob_name)
            download_stream = await blob_client.download_blob()
            content = await download_stream.readall()
            return content.decode("utf-8")


async def wrap_payload_for_offloading(payload: dict) -> dict:
    """
    Checks if the payload exceeds the threshold and offloads to blob storage if it does.
    Returns the original payload or a reference to the offloaded blob.
    """
    payload_str = json.dumps(payload)
    if constants.SERVICE_BUS_MESSAGES_STORAGE_ACCOUNT_NAME and len(payload_str) > constants.SERVICE_BUS_MESSAGE_OFFLOAD_THRESHOLD:
        logging.info(f"Payload size {len(payload_str)} exceeds threshold. Offloading to blob storage.")
        blob_url = await _offload_to_blob(payload_str)
        return {
            "claim_check": blob_url
        }
    return payload


async def _offload_to_blob(content: str) -> str:
    account_url = f"https://{constants.SERVICE_BUS_MESSAGES_STORAGE_ACCOUNT_NAME}.blob.{constants.STORAGE_ENDPOINT_SUFFIX}"
    credential = await _get_credential()
    async with credential:
        blob_service_client = BlobServiceClient(account_url, credential=credential)
        async with blob_service_client:
            blob_name = f"msg-{uuid.uuid4()}.json"
            blob_client = blob_service_client.get_blob_client(container="sb-messages", blob=blob_name)
            await blob_client.upload_blob(content)
            return f"sb-messages/{blob_name}"
