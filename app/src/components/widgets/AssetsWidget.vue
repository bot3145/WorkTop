<script setup lang="ts">
// 资产卡片：主机清单概览（探活状态点）；凭据绝不进卡片。
import { computed, onMounted, ref, watch } from "vue"
import { call } from "../../lib/api"
import { isLocked, refreshGuard } from "../../lib/guard"
import WidgetShell from "../WidgetShell.vue"


interface AssetRow {
  name: string
  host: string
  port: string
  grp: string
  note: string
  last_status: string
}

const emit = defineEmits<{ "open-app": [id: string] }>()
const assets = ref<AssetRow[]>([])
const locked = computed(() => isLocked("assets"))

async function load() {
  try {
    const d = await call<{ assets: AssetRow[] }>("assets_list")
    assets.value = d.assets
  } catch {}
}

onMounted(async () => {
  await refreshGuard()
  if (!locked.value) await load()
})

// 上锁就清掉清单；解锁后补拉一次
watch(locked, (v) => {
  if (v) assets.value = []
  else void load()
})
</script>

<template>
  <WidgetShell id="assets" caption="资产" :width="320">
    <!-- 纵向列布局：清单在内部滚动，入口按钮固定在底部——卡片缩小后入口依然可见 -->
    <div class="as-wrap">
      <div v-if="locked" class="as-empty">已上锁，打开面板输入口令</div>
      <div v-else-if="assets.length" class="as-list">
        <div v-for="a in assets" :key="a.name" class="as-row" :title="a.note">
          <span class="as-dot" :class="a.last_status" />
          <span class="as-name">{{ a.name }}</span>
          <span class="as-host">{{ a.host }}<template v-if="a.port">:{{ a.port }}</template></span>
          <span v-if="a.grp" class="as-grp">{{ a.grp }}</span>
        </div>
      </div>
      <div v-else class="as-empty">还没有资产记录</div>
      <button class="as-more" @click="emit('open-app', 'assets')">全部 {{ assets.length }} 个资产 →</button>
    </div>
  </WidgetShell>
</template>

<style scoped>
/* 列布局：as-list 占满剩余空间内部滚动，as-more 恒在底部（卡片缩小入口不消失） */
.as-wrap { display: flex; flex-direction: column; height: 100%; min-height: 0; }
/* 变宽自动多列（列宽下限固定、间距固定）：窄=1 列，宽=2/3 列；
   min() 夹住列下限：卡片比 230px 还窄时不让列溢出（否则右侧内容被裁） */
.as-list { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: none; -ms-overflow-style: none;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(min(230px, 100%), 1fr)); gap: 1px 14px; align-content: start; }
.as-list::-webkit-scrollbar { width: 0; height: 0; display: none; }
.as-row { display: flex; align-items: center; gap: 7px; padding: 3.5px 0; font-size: 12px; min-width: 0; }
.as-dot { width: 7px; height: 7px; border-radius: 50%; background: #c7c7cc; flex-shrink: 0; }
.as-dot.up { background: #34c759; }
.as-dot.down { background: #ff3b30; }
.as-name { color: #1d1d1f; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.as-host { color: #6e6e73; font-size: 11px; font-variant-numeric: tabular-nums; margin-left: auto; flex-shrink: 0; max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.as-grp { font-size: 10px; color: #6e6e73; background: rgba(0,0,0,.05); border-radius: 999px; padding: 1px 7px; flex-shrink: 0; white-space: nowrap; }
.as-more { flex: none; border: none; background: transparent; color: #1f7a3d; font: inherit; font-size: 11.5px;
  font-weight: 500; cursor: pointer; padding: 6px 0 0; height: auto; }
.as-more:hover { text-decoration: underline; }
.as-empty { flex: 1; min-height: 0; font-size: 12px; color: #6e6e73; padding: 4px 0; overflow: hidden; }
</style>
