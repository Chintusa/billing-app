Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(currentDir)
If Not fso.FileExists(projectDir & "\Smart-Bill.bat") Then
    projectDir = currentDir
End If

desktopPath = WshShell.SpecialFolders("Desktop")
Set shortcut = WshShell.CreateShortcut(desktopPath & "\Smart Bill - Billing Software.lnk")
shortcut.TargetPath = projectDir & "\Smart-Bill.bat"
shortcut.WorkingDirectory = projectDir
iconPath = projectDir & "\assets\smart-bill.ico"
If Not fso.FileExists(iconPath) Then
    iconPath = projectDir & "\assets\icon.ico"
End If
If fso.FileExists(iconPath) Then
    shortcut.IconLocation = iconPath & ",0"
Else
    shortcut.IconLocation = "shell32.dll,138"
End If
shortcut.Save
