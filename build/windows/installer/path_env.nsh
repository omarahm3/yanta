; path_env.nsh — add/remove a directory on the *system* PATH (HKLM), for the
; machine-wide (admin) YANTA install. This is what lets external agents spawn
; `yanta` (and therefore `yanta mcp`) by bare name from any shell.
;
; A change broadcast (WM_WININICHANGE / "Environment") is sent so newly-launched
; processes pick up the change without a reboot.
;
; Safety:
;   - Skips if the directory is already present (no duplicate entries when the
;     user installs over an existing install).
;   - Skips (with a visible message) rather than writing a truncated value if
;     the current PATH is close to NSIS's max string length, so a long PATH can
;     never be silently corrupted.

!ifndef PATH_ENV_NSH
!define PATH_ENV_NSH

!include "LogicLib.nsh"
!include "WinMessages.nsh"

; System-wide environment block. ReadRegStr reads the raw value (does NOT expand
; %vars%), and WriteRegExpandStr writes it back as REG_EXPAND_SZ — together they
; preserve any %SystemRoot%-style entries already in PATH.
!define PATH_ENVIRON 'HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"'

; StrStr — caller pushes haystack then needle; leaves the remainder of haystack
; starting at the first match (or "" if not found) on the stack.
!macro _PathStrStr UN
Function ${UN}PathStrStr
  Exch $R1 ; needle
  Exch
  Exch $R2 ; haystack
  Push $R3
  Push $R4
  Push $R5
  StrLen $R3 $R1
  StrCpy $R4 0
  ${Do}
    StrCpy $R5 $R2 $R3 $R4
    ${If} $R5 == $R1
      ${ExitDo}
    ${EndIf}
    ${If} $R5 == ""
      ${ExitDo}
    ${EndIf}
    IntOp $R4 $R4 + 1
  ${Loop}
  StrCpy $R1 $R2 "" $R4
  Pop $R5
  Pop $R4
  Pop $R3
  Pop $R2
  Exch $R1
FunctionEnd
!macroend
!insertmacro _PathStrStr ""
!insertmacro _PathStrStr "un."

; PathAddToPath — caller pushes the directory to add to the system PATH.
Function PathAddToPath
  Exch $0 ; dir
  Push $1
  Push $2
  Push $3

  ReadRegStr $1 ${PATH_ENVIRON} "PATH"

  ; Already present? Wrap both sides in ";" so we match whole entries only.
  Push "$1;"
  Push "$0;"
  Call PathStrStr
  Pop $2
  ${If} $2 != ""
    DetailPrint "'$0' is already on PATH."
    Goto add_done
  ${EndIf}

  ; Truncation guard: existing + ";" + dir + NUL must fit NSIS_MAX_STRLEN.
  StrLen $2 $0
  StrLen $3 $1
  IntOp $2 $2 + $3
  IntOp $2 $2 + 2
  ${If} $2 >= ${NSIS_MAX_STRLEN}
    DetailPrint "PATH is too long to update automatically; add '$0' to PATH manually."
    Goto add_done
  ${EndIf}

  ${If} $1 == ""
    StrCpy $1 "$0"
  ${Else}
    StrCpy $1 "$1;$0"
  ${EndIf}
  WriteRegExpandStr ${PATH_ENVIRON} "PATH" "$1"
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
  DetailPrint "Added '$0' to the system PATH."

  add_done:
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

; un.PathRemoveFromPath — caller pushes the directory to remove from PATH.
Function un.PathRemoveFromPath
  Exch $0 ; dir
  Push $1
  Push $2
  Push $3
  Push $4
  Push $5

  ReadRegStr $1 ${PATH_ENVIRON} "PATH"

  ; Normalize with a trailing ";" so the entry always looks like "$0;".
  StrCpy $5 $1 1 -1
  ${If} $5 != ";"
    StrCpy $1 "$1;"
  ${EndIf}

  Push "$1"
  Push "$0;"
  Call un.PathStrStr
  Pop $2 ; remainder beginning at "$0;" (or "" if absent)
  ${If} $2 == ""
    Goto remove_done
  ${EndIf}

  StrLen $3 "$0;"    ; chunk to drop
  StrLen $4 $2       ; length of "$0;<rest>"
  StrCpy $5 $1 -$4   ; head: everything before our entry
  StrCpy $4 $2 "" $3 ; tail: everything after our entry
  StrCpy $1 "$5$4"

  ; Drop a trailing ";" left behind.
  StrCpy $5 $1 1 -1
  ${If} $5 == ";"
    StrCpy $1 $1 -1
  ${EndIf}

  WriteRegExpandStr ${PATH_ENVIRON} "PATH" "$1"
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
  DetailPrint "Removed '$0' from the system PATH."

  remove_done:
  Pop $5
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

!endif ; PATH_ENV_NSH
