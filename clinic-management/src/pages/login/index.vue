<script setup lang="ts">
import { toast } from 'vue-sonner'
import { ApiError } from '@/services/http'
import type { LoginPayload } from '@/services/auth'
import { useAuthStore } from '@/stores/auth'
import LoginForm from '@/components/LoginForm.vue'

definePage({
  name: '/login/',
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

const redirectTarget = computed(() => {
  const target = route.query.redirect
  return typeof target === 'string' && target.length > 0 ? target : '/'
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
    toast.error(message)
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

    <div class="relative z-10 w-full max-w-sm md:max-w-4xl">
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
