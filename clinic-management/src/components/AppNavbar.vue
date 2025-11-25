<script setup lang="ts">
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu'

const systemMenu: { name: string; path: string }[] = [
  { name: 'Room Configuration', path: '/room-configuration' },
  { name: 'Change Password', path: '/' },
  { name: 'SignOut', path: '/' },
]
const receptionMenu: { name: string; path: string }[] = [
  { name: 'Patient Registration', path: '/' },
  { name: 'Follow-up Appointment', path: '/' },
  { name: 'Administrative Info', path: '/' },
]
const medicalExaminationMenu: { name: string; path: string }[] = [
  { name: 'Medical Examination', path: '/' },
  { name: 'Off-schedule Examination', path: '/' },
]
const diagnosticsMenu: { name: string; path: string }[] = [
  { name: 'Laboratory', path: '/' },
  { name: 'Ultrasound', path: '/' },
  { name: 'Endoscopy', path: '/' },
  { name: 'ECG', path: '/' },
  { name: 'X-Ray', path: '/' },
  { name: 'Surgery & Procedures', path: '/' },
]
</script>
<template>
  <nav>
    <div class="mx-auto flex max-w-6xl items-center gap-6 px-4 py-4">
      <div class="title flex items-center gap-3 text-primary-foreground">
        <img
          src="@/assets/images/CTU_logo.png"
          alt="Clinic logo"
          class="h-10 w-10 rounded-md bg-white p-1 object-contain"
        />
        <div class="hidden sm:block leading-tight">
          <div class="text-sm font-semibold">CTU Clinic</div>
          <div class="text-xs text-primary-foreground/80">Clinic Management</div>
        </div>
      </div>

      <NavigationMenu class="max-w-none!" :viewport="false">
        <NavigationMenuList class="gap-6">
          <NavigationMenuItem>
            <NavigationMenuTrigger>System</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul class="grid w-[200px] gap-2">
                <li v-for="item in systemMenu" :key="item.name">
                  <NavigationMenuLink as-child>
                    <router-link
                      :to="item.path"
                      class="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                    >
                      {{ item.name }}
                    </router-link>
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
                      class="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
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
                      class="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
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
                      class="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                    >
                      {{ item.name }}
                    </router-link>
                  </NavigationMenuLink>
                </li>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>

          <NavigationMenuItem class="bg-white rounded-md">
            <NavigationMenuLink as-child class="px-4">
              <router-link to="/" class="font-medium">Billing</router-link>
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  </nav>
</template>
