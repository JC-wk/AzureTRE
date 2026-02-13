import logging
import json

import azure.functions as func
from azure.storage.blob.aio import BlobServiceClient

from shared_code import blob_operations, sb_helpers


async def delete_blob_and_container_if_last_blob(blob_url: str):
    storage_account_name, container_name, blob_name = blob_operations.get_blob_info_from_blob_url(blob_url=blob_url)
    credential = blob_operations.get_credential()
    async with BlobServiceClient(
        account_url=blob_operations.get_account_url(storage_account_name),
        credential=credential) as blob_service_client:
        container_client = blob_service_client.get_container_client(container_name)

        if not blob_name:
            logging.info(f'No specific blob specified, deleting the entire container: {container_name}')
            await container_client.delete_container()
            return

        # If it's the only blob in the container, we need to delete the container too
        # Check how many blobs are in the container
        blobs_num = 0
        async for _ in container_client.list_blobs():
            blobs_num += 1
        logging.info(f'Found {blobs_num} blobs in the container')

        # Deleting blob
        logging.info(f'Deleting blob {blob_name}...')
        blob_client = container_client.get_blob_client(blob_name)
        await blob_client.delete_blob()

        if blobs_num == 1:
            # Need to delete the container too
            logging.info(f'There was one blob in the container. Deleting container {container_name}...')
            await container_client.delete_container()


async def main(msg: func.ServiceBusMessage):
    body = msg.get_body().decode('utf-8')
    logging.info(f'Python ServiceBus queue trigger raw body: {body}')
    payload = await sb_helpers.receive_message_payload(body)
    json_body = json.loads(payload)

    blob_url = json_body["data"]["blob_to_delete"]
    logging.info(f'Blob to delete is {blob_url}')

    await delete_blob_and_container_if_last_blob(blob_url)