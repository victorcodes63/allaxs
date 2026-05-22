import { apiClient } from "./api-client";

export type AnnouncementRecipients = {
  recipientCount: number;
};

export type SendAnnouncementResult = {
  recipientCount: number;
  sentCount: number;
  failedCount: number;
};

export async function fetchAnnouncementRecipients(
  eventId: string,
): Promise<AnnouncementRecipients> {
  const res = await apiClient.get<AnnouncementRecipients>(
    `/organizer/events/${eventId}/announcements/recipients`,
  );
  return res.data;
}

export async function sendEventAnnouncement(
  eventId: string,
  payload: { subject: string; bodyHtml: string },
): Promise<SendAnnouncementResult> {
  const res = await apiClient.post<SendAnnouncementResult>(
    `/organizer/events/${eventId}/announcements`,
    payload,
  );
  return res.data;
}
