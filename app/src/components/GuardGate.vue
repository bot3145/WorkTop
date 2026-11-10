<script setup lang="ts">
// 模块锁屏：受保护模块在解锁前只显示这个卡片，不渲染任何真实内容。
// 口令校验在 Rust 端做（HMAC 校验值比对），前端只负责收集与展示错误。
import { computed, inject, ref, type ComputedRef } from "vue"
import { ApiError } from "../lib/api"
import { unlockGuard, type GuardModule } from "../lib/guard"
import type { T } from "../i18n"
import Icon from "./Icon.vue"

const props = defineProps<{ module: GuardModule }>()
const emit = defineEmits<{ unlocked: [] }>()
const t = inject<ComputedRef<T>>("t")!

const pw = ref("")
const busy = ref(false)
const err = ref("")

const label = computed(() => t.value(`guard_mod_${props.module}`))

async function submit() {
  if (busy.value || !pw.value) return
  busy.value = true
  err.value = ""
  try {
    await unlockGuard(props.module, pw.value)
    pw.value = ""
    emit("unlocked")
  } catch (e) {
    err.value = e instanceof ApiError ? e.message : String((e as Error).message)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="guard-wrap">
    <div class="guard-card">
      <div class="guard-icon"><Icon name="lock" :size="20" /></div>
      <div class="guard-title">{{ t("guard_locked_title", { name: label }) }}</div>
      <div class="guard-sub">{{ t("guard_locked_desc") }}</div>
      <div class="row guard-form">
        <input v-model="pw" type="password" :placeholder="t('guard_pw_ph')" autofocus
          autocomplete="off" @keydown.enter="submit">
        <button class="primary" :disabled="busy || !pw" @click="submit">
          {{ busy ? t("guard_unlocking") : t("guard_unlock") }}
        </button>
      </div>
      <div v-if="err" class="guard-err">{{ err }}</div>
      <div class="guard-note">{{ t("guard_plain_note") }}</div>
    </div>
  </div>
</template>

<style scoped>
.guard-wrap { display: flex; align-items: center; justify-content: center; min-height: 58vh; }
.guard-card { width: min(360px, 100%); text-align: center; padding: 26px 22px 20px;
  border: 1px solid var(--pwb-border-strong); border-radius: 14px; background: var(--pwb-card); }
.guard-icon { width: 42px; height: 42px; margin: 0 auto 12px; border-radius: 50%; display: flex;
  align-items: center; justify-content: center; color: var(--pwb-accent); background: var(--pwb-chip); }
.guard-title { font-size: 14px; font-weight: 600; }
.guard-sub { font-size: 12px; color: var(--pwb-muted); margin-top: 6px; line-height: 1.6; }
.guard-form { margin-top: 16px; gap: 8px; }
.guard-form input { flex: 1; min-width: 0; }
.guard-err { margin-top: 10px; font-size: 12px; color: #c0392b; }
.guard-note { margin-top: 14px; font-size: 11.5px; color: var(--pwb-faint); line-height: 1.6; }
</style>
