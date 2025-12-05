import type { MedicalRecordSummary, MedicalStaffSummary } from '@/services/medicalRecord'

export const useFormatting = () => {
  const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })
  const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
  const currencyFormatter = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  })

  const formatStaffLabel = (
    staff: MedicalStaffSummary | null | undefined,
    emptyLabel = '—',
  ): string => {
    if (!staff) {
      return emptyLabel
    }

    const department = staff.department?.name
    return department ? `${staff.name} · ${department}` : staff.name
  }

  const formatCurrency = (value: number | string): string => {
    const numericValue = typeof value === 'string' ? Number(value) : value

    if (!Number.isFinite(numericValue)) {
      return '—'
    }

    return currencyFormatter.format(numericValue)
  }

  const formatBirthYear = (value: string | null | undefined): string => {
    if (!value) {
      return '—'
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return '—'
    }

    return String(date.getFullYear())
  }

  const formatDate = (value: string | null | undefined): string => {
    if (!value) {
      return '—'
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return '—'
    }

    return dateFormatter.format(date)
  }

  const formatDateTime = (value: string | null | undefined): string => {
    if (!value) {
      return '—'
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return '—'
    }

    return dateTimeFormatter.format(date)
  }

  const formatExamTimeRange = (record: MedicalRecordSummary | null): string => {
    if (!record) {
      return '—'
    }

    const start = formatDateTime(record.enteredAt)
    if (start === '—') {
      return '—'
    }

    const end = record.completedAt ? formatDateTime(record.completedAt) : 'In Progress'
    return `${start} - ${end}`
  }

  const getDispositionLabel = (record: MedicalRecordSummary): string => {
    return record.completedAt ? 'Updated' : 'Not updated'
  }

  const formatInputDate = (value: Date): string => {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getDefaultFromDate = (): string => {
    return formatInputDate(new Date())
  }

  const parseDateInput = (value: string): Date | null => {
    if (!value) {
      return null
    }

    const date = new Date(`${value}T00:00:00`)
    if (Number.isNaN(date.getTime())) {
      return null
    }

    return date
  }

  function startOfDay(value: Date): Date {
    const result = new Date(value)
    result.setHours(0, 0, 0, 0)
    return result
  }

  function endOfDay(value: Date): Date {
    const result = new Date(value)
    result.setHours(23, 59, 59, 999)
    return result
  }

  return {
    formatStaffLabel,
    formatCurrency,
    formatBirthYear,
    formatDate,
    formatDateTime,
    formatExamTimeRange,
    getDispositionLabel,
    formatInputDate,
    getDefaultFromDate,
    parseDateInput,
    startOfDay,
    endOfDay,
  }
}
