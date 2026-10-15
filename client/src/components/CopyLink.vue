<script setup>
import { ref, onBeforeUnmount } from 'vue';
const props = defineProps({ url: { type: String, required: true } });
const state = ref('');
let timer;
async function copy() {
  if (state.value === 'pending') return;
  clearTimeout(timer);
  state.value = 'pending';
  try { await navigator.clipboard.writeText(props.url); state.value = 'success'; }
  catch { state.value = 'error'; }
  timer = setTimeout(() => { state.value = ''; }, 5000);
}
onBeforeUnmount(() => clearTimeout(timer));
</script>
<template>
  <div class="copy-control">
    <button type="button" :class="{ copied: state === 'success' }" :disabled="state === 'pending'" :aria-label="`คัดลอกลิงก์ ${url}`" @click="copy"><svg v-if="state === 'success'" class="icon check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>{{ state === 'success' ? 'คัดลอกแล้ว' : state === 'pending' ? 'กำลังคัดลอก…' : 'คัดลอกลิงก์' }}</button>
    <span class="sr-only" role="status">{{ state === 'success' ? 'คัดลอกลิงก์แล้ว' : '' }}</span>
    <small v-if="state === 'error'" class="error" role="alert">คัดลอกไม่ได้ กรุณาเลือกลิงก์แล้วคัดลอกด้วยตนเอง</small>
  </div>
</template>
