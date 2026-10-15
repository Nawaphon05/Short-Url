<script setup>
import { ref, onMounted } from 'vue';
import LinkQr from './LinkQr.vue';
const links = ref([]);
const page = ref(1);
const hasMore = ref(false);
const loading = ref(false);
const error = ref('');

async function loadHistory(targetPage = page.value) {
  if (loading.value) return;

  loading.value = true;
  error.value = '';

  try {
    const response = await fetch(`/api/links?page=${targetPage}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'โหลดประวัติไม่สำเร็จ');
    }

    links.value = data.items;
    page.value = data.page;
    hasMore.value = data.hasMore;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function formatDate(value) {
  return new Date(value).toLocaleString('th-TH');
}

onMounted(() => loadHistory());

defineExpose({
  refresh: () => loadHistory(1),
});
</script>

<template>
  <section class="history">
    <h2>ประวัติลิงก์</h2>
    <p>ประวัติร่วมกันของเดโม · จำนวนเปิดรวมการเปิดซ้ำ</p>

    <button
      type="button"
      :disabled="loading"
      @click="loadHistory()"
    >
      {{ loading ? 'กำลังโหลด…' : 'รีเฟรชจำนวนคลิก' }}
    </button>

    <p v-if="error" class="error" role="alert">
      {{ error }}
    </p>

    <p v-if="loading" role="status">กำลังโหลดประวัติ…</p>

    <p v-if="!loading && !error && links.length === 0">
      ยังไม่มีประวัติลิงก์
    </p>

    <article
      v-for="link in links"
      :key="link.id"
      class="history-item"
    >
      <p class="original-url">{{ link.original_url }}</p>

      <a
        :href="link.short_url"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ link.short_url }}
      </a>

      <p>
        จำนวนเปิด: <strong>{{ link.clicks }}</strong> ครั้ง
      </p>

      <small>สร้างเมื่อ {{ formatDate(link.created_at) }}</small>
        <LinkQr :url="link.short_url" />
    </article>

    <nav class="pagination" aria-label="หน้าประวัติ">
      <button
        type="button"
        :disabled="page === 1 || loading"
        @click="loadHistory(page - 1)"
      >
        ก่อนหน้า
      </button>

      <span>หน้า {{ page }}</span>

      <button
        type="button"
        :disabled="!hasMore || loading"
        @click="loadHistory(page + 1)"
      >
        ถัดไป
      </button>
    </nav>
  </section>
</template>

<style scoped>
.history {
  margin-top: 36px;
}

.history-item {
  margin-top: 16px;
  padding: 20px;
  background: white;
  border: 1px solid #dce5df;
  border-radius: 12px;
  overflow-wrap: anywhere;
}

.original-url,
small {
  color: #64756b;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
}

.pagination button {
  width: auto;
  margin: 0;
}
</style>