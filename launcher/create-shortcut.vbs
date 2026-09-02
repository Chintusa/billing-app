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
shortcut.Description = "Smart Bill - Offline Billing & POS Software"
shortcut.IconLocation = "shell32.dll,138"
shortcut.Save
