#!/usr/bin/env python3
from pathlib import Path
r=Path(__file__).resolve().parent.parent
android=r/'android/app/src/main/java/ir/fixquick/accounting'
android.mkdir(parents=True, exist_ok=True)
(android/'FastReceiptOCR.java').write_bytes((r/'native-android/FastReceiptOCR.java').read_bytes())
main=android/'MainActivity.java'
if not main.exists(): raise SystemExit('MainActivity.java not found at expected path: '+str(main))
s=main.read_text()
if 'registerPlugin(FastReceiptOCR.class)' not in s:
    # Cap 6 generated MainActivity is "public class MainActivity extends BridgeActivity {}"
    # Replace class with class registering plugin before Capacitor bridge initialization.
    import re
    s,n=re.subn(r'public class MainActivity extends BridgeActivity\s*\{[\s\S]*?\}',
      'public class MainActivity extends BridgeActivity {\n  @Override public void onCreate(android.os.Bundle state) {\n    registerPlugin(FastReceiptOCR.class);\n    super.onCreate(state);\n  }\n}',s,count=1)
    if n!=1: raise SystemExit('Unexpected MainActivity template')
    main.write_text(s)
gradle=r/'android/app/build.gradle'
s=gradle.read_text()
dep='    implementation "com.google.mlkit:text-recognition:16.0.1"'
if dep not in s:
    anchor='dependencies {'
    if anchor not in s: raise SystemExit('No dependencies block in android app build.gradle')
    s=s.replace(anchor,anchor+'\n'+dep,1)
    gradle.write_text(s)
print('Native ML Kit Latin OCR integrated')
