<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import LinkQr from './LinkQr.vue';
import CopyLink from './CopyLink.vue';
import { api } from '../api';
const links = ref([]);
const query = ref('');
const activeQuery = ref('');
const editingId = ref(null);
const editTitle = ref('');
const saving = ref(false);
const editError = ref('');
const deletingId = ref(null);
const deleteError = ref('');
async function askDelete(link) {
  if (saving.value || loading.value) return;
  editingId.value = null; deletingId.value = link.id; deleteError.value = '';
  await nextTick(); document.getElementById(`cancel-delete-${link.id}`)?.focus();
}
async function cancelDelete(id) {
  if (saving.value) return;
  deletingId.value = null; deleteError.value = '';
  await nextTick(); document.getElementById(`delete-${id}`)?.focus();
}
async function deleteLink(link) {
  if (saving.value || loading.value) return;
  saving.value = true; deleteError.value = '';
  try {
    const response = await api(`/api/links/${link.id}`, { method: 'DELETE', body: '{}' });
    if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'ลบลิงก์ไม่สำเร็จ'); }
    if (disposed) return;
    links.value = links.value.filter(item => item.id !== link.id);
    deletingId.value = null;
    await loadHistory(!links.value.length && page.value > 1 ? page.value - 1 : page.value);
    announcement.value = 'ลบลิงก์แล้ว ลิงก์และ QR เดิมจะเปิดไม่ได้';
    actionFeedback.value = announcement.value;
    await nextTick(); document.getElementById('history-title')?.focus();
  } catch (err) { if (!disposed) deleteError.value = err.serviceUnavailable ? err.message : err.message || 'ลบลิงก์ไม่สำเร็จ กรุณาลองอีกครั้ง'; }
  finally { saving.value = false; }
}

const clock = ref(Date.now());
const clockTimer = setInterval(() => { clock.value = Date.now(); }, 30000);
function isExpired(link) { return link.expires_at && new Date(link.expires_at).getTime() <= clock.value; }
async function search() { if (loading.value || saving.value) return; activeQuery.value = query.value.trim(); await loadHistory(1); }
async function clearSearch() { query.value = ''; await search(); }
async function startEdit(link) { deletingId.value = null; editingId.value = link.id; editTitle.value = link.title; editError.value = ''; await nextTick(); document.getElementById(`rename-${link.id}`)?.focus(); }
async function cancelEdit(id) { editingId.value = null; editError.value = ''; await nextTick(); document.getElementById(`edit-${id}`)?.focus(); }
async function saveTitle(link) {
  if (saving.value) return;
  saving.value = true; editError.value = '';
  try {
    const response = await api(`/api/links/${link.id}`, { method: 'PATCH', body: JSON.stringify({ title: editTitle.value }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'บันทึกชื่อไม่สำเร็จ');
    await cancelEdit(link.id); announcement.value = 'บันทึกชื่อแล้ว';
    await loadHistory(page.value);
    if (!links.value.length && page.value > 1) await loadHistory(page.value - 1);
    actionFeedback.value = 'บันทึกชื่อใหม่แล้ว URL และ QR ยังใช้ได้เหมือนเดิม';
  } catch (err) { if (!disposed) editError.value = err.message || 'บันทึกชื่อไม่สำเร็จ กรุณาลองใหม่'; }
  finally { saving.value = false; }
}

const page = ref(1);
const hasMore = ref(false);
const loading = ref(false);
const error = ref('');
const announcement = ref('');
const actionFeedback = ref('');
const updatedAt = ref('');
const changedIds = ref([]);
let pendingRefresh = false;
let disposed = false;
let controller;
onBeforeUnmount(() => { disposed = true; controller?.abort(); clearInterval(clockTimer); });
async function loadHistory(targetPage = page.value) {
  if (loading.value || disposed) return;
  controller = new AbortController();
  loading.value = true;
  error.value = '';
  announcement.value = '';
  try {
    const response = await api(`/api/links?page=${targetPage}&q=${encodeURIComponent(activeQuery.value)}`, { signal: controller.signal });
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (disposed) return;
    if (!Array.isArray(data.items)) throw new Error();
    changedIds.value = data.items.filter(item => {
      const previous = links.value.find(link => link.id === item.id);
      return previous && previous.clicks !== item.clicks;
    }).map(item => item.id);
    links.value = data.items;
    updatedAt.value = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    editingId.value = null; deletingId.value = null;
    page.value = data.page;
    hasMore.value = data.hasMore;
    announcement.value = 'อัปเดตประวัติและจำนวนคลิกแล้ว';
  } catch (err) {
    if (!disposed && err.name !== 'AbortError') error.value = err.serviceUnavailable ? err.message : 'โหลดประวัติไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วกดรีเฟรชอีกครั้ง';
  }
  finally {
    loading.value = false;
    if (pendingRefresh && !disposed) { pendingRefresh = false; await loadHistory(1); }
  }
}
function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'ไม่ทราบวันที่' : date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}
function destination(value) {
  try { return new URL(value).hostname; } catch { return 'เว็บไซต์ปลายทาง'; }
}
onMounted(() => loadHistory());
defineExpose({ refresh: () => {
  query.value = ''; activeQuery.value = '';
  if (loading.value) { pendingRefresh = true; return; }
  return loadHistory(1);
} });
</script>
<template>
  <section id="history" class="history" aria-labelledby="history-title">
    <div class="section-heading"><div><h2 id="history-title" tabindex="-1">ลิงก์ของคุณ</h2><p class="help">แสดงเฉพาะลิงก์ที่สร้างด้วยบัญชีนี้</p></div><button type="button" :disabled="loading || saving" @click="loadHistory()"><svg class="icon" :class="{ spinning: loading }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9" /></svg>{{ loading ? 'กำลังโหลด…' : 'รีเฟรชข้อมูล' }}</button></div>
    <form class="history-search" role="search" @submit.prevent="search"><label for="history-query" class="sr-only">ค้นหาลิงก์ของคุณ</label><div class="search-input"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="history-query" v-model="query" type="search" maxlength="200" placeholder="ค้นหาชื่อ URL หรือรหัสลิงก์ทุกหน้า" :readonly="loading || saving" /></div><button type="submit" :disabled="loading || saving">ค้นหา</button><button v-if="activeQuery" type="button" :disabled="loading || saving" @click="clearSearch">ล้างคำค้น</button></form>
    <p v-if="activeQuery" class="search-summary">ผลการค้นหา “{{ activeQuery }}” · เฉพาะบัญชีของคุณ</p>
    <Transition name="feedback"><p v-if="actionFeedback" :key="actionFeedback" class="action-feedback" role="status"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>{{ actionFeedback }}<button type="button" aria-label="ปิดข้อความแจ้งผล" @click="actionFeedback = ''"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></p></Transition>
    <div class="history-meta"><p class="history-note">{{ links.length ? `แสดง ${links.length} รายการในหน้านี้ · ` : '' }}จำนวนคลิกรวมการเปิดซ้ำ</p><p class="update-status" role="status">{{ loading ? 'กำลังอัปเดตข้อมูล…' : error ? 'อัปเดตไม่สำเร็จ' : updatedAt ? `อัปเดตแล้ว ${updatedAt}` : '' }}</p></div>
    <p class="sr-only" role="status">{{ loading ? 'กำลังโหลดประวัติ' : announcement }}</p>
    <p v-if="error" class="error" role="alert">{{ error }}<span v-if="links.length"> ข้อมูลด้านล่างเป็นข้อมูลที่โหลดไว้ก่อนหน้า</span></p>
    <div v-if="loading && !links.length" class="empty-state">กำลังโหลดประวัติลิงก์…</div>
    <div v-else-if="!error && !links.length" class="empty-state"><h3>{{ activeQuery ? 'ไม่พบลิงก์ที่ค้นหา' : 'คุณยังไม่มีลิงก์' }}</h3><p>{{ activeQuery ? 'ลองใช้คำอื่น หรือล้างคำค้นเพื่อดูทั้งหมด' : 'เริ่มสร้างลิงก์แรกได้จากช่อง URL ด้านบน' }}</p><a v-if="!activeQuery" href="#url">ไปสร้างลิงก์สั้น</a></div>
    <Transition name="page" mode="out-in"><div v-if="links.length" :key="`${page}-${activeQuery}`" class="history-list" :aria-busy="loading">
      <article v-for="link in links" :key="link.id" class="history-item">
        <div class="link-info"><div class="link-heading"><h3 class="link-title">{{ link.title || destination(link.original_url) }}</h3><span class="link-status" :class="{ expired: isExpired(link) }">{{ isExpired(link) ? 'หมดอายุ' : 'ใช้งานได้' }}</span></div><a class="short-link" :href="link.short_url" target="_blank" rel="noopener noreferrer">{{ link.short_url }}<svg class="external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M14 4h6v6m0-6L10 14M10 4H4v16h16v-6"/></svg><span class="sr-only"> (เปิดแท็บใหม่)</span></a><p class="original-url"><span class="sr-only">URL ต้นฉบับ: </span>{{ link.original_url }}</p><small class="date">สร้าง {{ formatDate(link.created_at) }}</small><p class="expiry-date" :class="{ expired: isExpired(link) }">{{ link.expires_at ? `หมดอายุ ${formatDate(link.expires_at)}` : 'ไม่กำหนดวันหมดอายุ' }}</p></div>
        <p class="click-count"><strong :key="`${link.id}-${link.clicks}`" :class="{ 'count-updated': changedIds.includes(link.id) }">{{ Number(link.clicks).toLocaleString('th-TH') }}</strong><span>ครั้งที่เปิด</span></p>
        <div class="row-actions"><CopyLink :url="link.short_url" /><button :id="`edit-${link.id}`" class="edit-link" type="button" :disabled="saving || loading" :aria-expanded="editingId === link.id" @click="startEdit(link)"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m15 4 5 5M4 20l4-1L20 7a2 2 0 0 0-3-3L5 16l-1 4Z"/></svg>แก้ชื่อ<span class="sr-only"> {{ link.title || link.code }}</span></button><button :id="`delete-${link.id}`" class="delete-link" type="button" :disabled="saving || loading" :aria-expanded="deletingId === link.id" @click="askDelete(link)"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5m4-5v5"/></svg>ลบ<span class="sr-only"> {{ link.title || link.code }}</span></button></div>
        <section v-if="deletingId === link.id" class="delete-confirm" :aria-labelledby="`delete-heading-${link.id}`" @keydown.esc.prevent="cancelDelete(link.id)">
          <h4 :id="`delete-heading-${link.id}`">ลบลิงก์นี้ใช่ไหม?</h4><p class="delete-target">{{ link.title || link.code }}</p><p>ลิงก์และ QR ที่แชร์ไว้จะเปิดไม่ได้ กู้คืนผ่านเว็บไม่ได้ และรหัสนี้จะไม่ถูกนำกลับมาใช้</p>
          <div class="delete-actions"><button :id="`cancel-delete-${link.id}`" type="button" :disabled="saving" @click="cancelDelete(link.id)">เก็บลิงก์ไว้</button><button class="primary" type="button" :disabled="saving" @click="deleteLink(link)"><span v-if="saving" class="spinner" aria-hidden="true"></span>{{ saving ? 'กำลังลบ…' : 'ยืนยันลบลิงก์' }}</button></div><p v-if="deleteError" class="error" role="alert">{{ deleteError }}</p>
        </section>
        <form v-if="editingId === link.id" class="rename-form" @submit.prevent="saveTitle(link)" @keydown.esc.prevent="cancelEdit(link.id)"><label :for="`rename-${link.id}`">แก้ชื่อแสดงผล <span class="optional">ไม่เปลี่ยน URL หรือ QR</span></label><input :id="`rename-${link.id}`" v-model="editTitle" maxlength="120" :readonly="saving" placeholder="เว้นว่างเพื่อแสดงโดเมนปลายทาง" /><div class="rename-actions"><button class="primary" type="submit" :disabled="saving"><span v-if="saving" class="spinner" aria-hidden="true"></span>{{ saving ? 'กำลังบันทึก…' : 'บันทึกชื่อ' }}</button><button type="button" :disabled="saving" @click="cancelEdit(link.id)">ยกเลิก</button></div><p v-if="editError" class="error" role="alert">{{ editError }}</p></form>
        <LinkQr :url="link.short_url" />
      </article>
    </div></Transition>
    <nav v-if="hasMore || page > 1" class="pagination" aria-label="หน้าประวัติ"><button type="button" :disabled="page === 1 || loading || saving" @click="loadHistory(page - 1)">ก่อนหน้า</button><span>หน้า {{ page }}</span><button type="button" :disabled="!hasMore || loading || saving" @click="loadHistory(page + 1)">ถัดไป</button></nav>
  </section>
</template>
