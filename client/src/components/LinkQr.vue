<script setup>
import { ref, watch, useId } from 'vue';
import QRCode from 'qrcode';
const props = defineProps({ url: { type: String, required: true } });
const open = ref(false);
const panelId = useId();
const qrImage = ref('');
const error = ref('');
watch([() => props.url, open], async ([url, visible], _previous, onCleanup) => {
  let active = true;
  onCleanup(() => { active = false; });
  if (!visible) return;
  qrImage.value = '';
  error.value = '';
  if (!url || !visible) return;
  try {
    const image = await QRCode.toDataURL(url, { width: 240, margin: 4, errorCorrectionLevel: 'M' });
    if (active) qrImage.value = image;
  } catch { if (active) error.value = 'สร้าง QR Code ไม่สำเร็จ กรุณาปิดแล้วเปิดอีกครั้ง'; }
});
</script>
<template>
  <div class="qr">
    <button type="button" class="qr-toggle" :aria-expanded="open" :aria-controls="panelId" @click="open = !open"><svg class="icon qr-chevron" :class="{ rotated: open }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>{{ open ? 'ปิด QR Code' : 'ดู QR Code' }}</button>
    <div :id="panelId" class="qr-reveal" :class="{ expanded: open }" :inert="!open"><div class="qr-clip"><div class="qr-content">
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-else-if="!qrImage" role="status">กำลังสร้าง QR Code…</p>
      <template v-else><img :src="qrImage" :alt="`QR Code สำหรับ ${url}`" width="240" height="240" /><a :href="qrImage" download="short-url-qr.png">ดาวน์โหลด QR Code (.png)</a></template>
    </div></div></div>
  </div>
</template>
