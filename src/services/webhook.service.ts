import axios from 'axios';
import { prisma } from '../prisma';

export class WebhookService {
  /**
   * Dispatches an event to the webhook URL registered for an instance.
   * @param instanceName Name of the instance sending the event.
   * @param eventName Name of the event (e.g., 'messages.upsert').
   * @param payload The payload/data of the event.
   */
  static async dispatch(instanceName: string, eventName: string, payload: any) {
    try {
      const instance = await prisma.instance.findUnique({
        where: { name: instanceName }
      });

      if (!instance || !instance.webhookUrl) {
        return; // No webhook registered or instance not found
      }

      // Check if event is subscribed
      if (!instance.webhookEvents || !instance.webhookEvents.includes(eventName)) {
        return; // Event not explicitly subscribed
      }

      await axios.post(instance.webhookUrl, {
        instance: instanceName,
        event: eventName,
        data: payload
      });

    } catch (error: any) {
      console.error(`[Webhook Dispatch Error] Instance: ${instanceName} | Event: ${eventName}`, error.message);
    }
  }
}
