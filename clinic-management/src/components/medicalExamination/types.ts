export interface FollowUpAppointmentDetails {
  id?: number | null
  scheduledAt: string
  reason: string
  roomId: number | null
  roomName: string | null
  notes: string | null
}
