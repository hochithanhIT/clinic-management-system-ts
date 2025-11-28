export type PaymentStatusFilterValue = "all" | "paid" | "unpaid"

export type PaymentStatusValue = Exclude<PaymentStatusFilterValue, "all">

export interface BillingRecord {
  id: number
  medicalRecordCode: string
  patientCode: string
  patientName: string
  wardName: string | null
  cityName: string | null
  paymentStatus: PaymentStatusValue
  totalServiceOrders: number
  totalServiceDetails: number
  unpaidServiceDetails: number
}

export interface BillingInvoice {
  id: number
  code: string
  amount: number
  paidAt: string
  collectorName: string
  collectorCode: string
  isCancelled: boolean
}
