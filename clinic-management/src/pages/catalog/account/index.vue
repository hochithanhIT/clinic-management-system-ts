<script setup lang="ts">
definePage({
  alias: '/catalog/account/',
  meta: {
    requiresAuth: true,
  },
})

import { computed, onMounted, reactive, ref, watch } from 'vue'
import { KeyIcon, Loader2, PlusIcon, SearchIcon } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { ApiError } from '@/services/http'
import { getEmployees, type EmployeeSummary, type GetEmployeesParams } from '@/services/employee'
import { getDepartments } from '@/services/department'
import type { DepartmentSummary } from '@/services/department'
import { getRoles, type RoleSummary } from '@/services/role'
import { createAccount, resetAccountPassword } from '@/services/account'
import ComboBox from '@/components/ComboBox.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
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

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/

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

const formatDateTimeDisplay = (value: string | null | undefined, emptyLabel = '—'): string => {
  if (!value) {
    return emptyLabel
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return emptyLabel
  }

  return parsed.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
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
const employeesPagination = ref<{
  page: number
  limit: number
  total: number
  totalPages: number
} | null>(null)
const employeesLoading = ref(false)
const employeesError = ref<string | null>(null)

const departments = ref<DepartmentSummary[]>([])
const roles = ref<RoleSummary[]>([])
const departmentsLoading = ref(false)
const rolesLoading = ref(false)

const selectedEmployee = ref<EmployeeSummary | null>(null)
const pendingSelectionId = ref<number | null>(null)

const newUsername = ref('')
const accountActionLoading = ref(false)
const currentAccountAction = ref<'create' | 'reset' | null>(null)
const accountErrors = ref<string[]>([])

const departmentOptions = computed(() => {
  return [
    { value: 'all', label: 'All departments' },
    ...departments.value.map((department) => ({
      value: String(department.id),
      label: department.name,
    })),
  ]
})

const roleOptions = computed(() => {
  return [
    { value: 'all', label: 'All roles' },
    ...roles.value.map((role) => ({ value: String(role.id), label: role.name })),
  ]
})

const selectedAccount = ref<EmployeeSummary['account'] | null>(null)
const selectedEmployeeName = computed(() => selectedEmployee.value?.fullName ?? '')
const selectedEmployeeCode = computed(() => selectedEmployee.value?.code ?? '')
const hasAccount = computed(() => selectedAccount.value !== null)

const isUsernameValid = computed(() => {
  const value = newUsername.value.trim()
  if (!value) {
    return false
  }

  if (value.length < 6 || value.length > 20) {
    return false
  }

  if (!USERNAME_PATTERN.test(value)) {
    return false
  }

  if (/^\d+$/.test(value)) {
    return false
  }

  return true
})

const isCreateDisabled = computed(() => {
  return (
    !selectedEmployee.value ||
    hasAccount.value ||
    !isUsernameValid.value ||
    accountActionLoading.value ||
    employeesLoading.value
  )
})

const isResetDisabled = computed(() => {
  return (
    !selectedEmployee.value ||
    !hasAccount.value ||
    accountActionLoading.value ||
    employeesLoading.value
  )
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
  const visible = employees.value.length

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

const suggestUsername = (employee: EmployeeSummary): string => {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^A-Za-z0-9_-]/g, '')
      .toLowerCase()

  const candidates = [employee.code ?? '', employee.fullName ?? '']
  for (const candidate of candidates) {
    const normalized = normalize(candidate).replace(/^-+/, '')
    if (normalized.length >= 6) {
      return normalized.slice(0, 20)
    }
  }

  return `nv${String(employee.id).padStart(4, '0')}`
}

const syncSelectedAccount = (employee: EmployeeSummary | null) => {
  selectedAccount.value = employee?.account ?? null
}

const applySelection = (list: EmployeeSummary[]) => {
  if (list.length === 0) {
    selectedEmployee.value = null
    syncSelectedAccount(null)
    return
  }

  const requestedId = pendingSelectionId.value ?? selectedEmployee.value?.id ?? null
  pendingSelectionId.value = null

  if (requestedId !== null) {
    const matched = list.find((employee) => employee.id === requestedId)
    if (matched !== undefined) {
      selectedEmployee.value = matched
      syncSelectedAccount(matched)
      return
    }
  }

  const firstWithAccount = list.find((employee) => employee.account !== null)
  if (firstWithAccount !== undefined) {
    selectedEmployee.value = firstWithAccount
    syncSelectedAccount(firstWithAccount)
    return
  }

  const firstEmployee = list[0] ?? null
  selectedEmployee.value = firstEmployee
  syncSelectedAccount(firstEmployee)
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

    applySelection(sortedEmployees)
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

const handlePageChange = async (nextPage: number) => {
  if (employeesLoading.value || nextPage === page.value) {
    return
  }

  page.value = nextPage
  await loadEmployees()
}

const handleSelectEmployee = (employee: EmployeeSummary) => {
  selectedEmployee.value = employee
}

const handleCreateAccount = async () => {
  if (!selectedEmployee.value || isCreateDisabled.value) {
    return
  }

  const username = newUsername.value.trim()
  if (!isUsernameValid.value) {
    accountErrors.value = [
      'Enter a valid username (6-20 characters, letters, numbers, hyphen, underscore).',
    ]
    return
  }

  accountErrors.value = []
  accountActionLoading.value = true
  currentAccountAction.value = 'create'

  try {
    await createAccount({
      nhanVienId: selectedEmployee.value.id,
      tenDangNhap: username,
    })

    toast.success('Account created successfully.')
    pendingSelectionId.value = selectedEmployee.value.id
    await loadEmployees()
  } catch (error) {
    console.error(error)
    if (error instanceof ApiError) {
      const messages = extractValidationMessages(error.details)
      accountErrors.value = messages.length ? messages : [error.message]
    } else if (error instanceof Error) {
      accountErrors.value = [error.message]
    } else {
      accountErrors.value = ['Unable to create account.']
    }
  } finally {
    accountActionLoading.value = false
    currentAccountAction.value = null
  }
}

const handleResetPassword = async () => {
  if (!selectedEmployee.value || !hasAccount.value || isResetDisabled.value) {
    return
  }

  accountErrors.value = []
  accountActionLoading.value = true
  currentAccountAction.value = 'reset'

  try {
    await resetAccountPassword({ nhanVienId: selectedEmployee.value.id })
    toast.success('Password reset to the default value.')
    pendingSelectionId.value = selectedEmployee.value.id
    await loadEmployees()
  } catch (error) {
    console.error(error)
    if (error instanceof ApiError) {
      const messages = extractValidationMessages(error.details)
      accountErrors.value = messages.length ? messages : [error.message]
    } else if (error instanceof Error) {
      accountErrors.value = [error.message]
    } else {
      accountErrors.value = ['Unable to reset password.']
    }
  } finally {
    accountActionLoading.value = false
    currentAccountAction.value = null
  }
}

watch(
  selectedEmployee,
  (employee) => {
    syncSelectedAccount(employee ?? null)

    if (!employee) {
      newUsername.value = ''
      accountErrors.value = []
      return
    }

    accountErrors.value = []

    if (employee.account) {
      newUsername.value = ''
      return
    }

    newUsername.value = suggestUsername(employee)
  },
  { immediate: true },
)

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
          <CardTitle class="text-base">Account Information</CardTitle>
          <p v-if="selectedEmployee" class="text-sm text-muted-foreground">
            {{ selectedEmployeeName }} ({{ selectedEmployeeCode }})
          </p>
        </CardHeader>
        <CardContent>
          <div
            v-if="!selectedEmployee"
            class="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground"
          >
            Select an employee from the list below to manage account access.
          </div>

          <div v-else class="space-y-4">
            <div class="flex items-center justify-between rounded-md border border-border/60 p-4">
              <div class="space-y-1 text-sm">
                <p class="font-medium">Account status</p>
                <p class="text-muted-foreground">
                  {{
                    hasAccount
                      ? 'Account available for this employee.'
                      : 'This employee does not have an account yet.'
                  }}
                </p>
              </div>
              <span
                class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                :class="
                  hasAccount ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                "
              >
                {{ hasAccount ? 'Account available' : 'No account' }}
              </span>
            </div>

            <div v-if="hasAccount" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field>
                <FieldLabel for="account-username">Username</FieldLabel>
                <Input
                  id="account-username"
                  :model-value="selectedAccount?.username ?? '—'"
                  disabled
                  readonly
                />
              </Field>

              <Field>
                <FieldLabel for="account-status">Status</FieldLabel>
                <Input
                  id="account-status"
                  :model-value="selectedAccount?.isActive ? 'Active' : 'Inactive'"
                  disabled
                  readonly
                />
              </Field>

              <Field>
                <FieldLabel for="account-created">Created At</FieldLabel>
                <Input
                  id="account-created"
                  :model-value="formatDateTimeDisplay(selectedAccount?.createdAt)"
                  disabled
                  readonly
                />
              </Field>

              <Field>
                <FieldLabel for="account-updated">Last Updated</FieldLabel>
                <Input
                  id="account-updated"
                  :model-value="formatDateTimeDisplay(selectedAccount?.updatedAt)"
                  disabled
                  readonly
                />
              </Field>
            </div>

            <div v-else class="grid gap-2 md:grid-cols-2 md:items-end">
              <Field class="md:col-span-2">
                <FieldLabel for="new-username">Username</FieldLabel>
                <Input
                  id="new-username"
                  v-model="newUsername"
                  :disabled="employeesLoading || accountActionLoading"
                  placeholder="Enter username"
                />
                <p class="mt-1 text-xs text-muted-foreground">
                  Usernames must be 6-20 characters and may include letters, numbers, hyphen, and
                  underscore.
                </p>
              </Field>
            </div>

            <div
              v-if="accountErrors.length"
              class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <ul class="list-disc space-y-1 pl-4">
                <li v-for="message in accountErrors" :key="message">{{ message }}</li>
              </ul>
            </div>

            <div class="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                class="flex items-center"
                :disabled="isResetDisabled"
                @click="handleResetPassword"
              >
                <Loader2
                  v-if="accountActionLoading && currentAccountAction === 'reset'"
                  class="mr-2 h-4 w-4 animate-spin"
                />
                <KeyIcon v-else class="mr-2 h-4 w-4" />
                Reset Password
              </Button>
              <Button
                type="button"
                class="flex items-center"
                :disabled="isCreateDisabled"
                @click="handleCreateAccount"
              >
                <Loader2
                  v-if="accountActionLoading && currentAccountAction === 'create'"
                  class="mr-2 h-4 w-4 animate-spin"
                />
                <PlusIcon v-else class="mr-2 h-4 w-4" />
                Create Account
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
                :disabled="employeesLoading || departmentsLoading"
                :loading="departmentsLoading"
              />
            </Field>

            <Field>
              <FieldLabel for="filter-role">Role</FieldLabel>
              <ComboBox
                id="filter-role"
                v-model="filters.roleId"
                :options="roleOptions"
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
                  <TableHead class="min-w-32">Account Username</TableHead>
                  <TableHead class="w-28">Account Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <template v-if="employeesLoading">
                  <TableEmpty :colspan="6">Loading employees…</TableEmpty>
                </template>
                <template v-else-if="employees.length === 0">
                  <TableEmpty :colspan="6">No employees match the current filters.</TableEmpty>
                </template>
                <template v-else>
                  <TableRow
                    v-for="employee in employees"
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
                    <TableCell>{{ employee.account?.username ?? '—' }}</TableCell>
                    <TableCell>
                      <span
                        class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                        :class="
                          employee.account?.isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        "
                      >
                        {{
                          employee.account
                            ? employee.account.isActive
                              ? 'Active'
                              : 'Inactive'
                            : 'N/A'
                        }}
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
