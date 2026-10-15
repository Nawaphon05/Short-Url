<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import AuthForm from './components/AuthForm.vue';
import { api } from './api';
import LinkHistory from './components/LinkHistory.vue';
import LinkQr from './components/LinkQr.vue';
import CopyLink from './components/CopyLink.vue';
const url = ref('');
const shortUrl = ref('');
const error = ref('');
const loading = ref(false);
const historyRef = ref(null);
const user = ref(null);
const checking = ref(true);
const sessionError = ref('');
const loggingOut = ref(false);
async function checkSession() {
  checking.value = true; sessionError.value = '';
  try {
    const response = await api('/api/auth/me');
    if (response.status === 401) user.value = null;
    else if (!response.ok) throw new Error();
    else user.value = (await response.json()).user;
  } catch (err) { sessionError.value = err.serviceUnavailable ? err.message : 'ตรวจสอบบัญชีไม่ได้ กรุณาลองอีกครั้ง'; }
  finally { checking.value = false; }
}
function expired() { user.value = null; shortUrl.value = ''; url.value = ''; error.value = ''; sessionError.value = 'Session หมดอายุ กรุณา Login อีกครั้ง'; }
async function logout() {
  if (loggingOut.value || loading.value) return;
  loggingOut.value = true; sessionError.value = '';
  try {
    const response = await api('/api/auth/logout', { method: 'POST', body: '{}' });
    if (!response.ok) throw new Error();
    user.value = null; shortUrl.value = ''; url.value = ''; error.value = '';
  } catch { sessionError.value = 'Logout ไม่สำเร็จ กรุณาลองอีกครั้ง'; }
  finally { loggingOut.value = false; }
}
function authenticated(value) { user.value = value; sessionError.value = ''; }
onMounted(() => { window.addEventListener('session-expired', expired); checkSession(); });
onBeforeUnmount(() => window.removeEventListener('session-expired', expired));
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
    const response = await api('/api/links', { method: 'POST', body: JSON.stringify({ url: value }) });
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
  <a class="skip-link" :href="user ? '#url' : '#auth-email'">{{ user ? 'ข้ามไปช่องวาง URL' : 'ข้ามไปฟอร์ม Login' }}</a>
  <header class="site-header"><div class="header-inner"><a class="brand" href="./">Short URL</a><div v-if="user" class="account-menu"><span class="account-email">{{ user.email }}</span><button type="button" :disabled="loggingOut || loading" @click="logout">{{ loggingOut ? 'กำลังออก…' : 'Logout' }}</button></div></div></header>
  <main class="container" :class="{ 'workspace': user }">
    <p v-if="checking" class="empty-state" role="status">กำลังตรวจสอบบัญชี…</p>
    <div v-if="sessionError" class="session-error" role="alert">{{ sessionError }} <button v-if="!user" @click="checkSession">ลองอีกครั้ง</button></div>
    <AuthForm v-if="!checking && !user" @authenticated="authenticated" />
    <template v-if="!checking && user">
    <section class="link-composer" aria-labelledby="create-title">
      <div class="composer-heading"><svg class="composer-symbol" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="m20 16 6-6a9 9 0 0 1 13 13l-7 7a9 9 0 0 1-13 0M28 32l-6 6a9 9 0 0 1-13-13l7-7a9 9 0 0 1 13 0m-12 13 14-14"/></svg><div><h1 id="create-title">ย่อให้สั้น <br>แชร์ได้ทุกที่</h1><p class="intro">สร้างลิงก์และ QR Code <br>พร้อมดูจำนวนคลิกในบัญชีของคุณ</p></div><p class="composer-caption">Short URL<span aria-hidden="true"> / </span>ลิงก์ของคุณ</p></div>
      <div class="composer-body"><h2 class="composer-form-title">สร้างลิงก์ใหม่</h2>
      <form @submit.prevent="createShortUrl" :aria-busy="loading">
        <label for="url">วาง URL ต้นฉบับ</label>
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
    </Transition></div></section>
    <LinkHistory :key="user.id" ref="historyRef" />
    </template>
    <footer>Short URL <span>ย่อลิงก์ · แชร์ลิงก์ · ดูจำนวนคลิก</span></footer>
  </main>
</template>
