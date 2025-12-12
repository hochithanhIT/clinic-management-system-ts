<script setup lang="ts">
definePage({
  alias: '/catalog/employee/',
  meta: {
    requiresAuth: true,
  },
})

import { computed, onMounted, reactive, ref } from 'vue'
import { CalendarIcon, Loader2, PlusIcon, SearchIcon } from 'lucide-vue-next'
import type { DateValue } from 'reka-ui'
import { parseDate } from '@internationalized/date'
import { toast } from 'vue-sonner'

import ComboBox from '@/components/ComboBox.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ApiError } from '@/services/http'
import {
  createEmployee,
  getEmployees,
  updateEmployee,
  type CreateEmployeePayload,
  type GetEmployeesParams,
  type EmployeeSummary,
  type UpdateEmployeePayload,
} from '@/services/employee'
import { getDepartments } from '@/services/department'
import type { DepartmentSummary } from '@/services/department'
import { getRoles, type RoleSummary } from '@/services/role'
import type { PaginationMeta } from '@/services/types'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

const formatDateDisplay = (value: string | null | undefined, emptyLabel = '—'): string => {
  if (!value) {
    return emptyLabel
  }

  const [datePart] = value.split('T')
  if (!datePart) {
    return emptyLabel
  }

  const segments = datePart.split('-')
  if (segments.length !== 3) {
    return emptyLabel
  }

  const [year = '', month = '', day = ''] = segments
  const isValid = [year, month, day].every((part) => part && Number.isFinite(Number(part)))
  if (!isValid) {
    return emptyLabel
  }

  const paddedDay = day.padStart(2, '0')
  const paddedMonth = month.padStart(2, '0')

  return `${paddedDay}-${paddedMonth}-${year}`
}

const formatDateLabel = (value: string): string => {
  return formatDateDisplay(value, 'Select date')
}

const toDateValue = (value: string): DateValue | undefined => {
  if (!value) {
    return undefined
  }

  try {
    return parseDate(value) as DateValue
  } catch (error) {
    console.error('Unable to parse date value', error)
    return undefined
  }
}

type EmployeeFormState = {
  code: string
  fullName: string
  gender: string
  birthDate: string
  phone: string
  departmentId: string
  roleId: string
  certificateCode: string
  certificateIssuedAt: string
  certificateExpiredAt: string
  status: 'active' | 'inactive'
}

const filters = reactive({
  name: '',
  code: '',
  departmentId: 'all',
  roleId: 'all',
})

const appliedFilters = reactive({
  name: '',
  code: '',
  departmentId: 'all',
  roleId: 'all',
})

const page = ref(1)
const pageSize = ref(PAGE_SIZE_OPTIONS[0])

const employees = ref<EmployeeSummary[]>([])
const employeesPagination = ref<PaginationMeta | null>(null)
const employeesLoading = ref(false)
const employeesError = ref<string | null>(null)

const departments = ref<DepartmentSummary[]>([])
const roles = ref<RoleSummary[]>([])
const departmentsLoading = ref(false)
const rolesLoading = ref(false)
const birthDatePopoverOpen = ref(false)
const certificateIssuedPopoverOpen = ref(false)
const certificateExpiredPopoverOpen = ref(false)
const birthDateValue = ref<DateValue | undefined>(undefined)
const certificateIssuedValue = ref<DateValue | undefined>(undefined)
const certificateExpiredValue = ref<DateValue | undefined>(undefined)
const birthDateBinding = computed<DateValue | undefined>(() => {
  const value = birthDateValue.value
  return value ? (value as unknown as DateValue) : undefined
})
const certificateIssuedBinding = computed<DateValue | undefined>(() => {
  const value = certificateIssuedValue.value
  return value ? (value as unknown as DateValue) : undefined
})
const certificateExpiredBinding = computed<DateValue | undefined>(() => {
  const value = certificateExpiredValue.value
  return value ? (value as unknown as DateValue) : undefined
})

const departmentOptions = computed(() => {
  return [
    { value: 'all', label: 'All departments' },
    ...departments.value.map((department) => ({
      value: String(department.id),
      label: department.name,
    })),
  ]
})

const departmentComboOptions = computed(() =>
  departments.value.map((department) => ({ value: String(department.id), label: department.name })),
)

const roleOptions = computed(() =>
  roles.value.map((role) => ({ value: String(role.id), label: role.name })),
)

const roleFilterOptions = computed(() => {
  return [
    { value: 'all', label: 'All roles' },
    ...roles.value.map((role) => ({ value: String(role.id), label: role.name })),
  ]
})

const selectedEmployee = ref<EmployeeSummary | null>(null)
const isCreating = ref(false)
const lastSelectedEmployeeId = ref<number | null>(null)
const pendingSelectionId = ref<number | null>(null)

const createEmptyFormState = (): EmployeeFormState => ({
  code: '',
  fullName: '',
  gender: '',
  birthDate: '',
  phone: '',
  departmentId: '',
  roleId: '',
  certificateCode: '',
  certificateIssuedAt: '',
  certificateExpiredAt: '',
  status: 'active',
})

const form = reactive<EmployeeFormState>(createEmptyFormState())
const saving = ref(false)
const formErrors = ref<string[]>([])

const genderOptions = [
  { value: '1', label: 'Male' },
  { value: '0', label: 'Female' },
]

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const birthDateLabel = computed(() => formatDateLabel(form.birthDate))
const certificateIssuedLabel = computed(() => formatDateLabel(form.certificateIssuedAt))
const certificateExpiredLabel = computed(() => formatDateLabel(form.certificateExpiredAt))

const filteredEmployees = computed(() => {
  let items = employees.value

  if (appliedFilters.departmentId !== 'all') {
    const departmentId = Number(appliedFilters.departmentId)
    if (Number.isFinite(departmentId)) {
      items = items.filter((employee) => employee.department?.id === departmentId)
    }
  }

  if (appliedFilters.roleId !== 'all') {
    const roleId = Number(appliedFilters.roleId)
    if (Number.isFinite(roleId)) {
      items = items.filter((employee) => employee.role?.id === roleId)
    }
  }

  return items
})

const recordsSummary = computed(() => {
  const pagination = employeesPagination.value
  if (!pagination) {
    return ''
  }

  if (pagination.total === 0) {
    return 'No employees found for the selected filters.'
  }

  const start = (pagination.page - 1) * pagination.limit + 1
  const end = Math.min(pagination.page * pagination.limit, pagination.total)
  const visible = filteredEmployees.value.length

  return `Showing ${visible} of ${pagination.total} employees (records ${start}-${end}).`
})

const recordsPerPageModel = computed({
  get: () => String(pageSize.value),
  set: (value: string) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed === pageSize.value) {
      return
    }

    pageSize.value = parsed
    page.value = 1
    void loadEmployees()
  },
})

const hasFormChanges = computed(() => {
  const employee = selectedEmployee.value
  if (!employee) {
    return false
  }

  const compareString = (value: string, original: string | null | undefined) => {
    return value.trim() !== (original ?? '').trim()
  }

  if (compareString(form.code, employee.code)) {
    return true
  }

  if (compareString(form.fullName, employee.fullName)) {
    return true
  }

  const formGender = form.gender === '' ? null : Number(form.gender)
  if (formGender !== employee.gender) {
    return true
  }

  const employeeBirthDate = employee.birthDate ? employee.birthDate.slice(0, 10) : ''
  if (form.birthDate !== employeeBirthDate) {
    return true
  }

  if (compareString(form.phone, employee.phone)) {
    return true
  }

  const formDepartmentId = form.departmentId ? Number(form.departmentId) : null
  if (formDepartmentId !== (employee.department?.id ?? null)) {
    return true
  }

  const formRoleId = form.roleId ? Number(form.roleId) : null
  if (formRoleId !== (employee.role?.id ?? null)) {
    return true
  }

  if (compareString(form.certificateCode, employee.certificateCode)) {
    return true
  }

  const certificateIssued = employee.certificateIssuedAt
    ? employee.certificateIssuedAt.slice(0, 10)
    : ''
  if (form.certificateIssuedAt !== certificateIssued) {
    return true
  }

  const certificateExpired = employee.certificateExpiredAt
    ? employee.certificateExpiredAt.slice(0, 10)
    : ''
  if (form.certificateExpiredAt !== certificateExpired) {
    return true
  }

  if ((form.status === 'inactive') !== employee.isDeleted) {
    return true
  }

  return false
})

const isSaveDisabled = computed(
  () => saving.value || !selectedEmployee.value || !hasFormChanges.value,
)

const applyEmployeeToForm = (employee: EmployeeSummary) => {
  isCreating.value = false
  lastSelectedEmployeeId.value = employee.id
  form.code = employee.code ?? ''
  form.fullName = employee.fullName ?? ''
  form.gender =
    employee.gender === null || employee.gender === undefined ? '' : String(employee.gender)
  form.birthDate = employee.birthDate ? employee.birthDate.slice(0, 10) : ''
  form.phone = employee.phone ?? ''
  form.departmentId = employee.department ? String(employee.department.id) : ''
  form.roleId = employee.role ? String(employee.role.id) : ''
  form.certificateCode = employee.certificateCode ?? ''
  form.certificateIssuedAt = employee.certificateIssuedAt
    ? employee.certificateIssuedAt.slice(0, 10)
    : ''
  form.certificateExpiredAt = employee.certificateExpiredAt
    ? employee.certificateExpiredAt.slice(0, 10)
    : ''
  form.status = employee.isDeleted ? 'inactive' : 'active'
  birthDatePopoverOpen.value = false
  certificateIssuedPopoverOpen.value = false
  certificateExpiredPopoverOpen.value = false
  birthDateValue.value = toDateValue(form.birthDate)
  certificateIssuedValue.value = toDateValue(form.certificateIssuedAt)
  certificateExpiredValue.value = toDateValue(form.certificateExpiredAt)
}

const resetForm = () => {
  Object.assign(form, createEmptyFormState())
  birthDateValue.value = undefined
  certificateIssuedValue.value = undefined
  certificateExpiredValue.value = undefined
  birthDatePopoverOpen.value = false
  certificateIssuedPopoverOpen.value = false
  certificateExpiredPopoverOpen.value = false
}

const extractValidationMessages = (details: unknown): string[] => {
  if (!details || typeof details !== 'object') {
    return []
  }

  const payload = details as { errors?: Record<string, unknown> }
  if (!payload.errors || typeof payload.errors !== 'object') {
    return []
  }

  const messages: string[] = []
  for (const value of Object.values(payload.errors)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === 'string' && entry.trim()) {
          messages.push(entry.trim())
        }
      }
    }
  }

  return messages
}

const buildSearchTerm = (): string | undefined => {
  const code = appliedFilters.code.trim()
  const name = appliedFilters.name.trim()

  if (code && name) {
    return `${code} ${name}`
  }

  if (code) {
    return code
  }

  if (name) {
    return name
  }

  return undefined
}

const loadDepartments = async () => {
  departmentsLoading.value = true
  try {
    const { departments: items } = await getDepartments({ page: 1, limit: 100 })
    departments.value = items
  } catch (error) {
    console.error(error)
    toast.error('Unable to load departments.')
  } finally {
    departmentsLoading.value = false
  }
}

const loadRoles = async () => {
  rolesLoading.value = true
  try {
    const { roles: items } = await getRoles({ page: 1, limit: 100 })
    roles.value = items
  } catch (error) {
    console.error(error)
    toast.error('Unable to load roles.')
  } finally {
    rolesLoading.value = false
  }
}

const handleBirthDateSelect = (value: DateValue | undefined) => {
  if (!value) {
    birthDateValue.value = undefined
    form.birthDate = ''
    return
  }

  birthDateValue.value = value
  form.birthDate = value.toString()
  birthDatePopoverOpen.value = false
}

const handleCertificateIssuedSelect = (value: DateValue | undefined) => {
  if (!value) {
    certificateIssuedValue.value = undefined
    form.certificateIssuedAt = ''
    return
  }

  certificateIssuedValue.value = value
  form.certificateIssuedAt = value.toString()
  certificateIssuedPopoverOpen.value = false
}

const handleCertificateExpiredSelect = (value: DateValue | undefined) => {
  if (!value) {
    certificateExpiredValue.value = undefined
    form.certificateExpiredAt = ''
    return
  }

  certificateExpiredValue.value = value
  form.certificateExpiredAt = value.toString()
  certificateExpiredPopoverOpen.value = false
}

const loadEmployees = async () => {
  employeesLoading.value = true
  employeesError.value = null

  try {
    const search = buildSearchTerm()
    const requestParams: GetEmployeesParams = {
      page: page.value,
      limit: pageSize.value,
      search,
    }

    if (appliedFilters.departmentId !== 'all') {
      const parsed = Number(appliedFilters.departmentId)
      if (Number.isFinite(parsed)) {
        requestParams.departmentId = parsed
      }
    }

    if (appliedFilters.roleId !== 'all') {
      const parsed = Number(appliedFilters.roleId)
      if (Number.isFinite(parsed)) {
        requestParams.roleId = parsed
      }
    }

    const { employees: list, pagination } = await getEmployees(requestParams)

    const sortedEmployees = [...list].sort((a, b) =>
      a.code.localeCompare(b.code, 'vi', { numeric: true }),
    )
    employees.value = sortedEmployees
    employeesPagination.value = pagination
    page.value = pagination.page
    pageSize.value = pagination.limit

    if (sortedEmployees.length === 0) {
      if (!isCreating.value) {
        selectedEmployee.value = null
        resetForm()
      }
      return
    }

    const requestedSelectionId = pendingSelectionId.value
    const currentSelectionId =
      requestedSelectionId ?? (isCreating.value ? null : (selectedEmployee.value?.id ?? null))
    pendingSelectionId.value = null

    if (typeof currentSelectionId === 'number') {
      const matchedEmployee = sortedEmployees.find((employee) => employee.id === currentSelectionId)
      if (matchedEmployee) {
        selectedEmployee.value = matchedEmployee
        applyEmployeeToForm(matchedEmployee)
        formErrors.value = []
        return
      }
    }

    if (isCreating.value) {
      selectedEmployee.value = null
      return
    }

    const fallbackEmployee = sortedEmployees[0]
    if (fallbackEmployee) {
      selectedEmployee.value = fallbackEmployee
      applyEmployeeToForm(fallbackEmployee)
      formErrors.value = []
      return
    }

    selectedEmployee.value = null
    resetForm()
  } catch (error) {
    console.error(error)
    if (error instanceof ApiError) {
      employeesError.value = error.message
    } else if (error instanceof Error) {
      employeesError.value = error.message
    } else {
      employeesError.value = 'Unable to load employees.'
    }
  } finally {
    employeesLoading.value = false
  }
}

const validateForm = (mode: 'create' | 'update'): boolean => {
  const errors: string[] = []

  if (mode === 'update') {
    if (!selectedEmployee.value) {
      errors.push('Select an employee to edit.')
    }

    if (!form.code.trim()) {
      errors.push('Employee code is required.')
    }
  }

  if (!form.fullName.trim()) {
    errors.push('Full name is required.')
  }

  if (!form.gender) {
    errors.push('Gender is required.')
  }

  if (!form.birthDate) {
    errors.push('Birth date is required.')
  }

  if (!form.phone.trim()) {
    errors.push('Phone number is required.')
  }

  if (!form.departmentId) {
    errors.push('Department is required.')
  }

  if (!form.roleId) {
    errors.push('Role is required.')
  }

  formErrors.value = errors
  return errors.length === 0
}

const buildUpdatePayload = (): UpdateEmployeePayload => {
  const employee = selectedEmployee.value
  if (!employee) {
    return {}
  }

  const payload: UpdateEmployeePayload = {}

  const code = form.code.trim()
  if (code !== employee.code) {
    payload.maNV = code
  }

  const fullName = form.fullName.trim()
  if (fullName !== employee.fullName) {
    payload.hoTen = fullName
  }

  const formGender = form.gender === '' ? null : Number(form.gender)
  if (formGender !== employee.gender && formGender !== null) {
    payload.gioiTinh = formGender
  }

  if (
    form.birthDate &&
    form.birthDate !== (employee.birthDate ? employee.birthDate.slice(0, 10) : '')
  ) {
    payload.ngaySinh = new Date(form.birthDate)
  }

  const phone = form.phone.trim()
  if (phone !== (employee.phone ?? '')) {
    payload.sdt = phone
  }

  const departmentId = form.departmentId ? Number(form.departmentId) : null
  if (departmentId !== null && departmentId !== (employee.department?.id ?? null)) {
    payload.khoaId = departmentId
  }

  const roleId = form.roleId ? Number(form.roleId) : null
  if (roleId !== null && roleId !== (employee.role?.id ?? null)) {
    payload.vaiTroId = roleId
  }

  const certificateCode = form.certificateCode.trim()
  if (certificateCode !== (employee.certificateCode ?? '')) {
    payload.soChungChiHanhNghe = certificateCode
  }

  if (
    form.certificateIssuedAt &&
    form.certificateIssuedAt !==
      (employee.certificateIssuedAt ? employee.certificateIssuedAt.slice(0, 10) : '')
  ) {
    payload.ngayCapChungChi = new Date(form.certificateIssuedAt)
  }

  if (
    form.certificateExpiredAt &&
    form.certificateExpiredAt !==
      (employee.certificateExpiredAt ? employee.certificateExpiredAt.slice(0, 10) : '')
  ) {
    payload.ngayHetHanChungChi = new Date(form.certificateExpiredAt)
  }

  const isDeleted = form.status === 'inactive'
  if (isDeleted !== employee.isDeleted) {
    payload.daXoa = isDeleted
  }

  return payload
}

const buildCreatePayload = (): CreateEmployeePayload => {
  const gender = Number(form.gender)
  if (!Number.isFinite(gender)) {
    throw new Error('Selected gender is invalid.')
  }

  const departmentId = Number(form.departmentId)
  if (!Number.isFinite(departmentId)) {
    throw new Error('Selected department is invalid.')
  }

  const roleId = Number(form.roleId)
  if (!Number.isFinite(roleId)) {
    throw new Error('Selected role is invalid.')
  }

  const payload: CreateEmployeePayload = {
    hoTen: form.fullName.trim(),
    ngaySinh: new Date(form.birthDate),
    gioiTinh: gender,
    sdt: form.phone.trim(),
    khoaId: departmentId,
    vaiTroId: roleId,
  }

  const certificateCode = form.certificateCode.trim()
  if (certificateCode) {
    payload.soChungChiHanhNghe = certificateCode
  }

  if (form.certificateIssuedAt) {
    payload.ngayCapChungChi = new Date(form.certificateIssuedAt)
  }

  if (form.certificateExpiredAt) {
    payload.ngayHetHanChungChi = new Date(form.certificateExpiredAt)
  }

  payload.daXoa = form.status === 'inactive'

  return payload
}

const handleSearch = async () => {
  appliedFilters.name = filters.name
  appliedFilters.code = filters.code
  appliedFilters.departmentId = filters.departmentId
  appliedFilters.roleId = filters.roleId
  page.value = 1
  await loadEmployees()
}

const handleResetFilters = async () => {
  filters.name = ''
  filters.code = ''
  filters.departmentId = 'all'
  filters.roleId = 'all'
  appliedFilters.name = ''
  appliedFilters.code = ''
  appliedFilters.departmentId = 'all'
  appliedFilters.roleId = 'all'
  page.value = 1
  pageSize.value = PAGE_SIZE_OPTIONS[0]
  await loadEmployees()
}

const handleAddEmployee = async () => {
  if (!isCreating.value) {
    if (hasFormChanges.value) {
      toast.info('Save or cancel current changes before adding a new employee.')
      return
    }

    lastSelectedEmployeeId.value = selectedEmployee.value?.id ?? null
    pendingSelectionId.value = null
    isCreating.value = true
    selectedEmployee.value = null
    resetForm()
    formErrors.value = []
    return
  }

  if (!validateForm('create')) {
    return
  }

  saving.value = true

  try {
    const payload = buildCreatePayload()
    const created = await createEmployee(payload)

    toast.success('Employee added.')
    pendingSelectionId.value = created.id
    isCreating.value = false
    lastSelectedEmployeeId.value = null
    formErrors.value = []

    await loadEmployees()
  } catch (error) {
    console.error(error)
    if (error instanceof ApiError) {
      const messages = extractValidationMessages(error.details)
      formErrors.value = messages.length ? messages : [error.message]
    } else if (error instanceof Error) {
      formErrors.value = [error.message]
    } else {
      formErrors.value = ['Unable to add employee.']
    }
  } finally {
    saving.value = false
  }
}

const handlePageChange = async (nextPage: number) => {
  if (employeesLoading.value || nextPage === page.value) {
    return
  }

  page.value = nextPage
  await loadEmployees()
}

const handleSelectEmployee = (employee: EmployeeSummary) => {
  selectedEmployee.value = employee
  applyEmployeeToForm(employee)
  formErrors.value = []
}

const handleCancel = () => {
  if (isCreating.value) {
    isCreating.value = false
    formErrors.value = []

    if (lastSelectedEmployeeId.value !== null) {
      const previous = employees.value.find(
        (employee) => employee.id === lastSelectedEmployeeId.value,
      )
      lastSelectedEmployeeId.value = null

      if (previous) {
        selectedEmployee.value = previous
        applyEmployeeToForm(previous)
        return
      }
    }

    lastSelectedEmployeeId.value = null

    const fallback = employees.value[0]
    if (fallback) {
      selectedEmployee.value = fallback
      applyEmployeeToForm(fallback)
    } else {
      selectedEmployee.value = null
      resetForm()
    }

    return
  }

  const employee = selectedEmployee.value
  if (employee) {
    applyEmployeeToForm(employee)
  } else {
    resetForm()
  }

  formErrors.value = []
}

const handleSave = async () => {
  if (!selectedEmployee.value) {
    return
  }

  if (!validateForm('update')) {
    return
  }

  const payload = buildUpdatePayload()
  if (Object.keys(payload).length === 0) {
    toast.info('No changes to save.')
    return
  }

  saving.value = true

  try {
    const updated = await updateEmployee(selectedEmployee.value.id, payload)
    selectedEmployee.value = updated
    applyEmployeeToForm(updated)

    const index = employees.value.findIndex((employee) => employee.id === updated.id)
    if (index !== -1) {
      employees.value.splice(index, 1, updated)
    }

    toast.success('Employee information updated.')
    formErrors.value = []
  } catch (error) {
    console.error(error)
    if (error instanceof ApiError) {
      const messages = extractValidationMessages(error.details)
      formErrors.value = messages.length ? messages : [error.message]
    } else if (error instanceof Error) {
      formErrors.value = [error.message]
    } else {
      formErrors.value = ['Unable to save employee changes.']
    }
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void Promise.all([loadDepartments(), loadRoles()])
  void loadEmployees()
})
</script>

<template>
  <section class="w-full bg-primary-foreground py-8">
    <div class="space-y-6 mx-auto max-w-7xl px-4">
      <Card>
        <CardHeader class="flex flex-col gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle class="text-base">Employee Details</CardTitle>
          <p v-if="selectedEmployee" class="text-sm text-muted-foreground">
            Editing {{ selectedEmployee.fullName }} ({{ selectedEmployee.code }})
          </p>
          <p v-else-if="isCreating" class="text-sm text-muted-foreground">Adding a new employee</p>
        </CardHeader>
        <CardContent class="space-y-5">
          <div
            v-if="!selectedEmployee && !isCreating"
            class="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground"
          >
            Select an employee from the list below to view and edit details.
          </div>

          <div v-else class="space-y-4">
            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field>
                <FieldLabel for="employee-code">Employee Code</FieldLabel>
                <Input
                  id="employee-code"
                  v-model="form.code"
                  disabled
                  readonly
                  placeholder="Auto generated"
                />
              </Field>

              <Field>
                <FieldLabel for="employee-name">Full Name</FieldLabel>
                <Input
                  id="employee-name"
                  v-model="form.fullName"
                  :disabled="saving"
                  placeholder="Employee name"
                />
              </Field>

              <Field>
                <FieldLabel for="employee-gender">Gender</FieldLabel>
                <ComboBox
                  id="employee-gender"
                  v-model="form.gender"
                  :options="genderOptions"
                  placeholder="Select gender"
                  :disabled="saving"
                />
              </Field>

              <Field>
                <FieldLabel for="employee-birth-date">Birth Date</FieldLabel>
                <Popover v-model:open="birthDatePopoverOpen">
                  <PopoverTrigger as-child>
                    <Button
                      id="employee-birth-date"
                      variant="outline"
                      class="w-full justify-start text-left font-normal"
                      :disabled="saving"
                    >
                      <CalendarIcon class="mr-2 h-4 w-4" />
                      <span :class="!form.birthDate ? 'text-muted-foreground' : ''">
                        {{ birthDateLabel }}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-auto p-0" align="start">
                    <Calendar
                      :model-value="birthDateBinding"
                      layout="month-and-year"
                      initial-focus
                      @update:model-value="handleBirthDateSelect"
                    />
                  </PopoverContent>
                </Popover>
              </Field>

              <Field>
                <FieldLabel for="employee-phone">Phone Number</FieldLabel>
                <Input
                  id="employee-phone"
                  v-model="form.phone"
                  type="tel"
                  :disabled="saving"
                  placeholder="Eg. 0901xxxxxx"
                />
              </Field>

              <Field>
                <FieldLabel for="employee-department">Department</FieldLabel>
                <ComboBox
                  id="employee-department"
                  v-model="form.departmentId"
                  :options="departmentComboOptions"
                  placeholder="Select department"
                  :disabled="saving || departmentsLoading || !departmentComboOptions.length"
                  :loading="departmentsLoading"
                />
              </Field>

              <Field>
                <FieldLabel for="employee-role">Role</FieldLabel>
                <ComboBox
                  id="employee-role"
                  v-model="form.roleId"
                  :options="roleOptions"
                  placeholder="Select role"
                  :disabled="saving || rolesLoading || !roleOptions.length"
                  :loading="rolesLoading"
                />
              </Field>

              <Field>
                <FieldLabel for="employee-certificate">Certificate Number</FieldLabel>
                <Input
                  id="employee-certificate"
                  v-model="form.certificateCode"
                  :disabled="saving"
                  placeholder="Certificate identifier"
                />
              </Field>

              <Field>
                <FieldLabel for="employee-certificate-issued">Certificate Issued</FieldLabel>
                <Popover v-model:open="certificateIssuedPopoverOpen">
                  <PopoverTrigger as-child>
                    <Button
                      id="employee-certificate-issued"
                      variant="outline"
                      class="w-full justify-start text-left font-normal"
                      :disabled="saving"
                    >
                      <CalendarIcon class="mr-2 h-4 w-4" />
                      <span :class="!form.certificateIssuedAt ? 'text-muted-foreground' : ''">
                        {{ certificateIssuedLabel }}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-auto p-0" align="start">
                    <Calendar
                      :model-value="certificateIssuedBinding"
                      :max-value="certificateExpiredBinding"
                      layout="month-and-year"
                      initial-focus
                      @update:model-value="handleCertificateIssuedSelect"
                    />
                  </PopoverContent>
                </Popover>
              </Field>

              <Field>
                <FieldLabel for="employee-certificate-expired">Certificate Expiry</FieldLabel>
                <Popover v-model:open="certificateExpiredPopoverOpen">
                  <PopoverTrigger as-child>
                    <Button
                      id="employee-certificate-expired"
                      variant="outline"
                      class="w-full justify-start text-left font-normal"
                      :disabled="saving"
                    >
                      <CalendarIcon class="mr-2 h-4 w-4" />
                      <span :class="!form.certificateExpiredAt ? 'text-muted-foreground' : ''">
                        {{ certificateExpiredLabel }}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-auto p-0" align="start">
                    <Calendar
                      :model-value="certificateExpiredBinding"
                      :min-value="certificateIssuedBinding"
                      layout="month-and-year"
                      initial-focus
                      @update:model-value="handleCertificateExpiredSelect"
                    />
                  </PopoverContent>
                </Popover>
              </Field>

              <Field>
                <FieldLabel for="employee-status">Status</FieldLabel>
                <ComboBox
                  id="employee-status"
                  v-model="form.status"
                  :options="statusOptions"
                  placeholder="Select status"
                  :disabled="saving"
                />
              </Field>
            </div>

            <div
              v-if="formErrors.length"
              class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <ul class="list-disc space-y-1 pl-4">
                <li v-for="message in formErrors" :key="message">
                  {{ message }}
                </li>
              </ul>
            </div>

            <div class="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                class="flex items-center"
                :disabled="saving"
                @click="handleAddEmployee"
              >
                <PlusIcon class="mr-2 h-4 w-4" />
                {{ isCreating ? (saving ? 'Adding...' : 'Add Employee') : 'New Employee' }}
              </Button>
              <Button type="button" variant="outline" :disabled="saving" @click="handleCancel">
                Cancel
              </Button>
              <Button
                v-if="!isCreating"
                type="button"
                :disabled="isSaveDisabled"
                @click="handleSave"
              >
                {{ saving ? 'Saving…' : 'Save Changes' }}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-base">Employee Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Field>
              <FieldLabel for="filter-name">Name</FieldLabel>
              <Input
                id="filter-name"
                v-model="filters.name"
                placeholder="Search by name"
                :disabled="employeesLoading"
              />
            </Field>

            <Field>
              <FieldLabel for="filter-code">Employee Code</FieldLabel>
              <Input
                id="filter-code"
                v-model="filters.code"
                placeholder="Search by code"
                :disabled="employeesLoading"
              />
            </Field>

            <Field>
              <FieldLabel for="filter-department">Department</FieldLabel>
              <ComboBox
                id="filter-department"
                v-model="filters.departmentId"
                :options="departmentOptions"
                placeholder="All departments"
                :disabled="employeesLoading || !departmentOptions.length"
              />
            </Field>

            <Field>
              <FieldLabel for="filter-role">Role</FieldLabel>
              <ComboBox
                id="filter-role"
                v-model="filters.roleId"
                :options="roleFilterOptions"
                placeholder="All roles"
                :disabled="employeesLoading || rolesLoading"
                :loading="rolesLoading"
              />
            </Field>

            <Field>
              <FieldLabel for="filter-page-size">Records per page</FieldLabel>
              <NativeSelect
                id="filter-page-size"
                v-model="recordsPerPageModel"
                :disabled="employeesLoading"
              >
                <option v-for="option in PAGE_SIZE_OPTIONS" :key="option" :value="option">
                  {{ option }}
                </option>
              </NativeSelect>
            </Field>
          </div>

          <div class="mt-4 flex justify-end gap-3">
            <Button
              type="button"
              class="flex items-center"
              :disabled="employeesLoading"
              @click="handleSearch"
            >
              <SearchIcon class="mr-2 h-4 w-4" />
              Search
            </Button>
            <Button
              type="button"
              variant="outline"
              :disabled="employeesLoading"
              @click="handleResetFilters"
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-col gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle class="text-base">Employee Directory</CardTitle>
          <p v-if="recordsSummary" class="text-sm text-muted-foreground">{{ recordsSummary }}</p>
        </CardHeader>
        <CardContent class="space-y-4">
          <div
            v-if="employeesLoading"
            class="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
          >
            <Loader2 class="h-4 w-4 animate-spin" />
            Loading employees…
          </div>
          <p v-else-if="employeesError" class="text-sm text-destructive">{{ employeesError }}</p>

          <div class="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-32">Code</TableHead>
                  <TableHead class="min-w-48">Full Name</TableHead>
                  <TableHead class="min-w-40">Department</TableHead>
                  <TableHead class="min-w-36">Role</TableHead>
                  <TableHead class="min-w-32">Phone</TableHead>
                  <TableHead class="min-w-40">Certificate</TableHead>
                  <TableHead class="w-28">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <template v-if="employeesLoading">
                  <TableEmpty :colspan="7">Loading employees…</TableEmpty>
                </template>
                <template v-else-if="filteredEmployees.length === 0">
                  <TableEmpty :colspan="7">No employees match the current filters.</TableEmpty>
                </template>
                <template v-else>
                  <TableRow
                    v-for="employee in filteredEmployees"
                    :key="employee.id"
                    class="cursor-pointer transition-colors"
                    :class="
                      selectedEmployee && employee.id === selectedEmployee.id
                        ? 'bg-muted/60 hover:bg-muted/60'
                        : 'hover:bg-muted/50'
                    "
                    @click="handleSelectEmployee(employee)"
                  >
                    <TableCell class="font-medium">{{ employee.code }}</TableCell>
                    <TableCell>
                      <div class="flex flex-col">
                        <span class="font-medium">{{ employee.fullName }}</span>
                        <span class="text-xs text-muted-foreground">
                          {{ formatDateDisplay(employee.birthDate, '—') }}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{{ employee.department?.name ?? '—' }}</TableCell>
                    <TableCell>{{ employee.role?.name ?? '—' }}</TableCell>
                    <TableCell>{{ employee.phone ?? '—' }}</TableCell>
                    <TableCell>
                      <div class="flex flex-col gap-1">
                        <span>{{ employee.certificateCode || '—' }}</span>
                        <span class="text-xs text-muted-foreground">
                          {{
                            employee.certificateIssuedAt
                              ? `Issued: ${formatDateDisplay(employee.certificateIssuedAt, '')}`
                              : ''
                          }}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                        :class="
                          employee.isDeleted
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        "
                      >
                        {{ employee.isDeleted ? 'Inactive' : 'Active' }}
                      </span>
                    </TableCell>
                  </TableRow>
                </template>
              </TableBody>
            </Table>
          </div>

          <Pagination
            v-if="employeesPagination && employeesPagination.total > 0"
            :page="page"
            :items-per-page="employeesPagination.limit"
            :total="employeesPagination.total"
            @update:page="handlePageChange"
          >
            <PaginationContent v-slot="{ items }">
              <PaginationPrevious />
              <template
                v-for="(item, index) in items"
                :key="item.type === 'page' ? `page-${item.value}` : `ellipsis-${index}`"
              >
                <PaginationItem
                  v-if="item.type === 'page'"
                  :value="item.value"
                  :is-active="item.value === page"
                >
                  {{ item.value }}
                </PaginationItem>
                <PaginationEllipsis v-else />
              </template>
              <PaginationNext />
            </PaginationContent>
          </Pagination>

          <p
            v-if="!employeesLoading && !employeesError && recordsSummary"
            class="text-sm text-muted-foreground"
          >
            {{ recordsSummary }}
          </p>
        </CardContent>
      </Card>
    </div>
  </section>
</template>
