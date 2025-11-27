<script setup lang="ts">
import logoCtu from '@/assets/images/CTU_logo.png'
</script>

<template>
  <section>
    <div class="w-full bg-primary-foreground h-full flex justify-center items-center">
      <main class="grow">
        <section class="relative overflow-hidden bg-white text-primary">
          <div class="absolute -right-20 top-12 h-48 w-48 rounded-full bg-primary/5 blur-2xl" />
          <div class="absolute -left-24 bottom-12 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />

          <div
            class="relative z-10 mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 py-20 text-center"
          >
            <div class="h-24 w-24 rounded-full border border-primary/10 bg-white shadow-sm">
              <img :src="logoCtu" alt="CTU Logo" class="h-full w-full object-contain p-4" />
            </div>

            <h1 class="text-3xl font-bold text-primary sm:text-4xl">Welcome to CTU Clinic</h1>
            <p class="max-w-2xl text-base text-muted-foreground sm:text-lg">
              A multi-specialty clinic management platform operated by Can Tho University. It
              connects clinical teams, streamlines every visit, and delivers a modern healthcare
              experience for patients and staff alike.
            </p>
          </div>
        </section>
      </main>
    </div>
  </section>
</template>

<style scoped>
/* Simple fade-in animation */
.animate-fade-in-up {
  animation: fadeInUp 0.8s ease-out forwards;
  opacity: 0;
  transform: translateY(20px);
}

.delay-100 {
  animation-delay: 0.1s;
}
.delay-200 {
  animation-delay: 0.2s;
}
.delay-300 {
  animation-delay: 0.3s;
}

@keyframes fadeInUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
