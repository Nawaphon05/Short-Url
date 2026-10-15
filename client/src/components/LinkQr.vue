<script setup>
import { ref, watch } from 'vue';
import QRCode from 'qrcode';

const props = defineProps({
  url: {
    type: String,
    required: true,
  },
});

const qrImage = ref('');
const error = ref('');

watch(
  () => props.url,
  async (url, _previous, onCleanup) => {
    let active = true;
    onCleanup(() => {
      active = false;
    });

    qrImage.value = '';
    error.value = '';

    if (!url) return;

    try {
      const image = await QRCode.toDataURL(url, {
        width: 240,
        margin: 4,
        errorCorrectionLevel: 'M',
      });

      if (active) qrImage.value = image;
    } catch {
      if (active) error.value = 'สร้าง QR Code ไม่สำเร็จ';
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="qr">
    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <template v-if="qrImage">
      <img
        :src="qrImage"
        alt="QR Code สำหรับเปิดลิงก์สั้น"
        width="240"
        height="240"
      />

      <a :href="qrImage" download="short-url-qr.png">
        ดาวน์โหลด QR Code
      </a>
    </template>
  </div>
</template>

<style scoped>
.qr {
  margin-top: 16px;
}

img {
  display: block;
  max-width: 100%;
  height: auto;
}

a {
  display: inline-block;
  margin-top: 8px;
}
</style>