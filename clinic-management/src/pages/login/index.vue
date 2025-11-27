<script setup lang="ts">
import { toast } from 'vue-sonner'
import { ApiError } from '@/services/http'
import type { LoginPayload } from '@/services/auth'
import { useAuthStore } from '@/stores/auth'
import LoginForm from '@/components/LoginForm.vue'

definePage({
  alias: '/login/',
  meta: {
    requiresAuth: false,
    hideNavbar: true,
  },
})

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const { loading } = storeToRefs(authStore)

const form = reactive<LoginPayload>({
  tenDangNhap: '',
  matKhau: '',
})

const fieldErrors = reactive<Record<keyof LoginPayload, string | null>>({
  tenDangNhap: null,
  matKhau: null,
})

const generalError = ref<string | null>(null)

const fieldDomIdMap: Record<keyof LoginPayload, string> = {
  tenDangNhap: 'username',
  matKhau: 'password',
}

const focusField = (fieldId: string) => {
  if (typeof window === 'undefined') {
    return
  }

  requestAnimationFrame(() => {
    const element = document.getElementById(fieldId)
    if (!element || !(element instanceof HTMLElement)) {
      return
    }

    if ('disabled' in element && element.disabled) {
      return
    }

    element.focus()
    if (typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  })
}

const focusFirstInvalidField = () => {
  const invalidEntry = (Object.keys(fieldErrors) as Array<keyof LoginPayload>).find((field) =>
    Boolean(fieldErrors[field]),
  )

  if (!invalidEntry) {
    return
  }

  focusField(fieldDomIdMap[invalidEntry])
}

const redirectTarget = computed(() => {
  const target = route.query.redirect
  return typeof target === 'string' && target.length > 0 ? target : '/room-configuration/'
})

const updateForm = (field: keyof LoginPayload, value: string) => {
  form[field] = value
  generalError.value = null
}

const validate = (): boolean => {
  fieldErrors.tenDangNhap = form.tenDangNhap.trim() ? null : 'Please enter your username'
  fieldErrors.matKhau = form.matKhau ? null : 'Please enter your password'

  return !fieldErrors.tenDangNhap && !fieldErrors.matKhau
}

const clearFieldError = (field: keyof LoginPayload) => {
  fieldErrors[field] = null
  generalError.value = null
}

const handleSubmit = async () => {
  if (!validate()) {
    generalError.value = 'Please correct the highlighted fields before continuing.'
    focusFirstInvalidField()
    return
  }

  try {
    generalError.value = null
    await authStore.login({
      tenDangNhap: form.tenDangNhap.trim(),
      matKhau: form.matKhau,
    })

    toast.success('Signed in successfully')
    await router.replace(redirectTarget.value)
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Sign in failed, please try again.'

    generalError.value = message
  }
}
</script>

<template>
  <div
    class="relative bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10 overflow-hidden"
  >
    <div
      class="absolute inset-0 bg-[url('@/assets/images/bg_login.jpg')] bg-cover bg-center blur-sm scale-105"
    ></div>

    <div class="absolute inset-0 bg-black/30"></div>

    <div class="relative z-10 w-full max-w-md md:max-w-5xl">
      <LoginForm
        :form="form"
        :field-errors="fieldErrors"
        :general-error="generalError"
        :loading="loading"
        @update:form="updateForm"
        @clearFieldError="clearFieldError"
        @submit="handleSubmit"
      />
    </div>
  </div>
</template>
