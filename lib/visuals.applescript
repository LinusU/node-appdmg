
tell application "Finder"

  set rootpath to POSIX file ("#{rootpath}" as string) as alias

  tell folder rootpath

    open

    delay 1 -- Sync

    tell container window
      set toolbar visible to false
      set statusbar visible to false
      set current view to icon view
      delay 1 -- Sync
      set the bounds to #{window.bounds}
      set statusbar visible to false
    end tell

    delay 1 -- Sync

    set background picture of the icon view options of container window to file "#{background.location}"

    set icon size of the icon view options of container window to #{icons.size}
    set arrangement of the icon view options of container window to not arranged

    set position of item "#{app.name}" to #{app.position}
    set position of item "#{alias.name}" to #{alias.position}

    close
    open

    update without registering applications
    delay 1 -- Sync

    set statusbar visible of the container window to false
    set the bounds of the container window to #{window.bounds}
    set background picture of the icon view options of container window to file "#{background.location}"
    update without registering applications

    delay 5 -- Sync

    close

  end tell

  delay 5 -- Sync

end tell
