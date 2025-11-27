<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { AlertCircle } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ApiError } from '@/services/http'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'

definePage({
  alias: '/change-password/',
  meta: {
    requiresAuth: true,
  },
})

type FieldKey = 'currentPassword' | 'newPassword' | 'confirmPassword'

const authStore = useAuthStore()
const workspaceStore = useWorkspaceStore()
const router = useRouter()
const { loading } = storeToRefs(authStore)

const form = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const fieldErrors = reactive<Record<FieldKey, string | null>>({
  currentPassword: null,
  newPassword: null,
  confirmPassword: null,
})

const generalError = ref<string | null>(null)

const fieldErrorMessages = computed(() =>
  Object.values(fieldErrors).filter((message): message is string => Boolean(message)),
)

const passwordRules = [
  {
    message: 'At least 8 characters long',
    validate: (value: string) => value.length >= 8,
  },
  {
    message: 'Contains at least one uppercase letter',
    validate: (value: string) => /[A-Z]/.test(value),
  },
  {
    message: 'Contains at least one lowercase letter',
    validate: (value: string) => /[a-z]/.test(value),
  },
  {
    message: 'Contains at least one number',
    validate: (value: string) => /[0-9]/.test(value),
  },
  {
    message: 'Contains at least one special character (@$!%*?&)',
    validate: (value: string) => /[@$!%*?&]/.test(value),
  },
]

const validatePassword = (value: string): string | null => {
  for (const rule of passwordRules) {
    if (!rule.validate(value)) {
      return rule.message
    }
  }
  return null
}

const clearFieldError = (field: FieldKey) => {
  fieldErrors[field] = null
  generalError.value = null
}

const updateField = (field: FieldKey, value: string | number) => {
  form[field] = typeof value === 'string' ? value : String(value)
  clearFieldError(field)
}

const validateForm = (): boolean => {
  fieldErrors.currentPassword = form.currentPassword
    ? validatePassword(form.currentPassword)
    : 'Current password is required'
  fieldErrors.newPassword = form.newPassword
    ? validatePassword(form.newPassword)
    : 'New password is required'
  fieldErrors.confirmPassword = form.confirmPassword
    ? validatePassword(form.confirmPassword)
    : 'Please confirm your password'

  if (!fieldErrors.newPassword && form.newPassword === form.currentPassword) {
    fieldErrors.newPassword = 'New password must differ from the current password'
  }

  if (!fieldErrors.confirmPassword && form.confirmPassword !== form.newPassword) {
    fieldErrors.confirmPassword = 'Passwords do not match'
  }

  return !fieldErrors.currentPassword && !fieldErrors.newPassword && !fieldErrors.confirmPassword
}

const resetForm = () => {
  form.currentPassword = ''
  form.newPassword = ''
  form.confirmPassword = ''

  fieldErrors.currentPassword = null
  fieldErrors.newPassword = null
  fieldErrors.confirmPassword = null
  generalError.value = null
}

const isSubmitting = computed(() => loading.value)

const handleSubmit = async () => {
  if (!validateForm()) {
    generalError.value = 'Please review the highlighted inputs before continuing.'
    return
  }

  try {
    generalError.value = null
    await authStore.changePassword({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
      confirmPassword: form.confirmPassword,
    })

    workspaceStore.clear()
    resetForm()

    toast.success('Password updated successfully. Please sign in again.')
    await router.replace({ path: '/login/' })
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : 'Unable to update password, please try again.'
    generalError.value = message
  }
}
</script>

<template>
  <section
    class="flex min-h-full w-full items-center justify-center bg-primary-foreground px-4 py-10"
  >
    <div class="w-full max-w-xl">
      <Card class="w-full">
        <CardHeader class="text-center">
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form class="grid gap-6" @submit.prevent="handleSubmit">
            <FieldGroup class="gap-6">
              <Alert
                v-if="generalError || fieldErrorMessages.length"
                variant="destructive"
                class="w-full"
              >
                <AlertCircle class="h-5 w-5" aria-hidden="true" />
                <AlertTitle>Unable to update password</AlertTitle>
                <AlertDescription class="space-y-2">
                  <p v-if="generalError">{{ generalError }}</p>
                  <ul v-if="fieldErrorMessages.length" class="list-disc space-y-1 pl-5">
                    <li v-for="message in fieldErrorMessages" :key="message">
                      {{ message }}
                    </li>
                  </ul>
                </AlertDescription>
              </Alert>

              <Field :data-invalid="Boolean(fieldErrors.currentPassword)">
                <FieldLabel for="currentPassword">Current Password</FieldLabel>
                <Input
                  id="currentPassword"
                  type="password"
                  autocomplete="current-password"
                  placeholder="Enter current password"
                  :model-value="form.currentPassword"
                  :disabled="isSubmitting"
                  @update:modelValue="updateField('currentPassword', $event)"
                />
              </Field>

              <Field :data-invalid="Boolean(fieldErrors.newPassword)">
                <FieldLabel for="newPassword">New Password</FieldLabel>
                <Input
                  id="newPassword"
                  type="password"
                  autocomplete="new-password"
                  placeholder="Enter new password"
                  :model-value="form.newPassword"
                  :disabled="isSubmitting"
                  @update:modelValue="updateField('newPassword', $event)"
                />
                <FieldDescription>
                  Password must meet all of the following requirements:
                  <ul class="mt-2 list-disc pl-5 text-left text-xs text-muted-foreground">
                    <li v-for="rule in passwordRules" :key="rule.message">{{ rule.message }}</li>
                  </ul>
                </FieldDescription>
              </Field>

              <Field :data-invalid="Boolean(fieldErrors.confirmPassword)">
                <FieldLabel for="confirmPassword">Confirm New Password</FieldLabel>
                <Input
                  id="confirmPassword"
                  type="password"
                  autocomplete="new-password"
                  placeholder="Re-enter new password"
                  :model-value="form.confirmPassword"
                  :disabled="isSubmitting"
                  @update:modelValue="updateField('confirmPassword', $event)"
                />
              </Field>
            </FieldGroup>

            <CardFooter class="flex flex-col gap-3 p-0">
              <Button type="submit" class="w-full" :disabled="isSubmitting">
                <span
                  v-if="isSubmitting"
                  aria-hidden="true"
                  class="mr-2 inline-flex h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
                <span>{{ isSubmitting ? 'Updating password...' : 'Update password' }}</span>
              </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>
    </div>
  </section>
</template>
