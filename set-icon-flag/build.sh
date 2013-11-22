
clang \
  -mmacosx-version-min=10.6 \
  -arch x86_64 -arch i386 \
  -o seticonflag \
  -framework Foundation \
  -framework CoreServices \
  ./set-icon-flag.m
