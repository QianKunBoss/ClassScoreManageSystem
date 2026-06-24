<template>
  <div class="min-h-screen flex flex-col bg-[#0a0a1a]">
    <StudentNavbar />
    <AppAnnouncementBar :top-offset="56" />
    <main class="flex-1">
      <slot />
    </main>
    <AppFooter />
    <UiToast />
  </div>
</template>
