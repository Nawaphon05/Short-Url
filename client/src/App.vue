<script setup>
import { ref } from 'vue';
import LinkHistory from './components/LinkHistory.vue';
import LinkQr from './components/LinkQr.vue';
import CopyLink from './components/CopyLink.vue';
const url = ref('');
const shortUrl = ref('');
const error = ref('');
const loading = ref(false);
const historyRef = ref(null);
async function createShortUrl() {
  if (loading.value) return;
  error.value = '';
  const value = url.value.trim();
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
  } catch {
    error.value = 'กรุณาใส่ URL ที่ขึ้นต้นด้วย https:// หรือ http:// และไม่มีชื่อผู้ใช้หรือรหัสผ่านในลิงก์';
    return;
  }
  loading.value = true;
  try {
    const response = await fetch('/api/links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: value }) });
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (!data.short_url) throw new Error();
    shortUrl.value = data.short_url;
    url.value = '';
    await historyRef.value?.refresh();
  } catch {
    error.value = 'สร้างลิงก์ไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง';
  } finally { loading.value = false; }
}
</script>
<template>
  <a class="skip-link" href="#url">ข้ามไปช่องวาง URL</a>
  <header class="site-header"><div class="header-inner"><a class="brand" href="./">Short URL</a></div></header>
  <main class="container">
    <section aria-labelledby="create-title">
      <h1 id="create-title">ย่อลิงก์ให้แชร์ง่าย</h1>
      <p class="intro">วางลิงก์ที่ต้องการย่อ แล้วกดสร้างลิงก์สั้น</p>
      <form @submit.prevent="createShortUrl" :aria-busy="loading">
        <label for="url">URL ที่ต้องการย่อ</label>
        <div class="form-row"><input id="url" v-model="url" type="url" inputmode="url" placeholder="https://example.com/your-long-link" maxlength="4096" :readonly="loading" :aria-invalid="!!error" :aria-describedby="error ? 'url-help create-error' : 'url-help'" required autocomplete="url" /><button class="primary" type="submit" :disabled="loading"><span v-if="loading" class="spinner" aria-hidden="true"></span>{{ loading ? 'กำลังสร้าง…' : 'สร้างลิงก์สั้น' }}</button></div>
        <p id="url-help" class="help">รองรับลิงก์ที่ขึ้นต้นด้วย https:// หรือ http://</p>
        <p v-if="loading" class="sr-only" role="status">กำลังสร้างลิงก์สั้น</p>
        <p v-if="error" id="create-error" class="error" role="alert">{{ error }}</p>
      </form>
      <Transition name="result"><section v-if="shortUrl" :key="shortUrl" class="result" aria-labelledby="result-title">
        <h2 id="result-title" role="status">สร้างลิงก์สำเร็จ พร้อมแชร์แล้ว</h2>
        <div class="result-row"><a class="short-link" :href="shortUrl" target="_blank" rel="noopener noreferrer">{{ shortUrl }}<span class="sr-only"> (เปิดแท็บใหม่)</span></a><CopyLink :key="shortUrl" :url="shortUrl" /></div>
        <LinkQr :key="shortUrl" :url="shortUrl" />
      </section>
    </Transition></section>
    <LinkHistory ref="historyRef" />
    <footer>Short URL <span>ย่อลิงก์ · แชร์ลิงก์ · ดูจำนวนคลิก</span></footer>
  </main>
</template>
