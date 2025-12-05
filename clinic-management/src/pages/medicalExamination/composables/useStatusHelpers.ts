export const useStatusHelpers = () => {
  const getMedicalRecordStatusLabel = (value: number): string => {
    switch (value) {
      case 0:
        return 'Pending'
      case 1:
        return 'In progress'
      case 2:
        return 'Completed'
      default:
        return 'Unknown'
    }
  }

  const getMedicalRecordStatusClass = (value: number): string => {
    switch (value) {
      case 0:
        return 'bg-amber-100 text-amber-800'
      case 1:
        return 'bg-sky-100 text-sky-800'
      case 2:
        return 'bg-emerald-100 text-emerald-800'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getServiceOrderStatusLabel = (value: number): string => {
    switch (value) {
      case 0:
        return 'Not sent'
      case 1:
        return 'Pending'
      case 2:
        return 'In progress'
      case 3:
        return 'Completed'
      default:
        return 'Unknown'
    }
  }

  const getServiceOrderStatusClass = (value: number): string => {
    switch (value) {
      case 0:
        return 'bg-slate-100 text-slate-800'
      case 1:
        return 'bg-amber-100 text-amber-800'
      case 2:
        return 'bg-sky-100 text-sky-800'
      case 3:
        return 'bg-emerald-100 text-emerald-800'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  return {
    getMedicalRecordStatusLabel,
    getMedicalRecordStatusClass,
    getServiceOrderStatusLabel,
    getServiceOrderStatusClass,
  }
}
