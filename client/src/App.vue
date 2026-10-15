<script setup>
import { ref } from 'vue';
import LinkHistory from './components/LinkHistory.vue';
import LinkQr from './components/LinkQr.vue';
const url = ref('');
const shortUrl = ref('');
const error = ref('');
const loading = ref(false);
const historyRef = ref(null);

async function createShortUrl() {
  loading.value = true;
  error.value = '';
  shortUrl.value = '';

  try {
    const response = await fetch('/api/links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url.value,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'สร้างลิงก์ไม่สำเร็จ');
    }

    shortUrl.value = data.short_url;
    url.value = '';

    await historyRef.value?.refresh();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="container">
    <h1>Short URL</h1>
    <p>เปลี่ยนลิงก์ยาวให้แชร์ง่ายขึ้น</p>

    <form @submit.prevent="createShortUrl">
      <label for="url">URL ที่ต้องการย่อ</label>

      <input
        id="url"
        v-model="url"
        type="url"
        placeholder="https://example.com"
        maxlength="4096"
        :disabled="loading"
        required
      />

      <button type="submit" :disabled="loading">
        {{ loading ? 'กำลังสร้าง…' : 'สร้างลิงก์สั้น' }}
      </button>
    </form>

    <p v-if="error" class="error" role="alert">
      {{ error }}
    </p>

    <section v-if="shortUrl" class="result">
      <h2>ลิงก์ของคุณพร้อมแล้ว</h2>

      <a
        :href="shortUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ shortUrl }}
      </a>
      <LinkQr :url="shortUrl" />
    </section>

    <LinkHistory ref="historyRef" />
  </main>
</template>