from collections import namedtuple
import json
import pytest
from mock import AsyncMock, MagicMock, patch

import shared_code.blob_operations as blob_ops
from exceptions import TooManyFilesInRequestException, NoFilesInRequestException


def get_test_blob():
    return namedtuple("Blob", "name")


class TestBlobOperations():

    def test_get_blob_info_from_topic_and_subject(self):
        topic = "/subscriptions/SUB_ID/resourceGroups/RG_NAME/providers/Microsoft.Storage/storageAccounts/ST_ACC_NAME"
        subject = "/blobServices/default/containers/c144728c-3c69-4a58-afec-48c2ec8bfd45/blobs/BLOB"

        storage_account_name, container_name, blob_name = blob_ops.get_blob_info_from_topic_and_subject(topic=topic, subject=subject)

        assert storage_account_name == "ST_ACC_NAME"
        assert container_name == "c144728c-3c69-4a58-afec-48c2ec8bfd45"
        assert blob_name == "BLOB"

    def test_get_blob_info_from_url(self):
        url = f"https://stalimextest.blob.{blob_ops.get_storage_endpoint_suffix()}/c144728c-3c69-4a58-afec-48c2ec8bfd45/test_dataset.txt"

        storage_account_name, container_name, blob_name = blob_ops.get_blob_info_from_blob_url(blob_url=url)

        assert storage_account_name == "stalimextest"
        assert container_name == "c144728c-3c69-4a58-afec-48c2ec8bfd45"
        assert blob_name == "test_dataset.txt"

    @pytest.mark.asyncio
    async def test_copy_data_fails_if_too_many_blobs_to_copy(self):
        with patch("shared_code.blob_operations.get_credential", new_callable=AsyncMock) as mock_get_credential, \
                patch("shared_code.blob_operations.BlobServiceClient") as mock_blob_service_client:

            mock_get_credential.return_value.__aenter__.return_value = MagicMock()

            mock_client_instance = mock_blob_service_client.return_value
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)

            mock_container_client = MagicMock()
            mock_client_instance.get_container_client.return_value = mock_container_client

            mock_list_blobs = AsyncMock()
            mock_list_blobs.__aiter__.return_value = [get_test_blob()("a"), get_test_blob()("b")]
            mock_container_client.list_blobs.return_value = mock_list_blobs

            with pytest.raises(TooManyFilesInRequestException):
                await blob_ops.copy_data("source_acc", "dest_acc", "req_id")

    @pytest.mark.asyncio
    async def test_copy_data_fails_if_no_blobs_to_copy(self):
        with patch("shared_code.blob_operations.get_credential", new_callable=AsyncMock) as mock_get_credential, \
                patch("shared_code.blob_operations.BlobServiceClient") as mock_blob_service_client:

            mock_get_credential.return_value.__aenter__.return_value = MagicMock()

            mock_client_instance = mock_blob_service_client.return_value
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)

            mock_container_client = MagicMock()
            mock_client_instance.get_container_client.return_value = mock_container_client

            mock_list_blobs = AsyncMock()
            mock_list_blobs.__aiter__.return_value = []
            mock_container_client.list_blobs.return_value = mock_list_blobs

            with pytest.raises(NoFilesInRequestException):
                await blob_ops.copy_data("source_acc", "dest_acc", "req_id")

    @pytest.mark.asyncio
    async def test_copy_data_adds_copied_from_metadata(self):
        with patch("shared_code.blob_operations.get_credential", new_callable=AsyncMock) as mock_get_credential, \
                patch("shared_code.blob_operations.BlobServiceClient") as mock_blob_service_client, \
                patch("shared_code.blob_operations.generate_container_sas", return_value="sas"):

            mock_get_credential.return_value.__aenter__.return_value = MagicMock()

            source_url = f"https://storageacct.blob.{blob_ops.get_storage_endpoint_suffix()}/container/blob"

            # Check for two scenarios: when there's no copied_from history in metadata, and when there is some
            for source_metadata, dest_metadata in [
                ({"a": "b"}, {"a": "b", "copied_from": json.dumps([source_url])}),
                ({"a": "b", "copied_from": json.dumps(["old_url"])}, {"a": "b", "copied_from": json.dumps(["old_url", source_url])})
            ]:
                mock_client_instance = mock_blob_service_client.return_value
                mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)

                source_blob_client_mock = MagicMock()
                source_blob_client_mock.url = source_url
                source_blob_client_mock.get_blob_properties = AsyncMock(return_value={"metadata": source_metadata})

                dest_blob_client_mock = MagicMock()
                dest_blob_client_mock.start_copy_from_url = AsyncMock(return_value={"copy_id": "123", "copy_status": "status"})

                mock_container_client = MagicMock()
                mock_client_instance.get_container_client.return_value = mock_container_client
                mock_container_client.get_blob_client.return_value = source_blob_client_mock

                mock_list_blobs = AsyncMock()
                mock_list_blobs.__aiter__.return_value = [get_test_blob()("a")]
                mock_container_client.list_blobs.return_value = mock_list_blobs

                mock_client_instance.get_user_delegation_key = AsyncMock(return_value="key")
                mock_client_instance.get_blob_client.return_value = dest_blob_client_mock

                await blob_ops.copy_data("source_acc", "dest_acc", "req_id")

                # Check that copied_from field was set correctly in the metadata
                dest_blob_client_mock.start_copy_from_url.assert_called_with(f"{source_url}?sas", metadata=dest_metadata)

    def test_get_blob_url_should_return_blob_url(self):
        account_name = "account"
        container_name = "container"
        blob_name = "blob"

        blob_url = blob_ops.get_blob_url(account_name, container_name, blob_name)
        assert blob_url == f"https://{account_name}.blob.{blob_ops.get_storage_endpoint_suffix()}/{container_name}/{blob_name}"

    def test_get_blob_url_without_blob_name_should_return_container_url(self):
        account_name = "account"
        container_name = "container"

        blob_url = blob_ops.get_blob_url(account_name, container_name)
        assert blob_url == f"https://{account_name}.blob.{blob_ops.get_storage_endpoint_suffix()}/{container_name}/"
