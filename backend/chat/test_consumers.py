import json

from django.test import TransactionTestCase
from unittest.mock import AsyncMock, MagicMock
from chat.consumers import UserNotificationConsumer
from chat.routing import websocket_urlpatterns


class ConsumerCoverageTests(TransactionTestCase):
    async def test_connect_authenticated(self):
        consumer = UserNotificationConsumer()
        consumer.scope = {"user": MagicMock(is_anonymous=False, id=1)}
        consumer.channel_layer = AsyncMock()
        consumer.channel_name = "test_channel"
        consumer.accept = AsyncMock()

        await consumer.connect()

        consumer.channel_layer.group_add.assert_called_once_with(
            "user_notifications_1", "test_channel"
        )
        consumer.accept.assert_called_once()

    async def test_connect_anonymous(self):
        consumer = UserNotificationConsumer()
        consumer.scope = {"user": MagicMock(is_anonymous=True)}
        consumer.close = AsyncMock()

        await consumer.connect()

        consumer.close.assert_called_once()

    async def test_disconnect(self):
        consumer = UserNotificationConsumer()
        consumer.group_name = "user_notifications_1"
        consumer.channel_name = "test_channel"
        consumer.channel_layer = AsyncMock()

        await consumer.disconnect(1000)

        consumer.channel_layer.group_discard.assert_called_once_with(
            "user_notifications_1", "test_channel"
        )

    async def test_chat_update(self):
        consumer = UserNotificationConsumer()
        consumer.send = AsyncMock()
        await consumer.chat_update({})
        consumer.send.assert_called_once_with(
            text_data=json.dumps({"type": "chat_update"})
        )

    async def test_notification_update(self):
        consumer = UserNotificationConsumer()
        consumer.send = AsyncMock()
        await consumer.notification_update({})
        consumer.send.assert_called_once_with(
            text_data=json.dumps({"type": "notification_update"})
        )

    async def test_swipe_session_update(self):
        consumer = UserNotificationConsumer()
        consumer.send = AsyncMock()
        await consumer.swipe_session_update({"group_id": "123"})
        consumer.send.assert_called_once_with(
            text_data=json.dumps({"type": "swipe_session_update", "group_id": "123"})
        )

    def test_routing(self):
        # Just to ensure routing.py is imported and the patterns are valid
        self.assertTrue(len(websocket_urlpatterns) > 0)
