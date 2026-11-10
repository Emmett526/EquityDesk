; Equity Desk Windows installer (NSIS 3). Per-user install, no admin rights needed.
; Build: makensis -DVERSION=1.0.0-beta.1 -DFILEVER=1.0.0.1 -DLABEL="Beta 1.0" -DSRC=<path to EquityDesk-win32-x64 folder> -DOUT=<output exe> EquityDesk.nsi
Unicode true
SetCompressor /SOLID lzma
!include "MUI2.nsh"
!include "LogicLib.nsh"
!ifndef VERSION
  !define VERSION "0.0.0"
!endif
!ifndef FILEVER
  !define FILEVER "0.0.0.0"   ; numeric form Windows needs for file properties
!endif
!ifndef LABEL
  !define LABEL "${VERSION}"   ; name shown to people, e.g. Beta 1.0
!endif
Name "Equity Desk ${LABEL}"
OutFile "${OUT}"
InstallDir "$LOCALAPPDATA\Programs\EquityDesk"
InstallDirRegKey HKCU "Software\EquityDesk" "InstallDir"
RequestExecutionLevel user
BrandingText "Equity Desk ${LABEL} · research only, no order entry"
VIProductVersion "${FILEVER}"
VIAddVersionKey "ProductName" "Equity Desk"
VIAddVersionKey "FileDescription" "Equity Desk installer"
VIAddVersionKey "FileVersion" "${FILEVER}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "CompanyName" "Emmett526"
VIAddVersionKey "LegalCopyright" "Copyright (c) 2026 Emmett526. Research tool, not financial advice."
!define UNKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\EquityDesk"

!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TEXT "This installs Equity Desk ${LABEL} (${VERSION}), a Bloomberg-style research terminal.$\r$\n$\r$\nIt is research only: the app never places orders.$\r$\n$\r$\nYour settings, keys and layouts in %APPDATA%\Equity Desk are kept when you update or uninstall."
!define MUI_COMPONENTSPAGE_SMALLDESC
!define MUI_FINISHPAGE_RUN "$INSTDIR\EquityDesk.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Start Equity Desk"
!define MUI_FINISHPAGE_TEXT "To download Gemma 4 or gpt-oss, open SET (Ctrl+8) > AI assistant, choose Gemma 4 / gpt-oss and press Download next to a model."
!insertmacro MUI_PAGE_WELCOME
!define MUI_LICENSEPAGE_TEXT_TOP "Personal, non-commercial use only. Research only: Equity Desk never places orders."
!insertmacro MUI_PAGE_LICENSE "${SRC}\LICENSE-EquityDesk.txt"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_SHOWREADME "$INSTDIR\README.txt"
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Open the README"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  ; close a running copy so its files can be replaced
  nsExec::Exec 'taskkill /IM EquityDesk.exe /T'
FunctionEnd

Section "Equity Desk (required)" SecApp
  SectionIn RO
  SetOutPath "$INSTDIR"
  RMDir /r "$INSTDIR\resources"          ; drop files from an older version
  File /r /x equity-desk-project "${SRC}\*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\Equity Desk"
  CreateShortcut "$SMPROGRAMS\Equity Desk\Equity Desk.lnk" "$INSTDIR\EquityDesk.exe"
  CreateShortcut "$SMPROGRAMS\Equity Desk\Uninstall Equity Desk.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$SMPROGRAMS\Equity Desk\README.lnk" "$INSTDIR\README.txt"
  CreateShortcut "$SMPROGRAMS\Equity Desk\Examples and guide.lnk" "$INSTDIR\Examples"
  WriteRegStr HKCU "Software\EquityDesk" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNKEY}" "DisplayName" "Equity Desk"
  WriteRegStr HKCU "${UNKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNKEY}" "Publisher" "Emmett526"
  WriteRegStr HKCU "${UNKEY}" "DisplayIcon" "$INSTDIR\EquityDesk.exe"
  WriteRegStr HKCU "${UNKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNKEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "${UNKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNKEY}" "NoRepair" 1
SectionEnd

Section "Desktop shortcut" SecDesk
  CreateShortcut "$DESKTOP\Equity Desk.lnk" "$INSTDIR\EquityDesk.exe"
SectionEnd

Section "Ollama for local AI (Gemma 4, gpt-oss)" SecOllama
  ${If} ${FileExists} "$LOCALAPPDATA\Programs\Ollama\ollama.exe"
    DetailPrint "Ollama is already installed."
  ${Else}
    DetailPrint "Downloading the Ollama installer from ollama.com…"
    nsExec::ExecToLog `powershell -NoProfile -ExecutionPolicy Bypass -Command "$$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing -Uri https://ollama.com/download/OllamaSetup.exe -OutFile '$TEMP\OllamaSetup.exe'"`
    Pop $0
    ${If} ${FileExists} "$TEMP\OllamaSetup.exe"
      DetailPrint "Starting the Ollama installer…"
      ExecWait '"$TEMP\OllamaSetup.exe"' $1
      Delete "$TEMP\OllamaSetup.exe"
    ${Else}
      DetailPrint "Could not download Ollama. You can install it later from SET > AI assistant."
    ${EndIf}
  ${EndIf}
SectionEnd

LangString DESC_App ${LANG_ENGLISH} "The app itself."
LangString DESC_Desk ${LANG_ENGLISH} "Put an Equity Desk icon on the desktop."
LangString DESC_Oll ${LANG_ENGLISH} "Download and install Ollama (free; a large download), which runs Gemma 4 and gpt-oss on this PC. Skipped if it is already installed. The models themselves are downloaded inside the app."
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecApp} $(DESC_App)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecDesk} $(DESC_Desk)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecOllama} $(DESC_Oll)
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Section "Uninstall"
  nsExec::Exec 'taskkill /IM EquityDesk.exe /T'
  Delete "$DESKTOP\Equity Desk.lnk"
  RMDir /r "$SMPROGRAMS\Equity Desk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNKEY}"
  DeleteRegKey HKCU "Software\EquityDesk"
  ; settings in %APPDATA%\Equity Desk and Ollama models are left in place on purpose
SectionEnd
