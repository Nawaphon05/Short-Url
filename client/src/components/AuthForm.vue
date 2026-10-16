<script setup>
import { ref, computed, nextTick } from 'vue';
import LinkVisual from './LinkVisual.vue';
import { api } from '../api';
const emit = defineEmits(['authenticated']);
const mode = ref('login');
function savedEmail() {
  try { return localStorage.getItem('short-url-email') || ''; } catch { return ''; }
}
const email = ref(savedEmail());
const password = ref('');
const confirm = ref('');
const visible = ref(false);
const remember = ref(!!email.value);
const busy = ref(false);
const error = ref('');
const success = ref('');
const emailInput = ref(null);
const signup = computed(() => mode.value === 'signup');
async function switchMode(target) {
  if (busy.value) return;
  const next = typeof target === 'string' ? target : signup.value ? 'login' : 'signup';
  if (next === mode.value) return;
  mode.value = next;
  password.value = ''; confirm.value = ''; error.value = ''; success.value = ''; visible.value = false;
  await nextTick(); emailInput.value?.focus();
}
async function submit(event) {
  if (busy.value) return;
  // Autofill can update the DOM without emitting Vue input events.
  if (event?.currentTarget) {
    const fields = new FormData(event.currentTarget);
    email.value = String(fields.get('username') || '');
    password.value = String(fields.get('password') || '');
    if (signup.value) confirm.value = String(fields.get('confirm-password') || '');
  }
  error.value = ''; success.value = '';
  if (signup.value && password.value !== confirm.value) { error.value = 'Password ทั้งสองช่องไม่ตรงกัน'; return; }
  busy.value = true;
  try {
    const response = await api(`/api/auth/${mode.value}`, { method: 'POST', body: JSON.stringify({ email: email.value, password: password.value, ...(!signup.value ? { remember: remember.value } : {}) }) });
    const data = await response.json();
    if (!response.ok) { error.value = data.error || 'ดำเนินการไม่สำเร็จ'; return; }
    if (signup.value) {
      mode.value = 'login'; password.value = ''; confirm.value = ''; visible.value = false;
      success.value = 'สมัครสำเร็จแล้ว Login ด้วยบัญชีใหม่ได้เลย';
      await nextTick(); emailInput.value?.focus();
    } else {
      try {
        if (remember.value) localStorage.setItem('short-url-email', data.user.email);
        else localStorage.removeItem('short-url-email');
      } catch { /* Storage may be disabled; authentication still succeeds. */ }
      // Ask the browser's password manager to save credentials, never web storage.
      if (remember.value && window.PasswordCredential && navigator.credentials?.store) {
        try {
          void navigator.credentials.store(new window.PasswordCredential({ id: data.user.email, password: password.value })).catch(() => {});
        } catch { /* Browser policy or the user can decline password saving. */ }
      }
      password.value = ''; emit('authenticated', data.user);
    }
  } catch (err) { error.value = err.serviceUnavailable ? err.message : 'เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'; }
  finally { busy.value = false; }
}
</script>
<template>
  <section class="auth-layout" aria-labelledby="auth-title">
    <div class="auth-intro">
      <h1>ลิงก์สั้น แชร์ง่าย.<br><span>จัดการได้ในที่เดียว.</span></h1>
      <p class="intro">ย่อลิงก์ให้จำง่าย แชร์ผ่าน QR Code<br>และจัดการทุกลิงก์ได้ในบัญชีเดียว</p>
      <LinkVisual />
      <div class="auth-capabilities"><span>ตั้งรหัสเอง</span><span>QR Code</span><span>กำหนดอายุลิงก์</span></div>
      <p class="auth-note">คนรับลิงก์เปิดได้ทันที โดยไม่ต้องมีบัญชี</p>
    </div>
    <section class="auth-panel">
      <div class="auth-mode-switch" role="group" aria-label="เลือกเข้าสู่ระบบหรือสมัครสมาชิก">
        <button type="button" :class="{ selected: !signup }" :aria-pressed="!signup" :disabled="busy" @click="switchMode('login')">Login</button>
        <button type="button" :class="{ selected: signup }" :aria-pressed="signup" :disabled="busy" @click="switchMode('signup')">Sign up</button>
      </div>
      <Transition name="page" mode="out-in" @after-enter="emailInput?.focus()">
        <form :key="mode" :name="signup ? 'signup' : 'login'" autocomplete="on" class="auth-form" :aria-busy="busy" @submit.prevent="submit">
          <h2 id="auth-title" tabindex="-1">{{ signup ? 'Create your account' : 'Welcome back' }}</h2>
          <p class="intro">{{ signup ? 'สมัครบัญชีเพื่อเก็บลิงก์ของคุณแยกเป็นส่วนตัว' : 'Login เพื่อสร้างลิงก์และดูประวัติของคุณ' }}</p>
          <div class="auth-field"><label for="auth-email">Email</label><input id="auth-email" name="username" ref="emailInput" v-model="email" type="email" autocomplete="username" maxlength="254" :readonly="busy" required /></div>
          <div class="auth-field"><label for="auth-password">Password</label><div class="password-field"><input id="auth-password" name="password" v-model="password" :type="visible ? 'text' : 'password'" :autocomplete="signup ? 'new-password' : 'current-password'" :minlength="signup ? 6 : 1" :maxlength="signup ? 12 : 128" :pattern="signup ? '(?=.*[A-Z]).{6,12}' : undefined" :readonly="busy" :aria-describedby="signup ? 'password-help' : undefined" required /><button type="button" :disabled="busy" :aria-pressed="visible" @click="visible = !visible"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path v-if="visible" d="m3 3 18 18"/></svg><span class="sr-only">{{ visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน' }}</span></button></div><div v-if="signup" id="password-help" class="password-guidance"><p :class="{ complete: password.length >= 6 && password.length <= 12 }">{{ password.length >= 6 && password.length <= 12 ? 'ความยาวครบแล้ว' : 'ใช้รหัสผ่าน 6–12 ตัวอักษร' }}<span>{{ password.length }}/12</span></p><div class="password-length" aria-hidden="true"><span :style="{ width: `${Math.min(password.length / 6, 1) * 100}%` }"></span></div><small>ต้องมีตัวพิมพ์ใหญ่ A–Z อย่างน้อย 1 ตัว</small></div></div>
          <div v-if="signup" class="auth-field"><label for="confirm-password">Confirm password</label><input id="confirm-password" name="confirm-password" v-model="confirm" :type="visible ? 'text' : 'password'" autocomplete="new-password" :minlength="signup ? 6 : 1" :maxlength="signup ? 12 : 128" :pattern="signup ? '(?=.*[A-Z]).{6,12}' : undefined" :readonly="busy" required /></div>
          <p v-if="error" class="error auth-message" role="alert">{{ error }}</p>
          <p v-if="success" class="auth-success auth-message" role="status">{{ success }}</p>
          <div v-if="!signup" class="remember-option"><label><input v-model="remember" type="checkbox" :disabled="busy" />จำ Email และการเข้าสู่ระบบ 7 วัน</label></div>
          <button type="submit" class="primary auth-submit" :disabled="busy"><span v-if="busy" class="spinner" aria-hidden="true"></span>{{ busy ? 'กำลังดำเนินการ…' : signup ? 'Sign up' : 'Login' }}</button>
          <p class="auth-switch">{{ signup ? 'มีบัญชีแล้ว?' : 'ยังไม่มีบัญชี?' }} <button type="button" :disabled="busy" @click="switchMode">{{ signup ? 'Login' : 'Sign up' }}</button></p>
        </form>
      </Transition>
    </section>
  </section>
</template>


