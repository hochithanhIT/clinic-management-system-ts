<script setup lang="ts">
import { toast } from 'vue-sonner'
import logoUrl from '@/assets/images/CTU_logo.png'

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu'
import { ApiError } from '@/services/http'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'

type MenuRouteItem = {
  name: string
  path: string
}

type MenuActionItem = {
  name: string
  action: () => Promise<void> | void
}

type MenuItem = MenuRouteItem | MenuActionItem

const authStore = useAuthStore()
const workspaceStore = useWorkspaceStore()
const router = useRouter()
const signingOut = ref(false)

const handleSignOut = async () => {
  if (signingOut.value) {
    return
  }

  signingOut.value = true

  try {
    await authStore.logout()
    toast.success('Signed out successfully.')
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Sign out failed, please try again.'
    toast.error(message)
  } finally {
    workspaceStore.clear()
    signingOut.value = false
    await router.replace({ path: '/login/' })
  }
}

const isActionItem = (item: MenuItem): item is MenuActionItem => 'action' in item

const handleMenuItemClick = async (item: MenuItem) => {
  if (!isActionItem(item) || signingOut.value) {
    return
  }

  await item.action()
}

const systemMenu: MenuItem[] = [
  { name: 'Room Configuration', path: '/room-configuration/' },
  { name: 'Change Password', path: '/change-password/' },
  { name: 'Sign Out', action: handleSignOut },
]
const receptionMenu: MenuRouteItem[] = [
  { name: 'Patient Registration', path: '/patient-intake/' },
  { name: 'Follow-up Appointment', path: '/' },
  { name: 'Administrative Info', path: '/administrative-info/' },
]
const medicalExaminationMenu: MenuRouteItem[] = [
  { name: 'Medical Examination', path: '/medical-examination/' },
]
const diagnosticsMenu: MenuRouteItem[] = [
  { name: 'Laboratory', path: '/laboratory/' },
  { name: 'Diagnostic Imaging', path: '/diagnostic-imaging/' },
]

const catalogMenu: MenuRouteItem[] = [
  { name: 'Accounts', path: '/catalog/account/' },
  { name: 'Employee', path: '/catalog/employee/' },
  { name: 'Departments & Rooms', path: '/' },
  { name: 'Services', path: '/' },
  { name: 'Diseases', path: '/' },
  { name: 'Addresses', path: '/' },
]
</script>
<template>
  <nav>
    <div class="mx-auto flex max-w-6xl items-center gap-6 px-4 py-4">
      <router-link to="/" class="flex shrink-0 items-center gap-3 text-primary-foreground">
        <img
          :src="logoUrl"
          alt="Clinic logo"
          class="h-10 w-10 rounded-md bg-white p-1 object-contain"
        />
        <div class="hidden sm:block leading-tight text-primary-foreground">
          <div class="text-sm font-semibold">CTU Clinic</div>
          <div class="text-xs text-primary-foreground/80">Clinic Management</div>
        </div>
      </router-link>

      <NavigationMenu class="max-w-none!" :viewport="false">
        <NavigationMenuList class="gap-6">
          <NavigationMenuItem>
            <NavigationMenuTrigger>System</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul class="grid w-[200px] gap-2">
                <li v-for="item in systemMenu" :key="item.name">
                  <NavigationMenuLink v-if="!isActionItem(item)" as-child>
                    <router-link
                      :to="item.path"
                      class="block rounded-md px-3 py-2 text-sm font-medium hover:bg-primary/10"
                    >
                      {{ item.name }}
                    </router-link>
                  </NavigationMenuLink>
                  <NavigationMenuLink v-else as-child>
                    <button
                      type="button"
                      class="block w-full rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-primary/10 disabled:opacity-60 cursor-pointer"
                      :disabled="signingOut"
                      @click.prevent="handleMenuItemClick(item)"
                    >
                      {{ item.name }}
                    </button>
                  </NavigationMenuLink>
                </li>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>

          <NavigationMenuItem>
            <NavigationMenuTrigger>Reception</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul class="grid w-[200px] gap-2">
                <li v-for="item in receptionMenu" :key="item.name">
                  <NavigationMenuLink as-child>
                    <router-link
                      :to="item.path"
                      class="block rounded-md px-3 py-2 text-sm font-medium hover:bg-primary/10"
                    >
                      {{ item.name }}
                    </router-link>
                  </NavigationMenuLink>
                </li>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>

          <NavigationMenuItem>
            <NavigationMenuTrigger>Medical Examination</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul class="grid w-[200px] gap-2">
                <li v-for="item in medicalExaminationMenu" :key="item.name">
                  <NavigationMenuLink as-child>
                    <router-link
                      :to="item.path"
                      class="block rounded-md px-3 py-2 text-sm font-medium hover:bg-primary/10"
                    >
                      {{ item.name }}
                    </router-link>
                  </NavigationMenuLink>
                </li>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>

          <NavigationMenuItem>
            <NavigationMenuTrigger>Diagnostics</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul class="grid w-[200px] gap-2">
                <li v-for="item in diagnosticsMenu" :key="item.name">
                  <NavigationMenuLink as-child>
                    <router-link
                      :to="item.path"
                      class="block rounded-md px-3 py-2 text-sm font-medium hover:bg-primary/10"
                    >
                      {{ item.name }}
                    </router-link>
                  </NavigationMenuLink>
                </li>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>

          <NavigationMenuItem>
            <NavigationMenuTrigger>Catalogs</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul class="grid w-[220px] gap-2">
                <li v-for="item in catalogMenu" :key="item.name">
                  <NavigationMenuLink as-child>
                    <router-link
                      :to="item.path"
                      class="block rounded-md px-3 py-2 text-sm font-medium hover:bg-primary/10"
                    >
                      {{ item.name }}
                    </router-link>
                  </NavigationMenuLink>
                </li>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>

          <NavigationMenuItem class="bg-white rounded-md">
            <NavigationMenuLink
              as-child
              class="px-4 hover:rounded-md hover:text-primary-foreground"
            >
              <router-link to="/billing" class="font-medium">Billing</router-link>
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  </nav>
</template>
