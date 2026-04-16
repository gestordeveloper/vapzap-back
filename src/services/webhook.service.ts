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
        where: { name: instanceName },
        include: { agent: true, user: true }
      });

      if (!instance || !instance.webhookUrl) {
        return; // No webhook registered or instance not found
      }

      // Check if event is subscribed
      if (!instance.webhookEvents || !instance.webhookEvents.includes(eventName)) {
        return; // Event not explicitly subscribed
      }

      let dataToSend: any = {
        instance: instanceName,
        event: eventName,
        data: payload
      };

      if (instance.webhookEvents.includes('send_agent_data')) {
         dataToSend.agent = instance.agent || null;
         dataToSend.connection = {
           id: instance.id,
           name: instance.name,
           status: instance.status
         };
         if (instance.user) {
             dataToSend.user = {
                 id: instance.user.id,
                 name: instance.user.name,
                 email: instance.user.email
             };
         }
      }

      await axios.post(instance.webhookUrl, dataToSend);

    } catch (error: any) {
      console.error(`[Webhook Dispatch Error] Instance: ${instanceName} | Event: ${eventName}`, error.message);
    }
  }
}
