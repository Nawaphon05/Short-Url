<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import LinkVisual from './components/LinkVisual.vue';
import AuthForm from './components/AuthForm.vue';
import { api } from './api';
import LinkHistory from './components/LinkHistory.vue';
import LinkQr from './components/LinkQr.vue';
import CopyLink from './components/CopyLink.vue';
const url = ref('');
const title = ref('');
const customCode = ref('');
const expiresAt = ref('');
const expiryEnabled = ref(false);
const accountNotice = ref('');
function resetDraft() { title.value = ''; customCode.value = ''; expiresAt.value = ''; expiryEnabled.value = false; }
function focusSurface() { nextTick(() => document.getElementById(user.value ? 'create-title' : 'auth-title')?.focus()); }

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
function expired() { user.value = null; shortUrl.value = ''; url.value = ''; error.value = ''; resetDraft(); sessionError.value = 'Session หมดอายุ กรุณา Login อีกครั้ง'; }
async function logout() {
  if (loggingOut.value || loading.value) return;
  loggingOut.value = true; sessionError.value = '';
  try {
    const response = await api('/api/auth/logout', { method: 'POST', body: '{}' });
    if (!response.ok) throw new Error();
    user.value = null; shortUrl.value = ''; url.value = ''; error.value = ''; resetDraft(); accountNotice.value = 'ออกจากระบบแล้ว';
  } catch { sessionError.value = 'Logout ไม่สำเร็จ กรุณาลองอีกครั้ง'; }
  finally { loggingOut.value = false; }
}
function authenticated(value) { user.value = value; sessionError.value = ''; accountNotice.value = 'เข้าสู่ระบบสำเร็จ'; }
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
  if (expiryEnabled.value && (!expiresAt.value || new Date(expiresAt.value).getTime() <= Date.now())) { error.value = 'เลือกวันและเวลาในอนาคตก่อนสร้างลิงก์'; return; }
  loading.value = true;
  try {
    const response = await api('/api/links', { method: 'POST', body: JSON.stringify({ url: value, title: title.value, custom_code: customCode.value, expires_at: expiryEnabled.value ? new Date(expiresAt.value).toISOString() : null }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'สร้างลิงก์ไม่สำเร็จ');
    if (!data.short_url) throw new Error();
    shortUrl.value = data.short_url;
    url.value = ''; resetDraft();
    await historyRef.value?.refresh();
  } catch (err) {
    error.value = err.message || 'สร้างลิงก์ไม่สำเร็จ กรุณาลองใหม่';
  } finally { loading.value = false; }
}
</script>
<template>
  <a class="skip-link" :href="user ? '#url' : '#auth-email'">{{ user ? 'ข้ามไปช่องวาง URL' : 'ข้ามไปฟอร์ม Login' }}</a>
  <header class="site-header"><div class="header-inner"><a class="brand" href="./"><svg class="brand-mark" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="m13 11 4-4a6 6 0 0 1 9 9l-5 5M19 21l-4 4a6 6 0 0 1-9-9l5-5m1 9 8-8"/></svg>Short URL</a><a v-if="user" class="header-nav" href="#history">ลิงก์ของฉัน<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg></a><div v-if="user" class="account-menu"><span class="account-email">{{ user.email }}</span><button type="button" :disabled="loggingOut || loading" @click="logout"><span v-if="loggingOut" class="spinner" aria-hidden="true"></span>{{ loggingOut ? 'กำลังออก…' : 'Logout' }}</button></div></div></header>
  <main class="container" :class="{ 'workspace': user }">
    <p v-if="checking" class="empty-state" role="status">กำลังตรวจสอบบัญชี…</p>
    <div v-if="sessionError" class="session-error" role="alert">{{ sessionError }} <button v-if="!user" @click="checkSession">ลองอีกครั้ง</button></div>
    <p class="account-notice" role="status">{{ accountNotice }}</p>
    <Transition name="account" mode="out-in" @after-enter="focusSurface">
    <AuthForm v-if="!checking && !user" key="auth" @authenticated="authenticated" />
    <div v-else-if="!checking && user" key="workspace" class="workspace-content">
    <section class="link-composer" aria-labelledby="create-title">
      <div class="composer-heading"><div><h1 id="create-title" tabindex="-1">ลิงก์ยาวแค่ไหน<br><span>ก็แชร์ง่าย.</span></h1><p class="intro">สร้างลิงก์ในแบบของคุณ จัดการทุกการแชร์<br>พร้อม QR Code และจำนวนคลิกในที่เดียว</p><a class="hero-jump" href="#history">ดูลิงก์ของฉัน <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></a></div><LinkVisual /></div>
      <div class="composer-body"><div class="form-title-row"><h2 class="composer-form-title">สร้างลิงก์ใหม่</h2><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 4v16M4 12h16"/></svg></div>
      <p class="composer-description">ตั้งชื่อให้หาเจอ แชร์ด้วยรหัสที่คุณเลือก</p>
      <form @submit.prevent="createShortUrl" :aria-busy="loading">
        <div class="draft-field"><label for="link-title">ชื่อลิงก์ <span class="optional">ไม่บังคับ</span></label><input id="link-title" v-model="title" maxlength="120" placeholder="เช่น สมัครงานบริษัท A" :readonly="loading" /></div>
        <label for="url">วาง URL ต้นฉบับ</label>
        <div class="form-row"><input id="url" v-model="url" type="url" inputmode="url" placeholder="https://example.com/your-long-link" maxlength="4096" :readonly="loading" :aria-invalid="!!error" :aria-describedby="error ? 'url-help create-error' : 'url-help'" required autocomplete="url" /></div>
        <p id="url-help" class="help">รองรับลิงก์ที่ขึ้นต้นด้วย https:// หรือ http://</p>
        <div class="draft-field"><label for="custom-code">รหัสลิงก์ของคุณ <span class="optional">ไม่กรอก ระบบสุ่มให้</span></label><div class="code-input"><span aria-hidden="true">/r/</span><input id="custom-code" v-model="customCode" maxlength="48" minlength="3" pattern="[A-Za-z0-9_-]{3,48}" placeholder="summer-sale" :readonly="loading" aria-describedby="code-help" autocapitalize="none" spellcheck="false" /></div><p id="code-help" class="help">3–48 ตัว ใช้ A–Z, a–z, 0–9, - และ _ ตัวพิมพ์เล็ก–ใหญ่ต่างกัน เปลี่ยนรหัสหลังสร้างไม่ได้</p></div>
        <div class="expiry-option"><label class="checkbox-label"><input v-model="expiryEnabled" type="checkbox" :disabled="loading" />กำหนดวันหมดอายุ</label><span v-if="!expiryEnabled" class="help">ใช้งานได้เรื่อย ๆ</span></div>
        <div v-if="expiryEnabled" class="draft-field expiry-field"><label for="expiry">วันและเวลาในเครื่องของคุณ</label><input id="expiry" v-model="expiresAt" type="datetime-local" :required="expiryEnabled" :readonly="loading" aria-describedby="expiry-help" /><p id="expiry-help" class="help">เมื่อหมดอายุ ลิงก์และ QR จะไม่ส่งต่อไปเว็บไซต์ต้นฉบับ</p></div>
        <button class="primary create-submit" type="submit" :disabled="loading"><span v-if="loading" class="spinner" aria-hidden="true"></span>{{ loading ? 'กำลังสร้าง…' : 'สร้างลิงก์สั้น' }}<svg v-if="!loading" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg></button>
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
    </div>
    </Transition>
    <footer>Short URL <span>ย่อลิงก์ · แชร์ลิงก์ · ดูจำนวนคลิก</span></footer>
  </main>
</template>
