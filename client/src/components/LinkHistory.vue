<script setup>
import { ref, onMounted } from 'vue';
import LinkQr from './LinkQr.vue';
import CopyLink from './CopyLink.vue';
import { api } from '../api';
const links = ref([]);
const page = ref(1);
const hasMore = ref(false);
const loading = ref(false);
const error = ref('');
const announcement = ref('');
const updatedAt = ref('');
const changedIds = ref([]);
let pendingRefresh = false;
async function loadHistory(targetPage = page.value) {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  announcement.value = '';
  try {
    const response = await api(`/api/links?page=${targetPage}`);
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (!Array.isArray(data.items)) throw new Error();
    changedIds.value = data.items.filter(item => {
      const previous = links.value.find(link => link.id === item.id);
      return previous && previous.clicks !== item.clicks;
    }).map(item => item.id);
    links.value = data.items;
    updatedAt.value = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    page.value = data.page;
    hasMore.value = data.hasMore;
    announcement.value = 'อัปเดตประวัติและจำนวนคลิกแล้ว';
  } catch { error.value = 'โหลดประวัติไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วกดรีเฟรชอีกครั้ง'; }
  finally {
    loading.value = false;
    if (pendingRefresh) { pendingRefresh = false; await loadHistory(1); }
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
  if (loading.value) { pendingRefresh = true; return; }
  return loadHistory(1);
} });
</script>
<template>
  <section id="history" class="history" aria-labelledby="history-title">
    <div class="section-heading"><div><h2 id="history-title">ลิงก์ของคุณ</h2><p class="help">แสดงเฉพาะลิงก์ที่สร้างด้วยบัญชีนี้</p></div><button type="button" :disabled="loading" @click="loadHistory()"><svg class="icon" :class="{ spinning: loading }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9" /></svg>{{ loading ? 'กำลังโหลด…' : 'รีเฟรชข้อมูล' }}</button></div>
    <div class="history-meta"><p class="history-note">{{ links.length ? `แสดง ${links.length} รายการในหน้านี้ · ` : '' }}จำนวนคลิกรวมการเปิดซ้ำ</p><p class="update-status" role="status">{{ loading ? 'กำลังอัปเดตข้อมูล…' : error ? 'อัปเดตไม่สำเร็จ' : updatedAt ? `อัปเดตแล้ว ${updatedAt}` : '' }}</p></div>
    <p class="sr-only" role="status">{{ loading ? 'กำลังโหลดประวัติ' : announcement }}</p>
    <p v-if="error" class="error" role="alert">{{ error }}<span v-if="links.length"> ข้อมูลด้านล่างเป็นข้อมูลที่โหลดไว้ก่อนหน้า</span></p>
    <div v-if="loading && !links.length" class="empty-state">กำลังโหลดประวัติลิงก์…</div>
    <div v-else-if="!error && !links.length" class="empty-state"><h3>คุณยังไม่มีลิงก์</h3><p>เริ่มสร้างลิงก์แรกได้จากช่อง URL ด้านบน</p><a href="#url">ไปสร้างลิงก์สั้น</a></div>
    <Transition name="page" mode="out-in"><div v-if="links.length" :key="page" class="history-list" :aria-busy="loading">
      <article v-for="link in links" :key="link.id" class="history-item">
        <div class="link-info"><p class="destination-name">{{ destination(link.original_url) }}</p><a class="short-link" :href="link.short_url" target="_blank" rel="noopener noreferrer">{{ link.short_url }}<svg class="external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M14 4h6v6m0-6L10 14M10 4H4v16h16v-6"/></svg><span class="sr-only"> (เปิดแท็บใหม่)</span></a><p class="original-url"><span class="sr-only">URL ต้นฉบับ: </span>{{ link.original_url }}</p><small class="date">{{ formatDate(link.created_at) }}</small></div>
        <p class="click-count"><strong :key="`${link.id}-${link.clicks}`" :class="{ 'count-updated': changedIds.includes(link.id) }">{{ Number(link.clicks).toLocaleString('th-TH') }}</strong><span>ครั้งที่เปิด</span></p>
        <div class="row-actions"><CopyLink :url="link.short_url" /></div>
        <LinkQr :url="link.short_url" />
      </article>
    </div></Transition>
    <nav v-if="hasMore || page > 1" class="pagination" aria-label="หน้าประวัติ"><button type="button" :disabled="page === 1 || loading" @click="loadHistory(page - 1)">ก่อนหน้า</button><span>หน้า {{ page }}</span><button type="button" :disabled="!hasMore || loading" @click="loadHistory(page + 1)">ถัดไป</button></nav>
  </section>
</template>
