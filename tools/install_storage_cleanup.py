#!/usr/bin/env python3
"""Install narrow migration for the retired download; no runtime plugin or extra permissions."""
from pathlib import Path
import re, shutil
root=Path(__file__).resolve().parent.parent
java=root/'android/app/src/main/java/ir/fixquick/accounting'
activity=java/'MainActivity.java'
s=activity.read_text()
if 'RetiredStorageCleanup.run(this)' not in s:
    if re.search(r'void\s+onCreate\s*\(',s):
        s,n=re.subn(r'(super\.onCreate\([^;]+\);)',r'\1\n        RetiredStorageCleanup.run(this);',s,count=1)
    else:
        s,n=re.subn(r'(class MainActivity extends BridgeActivity\s*\{)',r'\1\n    @Override public void onCreate(android.os.Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n        RetiredStorageCleanup.run(this);\n    }\n',s,count=1)
    assert n==1
    activity.write_text(s)
shutil.copy2(root/'migration/RetiredStorageCleanup.java',java/'RetiredStorageCleanup.java')
