export type ServiceOrderCategory = 'lab' | 'imaging' | 'procedure'
export type ServicesDialogMode = 'create' | 'edit'

export interface DiagnosticOrderSummaryRow {
  id: number
  code: string
  createdAt: string
  orderedBy: string
  status: number
}

export interface DiagnosticServiceRow {
  id: number
  serviceId: number
  serviceCode: string
  serviceName: string
  serviceTypeName: string | null
  quantity: number
  amount: number
  unitPrice: number
  executionRoomId: number | null
  requireResult: boolean
  hasResult: boolean
}

export interface DiagnosticResultRow {
  id: number
  serviceCode: string
  serviceName: string
  receivedAt: string
  performedAt: string
  deliveredAt: string
  result: string
  conclusion: string
  note: string | null
  url: string | null
}

export interface ServicesDialogInitialOrder {
  id: number
  createdAt: string
  services: Array<{
    detailId: number
    serviceId: number
    code: string
    name: string
    serviceTypeName: string | null
    price: number
    quantity: number
    executionRoomId: number | null
    requireResult: boolean
    hasResult: boolean
  }>
}
