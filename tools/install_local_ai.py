#!/usr/bin/env python3
"""Prepare generated Capacitor Android project. Does not publish or sign anything."""
from pathlib import Path
import shutil, subprocess, re
ROOT=Path(__file__).resolve().parent.parent
APP=ROOT/'android/app'; SRC=ROOT/'native-ai'
java=APP/'src/main/java/ir/fixquick/accounting'; cpp=APP/'src/main/cpp/fq-ai'
java.mkdir(parents=True,exist_ok=True); cpp.mkdir(parents=True,exist_ok=True)
for name in ['CMakeLists.txt','bridge.cpp','unsupported.cpp']: shutil.copy2(SRC/name,cpp/name)
shutil.copy2(SRC/'LocalAIPlugin.java',java/'LocalAIPlugin.java')
# Pin the exact upstream source revision, not a mutable main branch.
commit='a7a98e0fffed794396b3fbad4dcdbbc184963645'
up=cpp/'llama.cpp'
if not up.exists():
    subprocess.run(['git','clone','--depth','1','--branch','b6500','https://github.com/ggml-org/llama.cpp.git',str(up)],check=True)
assert subprocess.check_output(['git','-C',str(up),'rev-parse','HEAD'],text=True).strip()==commit,'Unexpected llama.cpp revision'
(APP/'src/main/assets').mkdir(parents=True,exist_ok=True)
shutil.copy2(up/'LICENSE',APP/'src/main/assets/llama-cpp-LICENSE.txt')
activity=java/'MainActivity.java'; s=activity.read_text()
if 'registerPlugin(LocalAIPlugin.class)' not in s:
    if re.search(r'void\s+onCreate\s*\(',s):
        s,n=re.subn(r'(super\.onCreate\([^;]+\);)',r'registerPlugin(LocalAIPlugin.class);\n        \1',s,count=1); assert n==1
    else:
        s,n=re.subn(r'(class MainActivity extends BridgeActivity\s*\{)',r'\1\n    @Override public void onCreate(android.os.Bundle savedInstanceState) {\n        registerPlugin(LocalAIPlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n',s,count=1); assert n==1
    activity.write_text(s)
gradle=APP/'build.gradle'; s=gradle.read_text()
if 'src/main/cpp/fq-ai/CMakeLists.txt' not in s:
    # Native engine on ARM64; stub libraries keep basic accounting available on the other standard ABIs.
    s,n=re.subn(r'(^android\s*\{)',r'\1\n    ndkVersion "27.2.12479018"\n    externalNativeBuild { cmake { path "src/main/cpp/fq-ai/CMakeLists.txt"; version "3.22.1" } }',s,count=1,flags=re.M); assert n==1
    # Preserve installation for all standard Android ABIs.
    s,n=re.subn(r'(defaultConfig\s*\{)',r'\1\n        externalNativeBuild { cmake { abiFilters "arm64-v8a", "armeabi-v7a", "x86_64", "x86"; arguments "-DANDROID_STL=c++_static" } }',s,count=1); assert n==1
    gradle.write_text(s)
manifest=APP/'src/main/AndroidManifest.xml'; s=manifest.read_text()
if 'android.permission.RECORD_AUDIO' not in s:
    s=s.replace('<application','<uses-permission android:name="android.permission.RECORD_AUDIO" />\n    <uses-feature android:name="android.hardware.microphone" android:required="false" />\n    <application',1)
if 'android.speech.RecognitionService' not in s:
    if '<queries>' in s:s=s.replace('<queries>','<queries><intent><action android:name="android.speech.RecognitionService" /></intent><intent><action android:name="android.intent.action.TTS_SERVICE" /></intent>',1)
    else:s=s.replace('<application','<queries><intent><action android:name="android.speech.RecognitionService" /></intent><intent><action android:name="android.intent.action.TTS_SERVICE" /></intent></queries>\n    <application',1)
manifest.write_text(s)
print('Prepared optional ARM64 local AI integration using pinned llama.cpp',commit)
