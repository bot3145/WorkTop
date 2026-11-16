# -*- coding: utf-8 -*-
"""WorkTop 广告旁白 TTS 批量生成
用法: python gen_tts.py
产出: audio/<创意ID>/<ID>NN.mp3 逐句 + 完整旁白-<ID>.mp3（句间 0.45s 静音）
"""
import asyncio
import os
import subprocess

import edge_tts

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "audio")
FF = r"D:\app\ffmpeg\bin\ffmpeg.exe"
FP = r"D:\app\ffmpeg\bin\ffprobe.exe"
SILENCE = os.path.join(OUT, "_silence.mp3")

CONCEPTS = [
    {
        "id": "A", "title": "把桌面还给你",
        "voice": "zh-CN-XiaoxiaoNeural", "rate": "-4%",
        "lines": [
            "你的桌面，多久没有好好整理过了？",
            "WorkTop，把常用的一切，摆回桌面上。",
            "时钟、待办、导航、便签——九张卡片，随手拖动，自动对齐。",
            "一个更懂 Windows 的 Dock：点击直启，再点一下，最小化。",
            "还有小助手托托，常驻屏幕角落，随叫随到。",
            "WorkTop，把桌面还给你。现在就去试试。",
        ],
    },
    {
        "id": "B", "title": "数据是我的",
        "voice": "zh-CN-YunxiNeural", "rate": "-6%",
        "lines": [
            "你的待办、笔记和密钥文档，现在存在谁的电脑上？",
            "WorkTop 的答案是：你的。",
            "所有数据，都是一份份 Markdown 明文，就放在你自己的硬盘里。",
            "Obsidian 可以直接编辑同一份待办，改完，桌面卡片立刻刷新。",
            "没有账号，没有云同步，没有遥测。断了网，照样全套能用。",
            "密钥文档还有独立主口令加密，密钥只进系统钥匙串。",
            "本地优先，不只是一个技术方案，更是一种态度。",
            "WorkTop，数据是我的。",
        ],
    },
    {
        "id": "C", "title": "托托的一天",
        "voice": "zh-CN-XiaoyiNeural", "rate": "+2%",
        "lines": [
            "早上九点，托托准时醒来。它是你的桌面小助手，也是今天第一位到岗的同事。",
            "屏幕角落，待办角标亮了——今天，有三件事。",
            "点一下它，扇形菜单展开：待办、速记、AI、截图，全在手边。",
            "同事发来一张图？按 F1，框住、标注、贴到桌面，三步搞定。",
            "下午的会临时提前？直接吩咐 AI：把明天的会，改到周五。待办卡片，自己就变了。改错了？撤销就行。",
            "下班啦。托托贴边折叠，安安静静，不占地方。",
            "它不领工资，还是开源的。托托和 WorkTop 的九张卡片，等你来桌面报到。",
        ],
    },
    {
        "id": "D", "title": "3MB的效率怪兽",
        "voice": "zh-CN-YunyangNeural", "rate": "+12%",
        "lines": [
            "三MB，装好一个效率怪兽。",
            "九张桌面卡片，F1一秒截图，AI带二十多个工具，直接读写你的待办和笔记。",
            "零账号，零云同步，零遥测。",
            "WorkTop——轻，但能打。",
        ],
    },
    {
        "id": "E", "title": "AI坐在桌面上",
        "voice": "zh-CN-YunxiNeural", "rate": "+0%",
        "lines": [
            "AI不该被关在聊天框里，它应该坐在你的桌面上。",
            "WorkTop的AI快问，接你自己的模型，密钥只进系统钥匙串。",
            "二十多个工具，直接读写你的待办、导航、速记和资产。",
            "一句话，把明天的会改到周五；再一句话，把速记提炼成要点。",
            "更重要的是，每一次改动，都能撤销。",
            "WorkTop，AI坐在桌面上——帮你干活，不抢你的方向盘。",
        ],
    },
    {
        "id": "F", "title": "开源邀请函",
        "voice": "zh-CN-YunjianNeural", "rate": "-2%",
        "lines": [
            "这是一只纯CSS画出来的吉祥物，也是一个MIT协议的开源项目。",
            "WorkTop，用Tauri打造的本地优先工作台：桌面卡片、Dock、吉祥物、截图和AI，装进一个三MB的安装包。",
            "代码在GitHub上，数据格式是公开的Markdown，Lite版零依赖，一条命令就能跑起来。",
            "每张卡片都是独立组件，欢迎带着业务需求来定制：企业看板、导航壳、私有部署。",
            "开源是邀请函，定制是回信。",
            "WorkTop，在GitHub等你。",
        ],
    },
]


async def tts(text: str, voice: str, rate: str, path: str) -> None:
    await edge_tts.Communicate(text, voice, rate=rate).save(path)


def dur(path: str) -> float:
    r = subprocess.run(
        [FP, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True, text=True,
    )
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


async def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    subprocess.run(
        [FF, "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", "0.45", "-b:a", "48k", SILENCE],
        capture_output=True,
    )
    for con in CONCEPTS:
        d = os.path.join(OUT, con["id"])
        os.makedirs(d, exist_ok=True)
        files = []
        for i, line in enumerate(con["lines"], 1):
            p = os.path.join(d, f"{con['id']}{i:02d}.mp3")
            await tts(line, con["voice"], con["rate"], p)
            files.append(p)
        lst = os.path.join(d, "_list.txt")
        with open(lst, "w", encoding="utf-8") as f:
            for i, p in enumerate(files):
                f.write(f"file '{p}'\n")
                if i < len(files) - 1:
                    f.write(f"file '{SILENCE}'\n")
        full = os.path.join(d, f"完整旁白-{con['id']}.mp3")
        subprocess.run([FF, "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", full],
                       capture_output=True)
        print(f"[{con['id']}] {con['title']}  voice={con['voice']} rate={con['rate']}  full={dur(full):.1f}s")
        for i, p in enumerate(files, 1):
            print(f"    {con['id']}{i:02d}  {dur(p):5.1f}s  {con['lines'][i-1]}")
        os.remove(lst)


if __name__ == "__main__":
    asyncio.run(main())
