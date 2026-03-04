from mock import patch, MagicMock, AsyncMock
import pytest

from DataDeletionTrigger import delete_blob_and_container_if_last_blob
from shared_code.blob_operations import get_storage_endpoint_suffix


@pytest.mark.asyncio
class TestDataDeletionTrigger():

    @patch("DataDeletionTrigger.blob_operations.get_credential")
    @patch("DataDeletionTrigger.BlobServiceClient")
    async def test_delete_blob_and_container_if_last_blob_deletes_container(self, mock_blob_service_client, _):
        blob_url = f"https://stalimextest.blob.{get_storage_endpoint_suffix()}/c144728c-3c69-4a58-afec-48c2ec8bfd45/test_dataset.txt"

        mock_service_instance = MagicMock()
        mock_blob_service_client.return_value.__aenter__.return_value = mock_service_instance

        mock_container_client = MagicMock()
        mock_service_instance.get_container_client.return_value = mock_container_client

        mock_list_blobs = AsyncMock()
        mock_list_blobs.__aiter__.return_value = ["blob"]
        mock_container_client.list_blobs.return_value = mock_list_blobs

        mock_container_client.delete_container = AsyncMock()
        mock_container_client.get_blob_client.return_value.delete_blob = AsyncMock()

        await delete_blob_and_container_if_last_blob(blob_url)

        mock_container_client.delete_container.assert_called_once()

    @patch("DataDeletionTrigger.blob_operations.get_credential")
    @patch("DataDeletionTrigger.BlobServiceClient")
    async def test_delete_blob_and_container_if_last_blob_doesnt_delete_container(self, mock_blob_service_client, _):
        blob_url = f"https://stalimextest.blob.{get_storage_endpoint_suffix()}/c144728c-3c69-4a58-afec-48c2ec8bfd45/test_dataset.txt"

        mock_service_instance = MagicMock()
        mock_blob_service_client.return_value.__aenter__.return_value = mock_service_instance

        mock_container_client = MagicMock()
        mock_service_instance.get_container_client.return_value = mock_container_client

        mock_list_blobs = AsyncMock()
        mock_list_blobs.__aiter__.return_value = ["blob1", "blob2"]
        mock_container_client.list_blobs.return_value = mock_list_blobs

        mock_container_client.delete_container = AsyncMock()
        mock_container_client.get_blob_client.return_value.delete_blob = AsyncMock()

        await delete_blob_and_container_if_last_blob(blob_url)

        mock_container_client.delete_container.assert_not_called()

    @patch("DataDeletionTrigger.blob_operations.get_credential")
    @patch("DataDeletionTrigger.BlobServiceClient")
    async def test_delete_blob_and_container_if_last_blob_deletes_container_if_no_blob_specified(self, mock_blob_service_client, _):
        blob_url = f"https://stalimextest.blob.{get_storage_endpoint_suffix()}/c144728c-3c69-4a58-afec-48c2ec8bfd45/"

        mock_service_instance = MagicMock()
        mock_blob_service_client.return_value.__aenter__.return_value = mock_service_instance

        mock_container_client = MagicMock()
        mock_service_instance.get_container_client.return_value = mock_container_client
        mock_container_client.delete_container = AsyncMock()

        await delete_blob_and_container_if_last_blob(blob_url)
        mock_container_client.delete_container.assert_called_once()
