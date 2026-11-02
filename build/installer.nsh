; Registers Weber with Windows as a web browser, so it appears in
; Settings > Apps > Default apps and can handle http/https links and web files.
; Windows 11 still lets only the user pick the default; this just makes Weber a choice.

!macro WeberApp PROGID
  WriteRegStr HKCU "Software\Classes\${PROGID}" "AppUserModelId" "com.weber.browser"
  WriteRegStr HKCU "Software\Classes\${PROGID}\Application" "AppUserModelId" "com.weber.browser"
  WriteRegStr HKCU "Software\Classes\${PROGID}\Application" "ApplicationName" "Weber"
  WriteRegStr HKCU "Software\Classes\${PROGID}\Application" "ApplicationIcon" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Classes\${PROGID}\Application" "ApplicationDescription" "Browse the web"
  WriteRegStr HKCU "Software\Classes\${PROGID}\Application" "ApplicationCompany" "Arjun"
!macroend

!macro customInstall
  ; the browser entry
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Weber" "" "Weber"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Weber\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Weber\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Weber\Capabilities" "ApplicationName" "Weber"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Weber\Capabilities" "ApplicationDescription" "A clean, fast web browser that J.A.R.V.I.S. can drive"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Weber\Capabilities" "ApplicationIcon" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Weber\Capabilities\StartMenu" "StartMenuInternet" "Weber"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Weber\Capabilities\URLAssociations" "http" "WeberURL"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Weber\Capabilities\URLAssociations" "https" "WeberURL"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Weber\Capabilities\FileAssociations" ".htm" "WeberHTML"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Weber\Capabilities\FileAssociations" ".html" "WeberHTML"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Weber\Capabilities\FileAssociations" ".xhtml" "WeberHTML"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Weber\Capabilities\FileAssociations" ".pdf" "WeberPDF"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Weber\Capabilities\FileAssociations" ".svg" "WeberHTML"
  WriteRegStr HKCU "Software\RegisteredApplications" "Weber" "Software\Clients\StartMenuInternet\Weber\Capabilities"

  ; what links and files open with
  WriteRegStr HKCU "Software\Classes\WeberURL" "" "Weber URL"
  WriteRegStr HKCU "Software\Classes\WeberURL" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\WeberURL\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Classes\WeberURL\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  WriteRegStr HKCU "Software\Classes\WeberHTML" "" "Weber web page"
  WriteRegStr HKCU "Software\Classes\WeberHTML\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Classes\WeberHTML\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  WriteRegStr HKCU "Software\Classes\WeberPDF" "" "Weber PDF document"
  WriteRegStr HKCU "Software\Classes\WeberPDF\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Classes\WeberPDF\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  ; offer Weber in "Open with" for these files too
  WriteRegStr HKCU "Software\Classes\.html\OpenWithProgids" "WeberHTML" ""
  WriteRegStr HKCU "Software\Classes\.htm\OpenWithProgids" "WeberHTML" ""
  WriteRegStr HKCU "Software\Classes\.pdf\OpenWithProgids" "WeberPDF" ""

  ; tie the handlers to the app (as Chrome and Opera do), and say where Weber.exe lives
  WriteRegDWORD HKCU "Software\Clients\StartMenuInternet\Weber\InstallInfo" "IconsVisible" 1
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\App Paths\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\App Paths\${APP_EXECUTABLE_FILENAME}" "Path" "$INSTDIR"
  !insertmacro WeberApp "WeberURL"
  !insertmacro WeberApp "WeberHTML"
  !insertmacro WeberApp "WeberPDF"

  ; tell Explorer the associations changed
  ; so Windows can match the program to its installed-apps entry
  WriteRegStr HKCU "${UNINSTALL_REGISTRY_KEY}" "InstallLocation" "$INSTDIR"

  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Clients\StartMenuInternet\Weber"
  DeleteRegValue HKCU "Software\RegisteredApplications" "Weber"
  DeleteRegKey HKCU "Software\Classes\WeberURL"
  DeleteRegKey HKCU "Software\Classes\WeberHTML"
  DeleteRegKey HKCU "Software\Classes\WeberPDF"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\App Paths\${APP_EXECUTABLE_FILENAME}"
  DeleteRegValue HKCU "Software\Classes\.html\OpenWithProgids" "WeberHTML"
  DeleteRegValue HKCU "Software\Classes\.htm\OpenWithProgids" "WeberHTML"
  DeleteRegValue HKCU "Software\Classes\.pdf\OpenWithProgids" "WeberPDF"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
