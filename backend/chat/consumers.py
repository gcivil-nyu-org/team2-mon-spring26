import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class UserNotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]

        if self.user.is_anonymous:
            logger.warning("Anonymous user attempted to connect to websocket.")
            await self.close()
            return

        self.group_name = f"user_notifications_{self.user.id}"

        # Join room group
        await self.channel_layer.group_add(self.group_name, self.channel_name)

        await self.accept()
        logger.info(f"WebSocket connected for user {self.user.id}")

    async def disconnect(self, close_code):
        # Leave room group
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def chat_update(self, event):
        """
        Handler for the 'chat_update' event received from the channel layer.
        """
        await self.send(text_data=json.dumps({"type": "chat_update"}))

    async def notification_update(self, event):
        """
        Handler for the 'notification_update' event to reload invites/activity.
        """
        await self.send(text_data=json.dumps({"type": "notification_update"}))
