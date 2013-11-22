
#import <Foundation/Foundation.h>
#import <CoreServices/CoreServices.h>

OSStatus setIconFlag(NSString *path);

int main(int argc, const char* argv[]) {

  OSStatus err;
  NSString *path;

  if (argc != 2) {
    fprintf(stderr, "usage: %s <path>\n", argv[0]);
    return 1;
  }

  path = [NSString stringWithUTF8String:argv[1]];
  err = setIconFlag(path);

  if (err != noErr) {
    NSError *error = [NSError errorWithDomain:NSOSStatusErrorDomain code:err userInfo:nil];
    fprintf(stderr, "%s\n", [[error localizedDescription] UTF8String]);
    return 2;
  }

  return 0;
}

OSStatus setIconFlag(NSString *path) {

  FSRef ref;
  OSStatus err;
  FSCatalogInfo info;

  err = FSPathMakeRef((const UInt8 *)[path fileSystemRepresentation], &ref, NULL);
  if (err != noErr) { return err; }

  err = FSGetCatalogInfo(&ref, kFSCatInfoFinderInfo, &info, NULL, NULL, NULL);
  if (err != noErr) { return err; }

  ((FileInfo*)&info.finderInfo)->finderFlags |= kHasCustomIcon;

  err = FSSetCatalogInfo(&ref, kFSCatInfoFinderInfo, &info);
  if (err != noErr) { return err; }

  return noErr;
}
