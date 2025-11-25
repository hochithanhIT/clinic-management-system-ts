<script setup lang="ts">
definePage({
  alias: '/room-configuration/',
  meta: {
    requiresAuth: true,
  },
})

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import RoomConfigurationComboBox from '@/components/RoomConfigurationComboBox.vue'
</script>

<template>
  <div>
    <div class="h-full max-w-6xl mx-auto flex items-center justify-center bg-primary-foreground">
      <Card class="w-full max-w-sm">
        <CardHeader class="text-center">
          <CardTitle>Room Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <form>
            <div class="grid w-full items-center gap-4">
              <div class="flex flex-col space-y-1.5">
                <Label for="department">Department</Label>
                <RoomConfigurationComboBox />
              </div>
              <div class="flex flex-col space-y-1.5">
                <div class="flex items-center">
                  <Label for="room">Room</Label>
                </div>
                <RoomConfigurationComboBox />
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter class="flex flex-col gap-2">
          <Button class="w-full"> OK </Button>
        </CardFooter>
      </Card>
    </div>
  </div>
</template>
