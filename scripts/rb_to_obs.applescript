-- Rekordbox -> now-playing.txt for OBS (ASCII safe)

set outFile to (POSIX path of (path to home folder)) & "now-playing.txt"
set rbXml to (POSIX path of (path to home folder)) & "rekordbox.xml"
set pyScript to (POSIX path of (path to home folder)) & "now-playing-control/scripts/rb_lookup_label.py"
set tabChar to ASCII character 9

set oldClipboard to the clipboard

tell application "rekordbox" to activate
delay 0.2

tell application "System Events"
	keystroke "c" using {command down}
end tell

delay 0.2
set clipText to (the clipboard as text)
set the clipboard to oldClipboard

set artistName to ""
set trackTitle to ""

if clipText contains tabChar then
	set AppleScript's text item delimiters to tabChar
	set parts to text items of clipText
	set AppleScript's text item delimiters to ""
	if (count of parts) >= 2 then
		set artistName to item 1 of parts
		set trackTitle to item 2 of parts
	else
		set trackTitle to clipText
	end if
else
	set trackTitle to clipText
end if

-- trim via python
try
	set artistName to do shell script "/usr/bin/python3 -c 'import sys;print(sys.argv[1].strip())' " & quoted form of artistName
end try

try
	set trackTitle to do shell script "/usr/bin/python3 -c 'import sys;print(sys.argv[1].strip())' " & quoted form of trackTitle
end try

-- label lookup via python
set labelName to ""
try
	set cmd to "RB_XML=" & quoted form of rbXml & " /usr/bin/python3 " & quoted form of pyScript & " " & quoted form of artistName & " " & quoted form of trackTitle
	set labelName to do shell script cmd
end try

try
	set labelName to do shell script "/usr/bin/python3 -c 'import sys;print(sys.argv[1].strip())' " & quoted form of labelName
end try

set finalLine to trackTitle
if artistName is not "" then set finalLine to artistName & " - " & trackTitle
if labelName is not "" then
	set finalLine to finalLine & " [" & labelName & "]"
else
	set finalLine to finalLine & " [Unreleased]"
end if

do shell script "/usr/bin/printf %s " & quoted form of finalLine & " > " & quoted form of outFile
return finalLine