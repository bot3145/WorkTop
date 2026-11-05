; WorkTop Lite 安装器（NSIS / MUI2，Unicode）
; 用户级安装（默认 %LOCALAPPDATA%\Programs\WorkTop Lite，可自选目录，无需管理员）
; 数据目录固定在 %APPDATA%\WorkTopLite\data（卸载不删数据）
; 系统未检测到 Node.js 时，自动安装内置 Node 运行时（runtime\node.exe，v24.9.0）
Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

!define PRODUCT_NAME "WorkTop Lite"
!define PRODUCT_VERSION "2.6.3"
!define NODE_VERSION "v24.9.0"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\WorkTopLite"
!define PRODUCT_DATA_DIR "$APPDATA\WorkTopLite\data"

Name "${PRODUCT_NAME}"
OutFile "..\..\release\WorkTop-Lite_2.6.3_x64-setup.exe"
InstallDir "$LOCALAPPDATA\Programs\WorkTop Lite"
RequestExecutionLevel user
SetCompressor /SOLID lzma

VIProductVersion "2.6.3.0"
VIAddVersionKey /LANG=2052 "ProductName" "${PRODUCT_NAME}"
VIAddVersionKey /LANG=2052 "FileDescription" "${PRODUCT_NAME} 安装程序"
VIAddVersionKey /LANG=2052 "FileVersion" "${PRODUCT_VERSION}"
VIAddVersionKey /LANG=2052 "ProductVersion" "${PRODUCT_VERSION}"
VIAddVersionKey /LANG=2052 "LegalCopyright" "MIT License"

!define MUI_ICON "..\icon\icon.ico"
!define MUI_UNICON "..\icon\icon.ico"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\启动工作台.bat"
!define MUI_FINISHPAGE_RUN_TEXT "立即启动 WorkTop Lite"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

; Node 检测：注册表（HKLM/HKCU，64 位视图）→ PATH（where node）。
; 任一命中即认为系统已有 Node；命令行 /WITHNODE 可强制安装内置运行时。
Var InstallRuntime
Function .onInit
  StrCpy $InstallRuntime 0
  ${GetOptions} $CMDLINE "/WITHNODE" $R0
  ${If} ${Errors}
    SetRegView 64
    ClearErrors
    ReadRegStr $0 HKLM "SOFTWARE\Node.js" ""
    ${If} ${Errors}
      ClearErrors
      ReadRegStr $0 HKCU "SOFTWARE\Node.js" ""
      ${If} ${Errors}
        nsExec::ExecToStack 'cmd /c where node'
        Pop $0
        ${If} $0 != 0
          StrCpy $InstallRuntime 1
        ${EndIf}
      ${EndIf}
    ${EndIf}
    SetRegView lastused
  ${Else}
    StrCpy $InstallRuntime 1
  ${EndIf}
FunctionEnd

Section "Install"
  ${If} $InstallRuntime == 1
    MessageBox MB_ICONINFORMATION "未检测到 Node.js。$\n将同时安装内置 Node 运行时（${NODE_VERSION}），WorkTop Lite 将完全自包含。"
    SetOutPath "$INSTDIR\runtime"
    File "runtime\node.exe"
    File "/oname=runtime\NODE_LICENSE" "runtime\NODE_LICENSE"
  ${EndIf}

  SetOutPath "$INSTDIR"
  File /r "..\core"
  File /r "..\public"
  File /r "..\src"
  File /r "..\scripts"
  File /r "..\icon"
  File "..\server.mjs"
  File "..\package.json"
  File "..\README.md"
  File "..\README.zh-CN.md"
  File "..\LICENSE"
  File "/oname=启动工作台.bat" "start-worktop.bat"

  ; 数据目录（用户数据，卸载时保留）
  CreateDirectory "${PRODUCT_DATA_DIR}"

  ; 开始菜单 + 桌面快捷方式
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\启动工作台.lnk" "$INSTDIR\启动工作台.bat" "" "$INSTDIR\icon\icon.ico"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\卸载 WorkTop Lite.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortCut "$DESKTOP\WorkTop Lite.lnk" "$INSTDIR\启动工作台.bat" "" "$INSTDIR\icon\icon.ico"

  ; 卸载器 + 注册表（用户级）
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\icon\icon.ico"
  WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "Publisher" "WorkTop"
  WriteRegDWORD HKCU "${PRODUCT_UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${PRODUCT_UNINST_KEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  RMDir /r "$INSTDIR"
  RMDir "$INSTDIR"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\启动工作台.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\卸载 WorkTop Lite.lnk"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"
  Delete "$DESKTOP\WorkTop Lite.lnk"
  DeleteRegKey HKCU "${PRODUCT_UNINST_KEY}"
  MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 "是否同时删除你的数据（%APPDATA%\WorkTopLite）？" IDYES del_data
  Goto done
del_data:
  RMDir /r "$APPDATA\WorkTopLite"
done:
SectionEnd
