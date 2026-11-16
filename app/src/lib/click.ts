// 单击 + 双击共存。
//
// 场景：图标「单击 = 打开 / 启动」「双击 = 全屏打开」。浏览器会先派发 click（可能两次）
// 再派发 dblclick，如果单击立刻执行，双击就会变成「先普通打开、再全屏」甚至启动两次
// （外部 exe 尤其危险）。这里的做法是把单击延后 delay 毫秒执行：
//   · 期间来了第二次点击 → 取消单击，交给 dblclick 处理；
//   · 超时没再来 → 才真的执行单击。
// 用法：
//   const split = createClickSplitter()
//   @click="split.single(() => open(a))"  @dblclick.stop="split.double(() => openFull(a))"
export function createClickSplitter(delay = 220) {
  let timer: ReturnType<typeof setTimeout> | null = null

  const clear = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  return {
    /** 单击（延后执行，可被第二次点击取消） */
    single(fn: () => void) {
      if (timer) {
        // 第二次点击：不再执行单击，等 dblclick
        clear()
        return
      }
      timer = setTimeout(() => {
        timer = null
        fn()
      }, delay)
    },
    /** 双击（立即执行） */
    double(fn: () => void) {
      clear()
      fn()
    },
    /** 组件卸载时清掉挂起的单击 */
    dispose: clear,
  }
}
