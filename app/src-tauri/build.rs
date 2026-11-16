fn main() {
    // 图标是编译期嵌进 exe 的（Windows 资源），tauri-build 默认不盯 icons/ 目录，
    // 换图标后不重新链接就会出现「图标文件已更新、任务栏还是旧图」的错觉。这里显式声明依赖。
    println!("cargo:rerun-if-changed=icons");
    // 前端产物同样是编译期嵌进 exe 的（frontendDist = ../dist），tauri-build 也不盯它：
    // 只跑 `npm run build` 再 `cargo build` 会出现「dist 已更新、exe 里还是旧界面」。一并声明。
    println!("cargo:rerun-if-changed=../dist");
    tauri_build::build()
}
