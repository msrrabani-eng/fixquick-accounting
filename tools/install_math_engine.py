#!/usr/bin/env python3
"""Integrate the optional isolated native inference engine into generated Capacitor Android."""
from pathlib import Path
import shutil, re, subprocess
r=Path(__file__).resolve().parent.parent
app=r/'android/app'
source=r/'local-math'
java=app/'src/main/java/ir/fixquick/accounting'
for name in ['FqMathPlugin.java','FqMathService.java']:
    shutil.copy2(source/name,java/name)
activity=java/'MainActivity.java'
s=activity.read_text()
assert 'super.onCreate(' in s
s=s.replace('super.onCreate(', 'registerPlugin(FqMathPlugin.class);\n        super.onCreate(',1)
activity.write_text(s)
manifest=app/'src/main/AndroidManifest.xml'
s=manifest.read_text()
assert '</application>' in s
s=s.replace('</application>','<service android:name=".FqMathService" android:exported="false" android:process=":fqmath" />\n    </application>',1)
manifest.write_text(s)
cpp=app/'src/main/cpp'
cpp.mkdir(parents=True,exist_ok=True)
for name in ['CMakeLists.txt','engine.cpp']: shutil.copy2(source/name,cpp/name)
subprocess.run(['git','clone','--depth','1','--branch','b6500','https://github.com/ggml-org/llama.cpp.git',str(cpp/'llama')],check=True)
shutil.copy2(cpp/'llama/LICENSE',app/'src/main/assets/llama-LICENSE.txt')
g=app/'build.gradle'
s=g.read_text()
assert 'android {' in s and 'defaultConfig {' in s
s=s.replace('android {','android {\n    ndkVersion "27.2.12479018"\n    externalNativeBuild { cmake { path "src/main/cpp/CMakeLists.txt"; version "3.22.1" } }',1)
s=s.replace('defaultConfig {','defaultConfig {\n        ndk { abiFilters "arm64-v8a" }\n        externalNativeBuild { cmake { arguments "-DANDROID_STL=c++_static" } }',1)
g.write_text(s)
